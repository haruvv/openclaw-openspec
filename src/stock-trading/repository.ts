import { randomUUID } from "node:crypto";
import { getDb } from "../utils/db.js";
import { DurableHttpStorageClient, getStorageConfig } from "../storage/index.js";
import type {
  CreateStockAiDecisionInput,
  CreateStockBacktestRunInput,
  CreateStockCandleInput,
  CreateStockLearningItemInput,
  CreateStockMarketSignalInput,
  CreateStockPortfolioSnapshotInput,
  CreateStockResearchItemInput,
  CreateStockTradeInput,
  UpsertStockMarketCandidateInput,
  UpsertStockPositionInput,
  StockAgentDecision,
  StockAiDecision,
  StockAiDecisionDetail,
  StockBacktestRun,
  StockBacktestRunDetail,
  StockBacktestStatus,
  StockBacktestTrade,
  StockCandle,
  StockExecutionSource,
  StockIntegrationStatus,
  StockLearningCategory,
  StockLearningItem,
  StockMarketCandidate,
  StockMarketCandidateSource,
  StockMarketCandidateStatus,
  StockMarketSignal,
  StockMarketSignalStatus,
  StockPortfolioMetrics,
  StockPortfolioSnapshot,
  StockPosition,
  StockResearchCategory,
  StockResearchItem,
  StockResearchSentiment,
  StockStrategyPerformance,
  StockTrade,
  StockTradeAction,
  StockTradeSide,
  StockTradingOverview,
  StockTradingRule,
  StockTradingRuleCategory,
  StockTradingRuleStatus,
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

type PositionRow = {
  id: string;
  symbol: string;
  quantity: number;
  average_entry_price: number;
  realized_pnl: number;
  last_mark_price: number;
  last_marked_at: number;
  opened_at: number;
  updated_at: number;
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

type TradingRuleRow = {
  id: string;
  source_learning_item_id: string | null;
  category: StockTradingRuleCategory;
  title: string;
  rule_text: string;
  status: StockTradingRuleStatus;
  confidence: number;
  created_at: number;
  updated_at: number;
};

type MarketSignalRow = {
  id: string;
  source: "tradingview";
  source_signal_id: string | null;
  symbol: string;
  timeframe: string;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  strategy_tag: string | null;
  suggested_action: StockTradeAction | null;
  indicators_json: string;
  raw_payload_json: string;
  status: StockMarketSignalStatus;
  decision_id: string | null;
  trade_id: string | null;
  status_reason: string | null;
  received_at: number;
};

type ResearchItemRow = {
  id: string;
  symbol: string | null;
  category: StockResearchCategory;
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  sentiment: StockResearchSentiment;
  importance: number;
  raw_payload_json: string;
  published_at: number;
  created_at: number;
};

type MarketCandidateRow = {
  id: string;
  symbol: string;
  theme: string | null;
  sector: string | null;
  strategy_tag: string | null;
  reason: string;
  score: number;
  source: StockMarketCandidateSource;
  status: StockMarketCandidateStatus;
  source_ref_id: string | null;
  raw_payload_json: string;
  last_scanned_at: number;
  converted_decision_id: string | null;
  created_at: number;
  updated_at: number;
};

type CandleRow = {
  id: string;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
  timestamp: number;
  created_at: number;
  updated_at: number;
};

type BacktestRunRow = {
  id: string;
  symbol: string;
  timeframe: string;
  strategy_tag: string;
  params_json: string;
  status: StockBacktestStatus;
  candle_count: number;
  trade_count: number;
  win_rate: number | null;
  realized_pnl: number;
  gross_profit: number;
  gross_loss: number;
  average_profit: number | null;
  average_loss: number | null;
  expectancy: number | null;
  profit_factor: number | null;
  maximum_drawdown: number | null;
  from_ts: number | null;
  to_ts: number | null;
  error: string | null;
  started_at: number;
  completed_at: number | null;
  created_at: number;
};

type BacktestTradeRow = {
  id: string;
  run_id: string;
  symbol: string;
  entry_at: number;
  exit_at: number;
  entry_price: number;
  exit_price: number;
  quantity: number;
  gross_pnl: number;
  fees: number;
  slippage_cost: number;
  net_pnl: number;
  outcome: StockBacktestTrade["outcome"];
  holding_bars: number;
  created_at: number;
};

type StrategyTradeRow = {
  trade_id: string;
  strategy_tag: string | null;
  realized_pnl: number;
  outcome: StockTrade["outcome"];
  executed_at: number;
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

export async function upsertStockPosition(input: UpsertStockPositionInput): Promise<StockPosition> {
  const existing = await getStockPosition(input.symbol);
  const id = existing?.id ?? input.id ?? randomUUID();
  const now = Date.now();
  const lastMarkedAt = input.lastMarkedAt?.getTime() ?? now;
  const openedAt = existing ? Date.parse(existing.openedAt) : input.openedAt?.getTime() ?? now;
  const updatedAt = input.updatedAt?.getTime() ?? now;
  const params = [
    id,
    input.symbol,
    input.quantity,
    input.averageEntryPrice,
    input.realizedPnl,
    input.lastMarkPrice,
    lastMarkedAt,
    openedAt,
    updatedAt,
  ];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{
      sql: `INSERT INTO stock_positions (
        id, symbol, quantity, average_entry_price, realized_pnl, last_mark_price,
        last_marked_at, opened_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        quantity = excluded.quantity,
        average_entry_price = excluded.average_entry_price,
        realized_pnl = excluded.realized_pnl,
        last_mark_price = excluded.last_mark_price,
        last_marked_at = excluded.last_marked_at,
        updated_at = excluded.updated_at`,
      params,
    }]);
  } else {
    const db = await getDb();
    db.prepare(
      `INSERT INTO stock_positions (
        id, symbol, quantity, average_entry_price, realized_pnl, last_mark_price,
        last_marked_at, opened_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        quantity = excluded.quantity,
        average_entry_price = excluded.average_entry_price,
        realized_pnl = excluded.realized_pnl,
        last_mark_price = excluded.last_mark_price,
        last_marked_at = excluded.last_marked_at,
        updated_at = excluded.updated_at`
    ).run(...params);
  }
  const position = await getStockPosition(input.symbol);
  if (!position) throw new Error(`Failed to load stock position ${input.symbol}`);
  return position;
}

