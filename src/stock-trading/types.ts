export type StockTradeAction = "BUY" | "SELL" | "HOLD" | "WATCH" | "SKIP";
export type StockTradeSide = "buy" | "sell";
export type StockExecutionSource = "paper" | "demo" | "manual";
export type StockLearningCategory = "winning_pattern" | "losing_pattern" | "rule_candidate" | "blocked_pattern" | "strategy_note";
export type StockMarketSignalStatus = "received" | "processed" | "rejected" | "executed" | "blocked";
export type StockResearchCategory = "news" | "earnings" | "disclosure" | "fundamental" | "macro" | "sector" | "operator_note";
export type StockResearchSentiment = "positive" | "neutral" | "negative" | "mixed" | "unknown";
export type StockBacktestStatus = "completed" | "failed";
export type StockMarketCandidateSource = "tradingview" | "research" | "manual" | "provider";
export type StockMarketCandidateStatus = "watch" | "approved" | "rejected" | "converted_to_decision";
export type StockTradingRuleCategory = "entry" | "exit" | "risk" | "portfolio" | "strategy";
export type StockTradingRuleStatus = "candidate" | "active" | "rejected";

export interface StockAiDecision {
  id: string;
  symbol: string;
  finalAction: StockTradeAction;
  confidence: number;
  strategyTag?: string;
  reasoning: string;
  riskFactors: string[];
  takeProfitPrice?: number;
  stopLossPrice?: number;
  createdAt: string;
}

export interface StockAgentDecision {
  id: string;
  aiDecisionId: string;
  agentName: string;
  score: number;
  stance: string;
  summary: string;
  reasoning: string;
  createdAt: string;
}

export interface StockAiDecisionDetail extends StockAiDecision {
  agents: StockAgentDecision[];
  learningItems: StockLearningItem[];
}

export interface StockTrade {
  id: string;
  decisionId?: string;
  symbol: string;
  side: StockTradeSide;
  quantity: number;
  price: number;
  executedAt: string;
  executionSource: StockExecutionSource;
  rawExecution: Record<string, unknown>;
  realizedPnl?: number;
  outcome?: "win" | "loss" | "flat" | "open";
  createdAt: string;
}

export interface StockPortfolioSnapshot {
  id: string;
  initialCapital: number;
  totalEquity: number;
  cashBalance: number;
  unrealizedPnl: number;
  realizedPnl: number;
  capturedAt: string;
}

export interface StockPosition {
  id: string;
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  realizedPnl: number;
  lastMarkPrice: number;
  lastMarkedAt: string;
  marketValue: number;
  unrealizedPnl: number;
  openedAt: string;
  updatedAt: string;
}

export interface StockLearningItem {
  id: string;
  sourceTradeId?: string;
  category: StockLearningCategory;
  title: string;
  body: string;
  confidence: number;
  appliedToSkill: boolean;
  createdAt: string;
}

export interface StockIntegrationStatus {
  label: string;
  key: string;
  configured: boolean;
  purpose: "market_data" | "broker" | "webhook";
}

export interface StockMarketSignal {
  id: string;
  source: "tradingview";
  sourceSignalId?: string;
  symbol: string;
  timeframe: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  strategyTag?: string;
  suggestedAction?: StockTradeAction;
  indicators: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  status: StockMarketSignalStatus;
  decisionId?: string;
  tradeId?: string;
  statusReason?: string;
  receivedAt: string;
}

export interface StockResearchItem {
  id: string;
  symbol?: string;
  category: StockResearchCategory;
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  sentiment: StockResearchSentiment;
  importance: number;
  rawPayload: Record<string, unknown>;
  publishedAt: string;
  createdAt: string;
}

