import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("stock trading paper runner", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock("../src/utils/llm-provider.js");
    const dir = await mkdtemp(join(tmpdir(), "stock-runner-"));
    process.env = {
      NODE_ENV: "production",
      DB_PATH: join(dir, "pipeline.db"),
      TRADINGVIEW_WEBHOOK_SECRET: "tv-secret",
      STOCK_PAPER_TRADE_CONFIDENCE_THRESHOLD: "0.7",
      STOCK_PAPER_TRADE_NOTIONAL_JPY: "100000",
    };
  });

  it("parses TradingView payloads without retaining webhook secret", async () => {
    const { parseTradingViewSignalPayload } = await import("../src/stock-trading/paper-runner.js");

    const parsed = parseTradingViewSignalPayload({
      secret: "tv-secret",
      passphrase: "tv-passphrase",
      token: "tv-token",
      symbol: "nvda",
      timeframe: "5m",
      price: "128",
      strategy: "breakout",
      action: "buy",
      indicators: { rsi: 58, ema20: 126 },
    });

    expect(parsed).toMatchObject({
      ok: true,
      signal: {
        symbol: "NVDA",
        timeframe: "5m",
        price: 128,
        suggestedAction: "BUY",
        rawPayload: expect.not.objectContaining({ secret: "tv-secret" }),
      },
    });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.signal.rawPayload).not.toMatchObject({
      passphrase: "tv-passphrase",
      token: "tv-token",
    });
  });

  it("creates a paper decision, paper trade, and portfolio snapshot for actionable signals", async () => {
    const { processStockMarketSignal } = await import("../src/stock-trading/paper-runner.js");
    const { listStockAiDecisions, listStockMarketSignals, listStockPortfolioSnapshots, listStockPositions, listStockTrades } = await import("../src/stock-trading/repository.js");

    const result = await processStockMarketSignal({
      sourceSignalId: "alert-1",
      symbol: "NVDA",
      timeframe: "5m",
      price: 128,
      strategyTag: "breakout",
      suggestedAction: "BUY",
      indicators: { rsi: 58, ema20: 126, ema50: 122 },
      rawPayload: { symbol: "NVDA" },
    });

    expect(result.status).toBe("executed");
    expect(result.decision).toMatchObject({ symbol: "NVDA", finalAction: "BUY" });
    expect(result.decision?.agents.map((agent) => agent.agentName)).toEqual([
      "market-scanner",
      "fundamental",
      "news",
      "technical",
      "entry",
      "exit",
      "risk",
      "portfolio",
      "review-learning",
      "knowledge-curator",
      "judge",
    ]);
    expect(result.trade).toMatchObject({ symbol: "NVDA", executionSource: "paper", side: "buy" });
    expect(result.learningItems).toEqual([]);
    await expect(listStockMarketSignals()).resolves.toMatchObject([{ status: "executed", tradeId: result.trade?.id }]);
    await expect(listStockAiDecisions()).resolves.toHaveLength(1);
    await expect(listStockTrades()).resolves.toHaveLength(1);
    await expect(listStockPositions()).resolves.toMatchObject([{ symbol: "NVDA", quantity: 781.25, averageEntryPrice: 128 }]);
    await expect(listStockPortfolioSnapshots()).resolves.toHaveLength(1);
  });

  it("reviews winning paper sell trades into learning items with decision, agent, risk, and research context", async () => {
    const { processStockMarketSignal } = await import("../src/stock-trading/paper-runner.js");
    const { reviewCompletedPaperTrade } = await import("../src/stock-trading/trade-review.js");
    const { createStockResearchItem, listStockLearningItems, listStockLearningItemsBySourceTrade } = await import("../src/stock-trading/repository.js");

    await createStockResearchItem({
      symbol: "NVDA",
      category: "earnings",
      title: "決算後モメンタム継続",
      summary: "市場反応が強い。",
      source: "manual",
      sentiment: "positive",
      importance: 0.9,
    });
    await processStockMarketSignal({
      symbol: "NVDA",
      timeframe: "5m",
      price: 100,
      strategyTag: "breakout_momentum",
      suggestedAction: "BUY",
      indicators: { rsi: 58, ema20: 98, ema50: 95 },
      rawPayload: { symbol: "NVDA" },
    });

    const result = await processStockMarketSignal({
      symbol: "NVDA",
      timeframe: "5m",
      price: 120,
      strategyTag: "breakout_momentum",
      suggestedAction: "SELL",
      indicators: { rsi: 42, ema20: 122, ema50: 124 },
      rawPayload: { symbol: "NVDA" },
    });

    expect(result.status).toBe("executed");
    expect(result.trade).toMatchObject({ side: "sell", outcome: "win" });
    expect(result.learningItems).toHaveLength(2);
    expect(result.learningItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "winning_pattern", sourceTradeId: result.trade?.id }),
      expect.objectContaining({ category: "strategy_note", sourceTradeId: result.trade?.id }),
    ]));
    const body = result.learningItems?.map((item) => item.body).join("\n") ?? "";
    expect(body).toContain("AI判断");
    expect(body).toContain("Agent意見");
    expect(body).toContain("risk=");
    expect(body).toContain("決算後モメンタム継続");

    if (!result.trade) throw new Error("expected trade");
    await expect(reviewCompletedPaperTrade(result.trade)).resolves.toHaveLength(2);
    await expect(listStockLearningItemsBySourceTrade(result.trade.id)).resolves.toHaveLength(2);
    await expect(listStockLearningItems()).resolves.toHaveLength(2);
  });

  it("reviews losing paper sell trades into loss and blocked-pattern learning items", async () => {
    const { processStockMarketSignal } = await import("../src/stock-trading/paper-runner.js");

    await processStockMarketSignal({
      symbol: "NVDA",
      timeframe: "5m",
      price: 100,
      strategyTag: "breakout_momentum",
      suggestedAction: "BUY",
      indicators: { rsi: 58, ema20: 98, ema50: 95 },
      rawPayload: { symbol: "NVDA" },
    });
    process.env.STOCK_PAPER_TRADE_NOTIONAL_JPY = "50000";

    const result = await processStockMarketSignal({
      symbol: "NVDA",
      timeframe: "5m",
      price: 90,
      suggestedAction: "SELL",
      indicators: { rsi: 35, ema20: 95, ema50: 98 },
      rawPayload: { symbol: "NVDA" },
    });

    expect(result.status).toBe("executed");
    expect(result.trade).toMatchObject({ side: "sell", outcome: "loss" });
    expect(result.learningItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "losing_pattern" }),
      expect.objectContaining({ category: "blocked_pattern" }),
    ]));
  });

  it("records low-confidence decisions without creating paper trades", async () => {
    process.env.STOCK_PAPER_TRADE_CONFIDENCE_THRESHOLD = "0.9";
    const { processStockMarketSignal } = await import("../src/stock-trading/paper-runner.js");
    const { listStockMarketSignals, listStockTrades } = await import("../src/stock-trading/repository.js");

    const result = await processStockMarketSignal({
      symbol: "TSLA",
      timeframe: "15m",
      price: 220,
      strategyTag: "overextended",
      suggestedAction: "BUY",
      indicators: { rsi: 82, ema20: 210 },
      rawPayload: { symbol: "TSLA" },
    });

    expect(result.status).toBe("blocked");
    expect(result.trade).toBeUndefined();
    await expect(listStockMarketSignals()).resolves.toMatchObject([{ status: "blocked", statusReason: "confidence_below_threshold:0.9" }]);
    await expect(listStockTrades()).resolves.toEqual([]);
  });

  it("uses LLM multi-agent decisions when configured", async () => {
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.STOCK_AI_DECISION_MODE = "llm";
    const generateText = vi.fn().mockResolvedValue(JSON.stringify(createLlmDecision({ finalAction: "BUY" })));
    vi.doMock("../src/utils/llm-provider.js", () => ({ generateText }));
    const { createStockLearningItem, createStockResearchItem, getStockAiDecisionDetail } = await import("../src/stock-trading/repository.js");
    await createStockResearchItem({
      symbol: "NVDA",
      category: "news",
      title: "AI需要が強い",
      summary: "半導体関連の需要が堅調という手入力メモ。",
      source: "manual",
      sentiment: "positive",
      importance: 0.8,
    });
    await createStockLearningItem({
      id: "lesson-feedback-1",
      category: "winning_pattern",
      title: "初回押しを待つ",
      body: "ブレイク直後ではなく、押し目から再上昇した場合に期待値が高い。",
      confidence: 0.77,
      appliedToSkill: false,
    });
    const { processStockMarketSignal } = await import("../src/stock-trading/paper-runner.js");
    const { listStockAiDecisions, listStockTrades } = await import("../src/stock-trading/repository.js");

    const result = await processStockMarketSignal({
      symbol: "NVDA",
      timeframe: "5m",
      price: 128,
      strategyTag: "breakout",
      indicators: { rsi: 58, ema20: 126, ema50: 122 },
      rawPayload: { symbol: "NVDA" },
    });

    expect(generateText).toHaveBeenCalledOnce();
    const prompt = generateText.mock.calls[0][0] as string;
    expect(prompt).toContain("researchContext");
    expect(prompt).toContain("learningContext");
    expect(prompt).toContain("review-learning");
    expect(prompt).toContain("knowledge-curator");
    expect(prompt).toContain("AI需要が強い");
    expect(prompt).toContain("初回押しを待つ");
    expect(prompt).toContain("Historical internal paper-trade observations");
    expect(result.status).toBe("executed");
    expect(result.decision).toMatchObject({
      finalAction: "BUY",
      agents: expect.arrayContaining([
        expect.objectContaining({ agentName: "technical", stance: "bullish" }),
        expect.objectContaining({ agentName: "review-learning" }),
        expect.objectContaining({ agentName: "knowledge-curator" }),
        expect.objectContaining({ agentName: "judge", stance: "buy" }),
      ]),
    });
    expect(result.decision?.learningItems).toMatchObject([
      { id: "lesson-feedback-1", title: "初回押しを待つ" },
    ]);
    expect(result.decision?.agents).toHaveLength(11);
    if (!result.decision) throw new Error("expected decision");
    await expect(getStockAiDecisionDetail(result.decision.id)).resolves.toMatchObject({
      learningItems: [{ id: "lesson-feedback-1" }],
    });
    await expect(listStockAiDecisions()).resolves.toMatchObject([{ finalAction: "BUY", confidence: 0.84 }]);
    await expect(listStockTrades()).resolves.toHaveLength(1);
  });

  it("enforces Risk Manager veto on LLM actionable decisions", async () => {
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.STOCK_AI_DECISION_MODE = "llm";
    vi.doMock("../src/utils/llm-provider.js", () => ({
      generateText: vi.fn().mockResolvedValue(JSON.stringify(createLlmDecision({
        finalAction: "BUY",
        agents: [
          { agentName: "risk", score: 20, stance: "reject", summary: "損切り幅が広すぎます。", reasoning: "Risk/reward is poor." },
          { agentName: "judge", score: 78, stance: "buy", summary: "買い推奨", reasoning: "Trend is strong." },
        ],
      }))),
    }));
    const { processStockMarketSignal } = await import("../src/stock-trading/paper-runner.js");
    const { listStockAiDecisions, listStockTrades } = await import("../src/stock-trading/repository.js");

    const result = await processStockMarketSignal({
      symbol: "NVDA",
      timeframe: "5m",
      price: 128,
      strategyTag: "breakout",
      indicators: { rsi: 76, ema20: 126, ema50: 122 },
      rawPayload: { symbol: "NVDA" },
    });

    expect(result.status).toBe("processed");
    expect(result.trade).toBeUndefined();
    expect(result.decision).toMatchObject({
      finalAction: "WATCH",
      riskFactors: expect.arrayContaining(["Risk Manager veto: 損切り幅が広すぎます。"]),
      agents: expect.arrayContaining([
        expect.objectContaining({ agentName: "fundamental" }),
        expect.objectContaining({ agentName: "knowledge-curator" }),
      ]),
    });
    expect(result.decision?.agents).toHaveLength(11);
    await expect(listStockAiDecisions()).resolves.toMatchObject([{ finalAction: "WATCH" }]);
    await expect(listStockTrades()).resolves.toEqual([]);
  });

  it("falls back to deterministic decisions when LLM output is invalid", async () => {
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.STOCK_AI_DECISION_MODE = "llm";
    vi.doMock("../src/utils/llm-provider.js", () => ({ generateText: vi.fn().mockResolvedValue("not-json") }));
    const { processStockMarketSignal } = await import("../src/stock-trading/paper-runner.js");

    const result = await processStockMarketSignal({
      symbol: "NVDA",
      timeframe: "5m",
      price: 128,
      strategyTag: "breakout",
      suggestedAction: "BUY",
      indicators: { rsi: 58, ema20: 126, ema50: 122 },
      rawPayload: { symbol: "NVDA" },
    });

    expect(result.status).toBe("executed");
    expect(result.decision).toMatchObject({
      finalAction: "BUY",
      agents: expect.arrayContaining([expect.objectContaining({ agentName: "market-scanner" })]),
    });
  });

  it("blocks sell signals when the paper position is insufficient", async () => {
    const { processStockMarketSignal } = await import("../src/stock-trading/paper-runner.js");
    const { listStockMarketSignals, listStockPortfolioSnapshots, listStockTrades } = await import("../src/stock-trading/repository.js");

    const result = await processStockMarketSignal({
      symbol: "NVDA",
      timeframe: "5m",
      price: 100,
      strategyTag: "breakdown",
      suggestedAction: "SELL",
      indicators: { rsi: 40, ema20: 105, ema50: 110 },
      rawPayload: { symbol: "NVDA" },
    });

    expect(result.status).toBe("blocked");
    expect(result.trade).toBeUndefined();
    expect(result.portfolio).toBeUndefined();
    await expect(listStockMarketSignals()).resolves.toMatchObject([{ status: "blocked", statusReason: "paper_sell_exceeds_position" }]);
    await expect(listStockTrades()).resolves.toEqual([]);
    await expect(listStockPortfolioSnapshots()).resolves.toEqual([]);
  });

  it("rejects webhook requests without the TradingView secret", async () => {
    const { handleTradingViewStockWebhook } = await import("../src/stock-trading/paper-runner.js");
    const { listStockMarketSignals } = await import("../src/stock-trading/repository.js");
    const res = createResponse();

    await handleTradingViewStockWebhook({
      headers: {},
      body: { symbol: "NVDA", price: 128 },
    } as Parameters<typeof handleTradingViewStockWebhook>[0], res as Parameters<typeof handleTradingViewStockWebhook>[1]);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
    await expect(listStockMarketSignals()).resolves.toEqual([]);
  });

  it("accepts authenticated webhook requests", async () => {
    const { handleTradingViewStockWebhook } = await import("../src/stock-trading/paper-runner.js");
    const res = createResponse();

    await handleTradingViewStockWebhook({
      headers: { "x-tradingview-secret": "tv-secret" },
      body: { symbol: "NVDA", timeframe: "5m", price: 128, action: "BUY", indicators: { rsi: 58, ema20: 126 } },
    } as Parameters<typeof handleTradingViewStockWebhook>[0], res as Parameters<typeof handleTradingViewStockWebhook>[1]);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ status: "executed", signal: { symbol: "NVDA" }, trade: { executionSource: "paper" } });
  });
});

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

