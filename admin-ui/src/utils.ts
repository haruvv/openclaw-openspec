import type { AgentRun, DiscoveryReport, OpportunityFinding, SeoDiagnostic } from "./types";

export function isActive(href: string, path: string): boolean {
  if (href === "/admin") return isAdminHome(path);
  if (href === "/admin/seo-sales") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

export function isAdminHome(path: string): boolean {
  return path === "/" || path === "/admin" || path === "/admin/";
}

export function getTargetUrl(run: AgentRun): string {
  const candidates = [run.summary.targetUrl, run.input.targetUrl, run.input.url];
  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.length > 0);
  return typeof value === "string" ? value : "-";
}

export function urlsMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeComparableUrl(left);
  const normalizedRight = normalizeComparableUrl(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

function normalizeComparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
      url.port = "";
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function getSeoScore(run: AgentRun): number | null {
  const candidates = [run.summary.seoScore, run.summary.score, run.summary.latestScore];
  const value = candidates.find((candidate) => typeof candidate === "number" && Number.isFinite(candidate));
  return typeof value === "number" ? value : null;
}

export function getOpportunityScore(run: AgentRun): number | null {
  const value = run.summary.opportunityScore;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getOpportunityFindings(run: AgentRun): OpportunityFinding[] {
  const value = run.summary.opportunityFindings;
  if (!Array.isArray(value)) return [];
  return value.filter(isOpportunityFinding);
}

export function getSeoDiagnostics(run: AgentRun): SeoDiagnostic[] {
  const value = run.summary.diagnostics;
  if (!Array.isArray(value)) return [];
  return value.filter(isSeoDiagnostic);
}

function isOpportunityFinding(value: unknown): value is OpportunityFinding {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as OpportunityFinding).title === "string"
    && typeof (value as OpportunityFinding).recommendation === "string"
    && typeof (value as OpportunityFinding).scoreImpact === "number";
}

function isSeoDiagnostic(value: unknown): value is SeoDiagnostic {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as SeoDiagnostic).id === "string"
    && typeof (value as SeoDiagnostic).title === "string"
    && (typeof (value as SeoDiagnostic).score === "number" || (value as SeoDiagnostic).score === null)
    && typeof (value as SeoDiagnostic).description === "string";
}

export function formatDate(value?: string): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return "-";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatBytes(value?: number): string {
  if (!value || !Number.isFinite(value)) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function formatStatus(status: Status): string {
  return { running: "実行中", passed: "成功", failed: "失敗", skipped: "スキップ" }[status];
}

export function formatSource(source: string): string {
  return { api: "API", telegram: "Telegram", manual: "手動", discovery: "自動候補発見" }[source] ?? source;
}

export function formatDiscoveryStatus(status: DiscoveryReport["status"]): string {
  return { disabled: "無効", skipped: "候補なし", passed: "成功", failed: "失敗" }[status];
}

export function formatDiscoverySummary(report: DiscoveryReport): string {
  if (report.status === "disabled") return "手動の候補発見は無効です。";
  if (report.runs.length > 0) return `${report.runs.length}件の解析を開始しました。`;
  if (report.candidateCount === 0) return "候補URLが見つかりませんでした。営業対象の業種を設定してください。";
  if (report.selectedCount === 0) return "新しく解析するURLはありませんでした。既に解析済み、またはURL検証で除外されています。";
  return "候補発見は完了しました。";
}

export function formatSkipReason(reason: string): string {
  return {
    already_analyzed: "解析済み",
    discovery_sources_empty: "検索条件なし",
    no_candidates_found: "検索結果なし",
    "REVENUE_AGENT_DISCOVERY_SEED_URLS is empty": "候補設定なし",
  }[reason] ?? reason;
}

export function formatStepName(name: string): string {
  return {
    crawl_and_score: "クロール・SEO採点",
    generate_proposal: "提案書生成",
    sendgrid_email: "メール送信",
    telegram_notification: "Telegram通知",
    stripe_payment_link: "決済リンク作成",
  }[name] ?? name;
}

export function formatFindingCategory(category: string): string {
  return {
    technical: "技術SEO",
    content: "コンテンツ",
    intent: "検索意図",
    conversion: "CV導線",
    trust: "信頼材料",
  }[category] ?? category;
}

export function formatFindingSeverity(severity: string): string {
  return { high: "高", medium: "中", low: "低" }[severity] ?? severity;
}