export async function applyPaperTradeWithLedger(input: CreateStockTradeInput): Promise<{
  trade: StockTrade;
  position: StockPosition;
  snapshot: StockPortfolioSnapshot;
}> {
  assertPaperExecutionSource(input.executionSource);
  const symbol = input.symbol.toUpperCase();
  const current = await getStockPosition(symbol);
  const currentQuantity = current?.quantity ?? 0;
  const currentAverage = current?.averageEntryPrice ?? 0;
  const currentRealized = current?.realizedPnl ?? 0;
  let nextQuantity = currentQuantity;
  let nextAverage = currentAverage;
  let realizedForTrade = 0;

  if (input.side === "buy") {
    nextQuantity = roundQuantity(currentQuantity + input.quantity);
    const currentCost = currentQuantity * currentAverage;
    const addedCost = input.quantity * input.price;
    nextAverage = nextQuantity > 0 ? roundPrice((currentCost + addedCost) / nextQuantity) : 0;
  } else {
    if (input.quantity > currentQuantity + 0.000_001) {
      throw new Error(`paper_sell_exceeds_position:${symbol}`);
    }
    realizedForTrade = roundMoney((input.price - currentAverage) * input.quantity);
    nextQuantity = roundQuantity(currentQuantity - input.quantity);
    nextAverage = nextQuantity > 0 ? currentAverage : 0;
  }

  const trade = await createStockTrade({
    ...input,
    symbol,
    realizedPnl: input.side === "sell" ? realizedForTrade : input.realizedPnl,
    outcome: input.side === "sell" ? classifyTradeOutcome(realizedForTrade) : input.outcome ?? "open",
  });
  const position = await upsertStockPosition({
    symbol,
    quantity: nextQuantity,
    averageEntryPrice: nextAverage,
    realizedPnl: roundMoney(currentRealized + realizedForTrade),
    lastMarkPrice: input.price,
  });
  const snapshot = await createStockPortfolioSnapshotFromLedger();
  return { trade, position, snapshot };
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
  await createStockTradingRuleCandidateFromLearningItem(item);
  return item;
}

export async function createStockMarketSignal(input: CreateStockMarketSignalInput): Promise<StockMarketSignal> {
  const id = input.id ?? randomUUID();
  const receivedAt = input.receivedAt?.getTime() ?? Date.now();
  const params = [
    id,
    input.source ?? "tradingview",
    input.sourceSignalId ?? null,
    input.symbol,
    input.timeframe,
    input.price,
    input.open ?? null,
    input.high ?? null,
    input.low ?? null,
    input.close ?? null,
    input.volume ?? null,
    input.strategyTag ?? null,
    input.suggestedAction ?? null,
    json(input.indicators ?? {}),
    json(input.rawPayload ?? {}),
    input.status ?? "received",
    input.decisionId ?? null,
    input.tradeId ?? null,
    input.statusReason ?? null,
    receivedAt,
  ];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{
      sql: `INSERT INTO stock_market_signals (
        id, source, source_signal_id, symbol, timeframe, price, open, high, low, close, volume,
        strategy_tag, suggested_action, indicators_json, raw_payload_json, status, decision_id,
        trade_id, status_reason, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params,
    }]);
  } else {
    const db = await getDb();
    db.prepare(
      `INSERT INTO stock_market_signals (
        id, source, source_signal_id, symbol, timeframe, price, open, high, low, close, volume,
        strategy_tag, suggested_action, indicators_json, raw_payload_json, status, decision_id,
        trade_id, status_reason, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...params);
  }
  const signal = await getStockMarketSignal(id);
  if (!signal) throw new Error(`Failed to load stock market signal ${id}`);
  return signal;
}

export async function createStockResearchItem(input: CreateStockResearchItemInput): Promise<StockResearchItem> {
  const id = input.id ?? randomUUID();
  const publishedAt = input.publishedAt?.getTime() ?? Date.now();
  const createdAt = input.createdAt?.getTime() ?? Date.now();
  const params = [
    id,
    input.symbol ? input.symbol.toUpperCase() : null,
    input.category,
    input.title,
    input.summary,
    input.source,
    input.sourceUrl ?? null,
    input.sentiment ?? "unknown",
    clampNumber(input.importance ?? 0.5, 0, 1),
    json(input.rawPayload ?? {}),
    publishedAt,
    createdAt,
  ];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{
      sql: `INSERT INTO stock_research_items (
        id, symbol, category, title, summary, source, source_url, sentiment,
        importance, raw_payload_json, published_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params,
    }]);
  } else {
    const db = await getDb();
    db.prepare(
      `INSERT INTO stock_research_items (
        id, symbol, category, title, summary, source, source_url, sentiment,
        importance, raw_payload_json, published_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...params);
  }
  const item = (await listStockResearchItems({ limit: 200 })).find((value) => value.id === id);
  if (!item) throw new Error(`Failed to load stock research item ${id}`);
  if (item.symbol) {
    await upsertStockMarketCandidate({
      symbol: item.symbol,
      theme: item.category === "sector" || item.category === "macro" ? item.title : undefined,
      reason: `Research ${item.category}: ${item.title}`,
      score: scoreResearchCandidate(item),
      source: "research",
      sourceRefId: item.id,
      rawPayload: {
        category: item.category,
        sentiment: item.sentiment,
        importance: item.importance,
        title: item.title,
        summary: item.summary,
      },
      lastScannedAt: new Date(Date.parse(item.publishedAt)),
    });
  }
  return item;
}

