import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiPost } from "../api";
import { Empty, ErrorState, Info, Loading, Panel, StatusPill } from "../components/common";
import { FindingsList, ProposalViewer, RunsTable } from "../components/tables";
import { useApi } from "../hooks";
import type { AgentRun, AgentRunDetail } from "../types";
import { formatDate, formatDuration, formatSource, formatStepName, getOpportunityFindings, getOpportunityScore, getSeoScore, getTargetUrl, urlsMatch } from "../utils";

export function RunsPage() {
  const { data, loading, error } = useApi<{ runs: AgentRun[] }>("/api/admin/seo-sales/runs");
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("url") ?? "";
  const detailSearch = urlFilter ? `?url=${encodeURIComponent(urlFilter)}` : "";
  const runs = data?.runs ?? [];
  const visibleRuns = urlFilter ? runs.filter((run) => urlsMatch(getTargetUrl(run), urlFilter)) : runs;
  return (
    <Panel
      title={urlFilter ? "このURLの実行ログ" : "実行ログ"}
      action={urlFilter ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link to="/admin/seo-sales/runs" className="btn-secondary">すべてのログ</Link>
        </div>
      ) : null}
    >
      {urlFilter ? <p className="mb-3 break-words border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">URL一覧から対象URLで絞り込んでいます: {urlFilter}</p> : null}
      {loading ? <Loading /> : error ? <ErrorState message={error} /> : <RunsTable runs={visibleRuns} detailSearch={detailSearch} />}
    </Panel>
  );
}

export function RunDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("url") ?? "";
  const runListPath = urlFilter ? `/admin/seo-sales/runs?url=${encodeURIComponent(urlFilter)}` : "";
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
    navigate(result.location);
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
      <Panel
        title={targetUrl}
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {runListPath ? <Link to={runListPath} className="btn-secondary">このURLの実行ログへ戻る</Link> : null}
            <button onClick={retry} className="btn-primary" disabled={retrying}><RefreshCw className="h-4 w-4" />再実行</button>
          </div>
        )}
      >
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
