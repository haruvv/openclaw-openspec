import React from "react";
import { BookOpen, ClipboardList, LineChart, ShieldCheck, TrendingUp, WalletCards } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Empty, ErrorState, Info, Loading, Metric, Panel, StatusPill } from "../components/common";
import { useApi } from "../hooks";
import type {
  StockAiDecision,
  StockAiDecisionDetail,
  StockIntegrationStatus,
  StockLearningItem,
  StockPortfolioMetrics,
  StockTrade,
  StockTradingOverview,
} from "../types";
import { formatCurrency, formatDate, formatPercent } from "../utils";

export function StockTradingHome() {
  const { data, loading, error } = useApi<StockTradingOverview>("/api/admin/stock-trading/overview");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const portfolio = data?.portfolio;
  return (
    <div className="space-y-5">
      <PaperOnlyBanner message={data?.safety.message ?? "内部ペーパー取引のみ"} />
      <PortfolioMetrics portfolio={portfolio} />
      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="AI判断" action={<Link className="link-action" to="/admin/stock-trading/decisions">すべて見る</Link>}>
          <DecisionList decisions={data?.recentDecisions ?? []} compact />
        </Panel>
        <Panel title="取引履歴" action={<Link className="link-action" to="/admin/stock-trading/trades">すべて見る</Link>}>
          <TradeList trades={data?.recentTrades ?? []} compact />
        </Panel>
        <Panel title="学習ログ" action={<Link className="link-action" to="/admin/stock-trading/lessons">すべて見る</Link>}>
          <LessonList lessons={data?.recentLessons ?? []} compact />
        </Panel>
        <Panel title="連携状態" action={<Link className="link-action" to="/admin/stock-trading/settings">確認する</Link>}>
          <IntegrationList integrations={data?.integrations ?? []} />
        </Panel>
      </section>
    </div>
  );
}

export function StockDecisionsPage() {
  const { data, loading, error } = useApi<{ decisions: StockAiDecision[] }>("/api/admin/stock-trading/decisions");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <Panel title="AI判断">
      <DecisionList decisions={data?.decisions ?? []} />
    </Panel>
  );
}

export function StockDecisionDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useApi<{ decision: StockAiDecisionDetail }>(`/api/admin/stock-trading/decisions/${encodeURIComponent(id)}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const decision = data?.decision;
  if (!decision) return <Empty title="AI判断が見つかりません" />;
  return (
    <div className="space-y-5">
      <Panel title={`${decision.symbol} / ${decision.finalAction}`}>
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="信頼度" value={formatPercent(decision.confidence)} />
          <Info label="戦略" value={decision.strategyTag ?? "-"} />
          <Info label="利確" value={formatCurrency(decision.takeProfitPrice)} />
          <Info label="損切り" value={formatCurrency(decision.stopLossPrice)} />
        </div>
        <div className="mt-4 border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">{decision.reasoning}</div>
        {decision.riskFactors.length ? (
          <div className="mt-4">
            <div className="text-xs font-black text-slate-500">リスク要因</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {decision.riskFactors.map((risk) => <span key={risk} className="border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">{risk}</span>)}
            </div>
          </div>
        ) : null}
      </Panel>
      <Panel title="Agent意見">
        {decision.agents.length === 0 ? <Empty title="Agent意見はまだありません" /> : (
          <div className="grid gap-3">
            {decision.agents.map((agent) => {
              const rejected = agent.agentName.toLowerCase().includes("risk") && agent.stance.toLowerCase().includes("reject");
              return (
                <article key={agent.id} className={`border p-4 ${rejected ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-black text-slate-950">{agent.agentName}</div>
                      <div className="mt-1 text-sm font-bold text-slate-600">{agent.summary}</div>
                    </div>
                    <div className="grid min-w-44 grid-cols-2 gap-2">
                      <Info label="score" value={agent.score} />
                      <Info label="stance" value={agent.stance} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{agent.reasoning}</p>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

export function StockTradesPage() {
  const { data, loading, error } = useApi<{ trades: StockTrade[] }>("/api/admin/stock-trading/trades");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <Panel title="取引履歴">
      <TradeList trades={data?.trades ?? []} />
    </Panel>
  );
}

export function StockLessonsPage() {
  const { data, loading, error } = useApi<{ lessons: StockLearningItem[] }>("/api/admin/stock-trading/lessons");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <Panel title="学習ログ">
      <LessonList lessons={data?.lessons ?? []} />
    </Panel>
  );
}

export function StockSettingsPage() {
  const { data, loading, error } = useApi<{ integrations: StockIntegrationStatus[]; safety: StockTradingOverview["safety"] }>("/api/admin/stock-trading/settings");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="space-y-5">
      <PaperOnlyBanner message={data?.safety.message ?? "内部ペーパー取引のみ"} />
      <Panel title="連携設定">
        <IntegrationList integrations={data?.integrations ?? []} />
      </Panel>
    </div>
  );
}

function PaperOnlyBanner({ message }: { message: string }) {
  return (
    <section className="border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <div className="text-sm font-black">Paper-only</div>
          <div className="mt-1 text-sm font-semibold leading-6">{message}</div>
        </div>
      </div>
    </section>
  );
}