export async function upsertStockMarketCandidate(input: UpsertStockMarketCandidateInput): Promise<StockMarketCandidate> {
  const symbol = input.symbol.toUpperCase();
  const existing = await getStockMarketCandidateBySymbolSource(symbol, input.source);
  const id = existing?.id ?? input.id ?? randomUUID();
  const now = Date.now();
  const createdAt = existing ? Date.parse(existing.createdAt) : input.createdAt?.getTime() ?? now;
  const updatedAt = input.updatedAt?.getTime() ?? now;
  const lastScannedAt = input.lastScannedAt?.getTime() ?? now;
  const status = input.status ?? existing?.status ?? "watch";
  const convertedDecisionId = input.convertedDecisionId ?? existing?.convertedDecisionId ?? null;
  const params = [
    id,
    symbol,
    input.theme ?? existing?.theme ?? null,
    input.sector ?? existing?.sector ?? null,
    input.strategyTag ?? existing?.strategyTag ?? null,
    input.reason,
    clampNumber(input.score, 0, 1),
    input.source,
    status,
    input.sourceRefId ?? existing?.sourceRefId ?? null,
    json(input.rawPayload ?? existing?.rawPayload ?? {}),
    lastScannedAt,
    convertedDecisionId,
    createdAt,
    updatedAt,
  ];
  const durable = getDurableClient();
  const sql = `INSERT INTO stock_market_candidates (
    id, symbol, theme, sector, strategy_tag, reason, score, source, status,
    source_ref_id, raw_payload_json, last_scanned_at, converted_decision_id, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(symbol, source) DO UPDATE SET
    theme = excluded.theme,
    sector = excluded.sector,
    strategy_tag = excluded.strategy_tag,
    reason = excluded.reason,
    score = excluded.score,
    status = excluded.status,
    source_ref_id = excluded.source_ref_id,
    raw_payload_json = excluded.raw_payload_json,
    last_scanned_at = excluded.last_scanned_at,
    converted_decision_id = excluded.converted_decision_id,
    updated_at = excluded.updated_at`;
  if (durable) {
    await durable.executeSql([{ sql, params }]);
  } else {
    const db = await getDb();
    db.prepare(sql).run(...params);
  }
  const candidate = await getStockMarketCandidate(id) ?? await getStockMarketCandidateBySymbolSource(symbol, input.source);
  if (!candidate) throw new Error(`Failed to load stock market candidate ${id}`);
  return candidate;
}

export async function upsertStockCandles(inputs: CreateStockCandleInput[]): Promise<StockCandle[]> {
  if (inputs.length === 0) return [];
  const now = Date.now();
  const rows = inputs.map((input) => ({
    id: input.id ?? randomUUID(),
    symbol: input.symbol.toUpperCase(),
    timeframe: input.timeframe,
    open: input.open,
    high: input.high,
    low: input.low,
    close: input.close,
    volume: input.volume,
    source: input.source ?? "manual",
    timestamp: input.timestamp.getTime(),
    createdAt: input.createdAt?.getTime() ?? now,
    updatedAt: input.updatedAt?.getTime() ?? now,
  }));
  const durable = getDurableClient();
  const statements = rows.map((row) => ({
    sql: `INSERT INTO stock_candles (
      id, symbol, timeframe, open, high, low, close, volume, source, timestamp, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol, timeframe, timestamp) DO UPDATE SET
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      volume = excluded.volume,
      source = excluded.source,
      updated_at = excluded.updated_at`,
    params: [row.id, row.symbol, row.timeframe, row.open, row.high, row.low, row.close, row.volume, row.source, row.timestamp, row.createdAt, row.updatedAt],
  }));
  if (durable) {
    await durable.executeSql(statements);
  } else {
    const db = await getDb();
    const stmt = db.prepare(statements[0].sql);
    const tx = db.transaction(() => {
      for (const statement of statements) stmt.run(...(statement.params ?? []));
    });
    tx();
  }
  const timestamps = new Set(rows.map((row) => row.timestamp));
  return (await listStockCandles({ symbol: rows[0].symbol, timeframe: rows[0].timeframe, limit: 5000 }))
    .filter((candle) => timestamps.has(Date.parse(candle.timestamp)));
}

export async function createStockBacktestRun(input: CreateStockBacktestRunInput): Promise<StockBacktestRunDetail> {
  const id = input.id ?? randomUUID();
  const startedAt = input.startedAt?.getTime() ?? Date.now();
  const completedAt = input.completedAt?.getTime() ?? Date.now();
  const createdAt = input.createdAt?.getTime() ?? startedAt;
  const runParams = [
    id,
    input.symbol.toUpperCase(),
    input.timeframe,
    input.strategyTag,
    json(input.params ?? {}),
    input.status,
    input.candleCount,
    input.tradeCount,
    input.winRate ?? null,
    input.realizedPnl,
    input.grossProfit,
    input.grossLoss,
    input.averageProfit ?? null,
    input.averageLoss ?? null,
    input.expectancy ?? null,
    input.profitFactor ?? null,
    input.maximumDrawdown ?? null,
    input.from?.getTime() ?? null,
    input.to?.getTime() ?? null,
    input.error ?? null,
    startedAt,
    completedAt,
    createdAt,
  ];
  const tradeStatements = (input.trades ?? []).map((trade) => ({
    sql: `INSERT INTO stock_backtest_trades (
      id, run_id, symbol, entry_at, exit_at, entry_price, exit_price, quantity,
      gross_pnl, fees, slippage_cost, net_pnl, outcome, holding_bars, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      trade.id ?? randomUUID(),
      id,
      (trade.symbol ?? input.symbol).toUpperCase(),
      trade.entryAt.getTime(),
      trade.exitAt.getTime(),
      trade.entryPrice,
      trade.exitPrice,
      trade.quantity,
      trade.grossPnl,
      trade.fees,
      trade.slippageCost,
      trade.netPnl,
      trade.outcome,
      trade.holdingBars,
      trade.createdAt?.getTime() ?? completedAt,
    ],
  }));
  const runStatement = {
    sql: `INSERT INTO stock_backtest_runs (
      id, symbol, timeframe, strategy_tag, params_json, status, candle_count, trade_count,
      win_rate, realized_pnl, gross_profit, gross_loss, average_profit, average_loss,
      expectancy, profit_factor, maximum_drawdown, from_ts, to_ts, error, started_at, completed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: runParams,
  };
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([runStatement, ...tradeStatements]);
  } else {
    const db = await getDb();
    const tx = db.transaction(() => {
      db.prepare(runStatement.sql).run(...runParams);
      if (tradeStatements.length > 0) {
        const insertTrade = db.prepare(tradeStatements[0].sql);
        for (const trade of tradeStatements) insertTrade.run(...(trade.params ?? []));
      }
    });
    tx();
  }
  const detail = await getStockBacktestRunDetail(id);
  if (!detail) throw new Error(`Failed to load stock backtest run ${id}`);
  return detail;
}

export async function updateStockMarketSignalOutcome(
  id: string,
  input: {
    status: StockMarketSignalStatus;
    decisionId?: string;
    tradeId?: string;
    statusReason?: string;
  },
): Promise<StockMarketSignal> {
  const params = [
    input.status,
    input.decisionId ?? null,
    input.tradeId ?? null,
    input.statusReason ?? null,
    id,
  ];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{
      sql: "UPDATE stock_market_signals SET status = ?, decision_id = ?, trade_id = ?, status_reason = ? WHERE id = ?",
      params,
    }]);
  } else {
    const db = await getDb();
    db.prepare("UPDATE stock_market_signals SET status = ?, decision_id = ?, trade_id = ?, status_reason = ? WHERE id = ?").run(...params);
  }
  const signal = await getStockMarketSignal(id);
  if (!signal) throw new Error(`Failed to load stock market signal ${id}`);
  return signal;
}

