import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileText,
  Globe2,
  LayoutDashboard,
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
  artifacts: Array<{ id: string; type: string; label: string; pathOrUrl?: string; contentText?: string }>;
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
  proposals: Array<{ id: string; label: string; pathOrUrl?: string; contentText?: string; createdAt: string }>;
}

interface SettingsPayload {
  integrations: Array<{ label: string; key: string; configured: boolean }>;
  policies: Array<{ label: string; enabled: boolean }>;
}

const navItems = [
  { label: "業務アプリ", href: "/admin", icon: LayoutDashboard },
  { label: "SEO営業 概要", href: "/admin/seo-sales", icon: BriefcaseBusiness },
  { label: "URL別結果", href: "/admin/seo-sales/sites", icon: Globe2 },
  { label: "実行ログ", href: "/admin/seo-sales/runs", icon: Activity },
  { label: "外部サービス設定", href: "/admin/seo-sales/settings", icon: Settings },
];

function App() {
  const path = window.location.pathname;
  const page = routePage(path);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-slate-950 text-white lg:flex lg:flex-col">
        <a href="/admin" className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-950">RA</div>
          <div>
            <div className="text-sm font-black">RevenueAgent</div>
            <div className="text-xs font-semibold text-slate-400">Business Console</div>
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
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{page.description}</p>
            </div>
            <a href="/admin" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm">
              業務アプリ一覧
            </a>
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
  if (path === "/admin/seo-sales") return { title: "SEO営業", description: "クロール、SEO評価、提案書生成、通知、決済導線をまとめて管理します。", node: <SeoSalesHome /> };
  if (path === "/admin/seo-sales/sites") return { title: "URL別結果", description: "自動・手動クロールで解析されたURLの最新状態と履歴を確認します。", node: <SitesPage /> };
  if (path.startsWith("/admin/seo-sales/sites/")) return { title: "URL詳細", description: "最新のSEO結果、提案書、過去の解析履歴を確認します。", node: <SiteDetailPage id={decodeURIComponent(path.split("/").pop() ?? "")} /> };
  if (path === "/admin/seo-sales/runs") return { title: "実行ログ", description: "SEO営業ワークフローの実行状況、失敗、成果物を確認します。", node: <RunsPage /> };
  if (path.startsWith("/admin/seo-sales/runs/")) return { title: "実行詳細", description: "各ステップ、成果物、詳細データを確認し、必要なら再実行します。", node: <RunDetailPage id={decodeURIComponent(path.split("/").pop() ?? "")} /> };
  if (path === "/admin/seo-sales/settings") return { title: "外部サービス設定", description: "APIキーの設定状態と副作用ポリシーを確認します。", node: <SettingsPage /> };
  return { title: "業務アプリ", description: "SEO営業、株自動売買など、複数の自動業務をここから管理します。", node: <PortalPage /> };
}

