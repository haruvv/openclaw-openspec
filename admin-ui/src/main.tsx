import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  LayoutDashboard,
  PlayCircle,
  RefreshCw,
  Search,
  Settings,
  TrendingUp,
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
  steps: Array<{ id: string; name: string; status: Status; durationMs: number; reason?: string; error?: string }>;
  artifacts: Array<ArtifactRecord>;
}

interface SiteRecord {
  id: string;
  displayUrl: string;
  normalizedUrl: string;
  domain: string;
  latestStatus: Status;
  latestSeoScore?: number;
  latestRunId?: string;
  updatedAt: string;
}

interface SiteDetail extends SiteRecord {
  snapshots: Array<{ id: string; status: Status; seoScore?: number; diagnostics: unknown[]; createdAt: string; runId?: string; summary: Record<string, unknown> }>;
  proposals: Array<ProposalRecord>;
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
  policies: Array<{ label: string; enabled: boolean }>;
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

function App() {
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
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-slate-950 text-white lg:flex lg:flex-col">
        <a href="/admin" className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-950">RA</div>
          <div>
            <div className="text-sm font-black">RevenueAgent</div>
            <div className="text-xs font-semibold text-slate-400">業務自動化コンソール</div>
          </div>
        </a>
        <nav className="space-y-7 px-4">
          <SidebarGroup label="全体" items={navItems.slice(0, 1)} path={path} />
          <SidebarGroup label="SEO営業" items={navItems.slice(1)} path={path} />
          <div>
            <div className="px-3 text-[11px] font-bold uppercase tracking-normal text-slate-500">準備中</div>
            <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-600">
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
              <h1 className="text-2xl font-black tracking-normal text-slate-950">{page.title}</h1>
              {page.description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{page.description}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/admin/seo-sales/runs" className="btn-primary"><PlayCircle className="h-4 w-4" />URLを解析</a>
              <a href="/admin" className="btn-secondary">業務アプリ一覧</a>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold ${isActive(item.href, path) ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}>
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-6 md:px-8">{page.node}</main>
      </div>
    </div>
  );
}

function SidebarGroup({ label, items, path }: { label: string; items: typeof navItems; path: string }) {
  return (
    <div>
      <div className="px-3 text-[11px] font-bold uppercase tracking-normal text-slate-500">{label}</div>
      <div className="mt-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold ${isActive(item.href, path) ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <Icon className="h-4 w-4" />
              {item.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function routePage(path: string): { title: string; description: string; node: React.ReactNode } {
  if (path === "/admin/seo-sales") return { title: "SEO営業", description: "URL解析、提案書、実行状況を確認します。", node: <SeoSalesHome /> };
  if (path === "/admin/seo-sales/sites") return { title: "URL別結果", description: "解析済みURLの最新状態です。", node: <SitesPage /> };
  if (path.startsWith("/admin/seo-sales/sites/")) return { title: "URL詳細", description: "", node: <SiteDetailPage id={decodeURIComponent(path.split("/").pop() ?? "")} /> };
  if (path === "/admin/seo-sales/runs") return { title: "実行ログ", description: "解析の実行履歴です。", node: <RunsPage /> };
  if (path.startsWith("/admin/seo-sales/runs/")) return { title: "実行詳細", description: "", node: <RunDetailPage id={decodeURIComponent(path.split("/").pop() ?? "")} /> };
  if (path === "/admin/seo-sales/settings") return { title: "外部サービス設定", description: "連携設定と実行ポリシーです。", node: <SettingsPage /> };
  return { title: "業務アプリ", description: "管理対象の業務一覧です。", node: <PortalPage /> };
}

function PortalPage() {
  const { data, loading, error } = useApi<{ apps: BusinessApp[] }>("/api/admin/apps");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data?.apps ?? []).map((app) => (
        <section key={app.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                {app.id === "stock-trading" ? <TrendingUp className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-lg font-black tracking-normal">{app.name}</h2>
                <StatusPill status={app.status === "active" ? "passed" : "skipped"} label={app.status === "active" ? "稼働中" : "準備中"} />
              </div>
            </div>
          </div>
          <p className="mt-4 min-h-12 text-sm text-slate-600">{app.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {app.status === "active" ? (
              <>
                <a href={app.entryPath} className="btn-primary">開く<ChevronRight className="h-4 w-4" /></a>
                {app.primaryLinks.map((link) => (
                  <a key={link.href} href={link.href} className="btn-secondary">{link.label}</a>
                ))}
              </>
            ) : (
              <span className="text-sm font-bold text-slate-500">近日追加予定</span>
            )}
          </div>
        </section>
        ))}
      </div>
    </div>
  );
}

function SeoSalesHome() {
  const { data, loading, error, reload } = useApi<{
    totals: { runs: number; sites: number; failedRuns: number; latestScore: number | null };
    recentRuns: AgentRun[];
    recentSites: SiteRecord[];
  }>("/api/admin/seo-sales/overview");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const totals = data?.totals;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="新規解析">
          <ManualRunForm onDone={reload} />
        </Panel>
        <DiscoveryRunPanel onDone={reload} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={<Activity />} label="最近の実行" value={totals?.runs ?? 0} />
        <Metric icon={<Globe2 />} label="解析済みURL" value={totals?.sites ?? 0} />
        <Metric icon={<XCircle />} label="失敗" value={totals?.failedRuns ?? 0} />
        <Metric icon={<Search />} label="最新SEOスコア" value={totals?.latestScore ?? "-"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="最近のURL結果" action={<a href="/admin/seo-sales/sites" className="link-action">すべて見る</a>}>
          <SiteTable sites={data?.recentSites ?? []} compact />
        </Panel>
        <Panel title="最近の実行" action={<a href="/admin/seo-sales/runs" className="link-action">すべて見る</a>}>
          <RunsTable runs={data?.recentRuns ?? []} compact />
        </Panel>
      </div>
    </div>
  );
}

function DiscoveryRunPanel({ onDone }: { onDone?: () => void | Promise<void> }) {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);

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
      await onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "候補発見に失敗しました");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Panel
      title="自動候補発見"
      action={<button onClick={runDiscovery} className="btn-primary" disabled={running}><Search className="h-4 w-4" />{running ? "実行中..." : "今すぐ実行"}</button>}
    >
      <div className="space-y-4">
        <p className="text-sm font-semibold leading-6 text-slate-600">検索条件からURL候補を探し、未解析のURLだけを上限件数まで解析します。</p>
        {running ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">
            候補発見を実行中です。検索と解析が入る場合は少し時間がかかります。
          </div>
        ) : null}
        {report ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
              {formatDiscoverySummary(report)}
              {lastCompletedAt ? <span className="ml-2 text-xs font-semibold text-slate-500">完了: {formatDate(lastCompletedAt)}</span> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Info label="状態" value={<StatusPill status={report.status === "disabled" ? "skipped" : report.status} label={formatDiscoveryStatus(report.status)} />} />
              <Info label="候補" value={`${report.candidateCount}件`} />
              <Info label="解析開始" value={`${report.selectedCount}件`} />
              <Info label="上限" value={`${report.quota}件/日`} />
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
          <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">手動の候補発見は無効です。Cloudflare の環境変数で REVENUE_AGENT_DISCOVERY_MANUAL_ENABLED=false になっていないか確認してください。</p>
        ) : null}
        {report?.status === "skipped" ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">解析できる新規候補がありませんでした。</p>
        ) : null}
        {report?.skipped.length ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-black text-slate-500">スキップ理由</div>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
              {report.skipped.slice(0, 5).map((item, index) => <li key={`${item.url}-${index}`}>{item.url}: {formatSkipReason(item.reason)}</li>)}
            </ul>
          </div>
        ) : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        <a href="/admin/seo-sales/settings" className="inline-flex items-center gap-1 text-sm font-black text-blue-700">設定を確認する<ArrowUpRight className="h-4 w-4" /></a>
      </div>
    </Panel>
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
  const { data, loading, error } = useApi<{ run: AgentRunDetail }>(`/api/admin/seo-sales/runs/${encodeURIComponent(id)}`);
  const [retrying, setRetrying] = useState(false);
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
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Info label="ドメイン" value={domain} />
          <Info label="SEOスコア" value={seoScore ?? "-"} />
          <Info label="提案書" value={`${proposalArtifacts.length}件`} />
          <Info label="成果物" value={`${run.artifacts.length}件`} />
        </div>
        {run.error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{run.error}</p> : null}
      </Panel>
      <Panel title="処理ステップ">
        <table className="data-table">
          <thead><tr><th>状態</th><th>名前</th><th>所要時間</th><th>理由 / エラー</th></tr></thead>
          <tbody>{run.steps.map((step) => <tr key={step.id}><td><StatusPill status={step.status} /></td><td>{formatStepName(step.name)}</td><td>{step.durationMs} ms</td><td>{step.error ?? step.reason ?? ""}</td></tr>)}</tbody>
        </table>
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
  const passedSnapshots = site.snapshots.filter((snapshot) => snapshot.status === "passed").length;
  return (
    <div className="space-y-5">
      <Panel title={site.displayUrl} action={site.latestRunId ? <a href={`/admin/seo-sales/runs/${site.latestRunId}`} className="btn-secondary">実行ログを開く</a> : null}>
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="状態" value={<StatusPill status={site.latestStatus} />} />
          <Info label="ドメイン" value={site.domain} />
          <Info label="SEOスコア" value={site.latestSeoScore ?? "-"} />
          <Info label="更新" value={formatDate(site.updatedAt)} />
        </div>
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
          <thead><tr><th>状態</th><th>SEOスコア</th><th>診断項目</th><th>作成</th><th>実行ログ</th></tr></thead>
          <tbody>{site.snapshots.map((snapshot) => <tr key={snapshot.id}><td><StatusPill status={snapshot.status} /></td><td>{snapshot.seoScore ?? "-"}</td><td>{snapshot.diagnostics.length}</td><td>{formatDate(snapshot.createdAt)}</td><td>{snapshot.runId ? <a href={`/admin/seo-sales/runs/${snapshot.runId}`}>開く</a> : "-"}</td></tr>)}</tbody>
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
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="外部サービス設定">
        <table className="data-table">
          <tbody>{data?.integrations.map((item) => <tr key={item.key}><th>{item.label}</th><td><StatusPill status={item.configured ? "passed" : "skipped"} label={item.configured ? "設定済み" : "未設定"} /></td></tr>)}</tbody>
        </table>
      </Panel>
      <Panel title="副作用の許可設定">
        <table className="data-table">
          <tbody>{data?.policies.map((item) => <tr key={item.label}><th>{item.label}</th><td><StatusPill status={item.enabled ? "passed" : "skipped"} label={item.enabled ? "有効" : "無効"} /></td></tr>)}</tbody>
        </table>
      </Panel>
    </div>
  );
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
    <article className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-950">{title}</h3>
            {createdAt ? <div className="mt-1 text-xs font-semibold text-slate-500">{formatDate(createdAt)}</div> : null}
          </div>
          {pathOrUrl ? <div className="max-w-full rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 md:max-w-xl">{pathOrUrl}</div> : null}
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
      <thead><tr><th>状態</th><th>URL</th><th>ドメイン</th><th>SEOスコア</th>{compact ? null : <th>更新</th>}<th>実行ログ</th></tr></thead>
      <tbody>{sites.map((site) => <tr key={site.id}><td><StatusPill status={site.latestStatus} /></td><td><a className="table-link" href={`/admin/seo-sales/sites/${site.id}`}>{site.displayUrl}</a></td><td>{site.domain}</td><td>{site.latestSeoScore ?? "-"}</td>{compact ? null : <td>{formatDate(site.updatedAt)}</td>}<td>{site.latestRunId ? <a className="table-link" href={`/admin/seo-sales/runs/${site.latestRunId}`}>開く</a> : "-"}</td></tr>)}</tbody>
    </table>
  );
}