export async function listStockAiDecisions(limit = 50): Promise<StockAiDecision[]> {
  const rows = await selectRows<DecisionRow>(
    "SELECT * FROM stock_ai_decisions ORDER BY created_at DESC LIMIT ?",
    [boundedLimit(limit)],
  );
  return rows.map(mapDecisionRow);
}

export async function getStockMarketSignal(id: string): Promise<StockMarketSignal | null> {
  const rows = await selectRows<MarketSignalRow>(
    "SELECT * FROM stock_market_signals WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ? mapMarketSignalRow(rows[0]) : null;
}

export async function listStockMarketSignals(limit = 50): Promise<StockMarketSignal[]> {
  const rows = await selectRows<MarketSignalRow>(
    "SELECT * FROM stock_market_signals ORDER BY received_at DESC LIMIT ?",
    [boundedLimit(limit, 500)],
  );
  return rows.map(mapMarketSignalRow);
}

export async function listStockResearchItems(options: { symbol?: string; includeMarketWide?: boolean; limit?: number } = {}): Promise<StockResearchItem[]> {
  const limit = boundedLimit(options.limit ?? 50, 500);
  let sql = "SELECT * FROM stock_research_items";
  const params: unknown[] = [];
  if (options.symbol) {
    if (options.includeMarketWide) {
      sql += " WHERE symbol = ? OR symbol IS NULL";
      params.push(options.symbol.toUpperCase());
    } else {
      sql += " WHERE symbol = ?";
      params.push(options.symbol.toUpperCase());
    }
  }
  sql += " ORDER BY published_at DESC, importance DESC LIMIT ?";
  params.push(limit);
  const rows = await selectRows<ResearchItemRow>(sql, params);
  return rows.map(mapResearchItemRow);
}

export async function listStockMarketCandidates(options: {
  status?: StockMarketCandidateStatus;
  limit?: number;
} = {}): Promise<StockMarketCandidate[]> {
  const params: unknown[] = [];
  let where = "";
  if (options.status) {
    where = "WHERE status = ?";
    params.push(options.status);
  }
  params.push(boundedLimit(options.limit ?? 100, 500));
  const rows = await selectRows<MarketCandidateRow>(
    `SELECT * FROM stock_market_candidates
      ${where}
      ORDER BY
        CASE status
          WHEN 'approved' THEN 0
          WHEN 'watch' THEN 1
          WHEN 'converted_to_decision' THEN 2
          WHEN 'rejected' THEN 3
          ELSE 4
        END ASC,
        score DESC,
        last_scanned_at DESC
      LIMIT ?`,
    params,
  );
  return rows.map(mapMarketCandidateRow);
}

export async function getStockMarketCandidate(id: string): Promise<StockMarketCandidate | null> {
  const rows = await selectRows<MarketCandidateRow>(
    "SELECT * FROM stock_market_candidates WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ? mapMarketCandidateRow(rows[0]) : null;
}

async function getStockMarketCandidateBySymbolSource(
  symbol: string,
  source: StockMarketCandidateSource,
): Promise<StockMarketCandidate | null> {
  const rows = await selectRows<MarketCandidateRow>(
    "SELECT * FROM stock_market_candidates WHERE symbol = ? AND source = ? LIMIT 1",
    [symbol.toUpperCase(), source],
  );
  return rows[0] ? mapMarketCandidateRow(rows[0]) : null;
}

export async function updateStockMarketCandidateStatus(
  id: string,
  status: StockMarketCandidateStatus,
  options: { convertedDecisionId?: string } = {},
): Promise<StockMarketCandidate> {
  const updatedAt = Date.now();
  const params = [status, options.convertedDecisionId ?? null, updatedAt, id];
  const sql = `UPDATE stock_market_candidates
    SET status = ?, converted_decision_id = COALESCE(?, converted_decision_id), updated_at = ?
    WHERE id = ?`;
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{ sql, params }]);
  } else {
    const db = await getDb();
    db.prepare(sql).run(...params);
  }
  const candidate = await getStockMarketCandidate(id);
  if (!candidate) throw new Error(`Failed to load stock market candidate ${id}`);
  return candidate;
}

export async function listStockCandles(options: { symbol: string; timeframe: string; limit?: number }): Promise<StockCandle[]> {
  const rows = await selectRows<CandleRow>(
    "SELECT * FROM stock_candles WHERE symbol = ? AND timeframe = ? ORDER BY timestamp ASC LIMIT ?",
    [options.symbol.toUpperCase(), options.timeframe, boundedLimit(options.limit ?? 500, 5000)],
  );
  return rows.map(mapCandleRow);
}

export async function listStockBacktestRuns(limit = 100): Promise<StockBacktestRun[]> {
  const rows = await selectRows<BacktestRunRow>(
    "SELECT * FROM stock_backtest_runs ORDER BY created_at DESC LIMIT ?",
    [boundedLimit(limit, 500)],
  );
  return rows.map(mapBacktestRunRow);
}

export async function getStockBacktestRunDetail(id: string): Promise<StockBacktestRunDetail | null> {
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<BacktestRunRow | BacktestTradeRow>([
      { sql: "SELECT * FROM stock_backtest_runs WHERE id = ? LIMIT 1", params: [id] },
      { sql: "SELECT * FROM stock_backtest_trades WHERE run_id = ? ORDER BY entry_at ASC", params: [id] },
    ]);
    const row = (results[0]?.results?.[0] as BacktestRunRow | undefined) ?? undefined;
    if (!row) return null;
    return { ...mapBacktestRunRow(row), trades: ((results[1]?.results ?? []) as BacktestTradeRow[]).map(mapBacktestTradeRow) };
  }
  const db = await getDb();
  const row = db.prepare("SELECT * FROM stock_backtest_runs WHERE id = ? LIMIT 1").get(id) as BacktestRunRow | undefined;
  if (!row) return null;
  const trades = db.prepare("SELECT * FROM stock_backtest_trades WHERE run_id = ? ORDER BY entry_at ASC").all(id) as BacktestTradeRow[];
  return { ...mapBacktestRunRow(row), trades: trades.map(mapBacktestTradeRow) };
}

