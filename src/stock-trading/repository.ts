import { randomUUID } from "node:crypto";
import { getDb } from "../utils/db.js";
import { DurableHttpStorageClient, getStorageConfig } from "../storage/index.js";
import type {
  CreateStockAiDecisionInput,
  CreateStockLearningItemInput,
  CreateStockPortfolioSnapshotInput,
  CreateStockTradeInput,
  StockAgentDecision,
  StockAiDecision,
  StockAiDecisionDetail,
  StockExecutionSource,
  StockIntegrationStatus,
  StockLearningCategory,
  StockLearningItem,
  StockPortfolioMetrics,
  StockPortfolioSnapshot,
  StockTrade,
  StockTradeAction,
  StockTradeSide,
  StockTradingOverview,
} from "./types.js";

type JsonObject = Record<string, unknown>;

const DEFAULT_INITIAL_CAPITAL = 1_000_000;

type DecisionRow = {
  id: string;
  symbol: string;
  final_action: StockTradeAction;
  confidence: number;
  strategy_tag: string | null;
  reasoning: string;
  risk_factors_json: string;
  take_profit_price: number | null;
  stop_loss_price: number | null;
  created_at: number;
};

type AgentDecisionRow = {
  id: string;
  ai_decision_id: string;
  agent_name: string;
  score: number;
  stance: string;
  summary: string;
  reasoning: string;
  created_at: number;
};

type TradeRow = {
  id: string;
  decision_id: string | null;
  symbol: string;
  side: StockTradeSide;
  quantity: number;
  price: number;
  executed_at: number;
  execution_source: StockExecutionSource;
  raw_execution_json: string;
  realized_pnl: number | null;
  outcome: StockTrade["outcome"] | null;
  created_at: number;
};

type PortfolioSnapshotRow = {
  id: string;
  initial_capital: number;
  total_equity: number;
  cash_balance: number;
  unrealized_pnl: number;
  realized_pnl: number;
  captured_at: number;
};

type LearningItemRow = {
  id: string;
  source_trade_id: string | null;
  category: StockLearningCategory;
  title: string;
  body: string;
  confidence: number;
  applied_to_skill: number;
  created_at: number;
};

