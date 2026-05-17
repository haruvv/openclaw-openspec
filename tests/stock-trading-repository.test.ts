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
      createStockPortfolioSnapshot,
      createStockTrade,
      getStockAiDecisionDetail,
      getStockTradingOverview,
      listStockTrades,
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

    await expect(getStockAiDecisionDetail("decision-1")).resolves.toMatchObject({
      symbol: "NVDA",
      agents: [{ agentName: "risk", stance: "reject" }],
    });
    await expect(listStockTrades()).resolves.toMatchObject([
      { id: "trade-1", executionSource: "paper", rawExecution: {} },
    ]);
    await expect(getStockTradingOverview()).resolves.toMatchObject({
      portfolio: {
        currentEquity: 1_002_400,
        realizedPnl: 240,
        winRate: 1,
      },
      safety: {
        mode: "paper_only",
        realOrderPlacementEnabled: false,
      },
    });
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
});
