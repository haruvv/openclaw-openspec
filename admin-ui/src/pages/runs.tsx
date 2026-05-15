import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiCache, apiPost } from "../api";
import { Empty, ErrorState, Info, Loading, Panel, StatusPill } from "../components/common";
import { FindingsList, ProposalViewer, RunsTable } from "../components/tables";
import { useApi } from "../hooks";
import type { AgentRun, AgentRunDetail, LlmRevenueAudit, SeoDiagnostic } from "../types";
import { formatDate, formatDuration, formatRevenueAuditConfidence, formatRevenueAuditPriority, formatSource, formatStepName, getLlmRevenueAudit, getOpportunityFindings, getOpportunityScore, getSeoDiagnostics, getSeoScore, getTargetUrl, urlsMatch } from "../utils";

export function RunsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useApi<{ runs: AgentRun[] }>("/api/admin/seo-sales/runs");
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("url") ?? "";
  const detailSearch = urlFilter ? `?url=${encodeURIComponent(urlFilter)}` : "";
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const runs = data?.runs ?? [];
  const visibleRuns = urlFilter ? runs.filter((run) => urlsMatch(getTargetUrl(run), urlFilter)) : runs;

  async function rerunUrl() {
    if (!urlFilter) return;
    setRerunning(true);
    setRerunError(null);
    try {
      const result = await apiPost<{ location: string }>("/api/admin/seo-sales/runs", { url: urlFilter });
      apiCache.delete("/api/admin/seo-sales/runs");
      navigate(`${result.location}?url=${encodeURIComponent(urlFilter)}`);
    } catch (err) {
      setRerunError(err instanceof Error ? err.message : "再解析の開始に失敗しました");
      setRerunning(false);
    }
  }

  return (
    <Panel
      title={urlFilter ? "このURLの実行ログ" : "実行ログ"}
      action={urlFilter ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={rerunUrl} className="btn-primary" disabled={rerunning}><RefreshCw className="h-4 w-4" />このURLを再解析</button>
          <Link to="/admin/seo-sales/runs" className="btn-secondary">すべてのログ</Link>
        </div>
      ) : null}
    >
      {urlFilter ? <p className="mb-3 break-words border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">URL一覧から対象URLで絞り込んでいます: {urlFilter}</p> : null}
      {rerunError ? <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{rerunError}</p> : null}
      {loading ? <Loading /> : error ? <ErrorState message={error} /> : <RunsTable runs={visibleRuns} detailSearch={detailSearch} />}
    </Panel>
  );
}