export async function createStockAiDecision(input: CreateStockAiDecisionInput): Promise<StockAiDecisionDetail> {
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt?.getTime() ?? Date.now();
  const agents = input.agents ?? [];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([
      {
        sql: `INSERT INTO stock_ai_decisions (
          id, symbol, final_action, confidence, strategy_tag, reasoning, risk_factors_json,
          take_profit_price, stop_loss_price, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          input.symbol,
          input.finalAction,
          input.confidence,
          input.strategyTag ?? null,
          input.reasoning,
          jsonArray(input.riskFactors ?? []),
          input.takeProfitPrice ?? null,
          input.stopLossPrice ?? null,
          createdAt,
        ],
      },
      ...agents.map((agent) => ({
        sql: `INSERT INTO stock_agent_decisions (
          id, ai_decision_id, agent_name, score, stance, summary, reasoning, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          agent.id ?? randomUUID(),
          id,
          agent.agentName,
          agent.score,
          agent.stance,
          agent.summary,
          agent.reasoning,
          agent.createdAt?.getTime() ?? createdAt,
        ],
      })),
    ]);
    const detail = await getStockAiDecisionDetail(id);
    if (!detail) throw new Error(`Failed to load stock decision ${id}`);
    return detail;
  }

  const db = await getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO stock_ai_decisions (
        id, symbol, final_action, confidence, strategy_tag, reasoning, risk_factors_json,
        take_profit_price, stop_loss_price, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.symbol,
      input.finalAction,
      input.confidence,
      input.strategyTag ?? null,
      input.reasoning,
      jsonArray(input.riskFactors ?? []),
      input.takeProfitPrice ?? null,
      input.stopLossPrice ?? null,
      createdAt,
    );

    const insertAgent = db.prepare(
      `INSERT INTO stock_agent_decisions (
        id, ai_decision_id, agent_name, score, stance, summary, reasoning, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const agent of agents) {
      insertAgent.run(
        agent.id ?? randomUUID(),
        id,
        agent.agentName,
        agent.score,
        agent.stance,
        agent.summary,
        agent.reasoning,
        agent.createdAt?.getTime() ?? createdAt,
      );
    }
  });
  tx();

  const detail = await getStockAiDecisionDetail(id);
  if (!detail) throw new Error(`Failed to load stock decision ${id}`);
  return detail;
}

export async function createStockTrade(input: CreateStockTradeInput): Promise<StockTrade> {
  assertPaperExecutionSource(input.executionSource);
  const id = input.id ?? randomUUID();
  const executedAt = input.executedAt?.getTime() ?? Date.now();
  const createdAt = input.createdAt?.getTime() ?? executedAt;
  const durable = getDurableClient();
  const params = [
    id,
    input.decisionId ?? null,
    input.symbol,
    input.side,
    input.quantity,
    input.price,
    executedAt,
    input.executionSource,
    json(input.rawExecution ?? {}),
    input.realizedPnl ?? null,
    input.outcome ?? null,
    createdAt,
  ];
  if (durable) {
    await durable.executeSql([{
      sql: `INSERT INTO stock_trades (
        id, decision_id, symbol, side, quantity, price, executed_at, execution_source,
        raw_execution_json, realized_pnl, outcome, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params,
    }]);
  } else {
    const db = await getDb();
    db.prepare(
      `INSERT INTO stock_trades (
        id, decision_id, symbol, side, quantity, price, executed_at, execution_source,
        raw_execution_json, realized_pnl, outcome, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...params);
  }
  const trade = (await listStockTrades(200)).find((item) => item.id === id);
  if (!trade) throw new Error(`Failed to load stock trade ${id}`);
  return trade;
}

export async function createStockPortfolioSnapshot(input: CreateStockPortfolioSnapshotInput): Promise<StockPortfolioSnapshot> {
  const id = input.id ?? randomUUID();
  const capturedAt = input.capturedAt?.getTime() ?? Date.now();
  const params = [
    id,
    input.initialCapital,
    input.totalEquity,
    input.cashBalance,
    input.unrealizedPnl,
    input.realizedPnl,
    capturedAt,
  ];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{
      sql: `INSERT INTO stock_portfolio_snapshots (
        id, initial_capital, total_equity, cash_balance, unrealized_pnl, realized_pnl, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params,
    }]);
  } else {
    const db = await getDb();
    db.prepare(
      `INSERT INTO stock_portfolio_snapshots (
        id, initial_capital, total_equity, cash_balance, unrealized_pnl, realized_pnl, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(...params);
  }
  const latest = await getLatestPortfolioSnapshot();
  if (!latest || latest.id !== id) {
    return {
      id,
      initialCapital: input.initialCapital,
      totalEquity: input.totalEquity,
      cashBalance: input.cashBalance,
      unrealizedPnl: input.unrealizedPnl,
      realizedPnl: input.realizedPnl,
      capturedAt: new Date(capturedAt).toISOString(),
    };
  }
  return latest;
}

export async function createStockLearningItem(input: CreateStockLearningItemInput): Promise<StockLearningItem> {
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt?.getTime() ?? Date.now();
  const params = [
    id,
    input.sourceTradeId ?? null,
    input.category,
    input.title,
    input.body,
    input.confidence,
    input.appliedToSkill ? 1 : 0,
    createdAt,
  ];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{
      sql: `INSERT INTO stock_learning_items (
        id, source_trade_id, category, title, body, confidence, applied_to_skill, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params,
    }]);
  } else {
    const db = await getDb();
    db.prepare(
      `INSERT INTO stock_learning_items (
        id, source_trade_id, category, title, body, confidence, applied_to_skill, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...params);
  }
  const item = (await listStockLearningItems(200)).find((value) => value.id === id);
  if (!item) throw new Error(`Failed to load stock learning item ${id}`);
  return item;
}

export async function listStockAiDecisions(limit = 50): Promise<StockAiDecision[]> {
  const rows = await selectRows<DecisionRow>(
    "SELECT * FROM stock_ai_decisions ORDER BY created_at DESC LIMIT ?",
    [boundedLimit(limit)],
  );
  return rows.map(mapDecisionRow);
}

export async function getStockAiDecisionDetail(id: string): Promise<StockAiDecisionDetail | null> {
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<DecisionRow | AgentDecisionRow>([
      { sql: "SELECT * FROM stock_ai_decisions WHERE id = ?", params: [id] },
      { sql: "SELECT * FROM stock_agent_decisions WHERE ai_decision_id = ? ORDER BY created_at ASC", params: [id] },
    ]);
    const row = (results[0]?.results?.[0] as DecisionRow | undefined) ?? undefined;
    if (!row) return null;
    const agents = (results[1]?.results ?? []) as AgentDecisionRow[];
    return { ...mapDecisionRow(row), agents: agents.map(mapAgentDecisionRow) };
  }

  const db = await getDb();
  const row = db.prepare("SELECT * FROM stock_ai_decisions WHERE id = ?").get(id) as DecisionRow | undefined;
  if (!row) return null;
  const agents = db
    .prepare("SELECT * FROM stock_agent_decisions WHERE ai_decision_id = ? ORDER BY created_at ASC")
    .all(id) as AgentDecisionRow[];
  return { ...mapDecisionRow(row), agents: agents.map(mapAgentDecisionRow) };
}

export async function listStockTrades(limit = 100): Promise<StockTrade[]> {
  const rows = await selectRows<TradeRow>(
    "SELECT * FROM stock_trades ORDER BY executed_at DESC LIMIT ?",
    [boundedLimit(limit, 500)],
  );
  return rows.map(mapTradeRow);
}

export async function listStockPortfolioSnapshots(limit = 100): Promise<StockPortfolioSnapshot[]> {
  const rows = await selectRows<PortfolioSnapshotRow>(
    "SELECT * FROM stock_portfolio_snapshots ORDER BY captured_at DESC LIMIT ?",
    [boundedLimit(limit, 500)],
  );
  return rows.map(mapPortfolioSnapshotRow);
}

export async function getLatestPortfolioSnapshot(): Promise<StockPortfolioSnapshot | null> {
  const rows = await selectRows<PortfolioSnapshotRow>(
    "SELECT * FROM stock_portfolio_snapshots ORDER BY captured_at DESC LIMIT 1",
  );
  return rows[0] ? mapPortfolioSnapshotRow(rows[0]) : null;
}

export async function listStockLearningItems(limit = 100): Promise<StockLearningItem[]> {
  const rows = await selectRows<LearningItemRow>(
    "SELECT * FROM stock_learning_items ORDER BY created_at DESC LIMIT ?",
    [boundedLimit(limit, 500)],
  );
  return rows.map(mapLearningItemRow);
}

export async function getStockIntegrationStatus(env: NodeJS.ProcessEnv = process.env): Promise<StockIntegrationStatus[]> {
  return [
    { label: "moomoo OpenAPI", key: "MOOMOO_OPENAPI_HOST", configured: Boolean(env.MOOMOO_OPENAPI_HOST), purpose: "market_data" },
    { label: "moomoo account", key: "MOOMOO_ACCOUNT_ID", configured: Boolean(env.MOOMOO_ACCOUNT_ID), purpose: "broker" },
    { label: "TradingView webhook", key: "TRADINGVIEW_WEBHOOK_SECRET", configured: Boolean(env.TRADINGVIEW_WEBHOOK_SECRET), purpose: "webhook" },
    { label: "News API", key: "STOCK_NEWS_API_KEY", configured: Boolean(env.STOCK_NEWS_API_KEY), purpose: "market_data" },
  ];
}

export async function getStockPortfolioMetrics(): Promise<StockPortfolioMetrics> {
  const history = (await listStockPortfolioSnapshots(120)).reverse();
  const latestSnapshot = history.at(-1);
  const initialCapital = latestSnapshot?.initialCapital ?? parseInitialCapital();
  const trades = await listStockTrades(500);
  return {
    initialCapital,
    currentEquity: latestSnapshot?.totalEquity ?? initialCapital,
    cashBalance: latestSnapshot?.cashBalance ?? initialCapital,
    realizedPnl: latestSnapshot?.realizedPnl ?? 0,
    unrealizedPnl: latestSnapshot?.unrealizedPnl ?? 0,
    winRate: calculateWinRate(trades),
    maximumDrawdown: calculateMaximumDrawdown(history),
    latestSnapshot,
    history,
  };
}

export async function getStockTradingOverview(): Promise<StockTradingOverview> {
  const [portfolio, recentDecisions, recentTrades, recentLessons, integrations] = await Promise.all([
    getStockPortfolioMetrics(),
    listStockAiDecisions(5),
    listStockTrades(5),
    listStockLearningItems(5),
    getStockIntegrationStatus(),
  ]);
  return {
    portfolio,
    recentDecisions,
    recentTrades,
    recentLessons,
    integrations,
    safety: {
      mode: "paper_only",
      realOrderPlacementEnabled: false,
      message: "このMVPは内部ペーパー取引のみを記録します。実弾注文、取消、資金移動は実行しません。",
    },
  };
}

export async function seedStockTradingFixtureData(): Promise<{
  decision: StockAiDecisionDetail;
  trade: StockTrade;
  snapshot: StockPortfolioSnapshot;
  lesson: StockLearningItem;
}> {
  const decision = await createStockAiDecision({
    id: "stock-decision-fixture-1",
    symbol: "NVDA",
    finalAction: "WATCH",
    confidence: 0.72,
    strategyTag: "breakout_momentum",
    reasoning: "半導体テーマは強いが急騰後のため押し目待ち。",
    riskFactors: ["短期RSIが高い", "損切り位置が遠い"],
    takeProfitPrice: 132,
    stopLossPrice: 124,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    agents: [
      {
        id: "stock-agent-fixture-risk",
        agentName: "risk",
        score: 35,
        stance: "reject",
        summary: "今の価格ではリスクリワードが悪い",
        reasoning: "損切り幅が想定利益に対して広い。",
      },
      {
        id: "stock-agent-fixture-technical",
        agentName: "technical",
        score: 62,
        stance: "wait",
        summary: "トレンドは強いが押し目待ち",
        reasoning: "高値更新後で過熱感が残る。",
      },
    ],
  });
  const trade = await createStockTrade({
    id: "stock-trade-fixture-1",
    decisionId: decision.id,
    symbol: "NVDA",
    side: "buy",
    quantity: 10,
    price: 128,
    executionSource: "paper",
    rawExecution: { source: "fixture" },
    realizedPnl: 240,
    outcome: "win",
    executedAt: new Date("2026-05-17T01:00:00.000Z"),
  });
  const snapshot = await createStockPortfolioSnapshot({
    id: "stock-snapshot-fixture-1",
    initialCapital: 1_000_000,
    totalEquity: 1_002_400,
    cashBalance: 998_720,
    unrealizedPnl: 2_160,
    realizedPnl: 240,
    capturedAt: new Date("2026-05-17T02:00:00.000Z"),
  });
  const lesson = await createStockLearningItem({
    id: "stock-lesson-fixture-1",
    sourceTradeId: trade.id,
    category: "rule_candidate",
    title: "ブレイク直後は初回押しを待つ",
    body: "高値更新後すぐではなく、5分足で一度押して再上昇した場合のみ入る。",
    confidence: 0.68,
    appliedToSkill: false,
    createdAt: new Date("2026-05-17T03:00:00.000Z"),
  });
  return { decision, trade, snapshot, lesson };
}

function mapDecisionRow(row: DecisionRow): StockAiDecision {
  return {
    id: row.id,
    symbol: row.symbol,
    finalAction: row.final_action,
    confidence: row.confidence,
    strategyTag: row.strategy_tag ?? undefined,
    reasoning: row.reasoning,
    riskFactors: parseStringArray(row.risk_factors_json),
    takeProfitPrice: row.take_profit_price ?? undefined,
    stopLossPrice: row.stop_loss_price ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapAgentDecisionRow(row: AgentDecisionRow): StockAgentDecision {
  return {
    id: row.id,
    aiDecisionId: row.ai_decision_id,
    agentName: row.agent_name,
    score: row.score,
    stance: row.stance,
    summary: row.summary,
    reasoning: row.reasoning,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapTradeRow(row: TradeRow): StockTrade {
  return {
    id: row.id,
    decisionId: row.decision_id ?? undefined,
    symbol: row.symbol,
    side: row.side,
    quantity: row.quantity,
    price: row.price,
    executedAt: new Date(row.executed_at).toISOString(),
    executionSource: row.execution_source,
    rawExecution: parseJson(row.raw_execution_json),
    realizedPnl: row.realized_pnl ?? undefined,
    outcome: row.outcome ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapPortfolioSnapshotRow(row: PortfolioSnapshotRow): StockPortfolioSnapshot {
  return {
    id: row.id,
    initialCapital: row.initial_capital,
    totalEquity: row.total_equity,
    cashBalance: row.cash_balance,
    unrealizedPnl: row.unrealized_pnl,
    realizedPnl: row.realized_pnl,
    capturedAt: new Date(row.captured_at).toISOString(),
  };
}

function mapLearningItemRow(row: LearningItemRow): StockLearningItem {
  return {
    id: row.id,
    sourceTradeId: row.source_trade_id ?? undefined,
    category: row.category,
    title: row.title,
    body: row.body,
    confidence: row.confidence,
    appliedToSkill: row.applied_to_skill === 1,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function selectRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<T>([{ sql, params }]);
    return results[0]?.results ?? [];
  }
  const db = await getDb();
  return db.prepare(sql).all(...params) as T[];
}

function getDurableClient(): DurableHttpStorageClient | null {
  const config = getStorageConfig();
  if (config.mode !== "durable-http" || !config.durableHttp) return null;
  return new DurableHttpStorageClient({ config: config.durableHttp });
}

function assertPaperExecutionSource(source: StockExecutionSource): void {
  if (!["paper", "demo", "manual"].includes(source)) {
    throw new Error("stock trading executions must be paper, demo, or manual");
  }
}

function calculateWinRate(trades: StockTrade[]): number | null {
  const closed = trades.filter((trade) => trade.outcome && trade.outcome !== "open");
  if (closed.length === 0) return null;
  return closed.filter((trade) => trade.outcome === "win").length / closed.length;
}

function calculateMaximumDrawdown(history: StockPortfolioSnapshot[]): number | null {
  if (history.length === 0) return null;
  let peak = history[0].totalEquity;
  let maxDrawdown = 0;
  for (const snapshot of history) {
    peak = Math.max(peak, snapshot.totalEquity);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, (snapshot.totalEquity - peak) / peak);
  }
  return maxDrawdown;
}

function parseInitialCapital(): number {
  const value = Number(process.env.STOCK_TRADING_INITIAL_CAPITAL_JPY ?? DEFAULT_INITIAL_CAPITAL);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INITIAL_CAPITAL;
}

function boundedLimit(limit: number, max = 200): number {
  return Math.max(1, Math.min(limit, max));
}

function json(value: JsonObject): string {
  return JSON.stringify(value);
}

function jsonArray(value: string[]): string {
  return JSON.stringify(value);
}

function parseJson(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
