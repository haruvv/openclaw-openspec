import React from "react";
import { BookOpen, ClipboardList, Code2, FileText, KeyRound, Link2, LineChart, Radar, ShieldCheck, TrendingUp, WalletCards } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { apiPatch, apiPost } from "../api";
import { Empty, ErrorState, Info, Loading, Metric, Panel, StatusPill } from "../components/common";
import { useApi } from "../hooks";
import type {
  StockBacktestRun,
  StockAiDecision,
  StockAiDecisionDetail,
  StockIntegrationStatus,
  StockLearningItem,
  StockMarketCandidate,
  StockMarketDataCollectionRun,
  StockMarketDataWatchlistEntry,
  StockMarketSignal,
  StockPortfolioMetrics,
  StockPosition,
  StockResearchCategory,
  StockResearchItem,
  StockResearchSentiment,
  StockRunnerStatus,
  StockStrategyPerformance,
  StockTrade,
  StockTradingOverview,
  StockTradingRule,
  StockTradingSettings,
} from "../types";
import { formatCurrency, formatDate, formatPercent } from "../utils";

const TRADINGVIEW_ALERT_TEMPLATE = `{
  "symbol": "{{ticker}}",
  "timeframe": "{{interval}}",
  "price": {{close}},
  "action": "BUY",
  "strategy": "breakout_momentum",
  "indicators": {
    "rsi": "{{plot(\"RSI\")}}",
    "ema20": "{{plot(\"EMA20\")}}",
    "ema50": "{{plot(\"EMA50\")}}"
  }
}`;

export function StockTradingHome() {
  const { data, loading, error, reload } = useApi<StockTradingOverview>("/api/admin/stock-trading/overview");
  const [exitReviewError, setExitReviewError] = React.useState<string | null>(null);
  const [exitReviewSymbol, setExitReviewSymbol] = React.useState<string | null>(null);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const portfolio = data?.portfolio;

  async function reviewExit(position: StockPosition) {
    setExitReviewSymbol(position.symbol);
    setExitReviewError(null);
    try {
      await apiPost(`/api/admin/stock-trading/positions/${encodeURIComponent(position.symbol)}/exit-review`, {});
      await reload();
    } catch (err) {
      setExitReviewError(err instanceof Error ? err.message : "Exit確認に失敗しました");
    } finally {
      setExitReviewSymbol(null);
    }
  }

  return (
    <div className="space-y-5">
      <PaperOnlyBanner message={data?.safety.message ?? "内部ペーパー取引のみ"} />
      <PortfolioMetrics portfolio={portfolio} />
      <RunnerStatus runner={data?.runner} />
      <Panel title="保有ポジション">
        {exitReviewError ? <ErrorState message={exitReviewError} /> : null}
        <PositionList positions={portfolio?.positions ?? []} busySymbol={exitReviewSymbol} onExitReview={(position) => void reviewExit(position)} />
      </Panel>
      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="AI候補銘柄" action={<Link className="link-action" to="/admin/stock-trading/candidates">すべて見る</Link>}>
          <CandidateList candidates={data?.recentCandidates ?? []} compact />
        </Panel>
        <Panel title="リサーチ材料" action={<Link className="link-action" to="/admin/stock-trading/research">すべて見る</Link>}>
          <ResearchList research={data?.recentResearch ?? []} compact />
        </Panel>
        <Panel title="市場シグナル" action={<Link className="link-action" to="/admin/stock-trading/signals">すべて見る</Link>}>
          <SignalList signals={data?.recentSignals ?? []} compact />
        </Panel>
        <Panel title="AI判断" action={<Link className="link-action" to="/admin/stock-trading/decisions">すべて見る</Link>}>
          <DecisionList decisions={data?.recentDecisions ?? []} compact />
        </Panel>
        <Panel title="取引履歴" action={<Link className="link-action" to="/admin/stock-trading/trades">すべて見る</Link>}>
          <TradeList trades={data?.recentTrades ?? []} compact />
        </Panel>
        <Panel title="戦略成績" action={<Link className="link-action" to="/admin/stock-trading/strategies">すべて見る</Link>}>
          <StrategyPerformanceList strategies={data?.strategyPerformance ?? []} compact />
        </Panel>
        <Panel title="バックテスト" action={<Link className="link-action" to="/admin/stock-trading/backtests">すべて見る</Link>}>
          <BacktestRunList runs={data?.recentBacktests ?? []} compact />
        </Panel>
        <Panel title="学習ログ" action={<Link className="link-action" to="/admin/stock-trading/lessons">すべて見る</Link>}>
          <LessonList lessons={data?.recentLessons ?? []} compact />
        </Panel>
        <Panel title="Knowledge Rulebook" action={<Link className="link-action" to="/admin/stock-trading/rules">すべて見る</Link>}>
          <RuleList rules={data?.recentRules ?? []} compact />
        </Panel>
        <Panel title="Market Data Collector" action={<Link className="link-action" to="/admin/stock-trading/market-data">開く</Link>}>
          <MarketDataRunList runs={data?.recentMarketDataRuns ?? []} compact />
        </Panel>
        <Panel title="連携状態" action={<Link className="link-action" to="/admin/stock-trading/settings">確認する</Link>}>
          <IntegrationList integrations={data?.integrations ?? []} />
        </Panel>
      </section>
    </div>
  );
}

