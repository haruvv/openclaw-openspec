export type StockTradeAction = "BUY" | "SELL" | "HOLD" | "WATCH" | "SKIP";
export type StockTradeSide = "buy" | "sell";
export type StockExecutionSource = "paper" | "demo" | "manual";
export type StockLearningCategory = "winning_pattern" | "losing_pattern" | "rule_candidate" | "blocked_pattern" | "strategy_note";

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

export interface StockPortfolioMetrics {
  initialCapital: number;
  currentEquity: number;
  cashBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number | null;
  maximumDrawdown: number | null;
  latestSnapshot?: StockPortfolioSnapshot;
  history: StockPortfolioSnapshot[];
}

export interface StockTradingOverview {
  portfolio: StockPortfolioMetrics;
  recentDecisions: StockAiDecision[];
  recentTrades: StockTrade[];
  recentLessons: StockLearningItem[];
  integrations: StockIntegrationStatus[];
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
