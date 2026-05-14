import express, { Router } from "express";
import type { AgentRunDetail } from "../agent-runs/types.js";
import { getAgentRunDetail, listAgentRuns } from "../agent-runs/repository.js";
import { runRevenueAgent } from "../revenue-agent/runner.js";
import { applySideEffectPolicy, sideEffectPolicyReason, validateSafeTargetUrl } from "../revenue-agent/security.js";
import { isAdminAuthorized, isAdminTokenConfigured, renderAdminLogin } from "./auth.js";
import { businessApps, getBusinessApp } from "./business-apps.js";

export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  if (isAdminAuthorized(req, res)) {
    next();
    return;
  }

  if (isAdminTokenConfigured()) {
    res.status(401).send(renderPage("管理画面ログイン", renderAdminLogin(req.originalUrl), { compact: true }));
    return;
  }

  if (process.env.NODE_ENV === "production") {
    res
      .status(503)
      .send(renderPage("管理画面を利用できません", "<p>本番環境では <code>ADMIN_TOKEN</code> が必要です。</p>", { compact: true }));
    return;
  }

  next();
});

adminRouter.use(express.urlencoded({ extended: false }));

adminRouter.get("/", async (_req, res) => {
  res.send(renderPage("管理画面", renderPortal()));
});

adminRouter.get("/seo-sales", async (_req, res) => {
  const app = getBusinessApp("seo-sales");
  res.send(renderPage("SEO営業", renderSeoSalesHome(app)));
});

adminRouter.get("/seo-sales/runs", async (_req, res) => {
  const runs = await listAgentRuns(50);
  res.send(renderPage("SEO営業 実行ログ", renderDashboard(runs)));
});

adminRouter.get("/seo-sales/settings", (_req, res) => {
  res.send(renderPage("SEO営業 外部サービス設定", renderIntegrations()));
});

adminRouter.post("/seo-sales/runs", async (req, res) => {
  const url = typeof req.body.url === "string" ? req.body.url : "";
  const safeUrl = await validateSafeTargetUrl(url);
  if (!safeUrl.ok) {
    res
      .status(400)
      .send(renderPage("URLが無効です", `<p>${escapeHtml(safeUrl.error)}</p><p><a href="/admin/seo-sales/runs">戻る</a></p>`));
    return;
  }

  const report = await runManualRevenueAgent(safeUrl.url, {});
  res.redirect(`/admin/seo-sales/runs/${encodeURIComponent(report.id)}`);
});

adminRouter.post("/seo-sales/runs/:id/retry", async (req, res) => {
  const prior = await getAgentRunDetail(req.params.id);
  const targetUrl = typeof prior?.input.targetUrl === "string" ? prior.input.targetUrl : undefined;
  if (!targetUrl) {
    res.status(400).send(renderPage("再実行できません", "<p>元の実行に対象URLが含まれていません。</p>"));
    return;
  }

  const report = await runManualRevenueAgent(targetUrl, { retryOf: prior?.id });
  res.redirect(`/admin/seo-sales/runs/${encodeURIComponent(report.id)}`);
});

adminRouter.get("/seo-sales/runs/:id", async (req, res) => {
  const run = await getAgentRunDetail(req.params.id);
  if (!run) {
    res.status(404).send(renderPage("実行が見つかりません", "<p>指定された実行は見つかりません。</p>"));
    return;
  }

  res.send(renderPage(`実行詳細 ${run.id}`, renderRunDetail(run)));
});

adminRouter.get("/integrations", (_req, res) => {
  res.redirect(301, "/admin/seo-sales/settings");
});

adminRouter.post("/runs", (req, res) => {
  const query = typeof req.url === "string" && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(307, `/admin/seo-sales/runs${query}`);
});

adminRouter.get("/runs", (_req, res) => {
  res.redirect(301, "/admin/seo-sales/runs");
});

adminRouter.get("/runs/:id", (req, res) => {
  res.redirect(301, `/admin/seo-sales/runs/${encodeURIComponent(req.params.id)}`);
});