export interface StockMarketCandidate {
  id: string;
  symbol: string;
  theme?: string;
  sector?: string;
  strategyTag?: string;
  reason: string;
  score: number;
  source: StockMarketCandidateSource;
  status: StockMarketCandidateStatus;
  sourceRefId?: string;
  rawPayload: Record<string, unknown>;
  lastScannedAt: string;
  convertedDecisionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTradingRule {
  id: string;
  sourceLearningItemId?: string;
  category: StockTradingRuleCategory;
  title: string;
  ruleText: string;
  status: StockTradingRuleStatus;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockStrategyPerformance {
  strategyTag: string;
  status: "adopt" | "watch" | "reject";
  tradeCount: number;
  winCount: number;
  lossCount: number;
  flatCount: number;
  winRate: number | null;
  realizedPnl: number;
  grossProfit: number;
  grossLoss: number;
  averageProfit: number | null;
  averageLoss: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  bestTradePnl: number | null;
  worstTradePnl: number | null;
  latestTradeAt?: string;
}

export interface StockCandle {
  id: string;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockBacktestRun {
  id: string;
  symbol: string;
  timeframe: string;
  strategyTag: string;
  params: Record<string, unknown>;
  status: StockBacktestStatus;
  candleCount: number;
  tradeCount: number;
  winRate: number | null;
  realizedPnl: number;
  grossProfit: number;
  grossLoss: number;
  averageProfit: number | null;
  averageLoss: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  maximumDrawdown: number | null;
  from?: string;
  to?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface StockBacktestTrade {
  id: string;
  runId: string;
  symbol: string;
  entryAt: string;
  exitAt: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  fees: number;
  slippageCost: number;
  netPnl: number;
  outcome: "win" | "loss" | "flat";
  holdingBars: number;
  createdAt: string;
}

export interface StockBacktestRunDetail extends StockBacktestRun {
  trades: StockBacktestTrade[];
}

export interface StockRunnerStatus {
  enabled: boolean;
  mode: "paper_only";
  decisionMode: "auto" | "llm" | "deterministic";
  llmConfigured: boolean;
  confidenceThreshold: number;
  paperTradeNotional: number;
  tradingViewWebhookConfigured: boolean;
  message: string;
}

export interface StockPortfolioMetrics {
  initialCapital: number;
  currentEquity: number;
  cashBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number | null;
  maximumDrawdown: number | null;
  positions: StockPosition[];
  latestSnapshot?: StockPortfolioSnapshot;
  history: StockPortfolioSnapshot[];
}

export interface StockTradingOverview {
  portfolio: StockPortfolioMetrics;
  recentCandidates: StockMarketCandidate[];
  recentRules: StockTradingRule[];
  recentDecisions: StockAiDecision[];
  recentTrades: StockTrade[];
  recentLessons: StockLearningItem[];
  recentSignals: StockMarketSignal[];
  recentResearch: StockResearchItem[];
  strategyPerformance: StockStrategyPerformance[];
  recentBacktests: StockBacktestRun[];
  integrations: StockIntegrationStatus[];
  runner: StockRunnerStatus;
  safety: {
    mode: "paper_only";
    realOrderPlacementEnabled: false;
    message: string;
  };
}

export interface CreateStockAiDecisionInput {
  id?: string;
  symbol: string;
  finalAction: StockTradeAction;
  confidence: number;
  strategyTag?: string;
  reasoning: string;
  riskFactors?: string[];
  takeProfitPrice?: number;
  stopLossPrice?: number;
  createdAt?: Date;
  agents?: Array<{
    id?: string;
    agentName: string;
    score: number;
    stance: string;
    summary: string;
    reasoning: string;
    createdAt?: Date;
  }>;
}

export interface CreateStockTradeInput {
  id?: string;
  decisionId?: string;
  symbol: string;
  side: StockTradeSide;
  quantity: number;
  price: number;
  executedAt?: Date;
  executionSource: StockExecutionSource;
  rawExecution?: Record<string, unknown>;
  realizedPnl?: number;
  outcome?: StockTrade["outcome"];
  createdAt?: Date;
}

export interface CreateStockPortfolioSnapshotInput {
  id?: string;
  initialCapital: number;
  totalEquity: number;
  cashBalance: number;
  unrealizedPnl: number;
  realizedPnl: number;
  capturedAt?: Date;
}

export interface UpsertStockPositionInput {
  id?: string;
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  realizedPnl: number;
  lastMarkPrice: number;
  lastMarkedAt?: Date;
  openedAt?: Date;
  updatedAt?: Date;
}

export interface CreateStockLearningItemInput {
  id?: string;
  sourceTradeId?: string;
  category: StockLearningCategory;
  title: string;
  body: string;
  confidence: number;
  appliedToSkill?: boolean;
  createdAt?: Date;
}

export interface CreateStockMarketSignalInput {
  id?: string;
  source?: "tradingview";
  sourceSignalId?: string;
  symbol: string;
  timeframe: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  strategyTag?: string;
  suggestedAction?: StockTradeAction;
  indicators?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
  status?: StockMarketSignalStatus;
  decisionId?: string;
  tradeId?: string;
  statusReason?: string;
  receivedAt?: Date;
}

export interface CreateStockResearchItemInput {
  id?: string;
  symbol?: string;
  category: StockResearchCategory;
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  sentiment?: StockResearchSentiment;
  importance?: number;
  rawPayload?: Record<string, unknown>;
  publishedAt?: Date;
  createdAt?: Date;
}

export interface UpsertStockMarketCandidateInput {
  id?: string;
  symbol: string;
  theme?: string;
  sector?: string;
  strategyTag?: string;
  reason: string;
  score: number;
  source: StockMarketCandidateSource;
  status?: StockMarketCandidateStatus;
  sourceRefId?: string;
  rawPayload?: Record<string, unknown>;
  lastScannedAt?: Date;
  convertedDecisionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateStockCandleInput {
  id?: string;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source?: string;
  timestamp: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateStockBacktestRunInput {
  id?: string;
  symbol: string;
  timeframe: string;
  strategyTag: string;
  params?: Record<string, unknown>;
  status: StockBacktestStatus;
  candleCount: number;
  tradeCount: number;
  winRate?: number | null;
  realizedPnl: number;
  grossProfit: number;
  grossLoss: number;
  averageProfit?: number | null;
  averageLoss?: number | null;
  expectancy?: number | null;
  profitFactor?: number | null;
  maximumDrawdown?: number | null;
  from?: Date;
  to?: Date;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  trades?: Array<{
    id?: string;
    symbol?: string;
    entryAt: Date;
    exitAt: Date;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    grossPnl: number;
    fees: number;
    slippageCost: number;
    netPnl: number;
    outcome: "win" | "loss" | "flat";
    holdingBars: number;
    createdAt?: Date;
  }>;
}

export interface RunStockBacktestInput {
  symbol: string;
  timeframe: string;
  strategyTag: "breakout_momentum";
  lookbackBars?: number;
  volumeLookbackBars?: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  maxHoldingBars?: number;
  notional?: number;
  feeBps?: number;
  slippageBps?: number;
}

export interface ProcessStockSignalResult {
  signal: StockMarketSignal;
  decision?: StockAiDecisionDetail;
  trade?: StockTrade;
  learningItems?: StockLearningItem[];
  portfolio?: StockPortfolioSnapshot;
  position?: StockPosition;
  status: StockMarketSignalStatus;
  message: string;
}
