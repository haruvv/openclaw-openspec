import { Router } from "express";
import type { SiteDetail, SiteRecord, SiteSnapshotRecord } from "./types.js";
import { getSiteDetail, listSites } from "./repository.js";
import { isAdminAuthorized, isAdminTokenConfigured, renderAdminLogin } from "../admin/auth.js";

export const sitesRouter = Router();

sitesRouter.use((req, res, next) => {
  if (isAdminAuthorized(req, res)) {
    next();
    return;
  }

  if (isAdminTokenConfigured()) {
    res.status(401).send(renderPage("URL別結果ログイン", renderAdminLogin(req.originalUrl), { compact: true }));
    return;
  }

  if (process.env.NODE_ENV === "production") {
    res
      .status(503)
      .send(renderPage("URL別結果を利用できません", "<p>本番環境では <code>ADMIN_TOKEN</code> が必要です。</p>", { compact: true }));
    return;
  }

  next();
});

sitesRouter.get("/", async (_req, res) => {
  const sites = await listSites(100);
  res.send(renderPage("URL別結果", renderSiteList(sites)));
});

sitesRouter.get("/:id", async (req, res) => {
  const site = await getSiteDetail(req.params.id);
  if (!site) {
    res
      .status(404)
      .send(renderPage("結果が見つかりません", `<p>指定されたURL別結果は見つかりません。</p><p><a href="/admin/seo-sales/sites">一覧に戻る</a></p>`));
    return;
  }

  res.send(renderPage(site.domain, renderSiteDetail(site)));
});