export async function listStockStrategyPerformance(limit = 50): Promise<StockStrategyPerformance[]> {
  const rows = await selectRows<StrategyTradeRow>(
    `SELECT
      t.id AS trade_id,
      d.strategy_tag AS strategy_tag,
      t.realized_pnl AS realized_pnl,
      t.outcome AS outcome,
      t.executed_at AS executed_at
    FROM stock_trades t
    LEFT JOIN stock_ai_decisions d ON d.id = t.decision_id
    WHERE t.execution_source = 'paper'
      AND t.side = 'sell'
      AND t.realized_pnl IS NOT NULL
      AND t.outcome IS NOT NULL
      AND t.outcome != 'open'
    ORDER BY t.executed_at DESC`,
  );
  const byStrategy = new Map<string, StrategyTradeRow[]>();
  for (const row of rows) {
    const key = row.strategy_tag?.trim() || "unclassified";
    byStrategy.set(key, [...(byStrategy.get(key) ?? []), row]);
  }
  return [...byStrategy.entries()]
    .map(([strategyTag, strategyRows]) => calculateStrategyPerformance(strategyTag, strategyRows))
    .sort((a, b) => {
      if (b.realizedPnl !== a.realizedPnl) return b.realizedPnl - a.realizedPnl;
      return b.tradeCount - a.tradeCount;
    })
    .slice(0, boundedLimit(limit, 200));
}

export async function getStockAiDecisionDetail(id: string): Promise<StockAiDecisionDetail | null> {
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<DecisionRow | AgentDecisionRow | LearningItemRow>([
      { sql: "SELECT * FROM stock_ai_decisions WHERE id = ?", params: [id] },
      { sql: "SELECT * FROM stock_agent_decisions WHERE ai_decision_id = ? ORDER BY created_at ASC", params: [id] },
      {
        sql: `SELECT li.*
          FROM stock_decision_learning_refs ref
          JOIN stock_learning_items li ON li.id = ref.learning_item_id
          WHERE ref.decision_id = ?
          ORDER BY ref.selected_at ASC, li.created_at DESC`,
        params: [id],
      },
    ]);
    const row = (results[0]?.results?.[0] as DecisionRow | undefined) ?? undefined;
    if (!row) return null;
    const agents = (results[1]?.results ?? []) as AgentDecisionRow[];
    const learningItems = (results[2]?.results ?? []) as LearningItemRow[];
    return {
      ...mapDecisionRow(row),
      agents: agents.map(mapAgentDecisionRow),
      learningItems: learningItems.map(mapLearningItemRow),
    };
  }

  const db = await getDb();
  const row = db.prepare("SELECT * FROM stock_ai_decisions WHERE id = ?").get(id) as DecisionRow | undefined;
  if (!row) return null;
  const agents = db
    .prepare("SELECT * FROM stock_agent_decisions WHERE ai_decision_id = ? ORDER BY created_at ASC")
    .all(id) as AgentDecisionRow[];
  const learningItems = db.prepare(
    `SELECT li.*
      FROM stock_decision_learning_refs ref
      JOIN stock_learning_items li ON li.id = ref.learning_item_id
      WHERE ref.decision_id = ?
      ORDER BY ref.selected_at ASC, li.created_at DESC`
  ).all(id) as LearningItemRow[];
  return {
    ...mapDecisionRow(row),
    agents: agents.map(mapAgentDecisionRow),
    learningItems: learningItems.map(mapLearningItemRow),
  };
}

export async function listStockTrades(limit = 100): Promise<StockTrade[]> {
  const rows = await selectRows<TradeRow>(
    "SELECT * FROM stock_trades ORDER BY executed_at DESC LIMIT ?",
    [boundedLimit(limit, 500)],
  );
  return rows.map(mapTradeRow);
}

export async function getStockTrade(id: string): Promise<StockTrade | null> {
  const rows = await selectRows<TradeRow>(
    "SELECT * FROM stock_trades WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ? mapTradeRow(rows[0]) : null;
}

export async function listStockPortfolioSnapshots(limit = 100): Promise<StockPortfolioSnapshot[]> {
  const rows = await selectRows<PortfolioSnapshotRow>(
    "SELECT * FROM stock_portfolio_snapshots ORDER BY captured_at DESC LIMIT ?",
    [boundedLimit(limit, 500)],
  );
  return rows.map(mapPortfolioSnapshotRow);
}

export async function listStockPositions(options: { openOnly?: boolean; limit?: number } = {}): Promise<StockPosition[]> {
  const rows = await selectRows<PositionRow>(
    options.openOnly === false
      ? "SELECT * FROM stock_positions ORDER BY updated_at DESC LIMIT ?"
      : "SELECT * FROM stock_positions WHERE quantity > 0 ORDER BY updated_at DESC LIMIT ?",
    [boundedLimit(options.limit ?? 100, 500)],
  );
  return rows.map(mapPositionRow);
}

export async function getStockPosition(symbol: string): Promise<StockPosition | null> {
  const rows = await selectRows<PositionRow>(
    "SELECT * FROM stock_positions WHERE symbol = ? LIMIT 1",
    [symbol.toUpperCase()],
  );
  return rows[0] ? mapPositionRow(rows[0]) : null;
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

export async function listStockLearningItemsBySourceTrade(sourceTradeId: string): Promise<StockLearningItem[]> {
  const rows = await selectRows<LearningItemRow>(
    "SELECT * FROM stock_learning_items WHERE source_trade_id = ? ORDER BY created_at ASC",
    [sourceTradeId],
  );
  return rows.map(mapLearningItemRow);
}

export async function listStockTradingRules(options: {
  status?: StockTradingRuleStatus;
  limit?: number;
} = {}): Promise<StockTradingRule[]> {
  const params: unknown[] = [];
  let where = "";
  if (options.status) {
    where = "WHERE status = ?";
    params.push(options.status);
  }
  params.push(boundedLimit(options.limit ?? 100, 500));
  const rows = await selectRows<TradingRuleRow>(
    `SELECT * FROM stock_trading_rules
      ${where}
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'candidate' THEN 1
          WHEN 'rejected' THEN 2
          ELSE 3
        END ASC,
        confidence DESC,
        updated_at DESC
      LIMIT ?`,
    params,
  );
  return rows.map(mapTradingRuleRow);
}

export async function updateStockTradingRuleStatus(id: string, status: StockTradingRuleStatus): Promise<StockTradingRule> {
  const updatedAt = Date.now();
  const sql = "UPDATE stock_trading_rules SET status = ?, updated_at = ? WHERE id = ?";
  const params = [status, updatedAt, id];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{ sql, params }]);
  } else {
    const db = await getDb();
    db.prepare(sql).run(...params);
  }
  const rows = await selectRows<TradingRuleRow>("SELECT * FROM stock_trading_rules WHERE id = ? LIMIT 1", [id]);
  if (!rows[0]) throw new Error(`Failed to load stock trading rule ${id}`);
  return mapTradingRuleRow(rows[0]);
}