adminRouter.post("/runs/:id/retry", (req, res) => {
  res.redirect(307, `/admin/seo-sales/runs/${encodeURIComponent(req.params.id)}/retry`);
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

function renderPortal(): string {
  return `
    <section class="panel">
      <h2>業務アプリ</h2>
      <div class="app-grid">
        ${businessApps.map(renderBusinessAppCard).join("")}
      </div>
    </section>
  `;
}

function renderBusinessAppCard(app: (typeof businessApps)[number]): string {
  const links = app.primaryLinks.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("");
  return `
    <article class="app-card">
      <div class="section-header">
        <h3>${escapeHtml(app.name)}</h3>
        <span class="badge ${app.status === "active" ? "passed" : "skipped"}">${app.status === "active" ? "稼働中" : "準備中"}</span>
      </div>
      <p>${escapeHtml(app.description)}</p>
      <nav>${app.status === "active" ? `<a href="${escapeHtml(app.entryPath)}">開く</a>${links}` : "近日追加予定"}</nav>
    </article>
  `;
}

function renderSeoSalesHome(app = getBusinessApp("seo-sales")): string {
  if (!app) return "<p>SEO営業アプリが見つかりません。</p>";
  return `
    <section class="panel">
      <div class="section-header">
        <h2>${escapeHtml(app.name)}</h2>
        <a href="/admin">業務アプリ一覧</a>
      </div>
      <p>${escapeHtml(app.description)}</p>
      <div class="link-grid">
        ${app.primaryLinks.map((link) => `<a class="link-tile" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("")}
      </div>
    </section>
  `;
}

function renderDashboard(runs: Awaited<ReturnType<typeof listAgentRuns>>): string {
  return `
    <p><a href="/admin/seo-sales">SEO営業に戻る</a> · <a href="/admin">業務アプリ一覧</a></p>
    <section class="panel">
      <h2>手動実行</h2>
      <form method="post" action="/admin/seo-sales/runs" class="inline-form">
        <input name="url" type="url" placeholder="https://example.com" required />
        <button type="submit">RevenueAgentを実行</button>
      </form>
    </section>
    <section class="panel">
      <div class="section-header">
        <h2>最近の実行</h2>
        <nav><a href="/admin/seo-sales/sites">URL別結果</a><a href="/admin/seo-sales/settings">外部サービス設定</a></nav>
      </div>
      <table>
        <thead>
          <tr>
            <th>状態</th>
            <th>エージェント</th>
            <th>起点</th>
            <th>対象URL</th>
            <th>開始</th>
            <th>所要時間</th>
          </tr>
        </thead>
        <tbody>
          ${runs.map(renderRunRow).join("") || `<tr><td colspan="6">実行履歴はまだありません。</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function renderRunRow(run: Awaited<ReturnType<typeof listAgentRuns>>[number]): string {
  const target = stringValue(run.summary.targetUrl) || stringValue(run.input.targetUrl) || "-";
  return `
    <tr>
      <td><span class="badge ${escapeHtml(run.status)}">${escapeHtml(formatStatus(run.status))}</span></td>
      <td>${escapeHtml(run.agentType)}</td>
      <td>${escapeHtml(run.source)}</td>
      <td><a href="/admin/seo-sales/runs/${encodeURIComponent(run.id)}">${escapeHtml(target)}</a></td>
      <td>${formatDate(run.startedAt)}</td>
      <td>${formatDuration(run.startedAt, run.completedAt)}</td>
    </tr>
  `;
}

function renderRunDetail(run: AgentRunDetail) {
  return `
    <p><a href="/admin/seo-sales/runs">実行一覧に戻る</a> · <a href="/admin/seo-sales">SEO営業に戻る</a></p>
    <section class="panel">
      <div class="section-header">
        <h2>${escapeHtml(stringValue(run.summary.targetUrl) || stringValue(run.input.targetUrl) || run.id)}</h2>
        <form method="post" action="/admin/seo-sales/runs/${encodeURIComponent(run.id)}/retry">
          <button type="submit">再実行</button>
        </form>
      </div>
      <dl class="grid">
        <dt>状態</dt><dd><span class="badge ${escapeHtml(run.status)}">${escapeHtml(formatStatus(run.status))}</span></dd>
        <dt>エージェント</dt><dd>${escapeHtml(run.agentType)}</dd>
        <dt>起点</dt><dd>${escapeHtml(formatSource(run.source))}</dd>
        <dt>開始</dt><dd>${formatDate(run.startedAt)}</dd>
        <dt>完了</dt><dd>${run.completedAt ? formatDate(run.completedAt) : "-"}</dd>
        <dt>所要時間</dt><dd>${formatDuration(run.startedAt, run.completedAt)}</dd>
        <dt>ドメイン</dt><dd>${escapeHtml(stringValue(run.summary.domain) || "-")}</dd>
        <dt>SEOスコア</dt><dd>${escapeHtml(stringValue(run.summary.seoScore) || "-")}</dd>
      </dl>
      ${run.error ? `<p class="error">${escapeHtml(run.error)}</p>` : ""}
    </section>
    <section class="panel">
      <h2>処理ステップ</h2>
      <table>
        <thead><tr><th>状態</th><th>名前</th><th>所要時間</th><th>理由 / エラー</th></tr></thead>
        <tbody>
          ${run.steps
            .map(
              (step) => `
                <tr>
                  <td><span class="badge ${escapeHtml(step.status)}">${escapeHtml(formatStatus(step.status))}</span></td>
                  <td>${escapeHtml(formatStepName(step.name))}</td>
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
      <h2>成果物</h2>
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
          .join("") || "<p>成果物は記録されていません。</p>"
      }
    </section>
    <section class="panel">
      <h2>詳細データ</h2>
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
    ["Telegram chat許可リスト", "TELEGRAM_CHAT_ID"],
    ["Telegram webhook secret", "TELEGRAM_WEBHOOK_SECRET"],
    ["Stripe", "STRIPE_SECRET_KEY"],
    ["管理トークン", "ADMIN_TOKEN"],
  ];
  const policies = [
    ["メール送信", process.env.REVENUE_AGENT_ALLOW_EMAIL === "true"],
    ["Telegram通知", process.env.REVENUE_AGENT_ALLOW_TELEGRAM === "true"],
    ["決済リンク作成", process.env.REVENUE_AGENT_ALLOW_PAYMENT_LINK === "true"],
  ];
  return `
    <p><a href="/admin/seo-sales">SEO営業に戻る</a> · <a href="/admin/seo-sales/runs">実行一覧に戻る</a></p>
    <section class="panel">
      <h2>外部サービス設定</h2>
      <table>
        <tbody>
          ${integrations
            .map(([label, key]) => `<tr><th>${escapeHtml(label)}</th><td>${configuredBadge(Boolean(process.env[key]))}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </section>
    <section class="panel">
      <h2>副作用の許可設定</h2>
      <table>
        <tbody>
          ${policies.map(([label, enabled]) => `<tr><th>${escapeHtml(String(label))}</th><td>${configuredBadge(Boolean(enabled), "enabled", "disabled")}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function configuredBadge(value: boolean, yes = "設定済み", no = "未設定"): string {
  return `<span class="badge ${value ? "passed" : "skipped"}">${value ? yes : no}</span>`;
}

function renderPage(title: string, body: string, options: { compact?: boolean } = {}): string {
  return `<!doctype html>
    <html lang="ja">
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
          .app-grid, .link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
          .app-card, .link-tile { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fff; }
          .app-card p { color: var(--muted); margin: 8px 0 14px; }
          .link-tile { display: block; font-weight: 700; }
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

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    running: "実行中",
    passed: "成功",
    failed: "失敗",
    skipped: "スキップ",
  };
  return labels[status] ?? status;
}

function formatSource(source: string): string {
  const labels: Record<string, string> = {
    api: "API",
    telegram: "Telegram",
    manual: "手動",
  };
  return labels[source] ?? source;
}

function formatStepName(name: string): string {
  const labels: Record<string, string> = {
    crawl_and_score: "クロール・SEO採点",
    generate_proposal: "提案書生成",
    sendgrid_email: "メール送信",
    telegram_notification: "Telegram通知",
    stripe_payment_link: "決済リンク作成",
  };
  return labels[name] ?? name;
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
