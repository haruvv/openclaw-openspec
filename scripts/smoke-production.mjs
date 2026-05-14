import { readFile } from "node:fs/promises";

const baseUrl = (process.env.PRODUCTION_BASE_URL ?? "https://revenue-agent-platform.haruki-ito0044.workers.dev").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 60_000);

async function main() {
  const cssPath = await readBuiltCssPath();
  await checkHealth();
  await check("admin auth boundary", `${baseUrl}/admin`, { expectedStatus: 401, expectedContentType: "text/html" });
  await check("admin css asset", `${baseUrl}${cssPath}`, { expectedStatus: 200, expectedContentType: "text/css" });
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

async function readBuiltCssPath() {
  const html = await readFile("dist/admin-ui/index.html", "utf8");
  const match = html.match(/href="([^"]+\.css)"/);
  if (!match?.[1]) throw new Error("Could not find built admin CSS asset in dist/admin-ui/index.html");
  return match[1];
}

async function check(name, url, expectation) {
  let lastError;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "HEAD" });
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
      const res = await fetch(url, { method: "GET" });
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
