const baseUrl = (process.env.PRODUCTION_BASE_URL ?? "https://revenue-agent-platform.haruki-ito0044.workers.dev").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 300_000);
const requestTimeoutMs = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 15_000);
const jobRequestTimeoutMs = Number(process.env.SMOKE_JOB_REQUEST_TIMEOUT_MS ?? 300_000);

async function main() {
  await checkHealth();
  await checkAdminUiAssets();
  await check("admin ui shell", `${baseUrl}/admin`, { expectedStatus: 200, expectedContentType: "text/html" });
  await check("admin ui settings deep link", `${baseUrl}/admin/seo-sales/settings`, { expectedStatus: 200, expectedContentType: "text/html" });
  await check("admin ui run detail deep link", `${baseUrl}/admin/seo-sales/runs/smoke-deep-link`, { expectedStatus: 200, expectedContentType: "text/html" });
  await check("admin api auth boundary", `${baseUrl}/api/admin/apps`, { expectedStatus: 401, expectedContentType: "application/json" });
  if (process.env.SMOKE_RUN_CRAWL_JOB === "true") {
    await checkManualCrawlJob();
  } else {
    console.log("manual crawl job: skipped (set SMOKE_RUN_CRAWL_JOB=true to enable)");
  }
  console.log(`Production smoke checks passed for ${baseUrl}`);
}

async function checkHealth() {
  const body = await getJsonWithRetry("health", `${baseUrl}/health`, {
    expectedStatus: 200,
    expectedContentType: "application/json",
  });
  if (body?.status !== "ok") {
    throw new Error(`health: expected status ok, got ${JSON.stringify(body)}`);
  }
  if (process.env.SMOKE_EXPECT_DURABLE_STORAGE !== "false" && body?.storage?.mode !== "durable-http") {
    throw new Error(`health: expected durable-http storage, got ${JSON.stringify(body?.storage)}`);
  }
  console.log(`health: 200 application/json storage=${body?.storage?.mode ?? "unknown"}`);
}

async function checkAdminUiAssets() {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile("dist-assets/admin/index.html", "utf8");
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((match) => match[1]);
  if (assetPaths.length === 0) {
    throw new Error("admin ui assets: no assets found in dist-assets/admin/index.html");
  }

  for (const assetPath of assetPaths) {
    const path = assetPath.startsWith("/") ? assetPath : `/admin/${assetPath.replace(/^\.\//, "")}`;
    await check(`admin ui asset ${path}`, `${baseUrl}${path}`, { expectedStatus: 200, expectedContentType: assetContentType(path) });
  }
}

async function checkManualCrawlJob() {
  const adminToken = process.env.SMOKE_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  if (!adminToken) {
    throw new Error("manual crawl job: SMOKE_ADMIN_TOKEN or ADMIN_TOKEN is required when SMOKE_RUN_CRAWL_JOB=true");
  }

  const targetUrl = process.env.SMOKE_CRAWL_TARGET_URL || "https://example.com";
  const response = await postJson("manual crawl job", adminUrl("/api/admin/seo-sales/runs", adminToken), {
    url: targetUrl,
  });

  assertRunPassed("manual crawl job", response.report);

  const detail = await getJsonWithRetry("manual crawl job detail", adminUrl(`/api/admin/seo-sales/runs/${encodeURIComponent(response.runId)}`, adminToken), {
    expectedStatus: 200,
    expectedContentType: "application/json",
  });
  assertRunPassed("manual crawl job detail", detail.run);
  console.log(`manual crawl job: passed runId=${response.runId} target=${targetUrl}`);
}

function assertRunPassed(name, run) {
  if (!run || run.status !== "passed") {
    throw new Error(`${name}: expected run status passed, got ${JSON.stringify(run?.status ?? null)}`);
  }

  const crawlStep = run.steps?.find((step) => step.name === "crawl_and_score");
  if (crawlStep?.status !== "passed") {
    throw new Error(`${name}: expected crawl_and_score passed, got ${JSON.stringify(crawlStep ?? null)}`);
  }
}

async function postJson(name, url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(jobRequestTimeoutMs),
  });
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${name}: expected JSON response, got ${res.status} ${contentType} ${text.slice(0, 500)}`);
  }

  if (res.status !== 201 || !contentType.includes("application/json")) {
    throw new Error(`${name}: expected 201 application/json, got ${res.status} ${contentType} ${JSON.stringify(json)}`);
  }
  return json;
}

function adminUrl(path, token) {
  const url = new URL(path, `${baseUrl}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

function assetContentType(path) {
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js")) return "javascript";
  return "";
}

async function check(name, url, expectation) {
  let lastError;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(requestTimeoutMs) });
      const contentType = res.headers.get("content-type") ?? "";
      if (res.status === expectation.expectedStatus && contentType.includes(expectation.expectedContentType)) {
        console.log(`${name}: ${res.status} ${contentType}`);
        return;
      }
      lastError = new Error(`${name}: expected ${expectation.expectedStatus} ${expectation.expectedContentType}, got ${res.status} ${contentType}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(3000);
  }
  throw lastError ?? new Error(`${name}: smoke check timed out`);
}

async function getJsonWithRetry(name, url, expectation) {
  let lastError;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(requestTimeoutMs) });
      const contentType = res.headers.get("content-type") ?? "";
      if (res.status === expectation.expectedStatus && contentType.includes(expectation.expectedContentType)) {
        return await res.json();
      }
      lastError = new Error(`${name}: expected ${expectation.expectedStatus} ${expectation.expectedContentType}, got ${res.status} ${contentType}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(3000);
  }
  throw lastError ?? new Error(`${name}: smoke check timed out`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
