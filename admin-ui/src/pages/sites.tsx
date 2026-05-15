import React from "react";
import { Link, useParams } from "react-router-dom";
import { Empty, ErrorState, Info, Loading, Panel, StatusPill } from "../components/common";
import { FindingsList, ProposalViewer, SiteTable } from "../components/tables";
import { useApi } from "../hooks";
import type { SiteDetail, SiteRecord } from "../types";
import { formatBytes, formatDate } from "../utils";

export function SitesPage() {
  const { data, loading, error } = useApi<{ sites: SiteRecord[] }>("/api/admin/seo-sales/sites");
  return <Panel title="URL一覧">{loading ? <Loading /> : error ? <ErrorState message={error} /> : <SiteTable sites={data?.sites ?? []} />}</Panel>;
}

export function SiteDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useApi<{ site: SiteDetail }>(`/api/admin/seo-sales/sites/${encodeURIComponent(id)}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const site = data?.site;
  if (!site) return <Empty title="URL結果が見つかりません" />;
  const latestProposal = site.proposals[0];
  const latestSnapshot = site.snapshots[0];
  const passedSnapshots = site.snapshots.filter((snapshot) => snapshot.status === "passed").length;
  const sitePath = `/admin/seo-sales/sites/${site.id}`;
  const runLogPath = `/admin/seo-sales/runs?url=${encodeURIComponent(site.normalizedUrl)}&returnTo=${encodeURIComponent(sitePath)}`;
  return (
    <div className="space-y-5">
      <Panel title={site.displayUrl} action={<Link to={runLogPath} className="btn-secondary">このURLの実行ログ</Link>}>
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="状態" value={<StatusPill status={site.latestStatus} />} />
          <Info label="ドメイン" value={site.domain} />
          <Info label="Lighthouse SEO" value={site.latestSeoScore ?? "-"} />
          <Info label="改善余地スコア" value={site.latestOpportunityScore ?? "-"} />
        </div>
        {latestSnapshot?.opportunityFindings.length ? <FindingsList findings={latestSnapshot.opportunityFindings.slice(0, 3)} /> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Info label="解析回数" value={`${site.snapshotCount}回`} />
          <Info label="成功回数" value={`${passedSnapshots}回`} />
          <Info label="提案書" value={`${site.proposals.length}件`} />
          <Info label="最新実行" value={site.latestRunId ? <Link className="table-link" to={`/admin/seo-sales/runs/${site.latestRunId}?returnTo=${encodeURIComponent(sitePath)}&logList=${encodeURIComponent(runLogPath)}`}>最新ログを開く</Link> : "-"} />
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
            <tbody>{site.proposals.map((proposal) => <tr key={proposal.id}><td>{formatDate(proposal.createdAt)}</td><td>{proposal.label}</td><td>{proposal.pathOrUrl ?? proposal.objectKey ?? "-"}</td><td>{formatBytes(proposal.byteSize)}</td><td>{proposal.runId ? <Link className="table-link" to={`/admin/seo-sales/runs/${proposal.runId}`}>開く</Link> : "-"}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>
      <Panel title="解析履歴">
        <table className="data-table">
          <thead><tr><th>状態</th><th>Lighthouse SEO</th><th>改善余地</th><th>診断項目</th><th>作成</th><th>実行ログ</th></tr></thead>
          <tbody>{site.snapshots.map((snapshot) => <tr key={snapshot.id}><td><StatusPill status={snapshot.status} /></td><td>{snapshot.seoScore ?? "-"}</td><td>{snapshot.opportunityScore ?? "-"}</td><td>{snapshot.diagnostics.length + snapshot.opportunityFindings.length}</td><td>{formatDate(snapshot.createdAt)}</td><td>{snapshot.runId ? <Link className="table-link" to={`/admin/seo-sales/runs/${snapshot.runId}`}>開く</Link> : "-"}</td></tr>)}</tbody>
        </table>
      </Panel>
    </div>
  );
}