function RunsTable({ runs, compact = false }: { runs: AgentRun[]; compact?: boolean }) {
  if (runs.length === 0) return <Empty title="実行履歴はまだありません" description="URLを解析すると、ここに実行ステータスと詳細ログが表示されます。" action={<a href="/admin/seo-sales/runs" className="btn-primary">URLを解析する</a>} />;
  return (
    <table className="data-table">
      <thead><tr><th>状態</th><th>対象URL</th><th>SEOスコア</th><th>起点</th>{compact ? null : <th>開始</th>}<th>所要時間</th></tr></thead>
      <tbody>{runs.map((run) => <tr key={run.id}><td><StatusPill status={run.status} /></td><td><a className="table-link" href={`/admin/seo-sales/runs/${run.id}`}>{getTargetUrl(run)}</a></td><td>{getSeoScore(run) ?? "-"}</td><td>{formatSource(run.source)}</td>{compact ? null : <td>{formatDate(run.startedAt)}</td>}<td>{formatDuration(run.startedAt, run.completedAt)}</td></tr>)}</tbody>
    </table>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-black tracking-normal">{title}</h2>{action}</div>{children}</section>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="text-sm font-bold text-slate-500">{label}</div><div className="text-blue-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</div></div><div className="mt-3 text-3xl font-black tracking-normal">{value}</div></section>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-sm font-black">{value}</div></div>;
}

function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div className="text-sm font-black text-slate-700">{title}</div>{description ? <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">{description}</p> : null}{action ? <div className="mt-4 flex justify-center">{action}</div> : null}</div>;
}

function Loading() {
  return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">読み込み中...</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />読み込みに失敗しました</div><p className="mt-2 font-semibold">{message}</p></div>;
}

function ManualRunForm({ onDone }: { onDone?: () => void | Promise<void> }) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
    </form>
  );
}