export async function listStockLearningItemsForDecision(decisionId: string): Promise<StockLearningItem[]> {
  const rows = await selectRows<LearningItemRow>(
    `SELECT li.*
      FROM stock_decision_learning_refs ref
      JOIN stock_learning_items li ON li.id = ref.learning_item_id
      WHERE ref.decision_id = ?
      ORDER BY ref.selected_at ASC, li.created_at DESC`,
    [decisionId],
  );
  return rows.map(mapLearningItemRow);
}

export async function listStockLearningItemsForDecisionContext(options: {
  symbol?: string;
  strategyTag?: string;
  limit?: number;
} = {}): Promise<StockLearningItem[]> {
  const symbol = options.symbol?.toUpperCase() ?? "";
  const strategyTag = options.strategyTag ?? "";
  const rows = await selectRows<LearningItemRow>(
    `SELECT li.*
      FROM stock_learning_items li
      LEFT JOIN stock_trades t ON t.id = li.source_trade_id
      LEFT JOIN stock_ai_decisions d ON d.id = t.decision_id
      ORDER BY
        CASE
          WHEN UPPER(COALESCE(t.symbol, '')) = ? THEN 0
          WHEN COALESCE(d.strategy_tag, '') = ? THEN 1
          WHEN li.source_trade_id IS NULL THEN 2
          ELSE 3
        END ASC,
        li.confidence DESC,
        li.created_at DESC
      LIMIT ?`,
    [symbol, strategyTag, boundedLimit(options.limit ?? 8, 50)],
  );
  return rows.map(mapLearningItemRow);
}

export async function attachStockDecisionLearningItems(
  decisionId: string,
  learningItemIds: string[],
  selectedAt: Date = new Date(),
): Promise<StockLearningItem[]> {
  const uniqueIds = [...new Set(learningItemIds.filter(Boolean))];
  if (uniqueIds.length === 0) return listStockLearningItemsForDecision(decisionId);
  const selectedAtMs = selectedAt.getTime();
  const durable = getDurableClient();
  const statements = uniqueIds.map((learningItemId) => ({
    sql: `INSERT OR IGNORE INTO stock_decision_learning_refs (
      decision_id, learning_item_id, selected_at
    ) VALUES (?, ?, ?)`,
    params: [decisionId, learningItemId, selectedAtMs],
  }));
  if (durable) {
    await durable.executeSql(statements);
  } else {
    const db = await getDb();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO stock_decision_learning_refs (
        decision_id, learning_item_id, selected_at
      ) VALUES (?, ?, ?)`
    );
    const tx = db.transaction(() => {
      for (const learningItemId of uniqueIds) insert.run(decisionId, learningItemId, selectedAtMs);
    });
    tx();
  }
  return listStockLearningItemsForDecision(decisionId);
}

async function createStockTradingRuleCandidateFromLearningItem(item: StockLearningItem): Promise<void> {
  const now = Date.now();
  const sql = `INSERT OR IGNORE INTO stock_trading_rules (
    id, source_learning_item_id, category, title, rule_text, status, confidence, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    `stock-rule-${item.id}`,
    item.id,
    ruleCategoryForLearningItem(item),
    item.title,
    item.body,
    "candidate",
    item.confidence,
    Date.parse(item.createdAt) || now,
    now,
  ];
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{ sql, params }]);
  } else {
    const db = await getDb();
    db.prepare(sql).run(...params);
  }
}

export async function getStockIntegrationStatus(env: NodeJS.ProcessEnv = process.env): Promise<StockIntegrationStatus[]> {
  return [
    { label: "moomoo OpenAPI", key: "MOOMOO_OPENAPI_HOST", configured: Boolean(env.MOOMOO_OPENAPI_HOST), purpose: "market_data" },
    { label: "moomoo account", key: "MOOMOO_ACCOUNT_ID", configured: Boolean(env.MOOMOO_ACCOUNT_ID), purpose: "broker" },
    { label: "TradingView webhook", key: "TRADINGVIEW_WEBHOOK_SECRET", configured: Boolean(env.TRADINGVIEW_WEBHOOK_SECRET), purpose: "webhook" },
    { label: "News API", key: "STOCK_NEWS_API_KEY", configured: Boolean(env.STOCK_NEWS_API_KEY), purpose: "market_data" },
  ];
}

export function getStockRunnerStatus(env: NodeJS.ProcessEnv = process.env) {
  const decisionMode = parseStockDecisionMode(env);
  return {
    enabled: Boolean(env.TRADINGVIEW_WEBHOOK_SECRET),
    mode: "paper_only" as const,
    decisionMode,
    llmConfigured: Boolean(env.GEMINI_API_KEY || env.ZAI_API_KEY),
    confidenceThreshold: parseConfidenceThreshold(env),
    paperTradeNotional: parsePaperTradeNotional(env),
    tradingViewWebhookConfigured: Boolean(env.TRADINGVIEW_WEBHOOK_SECRET),
    message: "TradingView webhookを受け取ると、内部ペーパー判断とシミュレーション取引だけを記録します。実弾注文は行いません。",
  };
}