function renderSiteList(sites: SiteRecord[]): string {
  return `
    <section class="panel">
      <div class="section-header">
        <h2>解析済みURL</h2>
        <nav><a href="/admin/seo-sales">SEO営業</a><a href="/admin/seo-sales/runs">実行ログ</a><a href="/admin/seo-sales/settings">外部サービス設定</a></nav>
      </div>
      <table>
        <thead>
          <tr>
            <th>状態</th>
            <th>URL</th>
            <th>ドメイン</th>
            <th>SEOスコア</th>
            <th>更新</th>
            <th>実行ログ</th>
          </tr>
        </thead>
        <tbody>
          ${sites.map(renderSiteRow).join("") || `<tr><td colspan="6">URL別結果はまだありません。</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function renderSiteRow(site: SiteRecord): string {
  return `
    <tr>
      <td><span class="badge ${escapeHtml(site.latestStatus)}">${escapeHtml(formatStatus(site.latestStatus))}</span></td>
      <td><a href="/admin/seo-sales/sites/${encodeURIComponent(site.id)}">${escapeHtml(site.displayUrl)}</a></td>
      <td>${escapeHtml(site.domain)}</td>
      <td>${formatScore(site.latestSeoScore)}</td>
      <td>${formatDate(site.updatedAt)}</td>
      <td>${site.latestRunId ? `<a href="/admin/seo-sales/runs/${encodeURIComponent(site.latestRunId)}">開く</a>` : "-"}</td>
    </tr>
  `;
}

function renderSiteDetail(site: SiteDetail): string {
  const latestSnapshot = site.snapshots[0];
  const latestProposal = site.proposals[0];
  return `
    <p><a href="/admin/seo-sales/sites">一覧に戻る</a> · <a href="/admin/seo-sales">SEO営業</a></p>
    <section class="panel">
      <div class="section-header">
        <h2>${escapeHtml(site.displayUrl)}</h2>
        ${site.latestRunId ? `<a href="/admin/seo-sales/runs/${encodeURIComponent(site.latestRunId)}">最新の実行ログを開く</a>` : ""}
      </div>
      <dl class="grid">
        <dt>状態</dt><dd><span class="badge ${escapeHtml(site.latestStatus)}">${escapeHtml(formatStatus(site.latestStatus))}</span></dd>
        <dt>ドメイン</dt><dd>${escapeHtml(site.domain)}</dd>
        <dt>SEOスコア</dt><dd>${formatScore(site.latestSeoScore)}</dd>
        <dt>正規化URL</dt><dd><code>${escapeHtml(site.normalizedUrl)}</code></dd>
        <dt>更新</dt><dd>${formatDate(site.updatedAt)}</dd>
      </dl>
    </section>
    <section class="panel">
      <h2>最新の解析結果</h2>
      ${latestSnapshot ? renderSnapshotSummary(latestSnapshot) : "<p>解析結果は記録されていません。</p>"}
    </section>
    <section class="panel">
      <h2>最新の提案書</h2>
      ${
        latestProposal
          ? `
            ${latestProposal.pathOrUrl ? `<p><code>${escapeHtml(latestProposal.pathOrUrl)}</code></p>` : ""}
            ${latestProposal.contentText ? `<pre>${escapeHtml(latestProposal.contentText)}</pre>` : "<p>提案書の本文は記録されていません。</p>"}
          `
          : "<p>提案書はまだ生成されていません。</p>"
      }
    </section>
    <section class="panel">
      <h2>履歴</h2>
      <table>
        <thead><tr><th>状態</th><th>SEOスコア</th><th>作成</th><th>診断項目</th><th>実行ログ</th></tr></thead>
        <tbody>
          ${site.snapshots.map(renderSnapshotRow).join("") || `<tr><td colspan="5">履歴はありません。</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function renderSnapshotSummary(snapshot: SiteSnapshotRecord): string {
  return `
    <dl class="grid">
      <dt>状態</dt><dd><span class="badge ${escapeHtml(snapshot.status)}">${escapeHtml(formatStatus(snapshot.status))}</span></dd>
      <dt>SEOスコア</dt><dd>${formatScore(snapshot.seoScore)}</dd>
      <dt>診断項目</dt><dd>${snapshot.diagnostics.length}</dd>
      <dt>作成</dt><dd>${formatDate(snapshot.createdAt)}</dd>
    </dl>
    <pre>${escapeHtml(JSON.stringify(snapshot.summary, null, 2))}</pre>
  `;
}

function renderSnapshotRow(snapshot: SiteSnapshotRecord): string {
  return `
    <tr>
      <td><span class="badge ${escapeHtml(snapshot.status)}">${escapeHtml(formatStatus(snapshot.status))}</span></td>
      <td>${formatScore(snapshot.seoScore)}</td>
      <td>${formatDate(snapshot.createdAt)}</td>
      <td>${snapshot.diagnostics.length}</td>
      <td>${snapshot.runId ? `<a href="/admin/seo-sales/runs/${encodeURIComponent(snapshot.runId)}">開く</a>` : "-"}</td>
    </tr>
  `;
}

function renderPage(title: string, body: string, options: { compact?: boolean } = {}): string {
  return `<!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root { color-scheme: light; --bg: #f6f7f9; --panel: #fff; --text: #1f2937; --muted: #667085; --line: #d9dee7; --accent: #175cd3; --error: #b42318; }
          body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          header { background: #111827; color: white; padding: 18px 24px; }
          header h1 { margin: 0; font-size: 20px; letter-spacing: 0; }
          main { max-width: ${options.compact ? "520px" : "1180px"}; margin: 24px auto; padding: 0 18px 32px; }
          a { color: #175cd3; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; margin-bottom: 18px; }
          .section-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
          nav { display: inline-flex; gap: 14px; align-items: center; }
          h2 { margin: 0 0 14px; font-size: 16px; letter-spacing: 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; vertical-align: top; }
          th { color: var(--muted); font-weight: 600; }
          input { min-width: 280px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
          button { padding: 9px 12px; border: 1px solid #175cd3; border-radius: 6px; background: var(--accent); color: white; font: inherit; cursor: pointer; }
          .badge { display: inline-flex; align-items: center; min-width: 68px; justify-content: center; border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 700; }
          .passed { background: #dcfae6; color: #067647; }
          .failed { background: #fee4e2; color: #b42318; }
          .skipped, .running { background: #eef2f6; color: #475467; }
          .grid { display: grid; grid-template-columns: 160px 1fr; gap: 8px 16px; }
          .grid dt { color: var(--muted); font-weight: 600; }
          .grid dd { margin: 0; }
          pre { max-height: 520px; overflow: auto; background: #111827; color: #f9fafb; border-radius: 8px; padding: 14px; white-space: pre-wrap; }
          code { background: #eef2f6; padding: 2px 5px; border-radius: 4px; }
          @media (max-width: 760px) {
            table { display: block; overflow-x: auto; }
            .grid { grid-template-columns: 1fr; }
            .section-header { align-items: flex-start; flex-direction: column; }
          }
        </style>
      </head>
      <body>
        <header><h1>${escapeHtml(title)}</h1></header>
        <main>${body}</main>
      </body>
    </html>`;
}

function formatScore(value: number | undefined): string {
  return typeof value === "number" ? `${value}` : "-";
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
