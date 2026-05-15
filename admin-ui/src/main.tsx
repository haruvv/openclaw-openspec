import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertCircle,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  LayoutDashboard,
  RefreshCw,
  Search,
  Settings,
  TrendingUp,
  ChevronDown,
  XCircle,
} from "lucide-react";
import "./styles.css";

type Status = "running" | "passed" | "failed" | "skipped";

interface BusinessApp {
  id: string;
  name: string;
  description: string;
  status: "active" | "planned";
  entryPath: string;
  primaryLinks: Array<{ label: string; href: string }>;
}

interface AgentRun {
  id: string;
  agentType: string;
  source: string;
  status: Status;
  input: Record<string, unknown>;
  summary: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface AgentRunDetail extends AgentRun {
  steps: Array<{ id: string; name: string; status: Status; durationMs: number; reason?: string; error?: string; details?: Record<string, unknown> }>;
  artifacts: Array<ArtifactRecord>;
}

interface SiteRecord {
  id: string;
  displayUrl: string;
  normalizedUrl: string;
  domain: string;
  latestStatus: Status;
  latestSeoScore?: number;
  latestOpportunityScore?: number;
  latestRunId?: string;
  updatedAt: string;
}

interface SiteDetail extends SiteRecord {
  snapshots: Array<{ id: string; status: Status; seoScore?: number; opportunityScore?: number; opportunityFindings: OpportunityFinding[]; diagnostics: unknown[]; createdAt: string; runId?: string; summary: Record<string, unknown> }>;
  proposals: Array<ProposalRecord>;
}

interface OpportunityFinding {
  category: string;
  severity: "low" | "medium" | "high";
  title: string;
  evidence: string;
  recommendation: string;
  scoreImpact: number;
}

interface ArtifactRecord {
  id: string;
  type: string;
  label: string;
  pathOrUrl?: string;
  contentText?: string;
  bodyStorage?: "inline" | "object";
  objectKey?: string;
  contentType?: string;
  byteSize?: number;
  createdAt?: string;
}

interface ProposalRecord {
  id: string;
  label: string;
  pathOrUrl?: string;
  contentText?: string;
  bodyStorage?: "inline" | "object";
  objectKey?: string;
  contentType?: string;
  byteSize?: number;
  createdAt: string;
  runId?: string;
}

interface SettingsPayload {
  integrations: Array<{ label: string; key: string; configured: boolean }>;
  policies: Array<{ key: "sendEmail" | "sendTelegram" | "createPaymentLink"; label: string; enabled: boolean }>;
  discovery: DiscoverySettings;
}

interface DiscoverySettings {
  queries: string[];
  seedUrls: string[];
  dailyQuota: number;
  searchLimit: number;
  country: string;
  lang: string;
  location: string;
  configuredFromAdmin: boolean;
}

interface DiscoveryReport {
  status: "disabled" | "skipped" | "passed" | "failed";
  enabled: boolean;
  quota: number;
  candidateCount: number;
  selectedCount: number;
  skipped: Array<{ url: string; reason: string }>;
  runs: Array<{ url: string; runId: string; status: Status }>;
}

const navItems = [
  { label: "業務アプリ", href: "/admin", icon: LayoutDashboard },
  { label: "SEO営業 概要", href: "/admin/seo-sales", icon: BriefcaseBusiness },
  { label: "URL別結果", href: "/admin/seo-sales/sites", icon: Globe2 },
  { label: "実行ログ", href: "/admin/seo-sales/runs", icon: Activity },
  { label: "外部サービス設定", href: "/admin/seo-sales/settings", icon: Settings },
];

const apiCache = new Map<string, unknown>();
const ADMIN_TOKEN_STORAGE_KEY = "revenue_agent_admin_token";
const DISCOVERY_INDUSTRIES = ["税理士事務所", "歯科医院", "整体院", "美容室", "工務店", "不動産会社", "行政書士事務所", "クリニック"];
const DISCOVERY_SEARCH_TARGETS = [
  { label: "日本語サイト / 日本", country: "jp", lang: "ja", location: "" },
  { label: "英語サイト / 米国", country: "us", lang: "en", location: "" },
] as const;

function App() {
  rememberAdminTokenFromUrl();
  const [path, setPath] = useState(window.location.pathname);
  const page = routePage(path);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = getAnchorFromEventTarget(event.target);
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;

      const url = new URL(link.href);
      if (url.origin !== window.location.origin || !isClientRoute(url.pathname)) return;

      event.preventDefault();
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      if (nextUrl === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      window.history.pushState({}, "", nextUrl);
      setPath(url.pathname);
    };

    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 signal-grid">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-slate-950 text-white lg:flex lg:flex-col">
        <a href="/admin" className="flex items-center gap-3 border-b border-slate-800 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center border border-slate-800 text-sm font-black text-slate-950">RA</div>
          <div>
            <div className="text-sm font-black">RevenueAgent</div>
            <div className="text-xs font-semibold text-slate-400">業務自動化コンソール</div>
          </div>
        </a>
        <nav className="space-y-7 px-4 py-5">
          <SidebarGroup label="全体" items={navItems.slice(0, 1)} path={path} />
          <SidebarGroup label="SEO営業" items={navItems.slice(1)} path={path} />
          <div>
            <div className="px-3 text-[11px] font-bold uppercase tracking-normal text-slate-500">準備中</div>
            <div className="mt-2 flex items-center gap-3 border border-slate-800 px-3 py-2.5 text-sm font-bold text-slate-600">
              <TrendingUp className="h-4 w-4" />
              株自動売買
            </div>
          </div>
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/90 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500">管理画面</div>
              <h1 className="text-2xl font-black tracking-normal text-slate-950 md:text-3xl">{page.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/admin" className="btn-secondary">業務アプリ一覧</a>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className={`inline-flex whitespace-nowrap border px-3 py-2 text-sm font-bold ${isActive(item.href, path) ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        <main className={`mx-auto px-5 py-6 md:px-8 ${isAdminHome(path) ? "max-w-[1500px]" : "max-w-7xl"}`}>{page.node}</main>
      </div>
    </div>
  );
}

function SidebarGroup({ label, items, path }: { label: string; items: typeof navItems; path: string }) {
  const containsActiveItem = items.some((item) => isActive(item.href, path));
  const [open, setOpen] = useState(containsActiveItem);

  useEffect(() => {
    if (containsActiveItem) setOpen(true);
  }, [containsActiveItem]);

  return (
    <div>
      <button type="button" className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] font-bold uppercase tracking-normal text-slate-500" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "" : "-rotate-90"}`} />
      </button>
      {open ? (
        <div className="mt-2 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, path);
            return (
              <a key={item.href} href={item.href} className={`relative flex items-center gap-3 border px-3 py-2.5 pl-4 text-sm font-bold ${active ? "border-blue-200 bg-blue-50 text-slate-950" : "border-transparent text-slate-300 hover:border-slate-200 hover:bg-white hover:text-slate-950"}`} aria-current={active ? "page" : undefined}>
                {active ? <span className="absolute inset-y-2 left-0 w-1 bg-blue-700" aria-hidden="true" /> : null}
                <Icon className={`h-4 w-4 ${active ? "text-blue-700" : ""}`} />
                {item.label}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function routePage(path: string): { title: string; description: string; node: React.ReactNode } {
  if (path === "/admin/seo-sales") return { title: "SEO営業", description: "候補発見、SEO解析、提案作成の実行状況を確認します。", node: <SeoSalesHome /> };
  if (path === "/admin/seo-sales/sites") return { title: "URL別結果", description: "解析済みURLの最新状態です。", node: <SitesPage /> };
  if (path.startsWith("/admin/seo-sales/sites/")) return { title: "URL詳細", description: "", node: <SiteDetailPage id={decodeURIComponent(path.split("/").pop() ?? "")} /> };
  if (path === "/admin/seo-sales/runs") return { title: "実行ログ", description: "解析の実行履歴です。", node: <RunsPage /> };
  if (path.startsWith("/admin/seo-sales/runs/")) return { title: "実行詳細", description: "", node: <RunDetailPage id={decodeURIComponent(path.split("/").pop() ?? "")} /> };
  if (path === "/admin/seo-sales/settings") return { title: "外部サービス設定", description: "連携設定と実行ポリシーです。", node: <SettingsPage /> };
  return { title: "業務アプリ", description: "利用する業務を選択します。", node: <PortalPage /> };
}

function PortalPage() {
  const { data, loading, error } = useApi<{ apps: BusinessApp[] }>("/api/admin/apps");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const apps = data?.apps ?? [];
  return (
    <section className="border border-slate-200 bg-white">
      <div className="divide-y divide-slate-200">
        {apps.map((app) => <AppListRow key={app.id} app={app} />)}
      </div>
    </section>
  );
}

function AppListRow({ app }: { app: BusinessApp }) {
  const Icon = app.id === "stock-trading" ? TrendingUp : Bot;
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-200 ${app.status === "active" ? "bg-blue-50 text-blue-700" : "bg-white text-slate-500"}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-black text-slate-950">{app.name}</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-500">{app.description}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusPill status={app.status === "active" ? "passed" : "skipped"} label={app.status === "active" ? "稼働中" : "準備中"} />
        {app.status === "active" ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
      </div>
    </>
  );

  if (app.status !== "active") {
    return <div className="flex min-h-20 items-center justify-between gap-4 bg-slate-50 px-5 py-4 md:px-6">{content}</div>;
  }

  return (
    <a href={app.entryPath} className="app-list-row flex min-h-20 items-center justify-between gap-4 px-5 py-4 md:px-6">
      {content}
    </a>
  );
}

function SeoSalesHome() {
  const { data, loading, error } = useApi<{
    totals: { runs: number; sites: number; failedRuns: number; latestScore: number | null };
    recentRuns: AgentRun[];
    recentSites: SiteRecord[];
  }>("/api/admin/seo-sales/overview");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const totals = data?.totals;
  return (
    <div className="space-y-5">
      <DiscoveryRunPanel />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Activity />} label="最近の実行" value={totals?.runs ?? 0} />
        <Metric icon={<Globe2 />} label="解析済みURL" value={totals?.sites ?? 0} />
        <Metric icon={<XCircle />} label="失敗" value={totals?.failedRuns ?? 0} />
        <Metric icon={<Search />} label="最新SEOスコア" value={totals?.latestScore ?? "-"} />
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Panel title="最近のURL結果" action={<a href="/admin/seo-sales/sites" className="link-action">すべて見る</a>}>
          <SiteTable sites={data?.recentSites ?? []} compact />
        </Panel>
        <Panel title="最近の実行" action={<a href="/admin/seo-sales/runs" className="link-action">すべて見る</a>}>
          <RunsTable runs={data?.recentRuns ?? []} compact />
        </Panel>
      </section>
    </div>
  );
}

function DiscoveryRunPanel() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);
  const [runningRuns, setRunningRuns] = useState<AgentRun[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!running) {
      setRunningRuns([]);
      return;
    }

    let active = true;
    const poll = async () => {
      try {
        const result = await apiGet<{ runs: AgentRun[] }>("/api/admin/seo-sales/runs");
        if (!active) return;
        setRunningRuns(result.runs.filter((run) => run.status === "running" && run.source === "discovery").slice(0, 3));
        setLastCheckedAt(new Date().toISOString());
      } catch {
        if (active) setLastCheckedAt(new Date().toISOString());
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [running]);

  async function runDiscovery() {
    setRunning(true);
    setReport(null);
    setLastCompletedAt(null);
    setError(null);
    try {
      const result = await apiPost<{ report: DiscoveryReport }>("/api/admin/seo-sales/discovery/run", {});
      apiCache.delete("/api/admin/seo-sales/overview");
      apiCache.delete("/api/admin/seo-sales/runs");
      apiCache.delete("/api/admin/seo-sales/sites");
      setReport(result.report);
      setLastCompletedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "候補発見に失敗しました");
    } finally {
      setRunning(false);
    }
  }

  const summaryItems = report ? [
    { label: "状態", value: <StatusPill status={report.status === "disabled" ? "skipped" : report.status} label={formatDiscoveryStatus(report.status)} /> },
    { label: "候補", value: `${report.candidateCount}件` },
    { label: "解析開始", value: `${report.selectedCount}件` },
    { label: "上限", value: `${report.quota}件/日` },
  ] : [];

  return (
    <section className="border border-blue-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="p-6 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-slate-200 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">主ワークフロー</span>
            {running ? <StatusPill status="running" label="候補発見中" /> : null}
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-normal text-slate-950">自動候補発見</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            営業対象になりそうなホームページを検索し、未解析のURLだけを選んでSEO解析と提案作成まで進めます。
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-primary h-12 px-5 text-base" disabled={running} onClick={runDiscovery}>
              <Search className="h-5 w-5" />{running ? "候補発見を実行中..." : "候補を探して解析を開始"}
            </button>
            <a href="/admin/seo-sales/settings" className="btn-secondary h-12 px-5"><Settings className="h-4 w-4" />検索条件を確認</a>
          </div>
          {summaryItems.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {summaryItems.map((item) => (
                <Info key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="border-t border-blue-100 bg-slate-50 p-5 lg:border-l lg:border-t-0">
          <div className="text-xs font-black text-slate-500">実行状況</div>
          <div className="mt-3 space-y-3">
        {running ? (
          <div className="border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">
            <div>{runningRuns.length > 0 ? "サーバー側で解析が始まっています。" : "候補検索中、または解析開始待ちです。"}</div>
            <div className="mt-1 text-xs font-semibold text-blue-700">この表示は3秒ごとに実行ログを確認しています。{lastCheckedAt ? ` 最終確認: ${formatDate(lastCheckedAt)}` : ""}</div>
          </div>
        ) : null}
        {runningRuns.length > 0 ? <RunningRunsList runs={runningRuns} /> : null}
        {report ? (
          <div>
            <div className="border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
              {formatDiscoverySummary(report)}
              {lastCompletedAt ? <span className="ml-2 text-xs font-semibold text-slate-500">完了: {formatDate(lastCompletedAt)}</span> : null}
            </div>
          </div>
        ) : null}
        {report?.runs.length ? (
          <table className="data-table">
            <thead><tr><th>状態</th><th>URL</th><th>実行ログ</th></tr></thead>
            <tbody>{report.runs.map((run) => <tr key={run.runId}><td><StatusPill status={run.status} /></td><td>{run.url}</td><td><a className="table-link" href={`/admin/seo-sales/runs/${run.runId}`}>開く</a></td></tr>)}</tbody>
          </table>
        ) : null}
        {report?.status === "disabled" ? (
          <p className="border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600">手動の候補発見は無効です。Cloudflare の環境変数で REVENUE_AGENT_DISCOVERY_MANUAL_ENABLED=false になっていないか確認してください。</p>
        ) : null}
        {report?.status === "skipped" ? (
          <p className="border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600">解析できる新規候補がありませんでした。</p>
        ) : null}
        {report?.skipped.length ? (
          <div className="border border-slate-200 bg-white p-3">
            <div className="text-xs font-black text-slate-500">スキップ理由</div>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
              {report.skipped.slice(0, 5).map((item, index) => <li key={`${item.url}-${index}`}>{item.url}: {formatSkipReason(item.reason)}</li>)}
            </ul>
          </div>
        ) : null}
        {error ? <p className="border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        {!running && !report && !error ? (
          <p className="border border-dashed border-slate-300 bg-white p-4 text-sm font-bold text-slate-500">まだこの画面では実行していません。ボタンを押すと候補検索と解析を開始します。</p>
        ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function RunsPage() {
  const { data, loading, error, reload } = useApi<{ runs: AgentRun[] }>("/api/admin/seo-sales/runs");
  return (
    <div className="space-y-5">
      <Panel title="新規解析">
        <ManualRunForm onDone={reload} />
      </Panel>
      <Panel title="実行ログ">{loading ? <Loading /> : error ? <ErrorState message={error} /> : <RunsTable runs={data?.runs ?? []} />}</Panel>
    </div>
  );
}

function RunDetailPage({ id }: { id: string }) {
  const { data, loading, error, reload } = useApi<{ run: AgentRunDetail }>(`/api/admin/seo-sales/runs/${encodeURIComponent(id)}`);
  const [retrying, setRetrying] = useState(false);
  const isRunning = data?.run?.status === "running";
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => void reload(), 3000);
    return () => window.clearInterval(timer);
  }, [isRunning, reload]);
  async function retry() {
    setRetrying(true);
    const result = await apiPost<{ location: string }>(`/api/admin/seo-sales/runs/${encodeURIComponent(id)}/retry`, {});
    window.location.href = result.location;
  }
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const run = data?.run;
  if (!run) return <Empty title="実行が見つかりません" />;
  const targetUrl = getTargetUrl(run);
  const seoScore = getSeoScore(run);
  const opportunityScore = getOpportunityScore(run);
  const opportunityFindings = getOpportunityFindings(run);
  const domain = typeof run.summary.domain === "string" ? run.summary.domain : "-";
  const proposalArtifacts = run.artifacts.filter((artifact) => artifact.type === "proposal" || artifact.contentType === "text/markdown");
  return (
    <div className="space-y-5">
      <Panel title={targetUrl} action={<button onClick={retry} className="btn-primary" disabled={retrying}><RefreshCw className="h-4 w-4" />再実行</button>}>
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="状態" value={<StatusPill status={run.status} />} />
          <Info label="起点" value={formatSource(run.source)} />
          <Info label="開始" value={formatDate(run.startedAt)} />
          <Info label="所要時間" value={formatDuration(run.startedAt, run.completedAt)} />
        </div>
        {run.status === "running" ? (
          <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">実行中です。この詳細画面は3秒ごとに更新されます。</p>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Info label="ドメイン" value={domain} />
          <Info label="Lighthouse SEO" value={seoScore ?? "-"} />
          <Info label="改善余地スコア" value={opportunityScore ?? "-"} />
          <Info label="提案書" value={`${proposalArtifacts.length}件`} />
        </div>
        {opportunityFindings.length > 0 ? <FindingsList findings={opportunityFindings.slice(0, 3)} /> : null}
        {run.error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{run.error}</p> : null}
      </Panel>
      <Panel title="処理ステップ">
        {run.steps.length === 0 ? <Empty title="ステップ開始待ちです" description="サーバーが処理を開始すると、ここにステップ単位の進捗が表示されます。" /> : (
          <table className="data-table">
            <thead><tr><th>状態</th><th>名前</th><th>所要時間</th><th>理由 / エラー</th></tr></thead>
            <tbody>{run.steps.map((step) => <tr key={step.id}><td><StatusPill status={step.status} /></td><td>{formatStepName(step.name)}</td><td>{step.status === "running" ? "処理中" : `${step.durationMs} ms`}</td><td>{step.error ?? step.reason ?? ""}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>
      <Panel title="提案書">
        {run.artifacts.length === 0 ? <Empty title="成果物はありません" /> : run.artifacts.map((artifact) => (
          <ProposalViewer
            key={artifact.id}
            title={artifact.label}
            pathOrUrl={artifact.pathOrUrl}
            contentText={artifact.contentText}
            createdAt={artifact.createdAt}
          />
        ))}
      </Panel>
    </div>
  );
}

function SitesPage() {
  const { data, loading, error } = useApi<{ sites: SiteRecord[] }>("/api/admin/seo-sales/sites");
  return <Panel title="解析済みURL">{loading ? <Loading /> : error ? <ErrorState message={error} /> : <SiteTable sites={data?.sites ?? []} />}</Panel>;
}

function SiteDetailPage({ id }: { id: string }) {
  const { data, loading, error } = useApi<{ site: SiteDetail }>(`/api/admin/seo-sales/sites/${encodeURIComponent(id)}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const site = data?.site;
  if (!site) return <Empty title="URL結果が見つかりません" />;
  const latestProposal = site.proposals[0];
  const latestSnapshot = site.snapshots[0];
  const passedSnapshots = site.snapshots.filter((snapshot) => snapshot.status === "passed").length;
  return (
    <div className="space-y-5">
      <Panel title={site.displayUrl} action={site.latestRunId ? <a href={`/admin/seo-sales/runs/${site.latestRunId}`} className="btn-secondary">実行ログを開く</a> : null}>
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="状態" value={<StatusPill status={site.latestStatus} />} />
          <Info label="ドメイン" value={site.domain} />
          <Info label="Lighthouse SEO" value={site.latestSeoScore ?? "-"} />
          <Info label="改善余地スコア" value={site.latestOpportunityScore ?? "-"} />
        </div>
        {latestSnapshot?.opportunityFindings.length ? <FindingsList findings={latestSnapshot.opportunityFindings.slice(0, 3)} /> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Info label="解析回数" value={`${site.snapshots.length}回`} />
          <Info label="成功回数" value={`${passedSnapshots}回`} />
          <Info label="提案書" value={`${site.proposals.length}件`} />
          <Info label="最新実行" value={site.latestRunId ? <a className="table-link" href={`/admin/seo-sales/runs/${site.latestRunId}`}>開く</a> : "-"} />
        </div>
      </Panel>
      <Panel title="最新の提案書">
        {latestProposal ? (
          <ProposalViewer
            title={latestProposal.label}
            pathOrUrl={latestProposal.pathOrUrl}
            contentText={latestProposal.contentText}
            createdAt={latestProposal.createdAt}
          />
        ) : <Empty title="提案書はまだありません" />}
      </Panel>
      <Panel title="提案書履歴">
        {site.proposals.length === 0 ? <Empty title="提案書履歴はまだありません" /> : (
          <table className="data-table">
            <thead><tr><th>作成</th><th>提案書</th><th>保存先</th><th>サイズ</th><th>実行ログ</th></tr></thead>
            <tbody>{site.proposals.map((proposal) => <tr key={proposal.id}><td>{formatDate(proposal.createdAt)}</td><td>{proposal.label}</td><td>{proposal.pathOrUrl ?? proposal.objectKey ?? "-"}</td><td>{formatBytes(proposal.byteSize)}</td><td>{proposal.runId ? <a className="table-link" href={`/admin/seo-sales/runs/${proposal.runId}`}>開く</a> : "-"}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>
      <Panel title="解析履歴">
        <table className="data-table">
          <thead><tr><th>状態</th><th>Lighthouse SEO</th><th>改善余地</th><th>診断項目</th><th>作成</th><th>実行ログ</th></tr></thead>
          <tbody>{site.snapshots.map((snapshot) => <tr key={snapshot.id}><td><StatusPill status={snapshot.status} /></td><td>{snapshot.seoScore ?? "-"}</td><td>{snapshot.opportunityScore ?? "-"}</td><td>{snapshot.diagnostics.length + snapshot.opportunityFindings.length}</td><td>{formatDate(snapshot.createdAt)}</td><td>{snapshot.runId ? <a href={`/admin/seo-sales/runs/${snapshot.runId}`}>開く</a> : "-"}</td></tr>)}</tbody>
        </table>
      </Panel>
    </div>
  );
}

function SettingsPage() {
  const { data, loading, error } = useApi<SettingsPayload>("/api/admin/seo-sales/settings");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="space-y-5">
      {data?.discovery ? <DiscoverySettingsPanel settings={data.discovery} /> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="外部サービス設定">
          <IntegrationSettingsList items={data?.integrations ?? []} />
        </Panel>
        <Panel title="副作用の許可設定">
          <SideEffectPolicyControls policies={data?.policies ?? []} />
        </Panel>
      </div>
    </div>
  );
}

function IntegrationSettingsList({ items }: { items: SettingsPayload["integrations"] }) {
  const configuredCount = items.filter((item) => item.configured).length;
  const missingCount = items.length - configuredCount;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Info label="設定済み" value={`${configuredCount}/${items.length}`} />
        <Info label="未設定" value={`${missingCount}`} />
      </div>
      <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.key} className={`flex min-h-16 items-center justify-between gap-4 border px-4 py-3 ${item.configured ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50"}`}>
          <span className="min-w-0">
            <span className="block text-sm font-black text-slate-950">{item.label}</span>
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">{item.key}</span>
              <span className="border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-black text-slate-500">{formatIntegrationRole(item.key)}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className={`status-dot ${item.configured ? "status-dot-on" : ""}`} aria-hidden="true" />
            <span className={`w-14 text-right text-xs font-black ${item.configured ? "text-blue-700" : "text-slate-500"}`}>
              {item.configured ? "接続済み" : "未接続"}
            </span>
          </span>
        </div>
      ))}
      </div>
    </div>
  );
}

function formatIntegrationRole(key: string): string {
  if (key.includes("FIRECRAWL")) return "候補発見";
  if (key.includes("GEMINI") || key.includes("ZAI")) return "AI生成";
  if (key.includes("SENDGRID")) return "メール";
  if (key.includes("TELEGRAM")) return "通知";
  if (key.includes("STRIPE")) return "決済";
  if (key.includes("ADMIN")) return "管理";
  return "連携";
}

function SideEffectPolicyControls({ policies }: { policies: SettingsPayload["policies"] }) {
  const [items, setItems] = useState(policies);
  const [savedItems, setSavedItems] = useState(policies);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(policies);
    setSavedItems(policies);
    setConfirmOpen(false);
    setMessage(null);
    setError(null);
  }, [policies]);

  const hasChanges = items.some((item) => savedItems.find((saved) => saved.key === item.key)?.enabled !== item.enabled);
  const enabledItems = items.filter((item) => item.enabled);

  function togglePolicy(key: SettingsPayload["policies"][number]["key"]) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, enabled: !item.enabled } : item));
    setMessage(null);
    setError(null);
  }

  async function savePolicies() {
    if (!hasChanges) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiPut<{ policies: { sendEmail: boolean; sendTelegram: boolean; createPaymentLink: boolean } }>("/api/admin/seo-sales/settings/policies", {
        sendEmail: items.find((item) => item.key === "sendEmail")?.enabled === true,
        sendTelegram: items.find((item) => item.key === "sendTelegram")?.enabled === true,
        createPaymentLink: items.find((item) => item.key === "createPaymentLink")?.enabled === true,
      });
      setSavedItems(items);
      setConfirmOpen(false);
      apiCache.delete("/api/admin/seo-sales/settings");
      setMessage("副作用の許可設定を保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定を保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className="flex min-h-14 items-center justify-between gap-4 border border-slate-200 bg-white px-4 py-3 text-left disabled:opacity-70"
            disabled={saving}
            onClick={() => togglePolicy(item.key)}
            aria-pressed={item.enabled}
          >
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-950">{item.label}</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-500">{item.enabled ? "有効" : "無効"}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className={`toggle-switch ${item.enabled ? "toggle-switch-on" : ""}`} aria-hidden="true">
                <span className="toggle-knob" />
              </span>
              <span className={`w-10 text-right text-xs font-black ${item.enabled ? "text-blue-700" : "text-slate-500"}`}>
                {item.enabled ? "ON" : "OFF"}
              </span>
            </span>
          </button>
        ))}
      </div>
      {hasChanges ? <div className="border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">未保存の変更があります。</div> : null}
      {message ? <div className="border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</div> : null}
      {error ? <div className="border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
      <div className="flex justify-end">
        <button type="button" className="btn-primary" disabled={!hasChanges || saving} onClick={() => setConfirmOpen(true)}>
          {saving ? "保存中..." : "設定を保存"}
        </button>
      </div>
      {confirmOpen ? (
        <SideEffectConfirmModal
          enabledItems={enabledItems}
          saving={saving}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void savePolicies()}
        />
      ) : null}
    </div>
  );
}

function SideEffectConfirmModal({
  enabledItems,
  saving,
  onCancel,
  onConfirm,
}: {
  enabledItems: SettingsPayload["policies"];
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-lg border border-slate-200 bg-white p-5 shadow-md" role="dialog" aria-modal="true" aria-labelledby="side-effect-confirm-title">
        <div className="border-b border-slate-200 pb-3">
          <h3 id="side-effect-confirm-title" className="text-lg font-black text-slate-950">副作用の許可設定を保存</h3>
        </div>
        <div className="mt-4 space-y-3">
          {enabledItems.length > 0 ? (
            <>
              <p className="text-sm font-semibold leading-6 text-slate-600">以下の副作用を許可します。</p>
              <div className="grid gap-2">
                {enabledItems.map((item) => (
                  <div key={item.key} className="flex min-h-11 items-center justify-between border border-blue-100 bg-blue-50 px-3 py-2">
                    <span className="text-sm font-black text-slate-950">{item.label}</span>
                    <span className="text-xs font-black text-blue-700">ON</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600">すべての副作用を無効にします。</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>キャンセル</button>
          <button type="button" className="btn-primary" disabled={saving} onClick={onConfirm}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </div>
    </div>
  );
}

function DiscoverySettingsPanel({ settings }: { settings: DiscoverySettings }) {
  const initialSelection = parseDiscoveryQuerySelection(settings.queries);
  const [selectedIndustries, setSelectedIndustries] = useState(initialSelection.industries);
  const [customQueries, setCustomQueries] = useState(initialSelection.customQueries.join("\n"));
  const [seedUrls, setSeedUrls] = useState(settings.seedUrls.join("\n"));
  const [dailyQuota, setDailyQuota] = useState(String(settings.dailyQuota));
  const [searchLimit, setSearchLimit] = useState(String(settings.searchLimit));
  const [country, setCountry] = useState(settings.country);
  const [lang, setLang] = useState(settings.lang);
  const [location, setLocation] = useState(settings.location);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configuredFromAdmin, setConfiguredFromAdmin] = useState(settings.configuredFromAdmin);
  const generatedQueries = buildDiscoveryQueries(selectedIndustries);
  const allQueries = [...generatedQueries, ...splitLines(customQueries)];

  useEffect(() => {
    const selection = parseDiscoveryQuerySelection(settings.queries);
    setSelectedIndustries(selection.industries);
    setCustomQueries(selection.customQueries.join("\n"));
    setSeedUrls(settings.seedUrls.join("\n"));
    setDailyQuota(String(settings.dailyQuota));
    setSearchLimit(String(settings.searchLimit));
    setCountry(settings.country);
    setLang(settings.lang);
    setLocation(settings.location);
    setConfiguredFromAdmin(settings.configuredFromAdmin);
  }, [settings]);

  function toggleSelection(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function selectSearchTarget(target: (typeof DISCOVERY_SEARCH_TARGETS)[number]) {
    setCountry(target.country);
    setLang(target.lang);
    setLocation(target.location);
  }

  function isSearchTargetSelected(target: (typeof DISCOVERY_SEARCH_TARGETS)[number]): boolean {
    return country === target.country && lang === target.lang && location === target.location;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const result = await apiPut<{ discovery: DiscoverySettings }>("/api/admin/seo-sales/settings/discovery", {
        queries: allQueries.join("\n"),
        seedUrls,
        dailyQuota: Number(dailyQuota),
        searchLimit: Number(searchLimit),
        country,
        lang,
        location,
      });
      apiCache.delete("/api/admin/seo-sales/settings");
      const selection = parseDiscoveryQuerySelection(result.discovery.queries);
      setSelectedIndustries(selection.industries);
      setCustomQueries(selection.customQueries.join("\n"));
      setSeedUrls(result.discovery.seedUrls.join("\n"));
      setDailyQuota(String(result.discovery.dailyQuota));
      setSearchLimit(String(result.discovery.searchLimit));
      setCountry(result.discovery.country);
      setLang(result.discovery.lang);
      setLocation(result.discovery.location);
      setConfiguredFromAdmin(result.discovery.configuredFromAdmin);
      setMessage("自動候補発見の設定を保存しました。次の実行から反映されます。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定を保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="自動候補発見設定" action={configuredFromAdmin ? <StatusPill status="passed" label="管理画面設定" /> : <StatusPill status="skipped" label="環境変数設定" />}>
      <form className="space-y-4" onSubmit={save}>
        <div>
          <fieldset>
            <legend className="text-sm font-black text-slate-700">営業対象の業種</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DISCOVERY_INDUSTRIES.map((industry) => (
                <label key={industry} className="check-row">
                  <input type="checkbox" checked={selectedIndustries.includes(industry)} onChange={() => toggleSelection(industry, selectedIndustries, setSelectedIndustries)} />
                  <span>{industry}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-black text-slate-500">検索キーワードのプレビュー</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {allQueries.length > 0 ? allQueries.slice(0, 12).map((query) => <span key={query} className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{query}</span>) : <span className="text-sm font-bold text-slate-500">営業対象の業種を選択してください</span>}
            {allQueries.length > 12 ? <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">他 {allQueries.length - 12}件</span> : null}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">選んだ業種の公式サイトを探し、解析結果から改善余地が大きいサイトを営業候補にします。</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-black text-slate-700">1日の解析上限<input className="input mt-2 w-full" type="number" min="1" max="10" value={dailyQuota} onChange={(event) => setDailyQuota(event.target.value)} /></label>
          <label className="block text-sm font-black text-slate-700">検索件数/キーワード<input className="input mt-2 w-full" type="number" min="1" max="20" value={searchLimit} onChange={(event) => setSearchLimit(event.target.value)} /></label>
        </div>
        <fieldset>
          <legend className="text-sm font-black text-slate-700">検索対象</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DISCOVERY_SEARCH_TARGETS.map((target) => (
              <label key={`${target.country}-${target.lang}`} className="check-row">
                <input
                  type="radio"
                  name="discovery-search-target"
                  checked={isSearchTargetSelected(target)}
                  onChange={() => selectSearchTarget(target)}
                />
                <span>{target.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-700">詳細設定</summary>
          <div className="mt-3 space-y-4">
            <div>
              <label className="text-sm font-black text-slate-700" htmlFor="custom-discovery-queries">追加の検索条件</label>
              <textarea id="custom-discovery-queries" className="textarea mt-2" value={customQueries} onChange={(event) => setCustomQueries(event.target.value)} placeholder={"港区 税理士事務所 公式サイト\n横浜市 歯科医院 公式サイト"} />
              <p className="mt-2 text-xs font-semibold text-slate-500">通常は空で構いません。チェック項目にない業種や市区町村を指定したいときだけ使います。</p>
            </div>
            <div>
              <label className="text-sm font-black text-slate-700" htmlFor="seed-urls">固定候補URL（検証用）</label>
              <textarea id="seed-urls" className="textarea mt-2" value={seedUrls} onChange={(event) => setSeedUrls(event.target.value)} placeholder={"https://example.com\nhttps://example.org"} />
              <p className="mt-2 text-xs font-semibold text-slate-500">本番運用では空で構いません。検索ではなく特定URLを解析したいときだけ使います。</p>
            </div>
          </div>
        </details>
        {message ? <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "保存中..." : "設定を保存"}</button>
        </div>
      </form>
    </Panel>
  );
}

function buildDiscoveryQueries(industries: string[]): string[] {
  return industries.map((industry) => `${industry} 公式サイト`);
}

function parseDiscoveryQuerySelection(queries: string[]): { industries: string[]; customQueries: string[] } {
  const industries = new Set<string>();
  const generated = new Set<string>();

  for (const industry of DISCOVERY_INDUSTRIES) {
    const currentQuery = `${industry} 公式サイト`;
    generated.add(currentQuery);
    if (queries.includes(currentQuery)) industries.add(industry);

    for (const query of queries) {
      if (query.endsWith(` ${industry} 公式サイト`)) {
        industries.add(industry);
        generated.add(query);
      }
    }
  }

  return {
    industries: [...industries],
    customQueries: queries.filter((query) => !generated.has(query)),
  };
}

function splitLines(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [item];
    });
}

function ProposalViewer({
  title,
  pathOrUrl,
  contentText,
  createdAt,
}: {
  title: string;
  pathOrUrl?: string;
  contentText?: string;
  createdAt?: string;
}) {
  const body = contentText?.trim();
  return (
    <article className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-950">{title}</h3>
            {createdAt ? <div className="mt-1 text-xs font-semibold text-slate-500">{formatDate(createdAt)}</div> : null}
          </div>
          {pathOrUrl ? <div className="max-w-full border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 md:max-w-xl">{pathOrUrl}</div> : null}
        </div>
      </div>
      {body ? (
        <div className="max-h-[680px] overflow-auto p-5">
          <MarkdownPreview text={body} />
        </div>
      ) : (
        <div className="p-5">
          <Empty title="本文は記録されていません" />
        </div>
      )}
    </article>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];
  let paragraph: string[] = [];

  function flush() {
    if (paragraph.length > 0) {
      nodes.push(<p key={`p-${nodes.length}`} className="whitespace-pre-wrap">{paragraph.join("\n")}</p>);
      paragraph = [];
    }
    if (bullets.length > 0) {
      nodes.push(<ul key={`ul-${nodes.length}`} className="list-disc space-y-1 pl-5">{bullets.map((item, index) => <li key={index}>{item}</li>)}</ul>);
      bullets = [];
    }
    if (numbers.length > 0) {
      nodes.push(<ol key={`ol-${nodes.length}`} className="list-decimal space-y-1 pl-5">{numbers.map((item, index) => <li key={index}>{item}</li>)}</ol>);
      numbers = [];
    }
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("# ")) {
      flush();
      nodes.push(<h2 key={`h2-${nodes.length}`} className="border-b border-slate-200 pb-2 text-xl font-black leading-8 text-slate-950">{line.replace(/^#\s+/, "")}</h2>);
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      nodes.push(<h3 key={`h3-${nodes.length}`} className="mt-6 text-lg font-black leading-7 text-slate-950">{line.replace(/^##\s+/, "")}</h3>);
      continue;
    }
    if (line.startsWith("### ")) {
      flush();
      nodes.push(<h4 key={`h4-${nodes.length}`} className="mt-5 text-base font-black leading-7 text-slate-900">{line.replace(/^###\s+/, "")}</h4>);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (paragraph.length > 0 || numbers.length > 0) flush();
      bullets.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (paragraph.length > 0 || bullets.length > 0) flush();
      numbers.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }
    if (bullets.length > 0 || numbers.length > 0) flush();
    paragraph.push(line);
  }
  flush();

  return (
    <div className="space-y-4 text-sm leading-7 text-slate-700">
      {nodes}
    </div>
  );
}

function SiteTable({ sites, compact = false }: { sites: SiteRecord[]; compact?: boolean }) {
  if (sites.length === 0) return <Empty title="URL別結果はまだありません" description="URLを解析すると、この一覧にサイトごとの最新結果が表示されます。" action={<a href="/admin/seo-sales/runs" className="btn-primary">URLを解析する</a>} />;
  return (
    <table className="data-table">
      <thead><tr><th>状態</th><th>URL</th><th>ドメイン</th><th>Lighthouse SEO</th><th>改善余地</th>{compact ? null : <th>更新</th>}<th>実行ログ</th></tr></thead>
      <tbody>{sites.map((site) => <tr key={site.id}><td><StatusPill status={site.latestStatus} /></td><td><a className="table-link" href={`/admin/seo-sales/sites/${site.id}`}>{site.displayUrl}</a></td><td>{site.domain}</td><td>{site.latestSeoScore ?? "-"}</td><td>{site.latestOpportunityScore ?? "-"}</td>{compact ? null : <td>{formatDate(site.updatedAt)}</td>}<td>{site.latestRunId ? <a className="table-link" href={`/admin/seo-sales/runs/${site.latestRunId}`}>開く</a> : "-"}</td></tr>)}</tbody>
    </table>
  );
}

function RunsTable({ runs, compact = false }: { runs: AgentRun[]; compact?: boolean }) {
  if (runs.length === 0) return <Empty title="実行履歴はまだありません" description="URLを解析すると、ここに実行ステータスと詳細ログが表示されます。" action={<a href="/admin/seo-sales/runs" className="btn-primary">URLを解析する</a>} />;
  return (
    <table className="data-table">
      <thead><tr><th>状態</th><th>対象URL</th><th>Lighthouse SEO</th><th>改善余地</th><th>起点</th>{compact ? null : <th>開始</th>}<th>所要時間</th></tr></thead>
      <tbody>{runs.map((run) => <tr key={run.id}><td><StatusPill status={run.status} /></td><td><a className="table-link" href={`/admin/seo-sales/runs/${run.id}`}>{getTargetUrl(run)}</a></td><td>{getSeoScore(run) ?? "-"}</td><td>{getOpportunityScore(run) ?? "-"}</td><td>{formatSource(run.source)}</td>{compact ? null : <td>{formatDate(run.startedAt)}</td>}<td>{formatDuration(run.startedAt, run.completedAt)}</td></tr>)}</tbody>
    </table>
  );
}

function FindingsList({ findings }: { findings: OpportunityFinding[] }) {
  return (
    <div className="mt-4 border border-amber-100 bg-amber-50 p-3">
      <div className="text-xs font-black text-amber-800">主な改善余地</div>
      <div className="mt-2 space-y-2">
        {findings.map((finding) => (
          <div key={`${finding.category}-${finding.title}`} className="border border-slate-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-amber-100 bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">{formatFindingCategory(finding.category)}</span>
              <span className="text-xs font-bold text-slate-500">{formatFindingSeverity(finding.severity)} / +{finding.scoreImpact}</span>
            </div>
            <div className="mt-1 font-black text-slate-800">{finding.title}</div>
            <div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{finding.recommendation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-200 pb-3"><h2 className="min-w-0 break-words text-lg font-black tracking-normal">{title}</h2>{action}</div><div className="panel-body">{children}</div></section>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <section className="border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="text-sm font-bold text-slate-500">{label}</div><div className="text-blue-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</div></div><div className="mt-3 text-3xl font-black tracking-normal">{value}</div></section>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-black">{value}</div></div>;
}

function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div className="text-sm font-black text-slate-700">{title}</div>{description ? <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">{description}</p> : null}{action ? <div className="mt-4 flex justify-center">{action}</div> : null}</div>;
}

function Loading() {
  return <div className="border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">読み込み中...</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />読み込みに失敗しました</div><p className="mt-2 font-semibold">{message}</p></div>;
}

function ManualRunForm({ onDone }: { onDone?: () => void | Promise<void> }) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningRuns, setRunningRuns] = useState<AgentRun[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!submitting) {
      setRunningRuns([]);
      return;
    }

    let active = true;
    const target = url.trim();
    const poll = async () => {
      try {
        const result = await apiGet<{ runs: AgentRun[] }>("/api/admin/seo-sales/runs");
        if (!active) return;
        setRunningRuns(
          result.runs
            .filter((run) => run.status === "running" && run.source === "manual" && (!target || getTargetUrl(run) === target))
            .slice(0, 2),
        );
        setLastCheckedAt(new Date().toISOString());
      } catch {
        if (active) setLastCheckedAt(new Date().toISOString());
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [submitting, url]);

  async function runManual(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ location: string }>("/api/admin/seo-sales/runs", { url });
      window.location.href = result.location;
    } catch (err) {
      setError(err instanceof Error ? err.message : "実行に失敗しました");
    } finally {
      setSubmitting(false);
      await onDone?.();
    }
  }
  return (
    <form onSubmit={runManual}>
      <div className="flex flex-col gap-3 md:flex-row">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-black text-slate-500">解析したいURL</span>
          <input value={url} onChange={(event) => setUrl(event.target.value)} className="input w-full" type="url" placeholder="https://example.com" required />
        </label>
        <button className="btn-primary md:mt-5" disabled={submitting}>{submitting ? "実行中..." : "解析を開始"}</button>
      </div>
      {submitting ? (
        <div className="mt-3 border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">
          <div>{runningRuns.length > 0 ? "サーバー側で解析が始まっています。" : "サーバーへ実行リクエストを送信済みです。開始ログを確認しています。"}</div>
          <div className="mt-1 text-xs font-semibold text-blue-700">この表示は3秒ごとに実行ログを確認しています。{lastCheckedAt ? ` 最終確認: ${formatDate(lastCheckedAt)}` : ""}</div>
        </div>
      ) : null}
      {runningRuns.length > 0 ? <div className="mt-3"><RunningRunsList runs={runningRuns} /></div> : null}
      {error ? <p className="mt-3 border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
    </form>
  );
}

function RunningRunsList({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="border border-blue-100 bg-white p-3">
      <div className="text-xs font-black text-slate-500">実行中のログ</div>
      <div className="mt-2 space-y-2">
        {runs.map((run) => (
          <div key={run.id} className="flex flex-col gap-2 border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 md:flex-row md:items-center md:justify-between">
            <div>
              <div>{getTargetUrl(run)}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">開始: {formatDate(run.startedAt)} / 起点: {formatSource(run.source)}</div>
            </div>
            <a className="table-link" href={`/admin/seo-sales/runs/${run.id}`}>詳細を見る</a>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status, label }: { status: Status; label?: string }) {
  const styles = {
    passed: "status-passed",
    failed: "status-failed",
    skipped: "status-skipped",
    running: "status-running",
  };
  const icons = {
    passed: <CheckCircle2 className="h-3.5 w-3.5" />,
    failed: <XCircle className="h-3.5 w-3.5" />,
    skipped: <Clock3 className="h-3.5 w-3.5" />,
    running: <RefreshCw className="h-3.5 w-3.5" />,
  };
  return <span className={`inline-flex items-center gap-1 border bg-slate-100 px-2.5 py-1 text-xs font-black ${styles[status]}`}>{icons[status]}{label ?? formatStatus(status)}</span>;
}

function useApi<T>(path: string) {
  const cached = apiCache.get(path) as T | undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchPath = useCallback(async (targetPath: string, force = false, shouldApply: () => boolean = () => true) => {
    const cachedData = apiCache.get(targetPath) as T | undefined;
    if (cachedData && !force) {
      setData(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(withAdminToken(targetPath), { credentials: "same-origin" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = (await res.json()) as T;
      apiCache.set(targetPath, json);
      if (shouldApply()) setData(json);
    } catch (err) {
      if (shouldApply()) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      if (shouldApply()) setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    await fetchPath(path, true);
  }, [fetchPath, path]);

  useEffect(() => {
    let active = true;
    void fetchPath(path, false, () => active);
    return () => {
      active = false;
    };
  }, [fetchPath, path]);
  return { data, loading, error, reload: load };
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(withAdminToken(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = (await readJsonResponse(res)) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(withAdminToken(path), { credentials: "same-origin" });
  const json = (await readJsonResponse(res)) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

async function apiPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(withAdminToken(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = (await readJsonResponse(res)) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text.trim() || `API error: ${res.status}` };
}

function rememberAdminTokenFromUrl(): void {
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) return;
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // Session storage can be unavailable in hardened browsers; API calls will then require tokenized URLs.
  }
}

function readRememberedAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function withAdminToken(path: string): string {
  const token = readRememberedAdminToken();
  if (!token) return path;
  const url = new URL(path, window.location.origin);
  if (!url.searchParams.has("token")) url.searchParams.set("token", token);
  return `${url.pathname}${url.search}${url.hash}`;
}

function isActive(href: string, path: string): boolean {
  if (href === "/admin") return isAdminHome(path);
  if (href === "/admin/seo-sales") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

function isClientRoute(path: string): boolean {
  return isAdminHome(path) || path.startsWith("/admin/seo-sales");
}

function isAdminHome(path: string): boolean {
  return path === "/" || path === "/admin" || path === "/admin/";
}

function getAnchorFromEventTarget(target: EventTarget | null): HTMLAnchorElement | null {
  if (target instanceof HTMLAnchorElement) return target;
  if (target instanceof Element) return target.closest("a");
  if (target instanceof Text && target.parentElement) return target.parentElement.closest("a");
  return null;
}

function getTargetUrl(run: AgentRun): string {
  const candidates = [run.summary.targetUrl, run.input.targetUrl, run.input.url];
  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.length > 0);
  return typeof value === "string" ? value : "-";
}

function getSeoScore(run: AgentRun): number | null {
  const candidates = [run.summary.seoScore, run.summary.score, run.summary.latestScore];
  const value = candidates.find((candidate) => typeof candidate === "number" && Number.isFinite(candidate));
  return typeof value === "number" ? value : null;
}

function getOpportunityScore(run: AgentRun): number | null {
  const value = run.summary.opportunityScore;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getOpportunityFindings(run: AgentRun): OpportunityFinding[] {
  const value = run.summary.opportunityFindings;
  if (!Array.isArray(value)) return [];
  return value.filter(isOpportunityFinding);
}

function isOpportunityFinding(value: unknown): value is OpportunityFinding {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as OpportunityFinding).title === "string"
    && typeof (value as OpportunityFinding).recommendation === "string"
    && typeof (value as OpportunityFinding).scoreImpact === "number";
}

function formatDate(value?: string): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return "-";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatBytes(value?: number): string {
  if (!value || !Number.isFinite(value)) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatStatus(status: Status): string {
  return { running: "実行中", passed: "成功", failed: "失敗", skipped: "スキップ" }[status];
}

function formatSource(source: string): string {
  return { api: "API", telegram: "Telegram", manual: "手動", discovery: "自動候補発見" }[source] ?? source;
}

function formatDiscoveryStatus(status: DiscoveryReport["status"]): string {
  return { disabled: "無効", skipped: "候補なし", passed: "成功", failed: "失敗" }[status];
}

function formatDiscoverySummary(report: DiscoveryReport): string {
  if (report.status === "disabled") return "手動の候補発見は無効です。";
  if (report.runs.length > 0) return `${report.runs.length}件の解析を開始しました。`;
  if (report.candidateCount === 0) return "候補URLが見つかりませんでした。営業対象の業種を設定してください。";
  if (report.selectedCount === 0) return "新しく解析するURLはありませんでした。既に解析済み、またはURL検証で除外されています。";
  return "候補発見は完了しました。";
}

function formatSkipReason(reason: string): string {
  return {
    already_analyzed: "解析済み",
    discovery_sources_empty: "検索条件なし",
    no_candidates_found: "検索結果なし",
    "REVENUE_AGENT_DISCOVERY_SEED_URLS is empty": "候補設定なし",
  }[reason] ?? reason;
}

function formatStepName(name: string): string {
  return {
    crawl_and_score: "クロール・SEO採点",
    generate_proposal: "提案書生成",
    sendgrid_email: "メール送信",
    telegram_notification: "Telegram通知",
    stripe_payment_link: "決済リンク作成",
  }[name] ?? name;
}

function formatFindingCategory(category: string): string {
  return {
    technical: "技術SEO",
    content: "コンテンツ",
    intent: "検索意図",
    conversion: "CV導線",
    trust: "信頼材料",
  }[category] ?? category;
}

function formatFindingSeverity(severity: string): string {
  return { high: "高", medium: "中", low: "低" }[severity] ?? severity;
}

createRoot(document.getElementById("root")!).render(<App />);