export async function getStockPortfolioMetrics(): Promise<StockPortfolioMetrics> {
  const history = (await listStockPortfolioSnapshots(120)).reverse();
  const latestSnapshot = history.at(-1);
  const initialCapital = latestSnapshot?.initialCapital ?? parseInitialCapital();
  const allPositions = await listStockPositions({ openOnly: false, limit: 500 });
  if (allPositions.length > 0) {
    const ledgerMetrics = await calculateLedgerPortfolioMetrics(allPositions, initialCapital);
    return {
      ...ledgerMetrics,
      winRate: calculateWinRate(await listStockTrades(500)),
      maximumDrawdown: calculateMaximumDrawdown(history),
      latestSnapshot,
      history,
    };
  }
  const trades = await listStockTrades(500);
  return {
    initialCapital,
    currentEquity: latestSnapshot?.totalEquity ?? initialCapital,
    cashBalance: latestSnapshot?.cashBalance ?? initialCapital,
    realizedPnl: latestSnapshot?.realizedPnl ?? 0,
    unrealizedPnl: latestSnapshot?.unrealizedPnl ?? 0,
    winRate: calculateWinRate(trades),
    maximumDrawdown: calculateMaximumDrawdown(history),
    positions: [],
    latestSnapshot,
    history,
  };
}

async function createStockPortfolioSnapshotFromLedger(): Promise<StockPortfolioSnapshot> {
  const latestSnapshot = await getLatestPortfolioSnapshot();
  const initialCapital = latestSnapshot?.initialCapital ?? parseInitialCapital();
  const metrics = await calculateLedgerPortfolioMetrics(await listStockPositions({ openOnly: false, limit: 500 }), initialCapital);
  return createStockPortfolioSnapshot({
    initialCapital: metrics.initialCapital,
    totalEquity: metrics.currentEquity,
    cashBalance: metrics.cashBalance,
    unrealizedPnl: metrics.unrealizedPnl,
    realizedPnl: metrics.realizedPnl,
  });
}

async function calculateLedgerPortfolioMetrics(positions: StockPosition[], initialCapital: number): Promise<Omit<StockPortfolioMetrics, "winRate" | "maximumDrawdown" | "latestSnapshot" | "history">> {
  const trades = await listStockTrades(500);
  const cashBalance = trades.reduce((cash, trade) => {
    const gross = trade.quantity * trade.price;
    return trade.side === "buy" ? cash - gross : cash + gross;
  }, initialCapital);
  const openPositions = positions.filter((position) => position.quantity > 0);
  const marketValue = openPositions.reduce((sum, position) => sum + position.marketValue, 0);
  const unrealizedPnl = openPositions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const realizedPnl = positions.reduce((sum, position) => sum + position.realizedPnl, 0);
  return {
    initialCapital,
    currentEquity: roundMoney(cashBalance + marketValue),
    cashBalance: roundMoney(cashBalance),
    realizedPnl: roundMoney(realizedPnl),
    unrealizedPnl: roundMoney(unrealizedPnl),
    positions: openPositions,
  };
}

