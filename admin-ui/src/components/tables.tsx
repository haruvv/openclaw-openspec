import React from "react";
import { Link } from "react-router-dom";
import type { AgentRun, OpportunityFinding, SiteRecord } from "../types";
import { Empty, StatusPill } from "./common";
import { formatDate, formatDuration, formatFindingCategory, formatFindingSeverity, formatSource, getOpportunityScore, getSeoScore, getTargetUrl } from "../utils";

export function ProposalViewer({
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

export function SiteTable({ sites, compact = false }: { sites: SiteRecord[]; compact?: boolean }) {
  if (sites.length === 0) return <Empty title="URL一覧はまだありません" description="URLを解析すると、この一覧にサイトごとの最新結果が表示されます。" action={<Link to="/admin/seo-sales/runs" className="btn-secondary">URLを解析する</Link>} />;
  return (
    <table className="data-table">
      <thead><tr><th>状態</th><th>URL</th><th>ドメイン</th><th>Lighthouse SEO</th><th>改善余地</th>{compact ? null : <th>解析回数</th>}{compact ? null : <th>最終解析</th>}<th>実行ログ</th></tr></thead>
      <tbody>{sites.map((site) => <tr key={site.id}><td><StatusPill status={site.latestStatus} /></td><td><Link className="table-link" to={`/admin/seo-sales/sites/${site.id}`}>{site.displayUrl}</Link></td><td>{site.domain}</td><td>{site.latestSeoScore ?? "-"}</td><td>{site.latestOpportunityScore ?? "-"}</td>{compact ? null : <td>{site.snapshotCount}回</td>}{compact ? null : <td>{formatDate(site.updatedAt)}</td>}<td><Link className="table-link" to={`/admin/seo-sales/runs?url=${encodeURIComponent(site.normalizedUrl)}&returnTo=${encodeURIComponent(`/admin/seo-sales/sites/${site.id}`)}`}>開く</Link></td></tr>)}</tbody>
    </table>
  );
}

export function RunsTable({ runs, compact = false, detailSearch = "" }: { runs: AgentRun[]; compact?: boolean; detailSearch?: string }) {
  if (runs.length === 0) return <Empty title="実行履歴はまだありません" description="URLを解析すると、ここに実行ステータスと詳細ログが表示されます。" action={<Link to="/admin/seo-sales/runs" className="btn-secondary">URLを解析する</Link>} />;
  return (
    <table className="data-table">
      <thead><tr><th>状態</th><th>対象URL</th><th>Lighthouse SEO</th><th>改善余地</th><th>起点</th>{compact ? null : <th>開始</th>}<th>所要時間</th></tr></thead>
      <tbody>{runs.map((run) => <tr key={run.id}><td><StatusPill status={run.status} /></td><td><Link className="table-link" to={`/admin/seo-sales/runs/${run.id}${detailSearch}`}>{getTargetUrl(run)}</Link></td><td>{getSeoScore(run) ?? "-"}</td><td>{getOpportunityScore(run) ?? "-"}</td><td>{formatSource(run.source)}</td>{compact ? null : <td>{formatDate(run.startedAt)}</td>}<td>{formatDuration(run.startedAt, run.completedAt)}</td></tr>)}</tbody>
    </table>
  );
}

export function FindingsList({ findings }: { findings: OpportunityFinding[] }) {
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

export function RunningRunsList({ runs }: { runs: AgentRun[] }) {
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
            <Link className="table-link" to={`/admin/seo-sales/runs/${run.id}`}>詳細を見る</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