function StatusPill({ status, label }: { status: Status; label?: string }) {
  const styles = {
    passed: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    skipped: "bg-slate-100 text-slate-600",
    running: "bg-blue-50 text-blue-700",
  };
  const icons = {
    passed: <CheckCircle2 className="h-3.5 w-3.5" />,
    failed: <XCircle className="h-3.5 w-3.5" />,
    skipped: <Clock3 className="h-3.5 w-3.5" />,
    running: <RefreshCw className="h-3.5 w-3.5" />,
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${styles[status]}`}>{icons[status]}{label ?? formatStatus(status)}</span>;
}

function useApi<T>(path: string) {
  const cached = apiCache.get(path) as T | undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  async function fetchPath(targetPath: string, force = false, shouldApply: () => boolean = () => true) {
    const cachedData = apiCache.get(targetPath) as T | undefined;
    if (cachedData && !force) {
      setData(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(targetPath, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = (await res.json()) as T;
      apiCache.set(targetPath, json);
      if (shouldApply()) setData(json);
    } catch (err) {
      if (shouldApply()) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      if (shouldApply()) setLoading(false);
    }
  }

  async function load() {
    await fetchPath(path, true);
  }

  useEffect(() => {
    let active = true;
    void fetchPath(path, false, () => active);
    return () => {
      active = false;
    };
  }, [path]);
  return { data, loading, error, reload: load };
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

function isActive(href: string, path: string): boolean {
  if (href === "/admin" || href === "/admin/seo-sales") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

function isClientRoute(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/seo-sales");
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
  if (report.candidateCount === 0) return "候補URLが見つかりませんでした。検索キーワードまたは固定候補を設定してください。";
  if (report.selectedCount === 0) return "新しく解析するURLはありませんでした。既に解析済み、またはURL検証で除外されています。";
  return "候補発見は完了しました。";
}

function formatSkipReason(reason: string): string {
  return {
    already_analyzed: "解析済み",
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

createRoot(document.getElementById("root")!).render(<App />);
