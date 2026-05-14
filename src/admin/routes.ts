import express, { Router } from "express";
import type { AgentRunDetail } from "../agent-runs/types.js";
import { getAgentRunDetail, listAgentRuns } from "../agent-runs/repository.js";
import { runRevenueAgent } from "../revenue-agent/runner.js";
import { applySideEffectPolicy, sideEffectPolicyReason, validateSafeTargetUrl } from "../revenue-agent/security.js";
import { isAdminAuthorized, isAdminTokenConfigured, renderAdminLogin } from "./auth.js";

export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  if (isAdminAuthorized(req, res)) {
    next();
    return;
  }

  if (isAdminTokenConfigured()) {
    res.status(401).send(renderPage("Admin Login", renderAdminLogin(req.originalUrl), { compact: true }));
    return;
  }

  if (process.env.NODE_ENV === "production") {
    res
      .status(503)
      .send(renderPage("Admin Unavailable", "<p><code>ADMIN_TOKEN</code> is required in production.</p>", { compact: true }));
    return;
  }

  next();
});

adminRouter.use(express.urlencoded({ extended: false }));

adminRouter.get("/", async (_req, res) => {
  const runs = await listAgentRuns(50);
  res.send(renderPage("Agent Operations", renderDashboard(runs)));
});

adminRouter.get("/integrations", (_req, res) => {
  res.send(renderPage("Integrations", renderIntegrations()));
});

adminRouter.post("/runs", async (req, res) => {
  const url = typeof req.body.url === "string" ? req.body.url : "";
  const safeUrl = await validateSafeTargetUrl(url);
  if (!safeUrl.ok) {
    res.status(400).send(renderPage("Invalid URL", `<p>${escapeHtml(safeUrl.error)}</p><p><a href="/admin">Back</a></p>`));
    return;
  }

  const report = await runManualRevenueAgent(safeUrl.url, {});
  res.redirect(`/admin/runs/${encodeURIComponent(report.id)}`);
});

adminRouter.post("/runs/:id/retry", async (req, res) => {
  const prior = await getAgentRunDetail(req.params.id);
  const targetUrl = typeof prior?.input.targetUrl === "string" ? prior.input.targetUrl : undefined;
  if (!targetUrl) {
    res.status(400).send(renderPage("Retry Failed", "<p>Original run does not include a target URL.</p>"));
    return;
  }

  const report = await runManualRevenueAgent(targetUrl, { retryOf: prior?.id });
  res.redirect(`/admin/runs/${encodeURIComponent(report.id)}`);
});

adminRouter.get("/runs/:id", async (req, res) => {
  const run = await getAgentRunDetail(req.params.id);
  if (!run) {
    res.status(404).send(renderPage("Run Not Found", "<p>Run not found.</p>"));
    return;
  }

  res.send(renderPage(`Run ${run.id}`, renderRunDetail(run)));
});

async function runManualRevenueAgent(targetUrl: string, metadata: Record<string, unknown>) {
  const requested = { sendEmail: false, sendTelegram: false, createPaymentLink: false };
  const allowed = applySideEffectPolicy(requested);
  return runRevenueAgent({
    targetUrl,
    source: "manual",
    metadata,
    sendEmail: allowed.sendEmail,
    sendTelegram: allowed.sendTelegram,
    createPaymentLink: allowed.createPaymentLink,
    sideEffectSkipReasons: {
      sendEmail: sideEffectPolicyReason("sendEmail"),
      sendTelegram: sideEffectPolicyReason("sendTelegram"),
      createPaymentLink: sideEffectPolicyReason("createPaymentLink"),
    },
  });
}