function PortfolioMetrics({ portfolio }: { portfolio?: StockPortfolioMetrics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<WalletCards />} label="現在評価額" value={formatCurrency(portfolio?.currentEquity)} />
      <Metric icon={<TrendingUp />} label="現金残高" value={formatCurrency(portfolio?.cashBalance)} />
      <Metric icon={<LineChart />} label="確定損益" value={formatCurrency(portfolio?.realizedPnl)} />
      <Metric icon={<ClipboardList />} label="勝率" value={formatPercent(portfolio?.winRate)} />
      <Metric icon={<WalletCards />} label="初期資金" value={formatCurrency(portfolio?.initialCapital)} />
      <Metric icon={<TrendingUp />} label="含み損益" value={formatCurrency(portfolio?.unrealizedPnl)} />
      <Metric icon={<LineChart />} label="最大DD" value={formatPercent(portfolio?.maximumDrawdown)} />
      <Metric icon={<BookOpen />} label="Snapshot" value={portfolio?.latestSnapshot ? formatDate(portfolio.latestSnapshot.capturedAt) : "-"} />
      {!portfolio?.latestSnapshot ? (
        <div className="sm:col-span-2 xl:col-span-4">
          <Empty title="内部ペーパー資産はまだありません" description="portfolio snapshot を記録すると、評価額と損益がここに表示されます。ブローカー口座への接続失敗ではありません。" />
        </div>
      ) : null}
    </section>
  );
}

function DecisionList({ decisions, compact = false }: { decisions: StockAiDecision[]; compact?: boolean }) {
  if (decisions.length === 0) return <Empty title="AI判断はまだありません" description="内部ペーパー用の判断ログが保存されるとここに表示されます。" />;
  return (
    <div className="space-y-3">
      {decisions.map((decision) => (
        <article key={decision.id} className="border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <Link className="table-link text-base" to={`/admin/stock-trading/decisions/${decision.id}`}>{decision.symbol} / {decision.finalAction}</Link>
              <div className="mt-1 text-xs font-semibold text-slate-500">{decision.strategyTag ?? "-"} / {formatDate(decision.createdAt)}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:w-72">
              <Info label="信頼度" value={formatPercent(decision.confidence)} />
              <Info label="リスク" value={decision.riskFactors[0] ?? "-"} />
            </div>
          </div>
          {!compact ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{decision.reasoning}</p> : null}
        </article>
      ))}
    </div>
  );
}

function TradeList({ trades, compact = false }: { trades: StockTrade[]; compact?: boolean }) {
  if (trades.length === 0) return <Empty title="内部ペーパー取引はまだありません" description="取引を記録しても実弾注文として扱われません。" />;
  return (
    <table className="data-table">
      <thead><tr><th>日時</th><th>銘柄</th><th>売買</th><th>数量</th><th>価格</th><th>元</th><th>損益</th></tr></thead>
      <tbody>
        {trades.map((trade) => (
          <tr key={trade.id}>
            <td>{formatDate(trade.executedAt)}</td>
            <td className="font-black">{trade.symbol}</td>
            <td>{trade.side}</td>
            <td>{trade.quantity}</td>
            <td>{formatCurrency(trade.price)}</td>
            <td>{formatExecutionSource(trade.executionSource)}</td>
            <td>{formatCurrency(trade.realizedPnl)}{!compact && trade.outcome ? ` / ${trade.outcome}` : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LessonList({ lessons, compact = false }: { lessons: StockLearningItem[]; compact?: boolean }) {
  if (lessons.length === 0) return <Empty title="学習ログはまだありません" description="取引レビューから勝ちパターン、負けパターン、ルール候補が保存されるとここに表示されます。" />;
  return (
    <div className="space-y-3">
      {lessons.map((lesson) => (
        <article key={lesson.id} className="border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-base font-black">{lesson.title}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{formatLearningCategory(lesson.category)} / {formatDate(lesson.createdAt)}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:w-72">
              <Info label="信頼度" value={formatPercent(lesson.confidence)} />
              <Info label="Skill反映" value={lesson.appliedToSkill ? "済" : "未"} />
            </div>
          </div>
          {!compact ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{lesson.body}</p> : null}
        </article>
      ))}
    </div>
  );
}

function IntegrationList({ integrations }: { integrations: StockIntegrationStatus[] }) {
  if (integrations.length === 0) return <Empty title="連携情報はまだありません" />;
  return (
    <div className="space-y-3">
      {integrations.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-4 border border-slate-200 bg-white p-4">
          <div>
            <div className="text-sm font-black">{item.label}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">{item.key} / {formatIntegrationPurpose(item.purpose)}</div>
          </div>
          <StatusPill status={item.configured ? "passed" : "skipped"} label={item.configured ? "設定済み" : "未設定"} />
        </div>
      ))}
    </div>
  );
}

function formatExecutionSource(value: string): string {
  return { paper: "内部ペーパー", demo: "デモ", manual: "手入力" }[value] ?? value;
}

function formatLearningCategory(value: string): string {
  return {
    winning_pattern: "勝ちパターン",
    losing_pattern: "負けパターン",
    rule_candidate: "ルール候補",
    blocked_pattern: "禁止パターン",
    strategy_note: "戦略メモ",
  }[value] ?? value;
}

function formatIntegrationPurpose(value: string): string {
  return { market_data: "価格・市場データ", broker: "証券API", webhook: "Webhook" }[value] ?? value;
}
