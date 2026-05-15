import React, { useState } from "react";
import { Activity, Globe2, Search, Settings, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { apiCache, apiPost } from "../api";
import { Empty, ErrorState, Info, Loading, Metric, Panel, StatusPill } from "../components/common";
import { RunningRunsList } from "../components/tables";
import { useApi, useRunningRunsPoll } from "../hooks";
import type { AgentRun, DiscoveryReport, SiteRecord } from "../types";
import { formatDate, formatDiscoveryStatus, formatDiscoverySummary, formatDuration, formatSkipReason, formatSource, getOpportunityScore, getSeoScore, getTargetUrl } from "../utils";

export function SeoSalesHome() {
  const { data, loading, error } = useApi<{
    totals: { runs: number; sites: number; failedRuns: number };
    recentRuns: AgentRun[];
    recentSites: SiteRecord[];
  }>("/api/admin/seo-sales/overview");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const totals = data?.totals;
  return (
    <div className="space-y-5">
      <DiscoveryRunPanel />
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Activity />} label="最近の実行" value={totals?.runs ?? 0} />
        <Metric icon={<Globe2 />} label="解析済みURL" value={totals?.sites ?? 0} />
        <Metric icon={<XCircle />} label="失敗" value={totals?.failedRuns ?? 0} />
      </section>
      <section className="space-y-5">
        <Panel title="URL一覧" action={<Link to="/admin/seo-sales/sites" className="link-action">すべて見る</Link>}>
          <RecentSitesList sites={data?.recentSites ?? []} />
        </Panel>
        <Panel title="最近の実行" action={<Link to="/admin/seo-sales/runs" className="link-action">すべて見る</Link>}>
          <RecentRunsList runs={data?.recentRuns ?? []} />
        </Panel>
      </section>
    </div>
  );
}

function RecentSitesList({ sites }: { sites: SiteRecord[] }) {
  if (sites.length === 0) {
    return <Empty title="URL一覧はまだありません" description="URLを解析すると、サイトごとの最新状態がここに表示されます。" />;
  }

  return (
    <div className="space-y-3">
      {sites.map((site) => {
        const runListPath = `/admin/seo-sales/runs?url=${encodeURIComponent(site.normalizedUrl)}`;
        return (
          <article key={site.id} className="border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">
                <Link className="table-link break-all text-base" to={runListPath}>{site.displayUrl}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>{site.domain}</span>
                  <span>{site.snapshotCount}回解析</span>
                  <span>最終解析: {formatDate(site.updatedAt)}</span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 xl:w-[420px]">
                <Info label="状態" value={<StatusPill status={site.latestStatus} />} />
                <Info label="SEO" value={site.latestSeoScore ?? "-"} />
                <Info label="改善余地" value={site.latestOpportunityScore ?? "-"} />
              </div>
              <div className="flex shrink-0">
                <Link className="btn-secondary" to={runListPath}>実行ログを見る</Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RecentRunsList({ runs }: { runs: AgentRun[] }) {
  if (runs.length === 0) {
    return <Empty title="実行履歴はまだありません" description="URLを解析すると、直近の実行状況がここに表示されます。" />;
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <article key={run.id} className="border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <Link className="table-link break-all text-base" to={`/admin/seo-sales/runs/${run.id}`}>{getTargetUrl(run)}</Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span>開始: {formatDate(run.startedAt)}</span>
                <span>起点: {formatSource(run.source)}</span>
                <span>所要時間: {formatDuration(run.startedAt, run.completedAt)}</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:w-[420px]">
              <Info label="状態" value={<StatusPill status={run.status} />} />
              <Info label="SEO" value={getSeoScore(run) ?? "-"} />
              <Info label="改善余地" value={getOpportunityScore(run) ?? "-"} />
            </div>
            <div className="flex shrink-0">
              <Link className="btn-secondary" to={`/admin/seo-sales/runs/${run.id}`}>詳細を見る</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function DiscoveryRunPanel() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);
  const { runningRuns, lastCheckedAt } = useRunningRunsPoll({ enabled: running, source: "discovery", limit: 3 });

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
            <Link to="/admin/seo-sales/settings" className="btn-secondary h-12 px-5"><Settings className="h-4 w-4" />検索条件を確認</Link>
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
            <tbody>{report.runs.map((run) => <tr key={run.runId}><td><StatusPill status={run.status} /></td><td>{run.url}</td><td><Link className="table-link" to={`/admin/seo-sales/runs/${run.runId}`}>開く</Link></td></tr>)}</tbody>
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