function createLlmDecision(overrides: Partial<{
  finalAction: string;
  confidence: number;
  agents: Array<{ agentName: string; score: number; stance: string; summary: string; reasoning: string }>;
}> = {}) {
  return {
    finalAction: overrides.finalAction ?? "BUY",
    confidence: overrides.confidence ?? 0.84,
    reasoning: "Technical setup is favorable, while unavailable fundamentals and news are treated as uncertainty.",
    riskFactors: ["ニュースと決算情報は未取得です。"],
    takeProfitPrice: 136,
    stopLossPrice: 124,
    agents: overrides.agents ?? [
      { agentName: "market-scanner", score: 60, stance: "neutral", summary: "市場全体データは未取得", reasoning: "Index and sector flow are unavailable." },
      { agentName: "fundamental", score: 50, stance: "uncertain", summary: "ファンダ情報は未取得", reasoning: "No earnings or valuation facts were provided." },
      { agentName: "news", score: 50, stance: "uncertain", summary: "ニュース情報は未取得", reasoning: "No news facts were provided." },
      { agentName: "technical", score: 82, stance: "bullish", summary: "短期トレンドは上向き", reasoning: "Price is above EMA20 and EMA50." },
      { agentName: "entry", score: 72, stance: "enter", summary: "エントリー許容", reasoning: "Signal price is close to breakout context." },
      { agentName: "exit", score: 65, stance: "planned", summary: "利確と損切りを設定", reasoning: "Use fixed paper take-profit and stop-loss levels." },
      { agentName: "risk", score: 74, stance: "approve", summary: "paper sizingなら許容", reasoning: "Paper notional and threshold are applied." },
      { agentName: "portfolio", score: 70, stance: "approve", summary: "余力あり", reasoning: "No conflicting open position context blocks this trade." },
      { agentName: "judge", score: 84, stance: "buy", summary: "BUYを採用", reasoning: "Technical and entry agents support a paper trade." },
    ],
  };
}