function renderDashboard(runs: Awaited<ReturnType<typeof listAgentRuns>>): string {
  return `
    <section class="panel">
      <h2>Manual Run</h2>
      <form method="post" action="/admin/runs" class="inline-form">
        <input name="url" type="url" placeholder="https://example.com" required />
        <button type="submit">Run RevenueAgent</button>
      </form>
    </section>
    <section class="panel">
      <div class="section-header">
        <h2>Recent Runs</h2>
        <nav><a href="/sites">Sites</a><a href="/admin/integrations">Integrations</a></nav>
      </div>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Agent</th>
            <th>Source</th>
            <th>Target</th>
            <th>Started</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${runs.map(renderRunRow).join("") || `<tr><td colspan="6">No runs recorded yet.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function renderRunRow(run: Awaited<ReturnType<typeof listAgentRuns>>[number]): string {
  const target = stringValue(run.summary.targetUrl) || stringValue(run.input.targetUrl) || "-";
  return `
    <tr>
      <td><span class="badge ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span></td>
      <td>${escapeHtml(run.agentType)}</td>
      <td>${escapeHtml(run.source)}</td>
      <td><a href="/admin/runs/${encodeURIComponent(run.id)}">${escapeHtml(target)}</a></td>
      <td>${formatDate(run.startedAt)}</td>
      <td>${formatDuration(run.startedAt, run.completedAt)}</td>
    </tr>
  `;
}

function renderRunDetail(run: AgentRunDetail) {
  return `
    <p><a href="/admin">Back to runs</a></p>
    <section class="panel">
      <div class="section-header">
        <h2>${escapeHtml(stringValue(run.summary.targetUrl) || stringValue(run.input.targetUrl) || run.id)}</h2>
        <form method="post" action="/admin/runs/${encodeURIComponent(run.id)}/retry">
          <button type="submit">Retry</button>
        </form>
      </div>
      <dl class="grid">
        <dt>Status</dt><dd><span class="badge ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span></dd>
        <dt>Agent</dt><dd>${escapeHtml(run.agentType)}</dd>
        <dt>Source</dt><dd>${escapeHtml(run.source)}</dd>
        <dt>Started</dt><dd>${formatDate(run.startedAt)}</dd>
        <dt>Completed</dt><dd>${run.completedAt ? formatDate(run.completedAt) : "-"}</dd>
        <dt>Duration</dt><dd>${formatDuration(run.startedAt, run.completedAt)}</dd>
        <dt>Domain</dt><dd>${escapeHtml(stringValue(run.summary.domain) || "-")}</dd>
        <dt>SEO score</dt><dd>${escapeHtml(stringValue(run.summary.seoScore) || "-")}</dd>
      </dl>
      ${run.error ? `<p class="error">${escapeHtml(run.error)}</p>` : ""}
    </section>
    <section class="panel">
      <h2>Steps</h2>
      <table>
        <thead><tr><th>Status</th><th>Name</th><th>Duration</th><th>Reason / Error</th></tr></thead>
        <tbody>
          ${run.steps
            .map(
              (step) => `
                <tr>
                  <td><span class="badge ${escapeHtml(step.status)}">${escapeHtml(step.status)}</span></td>
                  <td>${escapeHtml(step.name)}</td>
                  <td>${step.durationMs} ms</td>
                  <td>${escapeHtml(step.error ?? step.reason ?? "")}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Artifacts</h2>
      ${
        run.artifacts
          .map(
            (artifact) => `
              <article class="artifact">
                <h3>${escapeHtml(artifact.label)}</h3>
                ${artifact.pathOrUrl ? `<p><code>${escapeHtml(artifact.pathOrUrl)}</code></p>` : ""}
                ${artifact.contentText ? `<pre>${escapeHtml(artifact.contentText)}</pre>` : ""}
              </article>
            `,
          )
          .join("") || "<p>No artifacts recorded.</p>"
      }
    </section>
    <section class="panel">
      <h2>Raw Metadata</h2>
      <pre>${escapeHtml(JSON.stringify({ input: run.input, summary: run.summary, metadata: run.metadata }, null, 2))}</pre>
    </section>
  `;
}

function renderIntegrations(): string {
  const integrations = [
    ["Firecrawl", "FIRECRAWL_API_KEY"],
    ["Gemini", "GEMINI_API_KEY"],
    ["Z.ai", "ZAI_API_KEY"],
    ["SendGrid", "SENDGRID_API_KEY"],
    ["Telegram bot", "TELEGRAM_BOT_TOKEN"],
    ["Telegram chat allowlist", "TELEGRAM_CHAT_ID"],
    ["Telegram webhook secret", "TELEGRAM_WEBHOOK_SECRET"],
    ["Stripe", "STRIPE_SECRET_KEY"],
    ["Admin token", "ADMIN_TOKEN"],
  ];
  const policies = [
    ["Email side effects", process.env.REVENUE_AGENT_ALLOW_EMAIL === "true"],
    ["Telegram side effects", process.env.REVENUE_AGENT_ALLOW_TELEGRAM === "true"],
    ["Payment link side effects", process.env.REVENUE_AGENT_ALLOW_PAYMENT_LINK === "true"],
  ];
  return `
    <p><a href="/admin">Back to runs</a></p>
    <section class="panel">
      <h2>Provider Configuration</h2>
      <table>
        <tbody>
          ${integrations
            .map(([label, key]) => `<tr><th>${escapeHtml(label)}</th><td>${configuredBadge(Boolean(process.env[key]))}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Side Effect Policy</h2>
      <table>
        <tbody>
          ${policies.map(([label, enabled]) => `<tr><th>${escapeHtml(String(label))}</th><td>${configuredBadge(Boolean(enabled), "enabled", "disabled")}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function configuredBadge(value: boolean, yes = "configured", no = "missing"): string {
  return `<span class="badge ${value ? "passed" : "skipped"}">${value ? yes : no}</span>`;
}

function renderPage(title: string, body: string, options: { compact?: boolean } = {}): string {
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root { color-scheme: light; --bg: #f6f7f9; --panel: #fff; --text: #1f2937; --muted: #667085; --line: #d9dee7; --accent: #166534; --error: #b42318; }
          body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          header { background: #0f172a; color: white; padding: 18px 24px; }
          header h1 { margin: 0; font-size: 20px; letter-spacing: 0; }
          main { max-width: ${options.compact ? "520px" : "1180px"}; margin: 24px auto; padding: 0 18px 32px; }
          a { color: #175cd3; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; margin-bottom: 18px; }
          .section-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
          nav { display: inline-flex; gap: 14px; align-items: center; }
          h2 { margin: 0 0 14px; font-size: 16px; letter-spacing: 0; }
          h3 { margin: 0 0 8px; font-size: 14px; letter-spacing: 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; vertical-align: top; }
          th { color: var(--muted); font-weight: 600; }
          input { min-width: 280px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
          button { padding: 9px 12px; border: 1px solid #0b5; border-radius: 6px; background: var(--accent); color: white; font: inherit; cursor: pointer; }
          .inline-form { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
          .badge { display: inline-flex; align-items: center; min-width: 68px; justify-content: center; border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 700; }
          .passed { background: #dcfae6; color: #067647; }
          .failed { background: #fee4e2; color: #b42318; }
          .skipped, .running { background: #eef2f6; color: #475467; }
          .grid { display: grid; grid-template-columns: 160px 1fr; gap: 8px 16px; }
          .grid dt { color: var(--muted); font-weight: 600; }
          .grid dd { margin: 0; }
          pre { max-height: 520px; overflow: auto; background: #111827; color: #f9fafb; border-radius: 8px; padding: 14px; white-space: pre-wrap; }
          code { background: #eef2f6; padding: 2px 5px; border-radius: 4px; }
          .error { color: var(--error); font-weight: 600; }
        </style>
      </head>
      <body>
        <header><h1>${escapeHtml(title)}</h1></header>
        <main>${body}</main>
      </body>
    </html>`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return "-";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