export async function getStockTradingOverview(): Promise<StockTradingOverview> {
  const [portfolio, recentCandidates, recentRules, recentDecisions, recentTrades, recentLessons, recentSignals, recentResearch, strategyPerformance, recentBacktests, integrations] = await Promise.all([
    getStockPortfolioMetrics(),
    listStockMarketCandidates({ limit: 5 }),
    listStockTradingRules({ limit: 5 }),
    listStockAiDecisions(5),
    listStockTrades(5),
    listStockLearningItems(5),
    listStockMarketSignals(5),
    listStockResearchItems({ limit: 5 }),
    listStockStrategyPerformance(5),
    listStockBacktestRuns(5),
    getStockIntegrationStatus(),
  ]);
  return {
    portfolio,
    recentCandidates,
    recentRules,
    recentDecisions,
    recentTrades,
    recentLessons,
    recentSignals,
    recentResearch,
    strategyPerformance,
    recentBacktests,
    integrations,
    runner: getStockRunnerStatus(),
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

function mapPositionRow(row: PositionRow): StockPosition {
  const marketValue = roundMoney(row.quantity * row.last_mark_price);
  return {
    id: row.id,
    symbol: row.symbol,
    quantity: row.quantity,
    averageEntryPrice: row.average_entry_price,
    realizedPnl: row.realized_pnl,
    lastMarkPrice: row.last_mark_price,
    lastMarkedAt: new Date(row.last_marked_at).toISOString(),
    marketValue,
    unrealizedPnl: roundMoney((row.last_mark_price - row.average_entry_price) * row.quantity),
    openedAt: new Date(row.opened_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
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

function mapTradingRuleRow(row: TradingRuleRow): StockTradingRule {
  return {
    id: row.id,
    sourceLearningItemId: row.source_learning_item_id ?? undefined,
    category: row.category,
    title: row.title,
    ruleText: row.rule_text,
    status: row.status,
    confidence: row.confidence,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapMarketSignalRow(row: MarketSignalRow): StockMarketSignal {
  return {
    id: row.id,
    source: row.source,
    sourceSignalId: row.source_signal_id ?? undefined,
    symbol: row.symbol,
    timeframe: row.timeframe,
    price: row.price,
    open: row.open ?? undefined,
    high: row.high ?? undefined,
    low: row.low ?? undefined,
    close: row.close ?? undefined,
    volume: row.volume ?? undefined,
    strategyTag: row.strategy_tag ?? undefined,
    suggestedAction: row.suggested_action ?? undefined,
    indicators: parseJson(row.indicators_json),
    rawPayload: parseJson(row.raw_payload_json),
    status: row.status,
    decisionId: row.decision_id ?? undefined,
    tradeId: row.trade_id ?? undefined,
    statusReason: row.status_reason ?? undefined,
    receivedAt: new Date(row.received_at).toISOString(),
  };
}

function mapResearchItemRow(row: ResearchItemRow): StockResearchItem {
  return {
    id: row.id,
    symbol: row.symbol ?? undefined,
    category: row.category,
    title: row.title,
    summary: row.summary,
    source: row.source,
    sourceUrl: row.source_url ?? undefined,
    sentiment: row.sentiment,
    importance: row.importance,
    rawPayload: parseJson(row.raw_payload_json),
    publishedAt: new Date(row.published_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapMarketCandidateRow(row: MarketCandidateRow): StockMarketCandidate {
  return {
    id: row.id,
    symbol: row.symbol,
    theme: row.theme ?? undefined,
    sector: row.sector ?? undefined,
    strategyTag: row.strategy_tag ?? undefined,
    reason: row.reason,
    score: row.score,
    source: row.source,
    status: row.status,
    sourceRefId: row.source_ref_id ?? undefined,
    rawPayload: parseJson(row.raw_payload_json),
    lastScannedAt: new Date(row.last_scanned_at).toISOString(),
    convertedDecisionId: row.converted_decision_id ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapCandleRow(row: CandleRow): StockCandle {
  return {
    id: row.id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    source: row.source,
    timestamp: new Date(row.timestamp).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapBacktestRunRow(row: BacktestRunRow): StockBacktestRun {
  return {
    id: row.id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    strategyTag: row.strategy_tag,
    params: parseJson(row.params_json),
    status: row.status,
    candleCount: row.candle_count,
    tradeCount: row.trade_count,
    winRate: row.win_rate,
    realizedPnl: row.realized_pnl,
    grossProfit: row.gross_profit,
    grossLoss: row.gross_loss,
    averageProfit: row.average_profit,
    averageLoss: row.average_loss,
    expectancy: row.expectancy,
    profitFactor: row.profit_factor,
    maximumDrawdown: row.maximum_drawdown,
    from: row.from_ts ? new Date(row.from_ts).toISOString() : undefined,
    to: row.to_ts ? new Date(row.to_ts).toISOString() : undefined,
    error: row.error ?? undefined,
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapBacktestTradeRow(row: BacktestTradeRow): StockBacktestTrade {
  return {
    id: row.id,
    runId: row.run_id,
    symbol: row.symbol,
    entryAt: new Date(row.entry_at).toISOString(),
    exitAt: new Date(row.exit_at).toISOString(),
    entryPrice: row.entry_price,
    exitPrice: row.exit_price,
    quantity: row.quantity,
    grossPnl: row.gross_pnl,
    fees: row.fees,
    slippageCost: row.slippage_cost,
    netPnl: row.net_pnl,
    outcome: row.outcome,
    holdingBars: row.holding_bars,
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

function calculateStrategyPerformance(strategyTag: string, rows: StrategyTradeRow[]): StockStrategyPerformance {
  const pnls = rows.map((row) => row.realized_pnl);
  const wins = pnls.filter((pnl) => pnl > 0);
  const losses = pnls.filter((pnl) => pnl < 0);
  const flats = pnls.filter((pnl) => pnl === 0);
  const realizedPnl = roundMoney(pnls.reduce((sum, pnl) => sum + pnl, 0));
  const grossProfit = roundMoney(wins.reduce((sum, pnl) => sum + pnl, 0));
  const grossLoss = roundMoney(losses.reduce((sum, pnl) => sum + pnl, 0));
  const tradeCount = rows.length;
  const profitFactor = grossLoss < 0 ? roundRatio(grossProfit / Math.abs(grossLoss)) : grossProfit > 0 ? null : null;
  return {
    strategyTag,
    status: classifyStrategyStatus(tradeCount, realizedPnl, profitFactor),
    tradeCount,
    winCount: wins.length,
    lossCount: losses.length,
    flatCount: flats.length,
    winRate: tradeCount > 0 ? roundRatio(wins.length / tradeCount) : null,
    realizedPnl,
    grossProfit,
    grossLoss,
    averageProfit: wins.length > 0 ? roundMoney(grossProfit / wins.length) : null,
    averageLoss: losses.length > 0 ? roundMoney(grossLoss / losses.length) : null,
    expectancy: tradeCount > 0 ? roundMoney(realizedPnl / tradeCount) : null,
    profitFactor,
    bestTradePnl: pnls.length > 0 ? roundMoney(Math.max(...pnls)) : null,
    worstTradePnl: pnls.length > 0 ? roundMoney(Math.min(...pnls)) : null,
    latestTradeAt: rows[0] ? new Date(rows[0].executed_at).toISOString() : undefined,
  };
}

function classifyStrategyStatus(tradeCount: number, realizedPnl: number, profitFactor: number | null): StockStrategyPerformance["status"] {
  if (tradeCount < 5) return "watch";
  if (realizedPnl > 0 && profitFactor !== null && profitFactor >= 1.3) return "adopt";
  if (realizedPnl < 0 && profitFactor !== null && profitFactor < 1) return "reject";
  return "watch";
}

function classifyTradeOutcome(realizedPnl: number): NonNullable<StockTrade["outcome"]> {
  if (realizedPnl > 0) return "win";
  if (realizedPnl < 0) return "loss";
  return "flat";
}

function roundQuantity(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreResearchCandidate(item: StockResearchItem): number {
  const sentimentAdjustment: Record<StockResearchSentiment, number> = {
    positive: 0.16,
    mixed: 0.04,
    neutral: 0,
    unknown: 0,
    negative: -0.12,
  };
  return clampNumber(0.45 + item.importance * 0.35 + sentimentAdjustment[item.sentiment], 0, 1);
}

function ruleCategoryForLearningItem(item: StockLearningItem): StockTradingRuleCategory {
  if (item.category === "blocked_pattern" || item.category === "losing_pattern") return "risk";
  if (item.category === "winning_pattern" || item.category === "strategy_note") return "strategy";
  return "entry";
}

function parseInitialCapital(): number {
  const value = Number(process.env.STOCK_TRADING_INITIAL_CAPITAL_JPY ?? DEFAULT_INITIAL_CAPITAL);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INITIAL_CAPITAL;
}

export function parsePaperTradeNotional(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.STOCK_PAPER_TRADE_NOTIONAL_JPY ?? 100_000);
  return Number.isFinite(value) && value > 0 ? value : 100_000;
}

export function parseConfidenceThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.STOCK_PAPER_TRADE_CONFIDENCE_THRESHOLD ?? 0.7);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.7;
}

function parseStockDecisionMode(env: NodeJS.ProcessEnv): "auto" | "llm" | "deterministic" {
  const value = (env.STOCK_AI_DECISION_MODE ?? "auto").toLowerCase();
  return value === "llm" || value === "deterministic" ? value : "auto";
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
