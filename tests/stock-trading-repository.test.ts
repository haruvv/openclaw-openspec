import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("stock trading repository", () => {
  beforeEach(async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "stock-trading-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
    delete process.env.DURABLE_STORAGE_BASE_URL;
    delete process.env.DURABLE_STORAGE_TOKEN;
  });

  it("persists decisions, agent opinions, paper trades, snapshots, and lessons", async () => {
    const {
      createStockAiDecision,
      createStockLearningItem,
      createStockMarketSignal,
      createStockPortfolioSnapshot,
      createStockResearchItem,
      createStockTrade,
      getStockAiDecisionDetail,
      getStockTrade,
      getStockTradingOverview,
      listStockStrategyPerformance,
      listStockLearningItemsBySourceTrade,
      listStockMarketSignals,
      listStockResearchItems,
      listStockTradingRules,
      listStockTrades,
      updateStockTradingRuleStatus,
    } = await import("../src/stock-trading/repository.js");

    const decision = await createStockAiDecision({
      id: "decision-1",
      symbol: "NVDA",
      finalAction: "WATCH",
      confidence: 0.72,
      strategyTag: "breakout_momentum",
      reasoning: "押し目形成まで待つ。",
      riskFactors: ["急騰後", "損切り幅が広い"],
      createdAt: new Date("2026-05-17T00:00:00.000Z"),
      agents: [{
        id: "agent-risk-1",
        agentName: "risk",
        score: 35,
        stance: "reject",
        summary: "リスク過大",
        reasoning: "想定利益に対して損切り幅が広い。",
      }],
    });
    const trade = await createStockTrade({
      id: "trade-1",
      decisionId: decision.id,
      symbol: "NVDA",
      side: "buy",
      quantity: 10,
      price: 128,
      executionSource: "paper",
      realizedPnl: 240,
      outcome: "win",
      executedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    await createStockPortfolioSnapshot({
      id: "snapshot-1",
      initialCapital: 1_000_000,
      totalEquity: 1_002_400,
      cashBalance: 998_720,
      unrealizedPnl: 2_160,
      realizedPnl: 240,
      capturedAt: new Date("2026-05-17T02:00:00.000Z"),
    });
    await createStockLearningItem({
      id: "lesson-1",
      sourceTradeId: trade.id,
      category: "rule_candidate",
      title: "初回押しを待つ",
      body: "ブレイク直後に飛び乗らない。",
      confidence: 0.68,
    });
    await createStockMarketSignal({
      id: "signal-1",
      sourceSignalId: "alert-1",
      symbol: "NVDA",
      timeframe: "5m",
      price: 128,
      strategyTag: "breakout_momentum",
      indicators: { rsi: 62 },
      rawPayload: { symbol: "NVDA", secret: "should-not-exist" },
      status: "processed",
      decisionId: decision.id,
    });
    await createStockResearchItem({
      id: "research-1",
      symbol: "NVDA",
      category: "news",
      title: "AI半導体需要が堅調",
      summary: "データセンター需要が引き続き強いという手入力メモ。",
      source: "manual",
      sentiment: "positive",
      importance: 0.8,
      publishedAt: new Date("2026-05-17T00:15:00.000Z"),
    });

    await expect(getStockAiDecisionDetail("decision-1")).resolves.toMatchObject({
      symbol: "NVDA",
      agents: [{ agentName: "risk", stance: "reject" }],
    });
    await expect(listStockTrades()).resolves.toMatchObject([
      { id: "trade-1", executionSource: "paper", rawExecution: {} },
    ]);
    await expect(getStockTrade("trade-1")).resolves.toMatchObject({ id: "trade-1", symbol: "NVDA" });
    await expect(listStockLearningItemsBySourceTrade("trade-1")).resolves.toMatchObject([
      { id: "lesson-1", sourceTradeId: "trade-1", category: "rule_candidate" },
    ]);
    await expect(listStockTradingRules()).resolves.toMatchObject([
      { id: "stock-rule-lesson-1", sourceLearningItemId: "lesson-1", category: "entry", status: "candidate" },
    ]);
    await updateStockTradingRuleStatus("stock-rule-lesson-1", "active");
    await expect(listStockTradingRules({ status: "active" })).resolves.toMatchObject([
      { id: "stock-rule-lesson-1", status: "active" },
    ]);
    await expect(getStockTradingOverview()).resolves.toMatchObject({
      portfolio: {
        currentEquity: 1_002_400,
        realizedPnl: 240,
        winRate: 1,
      },
      recentRules: [{ id: "stock-rule-lesson-1", status: "active" }],
      safety: {
        mode: "paper_only",
        realOrderPlacementEnabled: false,
      },
      recentResearch: [{ id: "research-1", symbol: "NVDA", category: "news" }],
      recentSignals: [{ id: "signal-1", symbol: "NVDA", status: "processed", decisionId: "decision-1" }],
    });
    await expect(listStockMarketSignals()).resolves.toMatchObject([
      { id: "signal-1", sourceSignalId: "alert-1", indicators: { rsi: 62 } },
    ]);
    await expect(listStockResearchItems({ symbol: "NVDA" })).resolves.toMatchObject([
      { id: "research-1", title: "AI半導体需要が堅調", sentiment: "positive", importance: 0.8 },
    ]);
    await expect(listStockStrategyPerformance()).resolves.toEqual([]);
  });

  it("rejects non-paper execution sources before persistence", async () => {
    const { createStockTrade } = await import("../src/stock-trading/repository.js");

    await expect(createStockTrade({
      id: "trade-bad",
      symbol: "NVDA",
      side: "buy",
      quantity: 1,
      price: 128,
      executionSource: "real" as "paper",
    })).rejects.toThrow("paper, demo, or manual");
  });

  it("persists decision learning refs without duplicates and selects bounded learning context", async () => {
    const {
      attachStockDecisionLearningItems,
      createStockAiDecision,
      createStockLearningItem,
      createStockTrade,
      getStockAiDecisionDetail,
      listStockLearningItemsForDecision,
      listStockLearningItemsForDecisionContext,
    } = await import("../src/stock-trading/repository.js");

    const decision = await createStockAiDecision({
      id: "decision-learning-1",
      symbol: "NVDA",
      finalAction: "WATCH",
      confidence: 0.72,
      strategyTag: "breakout_momentum",
      reasoning: "学習確認",
      riskFactors: [],
    });
    const trade = await createStockTrade({
      id: "trade-learning-1",
      decisionId: decision.id,
      symbol: "NVDA",
      side: "sell",
      quantity: 10,
      price: 120,
      executionSource: "paper",
      realizedPnl: 200,
      outcome: "win",
    });
    await createStockLearningItem({
      id: "lesson-symbol-1",
      sourceTradeId: trade.id,
      category: "winning_pattern",
      title: "NVDAは初回押しを待つ",
      body: "NVDAのブレイク直後は押し目を待った方が良い。",
      confidence: 0.81,
    });
    await createStockLearningItem({
      id: "lesson-market-1",
      category: "strategy_note",
      title: "市場全体は過熱回避",
      body: "指数が過熱している日は見送りを優先する。",
      confidence: 0.7,
    });

    await attachStockDecisionLearningItems("decision-learning-1", ["lesson-symbol-1", "lesson-market-1", "lesson-symbol-1"], new Date("2026-05-18T00:00:00.000Z"));

    await expect(listStockLearningItemsForDecision("decision-learning-1")).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "lesson-symbol-1", title: "NVDAは初回押しを待つ" }),
      expect.objectContaining({ id: "lesson-market-1", title: "市場全体は過熱回避" }),
    ]));
    const detail = await getStockAiDecisionDetail("decision-learning-1");
    expect(detail?.learningItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "lesson-symbol-1" }),
      expect.objectContaining({ id: "lesson-market-1" }),
    ]));
    await expect(listStockLearningItemsForDecisionContext({ symbol: "NVDA", strategyTag: "breakout_momentum", limit: 2 })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "lesson-symbol-1" }),
      expect.objectContaining({ id: "lesson-market-1" }),
    ]));
  });

  it("persists market scanner candidates, refreshes research candidates, and updates status", async () => {
    const {
      createStockAiDecision,
      createStockResearchItem,
      getStockMarketCandidate,
      getStockTradingOverview,
      listStockMarketCandidates,
      updateStockMarketCandidateStatus,
      upsertStockMarketCandidate,
    } = await import("../src/stock-trading/repository.js");

    const candidate = await upsertStockMarketCandidate({
      id: "candidate-1",
      symbol: "nvda",
      theme: "AI半導体",
      sector: "semiconductor",
      strategyTag: "breakout_momentum",
      reason: "Market Scanner: 出来高急増とテーマ資金流入",
      score: 0.82,
      source: "manual",
      rawPayload: { price: 128 },
      lastScannedAt: new Date("2026-05-18T00:00:00.000Z"),
    });
    expect(candidate).toMatchObject({
      id: "candidate-1",
      symbol: "NVDA",
      status: "watch",
      score: 0.82,
    });

    await upsertStockMarketCandidate({
      symbol: "NVDA",
      theme: "AI半導体",
      reason: "Market Scanner refresh",
      score: 0.9,
      source: "manual",
      rawPayload: { price: 130 },
    });
    await expect(listStockMarketCandidates()).resolves.toMatchObject([
      { id: "candidate-1", symbol: "NVDA", score: 0.9, reason: "Market Scanner refresh" },
    ]);

    await createStockResearchItem({
      id: "research-candidate-1",
      symbol: "tsla",
      category: "news",
      title: "ロボタクシー材料",
      summary: "短期テーマとして注目。",
      source: "manual",
      sentiment: "positive",
      importance: 0.8,
    });
    await expect(listStockMarketCandidates()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "TSLA", source: "research", reason: "Research news: ロボタクシー材料" }),
    ]));

    await updateStockMarketCandidateStatus("candidate-1", "approved");
    const decision = await createStockAiDecision({
      id: "candidate-decision-1",
      symbol: "NVDA",
      finalAction: "WATCH",
      confidence: 0.7,
      reasoning: "候補から会議化",
    });
    await updateStockMarketCandidateStatus("candidate-1", "converted_to_decision", { convertedDecisionId: decision.id });
    await expect(getStockMarketCandidate("candidate-1")).resolves.toMatchObject({
      status: "converted_to_decision",
      convertedDecisionId: "candidate-decision-1",
    });
    await expect(getStockTradingOverview()).resolves.toMatchObject({
      recentCandidates: [expect.objectContaining({ symbol: "TSLA" }), expect.objectContaining({ symbol: "NVDA" })],
    });
  });

  it("applies paper fills to positions and ledger-derived portfolio metrics", async () => {
    const {
      applyPaperTradeWithLedger,
      getStockPortfolioMetrics,
      getStockPosition,
      listStockPositions,
      listStockTrades,
    } = await import("../src/stock-trading/repository.js");

    await applyPaperTradeWithLedger({
      id: "trade-buy-1",
      symbol: "nvda",
      side: "buy",
      quantity: 10,
      price: 100,
      executionSource: "paper",
      executedAt: new Date("2026-05-17T00:00:00.000Z"),
    });
    await applyPaperTradeWithLedger({
      id: "trade-buy-2",
      symbol: "NVDA",
      side: "buy",
      quantity: 10,
      price: 120,
      executionSource: "paper",
      executedAt: new Date("2026-05-17T00:01:00.000Z"),
    });
    await applyPaperTradeWithLedger({
      id: "trade-sell-1",
      symbol: "NVDA",
      side: "sell",
      quantity: 5,
      price: 130,
      executionSource: "paper",
      executedAt: new Date("2026-05-17T00:02:00.000Z"),
    });

    await expect(getStockPosition("NVDA")).resolves.toMatchObject({
      symbol: "NVDA",
      quantity: 15,
      averageEntryPrice: 110,
      lastMarkPrice: 130,
      marketValue: 1950,
      unrealizedPnl: 300,
      realizedPnl: 100,
    });
    await expect(listStockPositions()).resolves.toHaveLength(1);
    await expect(listStockTrades()).resolves.toMatchObject([
      { id: "trade-sell-1", realizedPnl: 100, outcome: "win" },
      { id: "trade-buy-2", outcome: "open" },
      { id: "trade-buy-1", outcome: "open" },
    ]);
    await expect(getStockPortfolioMetrics()).resolves.toMatchObject({
      currentEquity: 1000400,
      cashBalance: 998450,
      realizedPnl: 100,
      unrealizedPnl: 300,
      positions: [{ symbol: "NVDA", quantity: 15 }],
    });

    await expect(applyPaperTradeWithLedger({
      id: "trade-sell-bad",
      symbol: "NVDA",
      side: "sell",
      quantity: 99,
      price: 130,
      executionSource: "paper",
    })).rejects.toThrow("paper_sell_exceeds_position:NVDA");
  });

  it("aggregates completed paper sell trades by strategy tag", async () => {
    const {
      createStockAiDecision,
      createStockTrade,
      listStockStrategyPerformance,
    } = await import("../src/stock-trading/repository.js");

    const breakout = await createStockAiDecision({
      id: "decision-breakout",
      symbol: "NVDA",
      finalAction: "SELL",
      confidence: 0.8,
      strategyTag: "breakout_momentum",
      reasoning: "決済判断。",
    });
    await createStockTrade({
      id: "trade-open-buy",
      decisionId: breakout.id,
      symbol: "NVDA",
      side: "buy",
      quantity: 1,
      price: 100,
      executionSource: "paper",
      outcome: "open",
    });
    await createStockTrade({
      id: "trade-win",
      decisionId: breakout.id,
      symbol: "NVDA",
      side: "sell",
      quantity: 1,
      price: 110,
      executionSource: "paper",
      realizedPnl: 100,
      outcome: "win",
      executedAt: new Date("2026-05-17T00:01:00.000Z"),
    });
    await createStockTrade({
      id: "trade-loss",
      decisionId: breakout.id,
      symbol: "NVDA",
      side: "sell",
      quantity: 1,
      price: 90,
      executionSource: "paper",
      realizedPnl: -40,
      outcome: "loss",
      executedAt: new Date("2026-05-17T00:02:00.000Z"),
    });
    await createStockTrade({
      id: "trade-unclassified",
      symbol: "TSLA",
      side: "sell",
      quantity: 1,
      price: 50,
      executionSource: "paper",
      realizedPnl: 10,
      outcome: "win",
      executedAt: new Date("2026-05-17T00:03:00.000Z"),
    });

    await expect(listStockStrategyPerformance()).resolves.toMatchObject([
      {
        strategyTag: "breakout_momentum",
        tradeCount: 2,
        winCount: 1,
        lossCount: 1,
        winRate: 0.5,
        realizedPnl: 60,
        grossProfit: 100,
        grossLoss: -40,
        averageProfit: 100,
        averageLoss: -40,
        expectancy: 30,
        profitFactor: 2.5,
        bestTradePnl: 100,
        worstTradePnl: -40,
      },
      {
        strategyTag: "unclassified",
        tradeCount: 1,
        realizedPnl: 10,
      },
    ]);
  });

  it("upserts candles and persists backtest runs with simulated trades", async () => {
    const {
      createStockBacktestRun,
      createStockMarketDataCollectionRun,
      listStockBacktestRuns,
      getStockBacktestRunDetail,
      listStockCandles,
      listStockMarketDataCollectionRuns,
      listStockMarketDataWatchlistEntries,
      updateStockMarketDataWatchlistEntry,
      upsertStockMarketDataWatchlistEntry,
      upsertStockCandles,
    } = await import("../src/stock-trading/repository.js");

    await upsertStockCandles([
      { symbol: "nvda", timeframe: "1d", open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: new Date("2026-05-01T00:00:00.000Z") },
      { symbol: "NVDA", timeframe: "1d", open: 101, high: 104, low: 100, close: 103, volume: 1200, timestamp: new Date("2026-05-02T00:00:00.000Z") },
      { symbol: "NVDA", timeframe: "1d", open: 101, high: 105, low: 100, close: 104, volume: 1300, timestamp: new Date("2026-05-02T00:00:00.000Z") },
    ]);

    await expect(listStockCandles({ symbol: "NVDA", timeframe: "1d" })).resolves.toMatchObject([
      { symbol: "NVDA", close: 101 },
      { symbol: "NVDA", close: 104, volume: 1300 },
    ]);

    const watchlist = await upsertStockMarketDataWatchlistEntry({
      id: "watchlist-1",
      symbol: "nvda",
      timeframe: "1d",
      provider: "moomoo",
      lookbackLimit: 250,
      notes: "AI半導体",
    });
    expect(watchlist).toMatchObject({ id: "watchlist-1", symbol: "NVDA", enabled: true, lookbackLimit: 250 });
    await updateStockMarketDataWatchlistEntry("watchlist-1", { enabled: false, lastCollectedAt: new Date("2026-05-07T00:00:00.000Z") });
    await expect(listStockMarketDataWatchlistEntries()).resolves.toMatchObject([
      { id: "watchlist-1", symbol: "NVDA", enabled: false, lastCollectedAt: "2026-05-07T00:00:00.000Z" },
    ]);
    await createStockMarketDataCollectionRun({
      id: "market-data-run-1",
      provider: "moomoo",
      status: "completed",
      requestedEntries: 1,
      completedEntries: 1,
      upsertedCandles: 2,
      startedAt: new Date("2026-05-07T00:00:00.000Z"),
      completedAt: new Date("2026-05-07T00:00:02.000Z"),
    });
    await expect(listStockMarketDataCollectionRuns()).resolves.toMatchObject([
      { id: "market-data-run-1", status: "completed", upsertedCandles: 2 },
    ]);

    const run = await createStockBacktestRun({
      id: "backtest-1",
      symbol: "NVDA",
      timeframe: "1d",
      strategyTag: "breakout_momentum",
      params: { lookbackBars: 3 },
      status: "completed",
      candleCount: 2,
      tradeCount: 1,
      winRate: 1,
      realizedPnl: 120,
      grossProfit: 120,
      grossLoss: 0,
      averageProfit: 120,
      averageLoss: null,
      expectancy: 120,
      profitFactor: null,
      maximumDrawdown: 0,
      from: new Date("2026-05-01T00:00:00.000Z"),
      to: new Date("2026-05-02T00:00:00.000Z"),
      trades: [{
        entryAt: new Date("2026-05-01T00:00:00.000Z"),
        exitAt: new Date("2026-05-02T00:00:00.000Z"),
        entryPrice: 101,
        exitPrice: 104,
        quantity: 40,
        grossPnl: 120,
        fees: 0,
        slippageCost: 0,
        netPnl: 120,
        outcome: "win",
        holdingBars: 1,
      }],
    });

    expect(run.trades).toHaveLength(1);
    await expect(listStockBacktestRuns()).resolves.toMatchObject([{ id: "backtest-1", tradeCount: 1, realizedPnl: 120 }]);
    await expect(getStockBacktestRunDetail("backtest-1")).resolves.toMatchObject({ id: "backtest-1", trades: [{ outcome: "win" }] });
  });
});
