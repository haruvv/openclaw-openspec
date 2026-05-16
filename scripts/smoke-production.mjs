const baseUrl = (process.env.PRODUCTION_BASE_URL ?? "https://revenue-agent-platform.haruki-ito0044.workers.dev").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 300_000);
const requestTimeoutMs = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 15_000);
const jobRequestTimeoutMs = Number(process.env.SMOKE_JOB_REQUEST_TIMEOUT_MS ?? 300_000);

async function main() {
  await checkHealth();
  await checkAdminUiAssets();
  await check("admin ui shell", `${baseUrl}/admin`, { expectedStatus: 200, expectedContentType: "text/html", headers: accessHeaders() });
  await check("admin ui settings deep link", `${baseUrl}/admin/seo-sales/settings`, { expectedStatus: 200, expectedContentType: "text/html", headers: accessHeaders() });
  await check("admin ui run detail deep link", `${baseUrl}/admin/seo-sales/runs/smoke-deep-link`, { expectedStatus: 200, expectedContentType: "text/html", headers: accessHeaders() });
  await check("admin api auth boundary", `${baseUrl}/api/admin/apps`, { expectedStatuses: [401, 403], expectedContentType: "" });
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
  const html = await getTextWithRetry("admin ui html", `${baseUrl}/admin`, {
    expectedStatus: 200,
    expectedContentType: "text/html",
    headers: accessHeaders(),
  });
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((match) => match[1]);
  if (assetPaths.length === 0) throw new Error("admin ui assets: no assets found in production admin HTML");

  for (const assetPath of assetPaths) {
    const path = assetPath.startsWith("/") ? assetPath : `/admin/${assetPath.replace(/^\.\//, "")}`;
    await check(`admin ui asset ${path}`, `${baseUrl}${path}`, { expectedStatus: 200, expectedContentType: assetContentType(path), headers: accessHeaders() });
  }
}

async function checkManualCrawlJob() {
  const headers = accessHeaders();
  if (!headers["CF-Access-Client-Id"] || !headers["CF-Access-Client-Secret"]) {
    throw new Error("manual crawl job: SMOKE_CF_ACCESS_CLIENT_ID and SMOKE_CF_ACCESS_CLIENT_SECRET are required when SMOKE_RUN_CRAWL_JOB=true");
  }

  const targetUrl = process.env.SMOKE_CRAWL_TARGET_URL || "https://example.com";
  const response = await postJson("manual crawl job", adminUrl("/api/admin/seo-sales/runs"), {
    url: targetUrl,
  }, headers);

  assertRunPassed("manual crawl job", response.report);

  const detail = await getJsonWithRetry("manual crawl job detail", adminUrl(`/api/admin/seo-sales/runs/${encodeURIComponent(response.runId)}`), {
    expectedStatus: 200,
    expectedContentType: "application/json",
    headers,
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

async function postJson(name, url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
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

function adminUrl(path) {
  return new URL(path, `${baseUrl}/`).toString();
}

function accessHeaders() {
  const clientId = process.env.SMOKE_CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.SMOKE_CF_ACCESS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
  };
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
      const res = await fetch(url, { method: "HEAD", headers: expectation.headers ?? {}, signal: AbortSignal.timeout(requestTimeoutMs) });
      const contentType = res.headers.get("content-type") ?? "";
      const statuses = expectation.expectedStatuses ?? [expectation.expectedStatus];
      if (statuses.includes(res.status) && contentType.includes(expectation.expectedContentType)) {
        console.log(`${name}: ${res.status} ${contentType}`);
        return;
      }
      lastError = new Error(`${name}: expected ${statuses.join("/")} ${expectation.expectedContentType}, got ${res.status} ${contentType}`);
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
      const res = await fetch(url, { method: "GET", headers: expectation.headers ?? {}, signal: AbortSignal.timeout(requestTimeoutMs) });
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

async function getTextWithRetry(name, url, expectation) {
  let lastError;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET", headers: expectation.headers ?? {}, signal: AbortSignal.timeout(requestTimeoutMs) });
      const contentType = res.headers.get("content-type") ?? "";
      if (res.status === expectation.expectedStatus && contentType.includes(expectation.expectedContentType)) {
        return await res.text();
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