export function RunDetailPage() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("url") ?? "";
  const runListPath = urlFilter ? `/admin/seo-sales/runs?url=${encodeURIComponent(urlFilter)}` : "";
  const { data, loading, error, reload } = useApi<{ run: AgentRunDetail }>(`/api/admin/seo-sales/runs/${encodeURIComponent(id)}`);
  const isRunning = data?.run?.status === "running";
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => void reload(), 3000);
    return () => window.clearInterval(timer);
  }, [isRunning, reload]);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const run = data?.run;
  if (!run) return <Empty title="実行が見つかりません" />;
  const targetUrl = getTargetUrl(run);
  const seoScore = getSeoScore(run);
  const opportunityScore = getOpportunityScore(run);
  const opportunityFindings = getOpportunityFindings(run);
  const diagnostics = getSeoDiagnostics(run);
  const revenueAudit = getLlmRevenueAudit(run);
  const domain = typeof run.summary.domain === "string" ? run.summary.domain : "-";
  const proposalArtifacts = run.artifacts.filter((artifact) => artifact.type === "proposal");
  return (
    <div className="space-y-5">
      <Panel
        title={targetUrl}
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {runListPath ? <Link to={runListPath} className="btn-secondary">このURLの実行ログへ戻る</Link> : null}
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
        {run.error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{run.error}</p> : null}
      </Panel>
      <Panel title="調査結果">
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Info label="ドメイン" value={domain} />
          <Info label="Lighthouse SEO" value={seoScore ?? "-"} />
          <Info label="改善余地スコア" value={opportunityScore ?? "-"} />
          <Info label="診断項目" value={`${diagnostics.length}件`} />
        </div>
        {opportunityFindings.length > 0 ? <FindingsList findings={opportunityFindings} /> : <Empty title="改善余地の詳細は記録されていません" />}
        {diagnostics.length > 0 ? <DiagnosticsTable diagnostics={diagnostics} /> : null}
      </Panel>
      <Panel title="営業評価">
        {revenueAudit ? <RevenueAuditView audit={revenueAudit} /> : <Empty title="営業評価はまだ生成されていません" description="既存の実行、またはLLM営業評価がスキップされた実行では、調査結果と営業提案書のみ表示されます。" />}
      </Panel>
      <Panel title="処理ステップ">
        {run.steps.length === 0 ? <Empty title="ステップ開始待ちです" description="サーバーが処理を開始すると、ここにステップ単位の進捗が表示されます。" /> : (
          <table className="data-table">
            <thead><tr><th>状態</th><th>名前</th><th>所要時間</th><th>理由 / エラー</th></tr></thead>
            <tbody>{run.steps.map((step) => <tr key={step.id}><td><StatusPill status={step.status} /></td><td>{formatStepName(step.name)}</td><td>{step.status === "running" ? "処理中" : `${step.durationMs} ms`}</td><td>{step.error ?? step.reason ?? ""}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>
      <Panel title="営業提案書">
        {proposalArtifacts.length === 0 ? <Empty title="営業提案書はまだ生成されていません" description="調査結果をもとに、メールでどう提案するかをまとめた提案書がここに表示されます。" /> : proposalArtifacts.map((artifact) => (
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

function RevenueAuditView({ audit }: { audit: LlmRevenueAudit }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Info label="営業優先度" value={formatRevenueAuditPriority(audit.salesPriority)} />
        <Info label="信頼度" value={formatRevenueAuditConfidence(audit.confidence)} />
        <Info label="推奨オファー" value={`${audit.recommendedOffer.name} / ${audit.recommendedOffer.estimatedPriceRange}`} />
      </div>
      <div className="border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-black text-slate-500">総評</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.overallAssessment}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.businessImpactSummary}</p>
      </div>
      <div className="border border-slate-200 bg-white p-4">
        <div className="text-xs font-black text-slate-500">推奨理由</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.recommendedOffer.description}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.recommendedOffer.reason}</p>
      </div>
      {audit.prioritizedFindings.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-black text-slate-500">優先指摘</div>
          {audit.prioritizedFindings.map((finding) => (
            <div key={`${finding.title}-${finding.salesAngle}`} className="border border-slate-200 bg-white p-3 text-sm">
              <div className="font-black text-slate-800">{finding.title}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">信頼度: {formatRevenueAuditConfidence(finding.confidence)}</div>
              <p className="mt-2 font-semibold leading-6 text-slate-700">{finding.businessImpact}</p>
              <p className="mt-1 font-semibold leading-6 text-slate-700">{finding.suggestedFix}</p>
              <p className="mt-1 font-semibold leading-6 text-slate-700">営業角度: {finding.salesAngle}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="border border-blue-100 bg-blue-50 p-4">
        <div className="text-xs font-black text-blue-800">初回接触案</div>
        <div className="mt-2 text-sm font-black text-slate-900">{audit.outreach.subject}</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.outreach.firstEmail}</p>
      </div>
      <div className="border border-slate-200 bg-white p-4">
        <div className="text-xs font-black text-slate-500">追撃文面案</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.outreach.followUpEmail}</p>
      </div>
      {audit.caveats.length > 0 ? (
        <div className="border border-amber-100 bg-amber-50 p-4">
          <div className="text-xs font-black text-amber-800">注意事項</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">
            {audit.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DiagnosticsTable({ diagnostics }: { diagnostics: SeoDiagnostic[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>診断項目</th><th>スコア</th><th>内容</th></tr></thead>
        <tbody>{diagnostics.map((diagnostic) => (
          <tr key={diagnostic.id}>
            <td>{diagnostic.title}</td>
            <td>{diagnostic.score === null ? "未計測" : `${Math.round(diagnostic.score * 100)}点`}</td>
            <td>{diagnostic.description || "-"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