function PortalPage() {
  const { data, loading } = useApi<{ apps: BusinessApp[] }>("/api/admin/apps");
  if (loading) return <Loading />;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(data?.apps ?? []).map((app) => (
        <section key={app.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
                <a href={app.entryPath} className="btn-primary">開く</a>
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
  );
}

function SeoSalesHome() {
  const { data, loading } = useApi<{
    totals: { runs: number; sites: number; failedRuns: number; latestScore: number | null };
    recentRuns: AgentRun[];
    recentSites: SiteRecord[];
  }>("/api/admin/seo-sales/overview");
  if (loading) return <Loading />;
  const totals = data?.totals;
  return (
    <div className="space-y-5">
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

function RunsPage() {
  const { data, loading, reload } = useApi<{ runs: AgentRun[] }>("/api/admin/seo-sales/runs");
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
      void reload();
    }
  }
  return (
    <div className="space-y-5">
      <Panel title="手動実行">
        <form onSubmit={runManual} className="flex flex-col gap-3 md:flex-row">
          <input value={url} onChange={(event) => setUrl(event.target.value)} className="input flex-1" type="url" placeholder="https://example.com" required />
          <button className="btn-primary" disabled={submitting}>{submitting ? "実行中..." : "RevenueAgentを実行"}</button>
        </form>
        {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
      </Panel>
      <Panel title="実行ログ">{loading ? <Loading /> : <RunsTable runs={data?.runs ?? []} />}</Panel>
    </div>
  );
}

function RunDetailPage({ id }: { id: string }) {
  const { data, loading, reload } = useApi<{ run: AgentRunDetail }>(`/api/admin/seo-sales/runs/${encodeURIComponent(id)}`);
  const [retrying, setRetrying] = useState(false);
  async function retry() {
    setRetrying(true);
    const result = await apiPost<{ location: string }>(`/api/admin/seo-sales/runs/${encodeURIComponent(id)}/retry`, {});
    window.location.href = result.location;
  }
  if (loading) return <Loading />;
  const run = data?.run;
  if (!run) return <Empty title="実行が見つかりません" />;
  return (
    <div className="space-y-5">
      <Panel title={String(run.summary.targetUrl ?? run.input.targetUrl ?? run.id)} action={<button onClick={retry} className="btn-primary" disabled={retrying}><RefreshCw className="h-4 w-4" />再実行</button>}>
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="状態" value={<StatusPill status={run.status} />} />
          <Info label="起点" value={formatSource(run.source)} />
          <Info label="開始" value={formatDate(run.startedAt)} />
          <Info label="所要時間" value={formatDuration(run.startedAt, run.completedAt)} />
        </div>
        {run.error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{run.error}</p> : null}
      </Panel>
      <Panel title="処理ステップ">
        <table className="data-table">
          <thead><tr><th>状態</th><th>名前</th><th>所要時間</th><th>理由 / エラー</th></tr></thead>
          <tbody>{run.steps.map((step) => <tr key={step.id}><td><StatusPill status={step.status} /></td><td>{formatStepName(step.name)}</td><td>{step.durationMs} ms</td><td>{step.error ?? step.reason ?? ""}</td></tr>)}</tbody>
        </table>
      </Panel>
      <Panel title="成果物">
        {run.artifacts.length === 0 ? <Empty title="成果物はありません" /> : run.artifacts.map((artifact) => (
          <article key={artifact.id} className="mb-4 rounded-lg border border-slate-200 p-4">
            <h3 className="font-black">{artifact.label}</h3>
            {artifact.pathOrUrl ? <p className="mt-2 rounded bg-slate-100 px-2 py-1 font-mono text-xs">{artifact.pathOrUrl}</p> : null}
            {artifact.contentText ? <pre className="mt-3 max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-50">{artifact.contentText}</pre> : null}
          </article>
        ))}
      </Panel>
    </div>
  );
}

function SitesPage() {
  const { data, loading } = useApi<{ sites: SiteRecord[] }>("/api/admin/seo-sales/sites");
  return <Panel title="解析済みURL">{loading ? <Loading /> : <SiteTable sites={data?.sites ?? []} />}</Panel>;
}

function SiteDetailPage({ id }: { id: string }) {
  const { data, loading } = useApi<{ site: SiteDetail }>(`/api/admin/seo-sales/sites/${encodeURIComponent(id)}`);
  if (loading) return <Loading />;
  const site = data?.site;
  if (!site) return <Empty title="URL結果が見つかりません" />;
  const latestProposal = site.proposals[0];
  return (
    <div className="space-y-5">
      <Panel title={site.displayUrl} action={site.latestRunId ? <a href={`/admin/seo-sales/runs/${site.latestRunId}`} className="btn-secondary">実行ログを開く</a> : null}>
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="状態" value={<StatusPill status={site.latestStatus} />} />
          <Info label="ドメイン" value={site.domain} />
          <Info label="SEOスコア" value={site.latestSeoScore ?? "-"} />
          <Info label="更新" value={formatDate(site.updatedAt)} />
        </div>
      </Panel>
      <Panel title="最新の提案書">
        {latestProposal ? (
          <>
            {latestProposal.pathOrUrl ? <p className="mb-3 rounded bg-slate-100 px-2 py-1 font-mono text-xs">{latestProposal.pathOrUrl}</p> : null}
            <pre className="max-h-[580px] overflow-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-50">{latestProposal.contentText ?? "本文は記録されていません。"}</pre>
          </>
        ) : <Empty title="提案書はまだありません" />}
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
  const { data, loading } = useApi<SettingsPayload>("/api/admin/seo-sales/settings");
  if (loading) return <Loading />;
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

function SiteTable({ sites, compact = false }: { sites: SiteRecord[]; compact?: boolean }) {
  if (sites.length === 0) return <Empty title="URL別結果はまだありません" />;
  return (
    <table className="data-table">
      <thead><tr><th>状態</th><th>URL</th><th>ドメイン</th><th>SEOスコア</th>{compact ? null : <th>更新</th>}<th>実行ログ</th></tr></thead>
      <tbody>{sites.map((site) => <tr key={site.id}><td><StatusPill status={site.latestStatus} /></td><td><a href={`/admin/seo-sales/sites/${site.id}`}>{site.displayUrl}</a></td><td>{site.domain}</td><td>{site.latestSeoScore ?? "-"}</td>{compact ? null : <td>{formatDate(site.updatedAt)}</td>}<td>{site.latestRunId ? <a href={`/admin/seo-sales/runs/${site.latestRunId}`}>開く</a> : "-"}</td></tr>)}</tbody>
    </table>
  );
}

function RunsTable({ runs, compact = false }: { runs: AgentRun[]; compact?: boolean }) {
  if (runs.length === 0) return <Empty title="実行履歴はまだありません" />;
  return (
    <table className="data-table">
      <thead><tr><th>状態</th><th>対象URL</th><th>起点</th>{compact ? null : <th>開始</th>}<th>所要時間</th></tr></thead>
      <tbody>{runs.map((run) => <tr key={run.id}><td><StatusPill status={run.status} /></td><td><a href={`/admin/seo-sales/runs/${run.id}`}>{String(run.summary.targetUrl ?? run.input.targetUrl ?? "-")}</a></td><td>{formatSource(run.source)}</td>{compact ? null : <td>{formatDate(run.startedAt)}</td>}<td>{formatDuration(run.startedAt, run.completedAt)}</td></tr>)}</tbody>
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

function Empty({ title }: { title: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">{title}</div>;
}

function Loading() {
  return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">読み込み中...</div>;
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
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setData((await res.json()) as T);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
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
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(`${href}/`);
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

function formatStatus(status: Status): string {
  return { running: "実行中", passed: "成功", failed: "失敗", skipped: "スキップ" }[status];
}

function formatSource(source: string): string {
  return { api: "API", telegram: "Telegram", manual: "手動" }[source] ?? source;
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