export function StockCandidatesPage() {
  const { data, loading, error, reload } = useApi<{ candidates: StockMarketCandidate[] }>("/api/admin/stock-trading/candidates");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  async function setStatus(candidate: StockMarketCandidate, status: "approved" | "rejected" | "watch") {
    setBusyId(candidate.id);
    setActionError(null);
    try {
      await apiPatch(`/api/admin/stock-trading/candidates/${encodeURIComponent(candidate.id)}`, { status });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "候補ステータスの更新に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function convert(candidate: StockMarketCandidate) {
    setBusyId(candidate.id);
    setActionError(null);
    try {
      await apiPost(`/api/admin/stock-trading/candidates/${encodeURIComponent(candidate.id)}/convert`, {});
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "AI投資会議への変換に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel title="AI候補銘柄">
      {actionError ? <ErrorState message={actionError} /> : null}
      <CandidateList
        candidates={data?.candidates ?? []}
        busyId={busyId}
        onApprove={(candidate) => void setStatus(candidate, "approved")}
        onReject={(candidate) => void setStatus(candidate, "rejected")}
        onWatch={(candidate) => void setStatus(candidate, "watch")}
        onConvert={(candidate) => void convert(candidate)}
      />
    </Panel>
  );
}

export function StockSignalsPage() {
  const { data, loading, error } = useApi<{ signals: StockMarketSignal[] }>("/api/admin/stock-trading/signals");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <Panel title="市場シグナル">
      <SignalList signals={data?.signals ?? []} />
    </Panel>
  );
}

export function StockResearchPage() {
  const { data, loading, error, reload } = useApi<{ research: StockResearchItem[] }>("/api/admin/stock-trading/research");
  const [form, setForm] = React.useState({
    symbol: "",
    category: "news" as StockResearchCategory,
    title: "",
    summary: "",
    source: "manual",
    sourceUrl: "",
    sentiment: "unknown" as StockResearchSentiment,
    importance: "0.5",
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiPost("/api/admin/stock-trading/research", {
        ...form,
        symbol: form.symbol.trim() || undefined,
        sourceUrl: form.sourceUrl.trim() || undefined,
        importance: Number(form.importance),
      });
      setForm((current) => ({ ...current, symbol: "", title: "", summary: "", sourceUrl: "", sentiment: "unknown", importance: "0.5" }));
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Panel title="リサーチ材料を追加">
        <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-black text-slate-500">銘柄<input className="input w-full" value={form.symbol} placeholder="NVDA / 空欄で市場全体" onChange={(event) => setForm({ ...form, symbol: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">カテゴリ<select className="input w-full" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as StockResearchCategory })}>
              {["news", "earnings", "disclosure", "fundamental", "macro", "sector", "operator_note"].map((value) => <option key={value} value={value}>{formatResearchCategory(value)}</option>)}
            </select></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">センチメント<select className="input w-full" value={form.sentiment} onChange={(event) => setForm({ ...form, sentiment: event.target.value as StockResearchSentiment })}>
              {["positive", "neutral", "negative", "mixed", "unknown"].map((value) => <option key={value} value={value}>{formatResearchSentiment(value)}</option>)}
            </select></label>
          </div>
          <label className="grid gap-1 text-xs font-black text-slate-500">タイトル<input className="input w-full" value={form.title} required onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label className="grid gap-1 text-xs font-black text-slate-500">要約<textarea className="textarea" value={form.summary} required onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px]">
            <label className="grid gap-1 text-xs font-black text-slate-500">ソース<input className="input w-full" value={form.source} required onChange={(event) => setForm({ ...form, source: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">URL<input className="input w-full" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">重要度<input className="input w-full" type="number" min="0" max="1" step="0.1" value={form.importance} onChange={(event) => setForm({ ...form, importance: event.target.value })} /></label>
          </div>
          {submitError ? <ErrorState message={submitError} /> : null}
          <div><button className="btn-primary" type="submit" disabled={submitting}>{submitting ? "保存中..." : "保存"}</button></div>
        </form>
      </Panel>
      <Panel title="リサーチ材料">
        <ResearchList research={data?.research ?? []} />
      </Panel>
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
  const learningItems = decision.learningItems ?? [];
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
      <Panel title="AI投資会議">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Info label="保存Agent数" value={`${decision.agents.length}`} />
          <Info label="実行モード" value="内部ペーパーのみ" />
          <Info label="Risk veto" value="有効" />
        </div>
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
      <Panel title="判断に使った学習ログ">
        {learningItems.length === 0 ? (
          <Empty title="この判断に紐づいた学習ログはありません" description="学習ログが蓄積されると、次回以降のAI判断で参照されます。" />
        ) : (
          <LessonList lessons={learningItems} />
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

export function StockStrategiesPage() {
  const { data, loading, error } = useApi<{ strategies: StockStrategyPerformance[] }>("/api/admin/stock-trading/strategies");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <Panel title="戦略成績">
      <StrategyPerformanceList strategies={data?.strategies ?? []} />
    </Panel>
  );
}

export function StockBacktestsPage() {
  const { data, loading, error, reload } = useApi<{ runs: StockBacktestRun[] }>("/api/admin/stock-trading/backtests");
  const [form, setForm] = React.useState({
    symbol: "NVDA",
    timeframe: "1d",
    strategyTag: "breakout_momentum",
    lookbackBars: "3",
    volumeLookbackBars: "3",
    takeProfitPct: "0.06",
    stopLossPct: "0.03",
    maxHoldingBars: "5",
    notional: "100000",
    feeBps: "0",
    slippageBps: "5",
  });
  const [candlesJson, setCandlesJson] = React.useState("[\n  {\"timestamp\":\"2026-05-01T00:00:00.000Z\",\"open\":100,\"high\":102,\"low\":99,\"close\":101,\"volume\":1000}\n]");
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  async function importCandles() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiPost("/api/admin/stock-trading/candles", {
        symbol: form.symbol,
        timeframe: form.timeframe,
        source: "manual",
        candles: JSON.parse(candlesJson) as unknown,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "ローソク足の保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function runBacktest() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiPost("/api/admin/stock-trading/backtests", {
        ...form,
        strategyTag: "breakout_momentum",
        lookbackBars: Number(form.lookbackBars),
        volumeLookbackBars: Number(form.volumeLookbackBars),
        takeProfitPct: Number(form.takeProfitPct),
        stopLossPct: Number(form.stopLossPct),
        maxHoldingBars: Number(form.maxHoldingBars),
        notional: Number(form.notional),
        feeBps: Number(form.feeBps),
        slippageBps: Number(form.slippageBps),
      });
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "バックテストに失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Panel title="バックテスト実行">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-xs font-black text-slate-500">銘柄<input className="input w-full" value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">時間足<input className="input w-full" value={form.timeframe} onChange={(event) => setForm({ ...form, timeframe: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">利確率<input className="input w-full" type="number" step="0.01" value={form.takeProfitPct} onChange={(event) => setForm({ ...form, takeProfitPct: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">損切率<input className="input w-full" type="number" step="0.01" value={form.stopLossPct} onChange={(event) => setForm({ ...form, stopLossPct: event.target.value })} /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <label className="grid gap-1 text-xs font-black text-slate-500">lookback<input className="input w-full" type="number" value={form.lookbackBars} onChange={(event) => setForm({ ...form, lookbackBars: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">出来高lookback<input className="input w-full" type="number" value={form.volumeLookbackBars} onChange={(event) => setForm({ ...form, volumeLookbackBars: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">最大保有本数<input className="input w-full" type="number" value={form.maxHoldingBars} onChange={(event) => setForm({ ...form, maxHoldingBars: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">手数料bps<input className="input w-full" type="number" value={form.feeBps} onChange={(event) => setForm({ ...form, feeBps: event.target.value })} /></label>
            <label className="grid gap-1 text-xs font-black text-slate-500">スリッページbps<input className="input w-full" type="number" value={form.slippageBps} onChange={(event) => setForm({ ...form, slippageBps: event.target.value })} /></label>
          </div>
          <label className="grid gap-1 text-xs font-black text-slate-500">ローソク足JSON<textarea className="textarea min-h-40" value={candlesJson} onChange={(event) => setCandlesJson(event.target.value)} /></label>
          {submitError ? <ErrorState message={submitError} /> : null}
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" type="button" disabled={submitting} onClick={() => void importCandles()}>ローソク足を保存</button>
            <button className="btn-primary" type="button" disabled={submitting} onClick={() => void runBacktest()}>バックテスト実行</button>
          </div>
        </div>
      </Panel>
      <Panel title="バックテスト履歴">
        <BacktestRunList runs={data?.runs ?? []} />
      </Panel>
    </div>
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

export function StockRulesPage() {
  const { data, loading, error, reload } = useApi<{ rules: StockTradingRule[] }>("/api/admin/stock-trading/rules");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  async function setRuleStatus(rule: StockTradingRule, status: "active" | "rejected" | "candidate") {
    setBusyId(rule.id);
    setActionError(null);
    try {
      await apiPatch(`/api/admin/stock-trading/rules/${encodeURIComponent(rule.id)}`, { status });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ルール更新に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel title="Knowledge Rulebook">
      {actionError ? <ErrorState message={actionError} /> : null}
      <RuleList
        rules={data?.rules ?? []}
        busyId={busyId}
        onActivate={(rule) => void setRuleStatus(rule, "active")}
        onReject={(rule) => void setRuleStatus(rule, "rejected")}
        onCandidate={(rule) => void setRuleStatus(rule, "candidate")}
      />
    </Panel>
  );
}

export function StockMarketDataPage() {
  const { data: watchlistData, loading: watchlistLoading, error: watchlistError, reload: reloadWatchlist } = useApi<{ entries: StockMarketDataWatchlistEntry[] }>("/api/admin/stock-trading/market-data/watchlist");
  const { data: runData, loading: runsLoading, error: runsError, reload: reloadRuns } = useApi<{ runs: StockMarketDataCollectionRun[] }>("/api/admin/stock-trading/market-data/runs");
  const [symbol, setSymbol] = React.useState("NVDA");
  const [timeframe, setTimeframe] = React.useState("1d");
  const [provider, setProvider] = React.useState("moomoo");
  const [lookbackLimit, setLookbackLimit] = React.useState("200");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  if (watchlistLoading || runsLoading) return <Loading />;
  if (watchlistError) return <ErrorState message={watchlistError} />;
  if (runsError) return <ErrorState message={runsError} />;

  async function createEntry() {
    setBusy(true);
    setActionError(null);
    try {
      await apiPost("/api/admin/stock-trading/market-data/watchlist", {
        symbol,
        timeframe,
        provider,
        lookbackLimit: Number(lookbackLimit),
        notes,
      });
      setNotes("");
      await reloadWatchlist();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "監視銘柄の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEntry(entry: StockMarketDataWatchlistEntry) {
    setBusy(true);
    setActionError(null);
    try {
      await apiPatch(`/api/admin/stock-trading/market-data/watchlist/${encodeURIComponent(entry.id)}`, { enabled: !entry.enabled });
      await reloadWatchlist();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "監視状態の更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function collect() {
    setBusy(true);
    setActionError(null);
    try {
      await apiPost("/api/admin/stock-trading/market-data/collect", {});
      await Promise.all([reloadRuns(), reloadWatchlist()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "価格データ収集に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {actionError ? <ErrorState message={actionError} /> : null}
      <Panel title="Market Data Collector" action={<button className="btn-primary" type="button" disabled={busy} onClick={() => void collect()}>収集実行</button>}>
        <div className="grid gap-3 lg:grid-cols-5">
          <label className="grid gap-1 text-xs font-black text-slate-500">銘柄<input className="input" value={symbol} onChange={(event) => setSymbol(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-black text-slate-500">時間足<input className="input" value={timeframe} onChange={(event) => setTimeframe(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-black text-slate-500">Provider<input className="input" value={provider} onChange={(event) => setProvider(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-black text-slate-500">取得本数<input className="input" type="number" min="1" value={lookbackLimit} onChange={(event) => setLookbackLimit(event.target.value)} /></label>
          <label className="grid gap-1 text-xs font-black text-slate-500">メモ<input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-secondary" type="button" disabled={busy} onClick={() => void createEntry()}>監視に追加</button>
        </div>
      </Panel>
      <Panel title="Watchlist">
        <MarketDataWatchlist entries={watchlistData?.entries ?? []} busy={busy} onToggle={(entry) => void toggleEntry(entry)} />
      </Panel>
      <Panel title="Collection Runs">
        <MarketDataRunList runs={runData?.runs ?? []} />
      </Panel>
    </div>
  );
}

export function StockSettingsPage() {
  const { data, loading, error } = useApi<StockTradingSettings>("/api/admin/stock-trading/settings");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return (
    <div className="space-y-5">
      <PaperOnlyBanner message={data?.safety.message ?? "内部ペーパー取引のみ"} />
      <RunnerStatus runner={data?.runner} />
      <TradingViewSetupGuide runner={data?.runner} setup={data?.tradingView} />
      <Panel title="連携設定">
        <IntegrationList integrations={data?.integrations ?? []} />
      </Panel>
    </div>
  );
}

function TradingViewSetupGuide({ runner, setup }: { runner?: StockRunnerStatus; setup?: StockTradingSettings["tradingView"] }) {
  const webhookPath = setup?.webhookPath ?? "/webhooks/stock-trading/tradingview";
  const webhookUrl = typeof window === "undefined" ? webhookPath : `${window.location.origin}${webhookPath}`;
  const latestSignal = setup?.latestSignal ?? null;
  return (
    <Panel title="TradingView Webhook設定">
      <div className="grid gap-3 lg:grid-cols-3">
        <Metric icon={<Link2 />} label="Webhook URL" value={<span className="block break-all text-base">{webhookUrl}</span>} />
        <Metric icon={<KeyRound />} label="Secret header" value={<span className="text-base">{setup?.secretHeader ?? "x-tradingview-secret"}</span>} />
        <Metric icon={<ShieldCheck />} label="Webhook" value={runner?.tradingViewWebhookConfigured ? "設定済み" : "未設定"} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="border border-slate-200 bg-slate-950 p-4 text-slate-100">
          <div className="mb-3 flex items-center gap-2 text-xs font-black text-slate-300"><Code2 className="h-4 w-4" />Alert message JSON</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs font-semibold leading-6">{TRADINGVIEW_ALERT_TEMPLATE}</pre>
        </div>
        <div className="space-y-3">
          <Info label="認証" value={`${setup?.secretHeader ?? "x-tradingview-secret"} に TRADINGVIEW_WEBHOOK_SECRET の値を設定`} />
          <Info label="モード" value="paper-only / broker注文なし" />
          {latestSignal ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="最終受信" value={formatDate(latestSignal.receivedAt)} />
              <Info label="銘柄" value={`${latestSignal.symbol} / ${latestSignal.timeframe}`} />
              <Info label="価格" value={formatCurrency(latestSignal.price)} />
              <Info label="状態" value={formatSignalStatus(latestSignal.status)} />
            </div>
          ) : (
            <Empty title="TradingViewシグナルはまだ届いていません" description="alertを作成したら、この欄で最後の受信時刻と状態を確認できます。" />
          )}
        </div>
      </div>
    </Panel>
  );
}

function RunnerStatus({ runner }: { runner?: StockRunnerStatus }) {
  return (
    <section className="grid gap-3 md:grid-cols-4">
      <Metric icon={<ShieldCheck />} label="Runner" value={runner?.enabled ? "Webhook ready" : "未設定"} />
      <Metric icon={<Code2 />} label="AI判断" value={formatDecisionMode(runner)} />
      <Metric icon={<ClipboardList />} label="信頼度しきい値" value={formatPercent(runner?.confidenceThreshold)} />
      <Metric icon={<WalletCards />} label="Paper notional" value={formatCurrency(runner?.paperTradeNotional)} />
      {runner?.message ? (
        <div className="md:col-span-4">
          <Info label="Paper runner" value={runner.message} />
        </div>
      ) : null}
    </section>
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

function PositionList({
  positions,
  busySymbol,
  onExitReview,
}: {
  positions: StockPosition[];
  busySymbol?: string | null;
  onExitReview?: (position: StockPosition) => void;
}) {
  if (positions.length === 0) return <Empty title="内部ペーパー建玉はまだありません" description="TradingView signal から paper BUY が作成されると、ここに平均単価と含み損益が表示されます。" />;
  return (
    <table className="data-table">
      <thead><tr><th>銘柄</th><th>数量</th><th>平均単価</th><th>現在値</th><th>評価額</th><th>含み損益</th><th>確定損益</th><th>更新</th>{onExitReview ? <th>Exit</th> : null}</tr></thead>
      <tbody>
        {positions.map((position) => (
          <tr key={position.id}>
            <td className="font-black">{position.symbol}</td>
            <td>{position.quantity}</td>
            <td>{formatCurrency(position.averageEntryPrice)}</td>
            <td>{formatCurrency(position.lastMarkPrice)}</td>
            <td>{formatCurrency(position.marketValue)}</td>
            <td>{formatCurrency(position.unrealizedPnl)}</td>
            <td>{formatCurrency(position.realizedPnl)}</td>
            <td>{formatDate(position.lastMarkedAt)}</td>
            {onExitReview ? (
              <td>
                <button className="btn-secondary" type="button" disabled={busySymbol === position.symbol} onClick={() => onExitReview(position)}>Exit確認</button>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CandidateList({
  candidates,
  compact = false,
  busyId,
  onApprove,
  onReject,
  onWatch,
  onConvert,
}: {
  candidates: StockMarketCandidate[];
  compact?: boolean;
  busyId?: string | null;
  onApprove?: (candidate: StockMarketCandidate) => void;
  onReject?: (candidate: StockMarketCandidate) => void;
  onWatch?: (candidate: StockMarketCandidate) => void;
  onConvert?: (candidate: StockMarketCandidate) => void;
}) {
  if (candidates.length === 0) return <Empty title="AI候補銘柄はまだありません" description="TradingView signal やリサーチ材料から、Market Scanner の監視候補がここに蓄積されます。" />;
  if (compact) {
    return (
      <div className="space-y-3">
        {candidates.slice(0, 4).map((candidate) => (
          <article key={candidate.id} className="border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-950">{candidate.symbol}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{formatCandidateSource(candidate.source)} / {formatCandidateStatus(candidate.status)} / {formatDate(candidate.lastScannedAt)}</div>
              </div>
              <Metric icon={<Radar />} label="score" value={formatPercent(candidate.score)} />
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{candidate.reason}</p>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {candidates.map((candidate) => {
        const canConvert = candidate.status !== "converted_to_decision";
        return (
          <article key={candidate.id} className="border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-black text-slate-950">{candidate.symbol}</span>
                  <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-black text-slate-600">{formatCandidateStatus(candidate.status)}</span>
                  <span className="border border-slate-200 bg-white px-2 py-0.5 text-xs font-black text-slate-600">{formatCandidateSource(candidate.source)}</span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{candidate.reason}</p>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-4">
                  <Info label="theme" value={candidate.theme ?? "-"} />
                  <Info label="sector" value={candidate.sector ?? "-"} />
                  <Info label="strategy" value={candidate.strategyTag ?? "-"} />
                  <Info label="scan" value={formatDate(candidate.lastScannedAt)} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:w-80">
                <Info label="score" value={formatPercent(candidate.score)} />
                <Info label="decision" value={candidate.convertedDecisionId ? <Link className="table-link" to={`/admin/stock-trading/decisions/${candidate.convertedDecisionId}`}>開く</Link> : "-"} />
                {onApprove ? <button className="btn-primary" type="button" disabled={busyId === candidate.id} onClick={() => onApprove(candidate)}>承認</button> : null}
                {onReject ? <button className="btn-secondary" type="button" disabled={busyId === candidate.id} onClick={() => onReject(candidate)}>却下</button> : null}
                {onWatch ? <button className="btn-secondary" type="button" disabled={busyId === candidate.id} onClick={() => onWatch(candidate)}>監視に戻す</button> : null}
                {onConvert ? <button className="btn-primary sm:col-span-2" type="button" disabled={!canConvert || busyId === candidate.id} onClick={() => onConvert(candidate)}>AI投資会議へ</button> : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ResearchList({ research, compact = false }: { research: StockResearchItem[]; compact?: boolean }) {
  if (research.length === 0) return <Empty title="リサーチ材料はまだありません" description="ニュース、決算、開示、ファンダ情報を追加するとAI判断の材料として使われます。" />;
  return (
    <div className="space-y-3">
      {research.map((item) => (
        <article key={item.id} className="border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-black text-slate-950">{item.symbol ?? "市場全体"}</span>
                <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-black text-slate-600">{formatResearchCategory(item.category)}</span>
                <span className="border border-slate-200 bg-white px-2 py-0.5 text-xs font-black text-slate-600">{formatResearchSentiment(item.sentiment)}</span>
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">{item.title}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{item.source} / {formatDate(item.publishedAt)} / 重要度 {Math.round(item.importance * 100)}</div>
            </div>
            <FileText className="h-5 w-5 shrink-0 text-blue-700" />
          </div>
          {!compact ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.summary}</p> : null}
        </article>
      ))}
    </div>
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

function SignalList({ signals, compact = false }: { signals: StockMarketSignal[]; compact?: boolean }) {
  if (signals.length === 0) return <Empty title="市場シグナルはまだありません" description="TradingView webhook からシグナルを受け取るとここに表示されます。" />;
  return (
    <table className="data-table">
      <thead><tr><th>受信</th><th>銘柄</th><th>時間足</th><th>価格</th><th>戦略</th><th>状態</th><th>判断</th></tr></thead>
      <tbody>
        {signals.map((signal) => (
          <tr key={signal.id}>
            <td>{formatDate(signal.receivedAt)}</td>
            <td className="font-black">{signal.symbol}</td>
            <td>{signal.timeframe}</td>
            <td>{formatCurrency(signal.price)}</td>
            <td>{signal.strategyTag ?? "-"}</td>
            <td><StatusPill status={signal.status === "executed" || signal.status === "processed" ? "passed" : signal.status === "blocked" ? "skipped" : "running"} label={formatSignalStatus(signal.status)} /></td>
            <td>{signal.decisionId ? <Link className="table-link" to={`/admin/stock-trading/decisions/${signal.decisionId}`}>開く</Link> : compact ? "-" : (signal.statusReason ?? "-")}</td>
          </tr>
        ))}
      </tbody>
    </table>
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

function StrategyPerformanceList({ strategies, compact = false }: { strategies: StockStrategyPerformance[]; compact?: boolean }) {
  if (strategies.length === 0) return <Empty title="戦略成績はまだありません" description="実現損益のある内部ペーパーSELLが記録されると、戦略タグごとの勝率、期待値、Profit Factorが表示されます。" />;
  if (compact) {
    return (
      <div className="space-y-3">
        {strategies.slice(0, 3).map((strategy) => (
          <div key={strategy.strategyTag} className="grid gap-3 border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_120px_120px]">
            <div>
              <div className="text-sm font-black">{strategy.strategyTag}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{formatStrategyStatus(strategy.status)} / {strategy.tradeCount} trades</div>
            </div>
            <Info label="損益" value={formatCurrency(strategy.realizedPnl)} />
            <Info label="PF" value={strategy.profitFactor === null ? "-" : strategy.profitFactor.toFixed(2)} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>戦略</th>
          <th>状態</th>
          <th>取引数</th>
          <th>勝率</th>
          <th>実現損益</th>
          <th>平均利益</th>
          <th>平均損失</th>
          <th>期待値</th>
          <th>PF</th>
          <th>最終取引</th>
        </tr>
      </thead>
      <tbody>
        {strategies.map((strategy) => (
          <tr key={strategy.strategyTag}>
            <td className="font-black">{strategy.strategyTag}</td>
            <td>{formatStrategyStatus(strategy.status)}</td>
            <td>{strategy.tradeCount}</td>
            <td>{formatPercent(strategy.winRate)}</td>
            <td>{formatCurrency(strategy.realizedPnl)}</td>
            <td>{strategy.averageProfit === null ? "-" : formatCurrency(strategy.averageProfit)}</td>
            <td>{strategy.averageLoss === null ? "-" : formatCurrency(strategy.averageLoss)}</td>
            <td>{strategy.expectancy === null ? "-" : formatCurrency(strategy.expectancy)}</td>
            <td>{strategy.profitFactor === null ? "-" : strategy.profitFactor.toFixed(2)}</td>
            <td>{strategy.latestTradeAt ? formatDate(strategy.latestTradeAt) : "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BacktestRunList({ runs, compact = false }: { runs: StockBacktestRun[]; compact?: boolean }) {
  if (runs.length === 0) return <Empty title="バックテストはまだありません" description="ローソク足を保存してバックテストを実行すると、勝率、期待値、Profit Factor、最大ドローダウンが表示されます。" />;
  if (compact) {
    return (
      <div className="space-y-3">
        {runs.slice(0, 3).map((run) => (
          <div key={run.id} className="grid gap-3 border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_120px_120px]">
            <div>
              <div className="text-sm font-black">{run.symbol} / {run.strategyTag}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{run.timeframe} / {run.tradeCount} trades</div>
            </div>
            <Info label="損益" value={formatCurrency(run.realizedPnl)} />
            <Info label="PF" value={run.profitFactor === null ? "-" : run.profitFactor.toFixed(2)} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>日時</th>
          <th>銘柄</th>
          <th>戦略</th>
          <th>足</th>
          <th>取引数</th>
          <th>勝率</th>
          <th>損益</th>
          <th>期待値</th>
          <th>PF</th>
          <th>最大DD</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id}>
            <td>{formatDate(run.createdAt)}</td>
            <td className="font-black">{run.symbol}</td>
            <td>{run.strategyTag}</td>
            <td>{run.timeframe}</td>
            <td>{run.tradeCount}</td>
            <td>{formatPercent(run.winRate)}</td>
            <td>{formatCurrency(run.realizedPnl)}</td>
            <td>{run.expectancy === null ? "-" : formatCurrency(run.expectancy)}</td>
            <td>{run.profitFactor === null ? "-" : run.profitFactor.toFixed(2)}</td>
            <td>{run.maximumDrawdown === null ? "-" : formatCurrency(run.maximumDrawdown)}</td>
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
              <div className="mt-1 text-xs font-semibold text-slate-500">
                {formatLearningCategory(lesson.category)} / {formatDate(lesson.createdAt)}
                {lesson.sourceTradeId ? ` / trade ${lesson.sourceTradeId}` : ""}
              </div>
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

function RuleList({
  rules,
  compact = false,
  busyId,
  onActivate,
  onReject,
  onCandidate,
}: {
  rules: StockTradingRule[];
  compact?: boolean;
  busyId?: string | null;
  onActivate?: (rule: StockTradingRule) => void;
  onReject?: (rule: StockTradingRule) => void;
  onCandidate?: (rule: StockTradingRule) => void;
}) {
  if (rules.length === 0) return <Empty title="再利用ルールはまだありません" description="学習ログからKnowledge Curatorのルール候補が作成されるとここに表示されます。" />;
  if (compact) {
    return (
      <div className="space-y-3">
        {rules.slice(0, 3).map((rule) => (
          <article key={rule.id} className="border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">{rule.title}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{formatRuleCategory(rule.category)} / {formatRuleStatus(rule.status)}</div>
              </div>
              <Info label="信頼度" value={formatPercent(rule.confidence)} />
            </div>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <article key={rule.id} className="border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-black text-slate-950">{rule.title}</span>
                <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-black text-slate-600">{formatRuleCategory(rule.category)}</span>
                <span className="border border-slate-200 bg-white px-2 py-0.5 text-xs font-black text-slate-600">{formatRuleStatus(rule.status)}</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{rule.ruleText}</p>
              <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-3">
                <Info label="source lesson" value={rule.sourceLearningItemId ?? "-"} />
                <Info label="updated" value={formatDate(rule.updatedAt)} />
                <Info label="信頼度" value={formatPercent(rule.confidence)} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:w-80">
              {onActivate ? <button className="btn-primary" type="button" disabled={busyId === rule.id} onClick={() => onActivate(rule)}>採用</button> : null}
              {onReject ? <button className="btn-secondary" type="button" disabled={busyId === rule.id} onClick={() => onReject(rule)}>却下</button> : null}
              {onCandidate ? <button className="btn-secondary" type="button" disabled={busyId === rule.id} onClick={() => onCandidate(rule)}>候補に戻す</button> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function MarketDataWatchlist({
  entries,
  busy,
  onToggle,
}: {
  entries: StockMarketDataWatchlistEntry[];
  busy?: boolean;
  onToggle?: (entry: StockMarketDataWatchlistEntry) => void;
}) {
  if (entries.length === 0) return <Empty title="価格データ監視銘柄はまだありません" description="銘柄と時間足を追加すると、Market Data Collector がローソク足を保存できます。" />;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>銘柄</th><th>時間足</th><th>provider</th><th>状態</th><th>取得本数</th><th>最終収集</th><th>操作</th></tr></thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="font-black">{entry.symbol}</td>
              <td>{entry.timeframe}</td>
              <td>{entry.provider}</td>
              <td><StatusPill status={entry.enabled ? "enabled" : "disabled"} /></td>
              <td>{entry.lookbackLimit}</td>
              <td>{entry.lastCollectedAt ? formatDate(entry.lastCollectedAt) : "-"}</td>
              <td>{onToggle ? <button className="btn-secondary" type="button" disabled={busy} onClick={() => onToggle(entry)}>{entry.enabled ? "停止" : "有効化"}</button> : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketDataRunList({ runs, compact = false }: { runs: StockMarketDataCollectionRun[]; compact?: boolean }) {
  if (runs.length === 0) return <Empty title="価格データ収集履歴はまだありません" description="収集を実行すると、件数とエラーがここに残ります。" />;
  if (compact) {
    return (
      <div className="space-y-3">
        {runs.slice(0, 3).map((run) => (
          <article key={run.id} className="border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">{run.provider}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{formatDate(run.createdAt)}</div>
              </div>
              <StatusPill status={run.status} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Info label="entries" value={`${run.completedEntries}/${run.requestedEntries}`} />
              <Info label="candles" value={run.upsertedCandles} />
              <Info label="error" value={run.error ?? "-"} />
            </div>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>provider</th><th>status</th><th>entries</th><th>candles</th><th>error</th><th>started</th><th>completed</th></tr></thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="font-black">{run.provider}</td>
              <td><StatusPill status={run.status} /></td>
              <td>{run.completedEntries}/{run.requestedEntries}</td>
              <td>{run.upsertedCandles}</td>
              <td>{run.error ?? "-"}</td>
              <td>{formatDate(run.startedAt)}</td>
              <td>{run.completedAt ? formatDate(run.completedAt) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function formatCandidateStatus(value: string): string {
  return {
    watch: "監視",
    approved: "承認",
    rejected: "却下",
    converted_to_decision: "会議済",
  }[value] ?? value;
}

function formatCandidateSource(value: string): string {
  return {
    tradingview: "TradingView",
    research: "Research",
    manual: "手入力",
    provider: "外部データ",
  }[value] ?? value;
}

function formatStrategyStatus(value: StockStrategyPerformance["status"]): string {
  return { adopt: "採用候補", watch: "継続監視", reject: "却下候補" }[value] ?? value;
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

function formatRuleCategory(value: string): string {
  return {
    entry: "Entry",
    exit: "Exit",
    risk: "Risk",
    portfolio: "Portfolio",
    strategy: "Strategy",
  }[value] ?? value;
}

function formatRuleStatus(value: string): string {
  return {
    candidate: "候補",
    active: "採用中",
    rejected: "却下",
  }[value] ?? value;
}

function formatIntegrationPurpose(value: string): string {
  return { market_data: "価格・市場データ", broker: "証券API", webhook: "Webhook" }[value] ?? value;
}

function formatSignalStatus(value: string): string {
  return {
    received: "受信",
    processed: "判断済",
    rejected: "拒否",
    executed: "Paper約定",
    blocked: "ブロック",
  }[value] ?? value;
}

function formatResearchCategory(value: string): string {
  return {
    news: "ニュース",
    earnings: "決算",
    disclosure: "開示",
    fundamental: "ファンダ",
    macro: "マクロ",
    sector: "セクター",
    operator_note: "手入力メモ",
  }[value] ?? value;
}

function formatResearchSentiment(value: string): string {
  return { positive: "ポジティブ", neutral: "中立", negative: "ネガティブ", mixed: "混在", unknown: "不明" }[value] ?? value;
}

function formatDecisionMode(runner?: StockRunnerStatus): string {
  if (!runner) return "-";
  if (runner.decisionMode === "deterministic") return "ルール固定";
  if (runner.decisionMode === "llm") return runner.llmConfigured ? "LLM" : "LLM未設定";
  return runner.llmConfigured ? "LLM auto" : "ルールfallback";
}
