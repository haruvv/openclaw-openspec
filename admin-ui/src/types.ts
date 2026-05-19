export type Status = "running" | "passed" | "failed" | "skipped";
export type SalesOutreachStatus = "draft" | "sent" | "skipped" | "failed";
export type SalesPaymentLinkStatus = "created" | "sent" | "failed" | "paid";
export type ContactMethodType = "email" | "form" | "phone" | "contact_page";
export type ContactMethodConfidence = "low" | "medium" | "high";

export interface ContactMethod {
  type: ContactMethodType;
  value: string;
  sourceUrl: string;
  confidence: ContactMethodConfidence;
  label?: string;
  reason?: string;
}

export interface BusinessApp {
  id: string;
  name: string;
  description: string;
  status: "active" | "planned";
  entryPath: string;
  primaryLinks: Array<{ label: string; href: string }>;
}

export interface AgentRun {
  id: string;
  agentType: string;
  source: string;
  status: Status;
  input: Record<string, unknown>;
  summary: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface AgentRunDetail extends AgentRun {
  steps: Array<{ id: string; name: string; status: Status; durationMs: number; reason?: string; error?: string; details?: Record<string, unknown> }>;
  artifacts: Array<ArtifactRecord>;
  salesActions?: SalesActions;
}

export interface SiteRecord {
  id: string;
  displayUrl: string;
  normalizedUrl: string;
  domain: string;
  latestStatus: Status;
  latestSeoScore?: number;
  latestOpportunityScore?: number;
  latestRunId?: string;
  latestOutreachStatus?: SalesOutreachStatus;
  latestOutreachSentAt?: string;
  latestPaymentLinkStatus?: SalesPaymentLinkStatus;
  latestPaymentLinkAmountJpy?: number;
  latestPaymentLinkUrl?: string;
  snapshotCount: number;
  updatedAt: string;
}

export interface SiteDetail extends SiteRecord {
  snapshots: Array<{ id: string; status: Status; seoScore?: number; opportunityScore?: number; opportunityFindings: OpportunityFinding[]; diagnostics: unknown[]; createdAt: string; runId?: string; summary: Record<string, unknown> }>;
  proposals: Array<ProposalRecord>;
}

export interface OpportunityFinding {
  category: string;
  severity: "low" | "medium" | "high";
  title: string;
  evidence: string;
  recommendation: string;
  scoreImpact: number;
}

export interface SeoDiagnostic {
  id: string;
  title: string;
  score: number | null;
  description: string;
}

export type RevenueAuditPriority = "low" | "medium" | "high";
export type RevenueAuditConfidence = "low" | "medium" | "high";

export interface LlmRevenueAudit {
  overallAssessment: string;
  salesPriority: RevenueAuditPriority;
  confidence: RevenueAuditConfidence;
  businessImpactSummary: string;
  recommendedOffer: {
    name: string;
    description: string;
    estimatedPriceRange: string;
    reason: string;
  };
  prioritizedFindings: Array<{
    title: string;
    businessImpact: string;
    suggestedFix: string;
    salesAngle: string;
    confidence: RevenueAuditConfidence;
  }>;
  outreach: {
    subject: string;
    firstEmail: string;
    followUpEmail: string;
  };
  caveats: string[];
}

export interface SalesActions {
  outreachMessages: SalesOutreachMessage[];
  paymentLinks: SalesPaymentLinkRecord[];
}

export interface SalesOutreachDraft {
  runId: string;
  siteId?: string;
  snapshotId?: string;
  targetUrl: string;
  domain: string;
  recipientEmail?: string;
  contactMethods: ContactMethod[];
  subject: string;
  bodyText: string;
  source: "llm_revenue_audit" | "fallback";
  caveats: string[];
  approval: SalesOutreachApprovalRecommendation;
}

export interface SalesOutreachApprovalRecommendation {
  priority: RevenueAuditPriority;
  confidence: RevenueAuditConfidence;
  recommendedAmountJpy: number;
  rationale: string[];
  caveats: string[];
  recipientSource: "detected_email" | "manual_required";
  readyToSend: boolean;
  nextStep: string;
}

export interface SalesOutreachMessage {
  id: string;
  runId: string;
  siteId?: string;
  snapshotId?: string;
  targetUrl: string;
  domain: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: SalesOutreachStatus;
  reviewedAt?: string;
  sentAt?: string;
  error?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SalesPaymentLinkRecord {
  id: string;
  runId: string;
  siteId?: string;
  outreachMessageId?: string;
  domain: string;
  recipientEmail?: string;
  amountJpy: number;
  stripeProductId?: string;
  stripePriceId?: string;
  stripePaymentLinkId?: string;
  paymentLinkUrl?: string;
  status: SalesPaymentLinkStatus;
  expiresAt?: string;
  sentAt?: string;
  error?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRecord {
  id: string;
  type: string;
  label: string;
  pathOrUrl?: string;
  contentText?: string;
  bodyStorage?: "inline" | "object";
  objectKey?: string;
  contentType?: string;
  byteSize?: number;
  createdAt?: string;
}

export interface ProposalRecord {
  id: string;
  label: string;
  pathOrUrl?: string;
  contentText?: string;
  bodyStorage?: "inline" | "object";
  objectKey?: string;
  contentType?: string;
  byteSize?: number;
  createdAt: string;
  runId?: string;
}

export interface SettingsPayload {
  integrations: Array<{ label: string; key: string; configured: boolean }>;
  policies: Array<{ key: "sendEmail" | "sendTelegram" | "createPaymentLink"; label: string; enabled: boolean }>;
  discovery: DiscoverySettings;
  sales: SalesOperationSettings;
}

export type SideEffectPolicy = SettingsPayload["policies"][number];

export interface PolicyUpdatePayload {
  sendEmail: boolean;
  sendTelegram: boolean;
  createPaymentLink: boolean;
}

export interface SalesOperationSettings {
  defaultPaymentAmountJpy: number;
  outreachCooldownDays: number;
  contactDiscoveryMaxPages: number;
  sendgridFromName: string;
  configuredFromAdmin: boolean;
}

export interface DiscoverySettings {
  queries: string[];
  seedUrls: string[];
  dailyQuota: number;
  searchLimit: number;
  country: string;
  lang: string;
  location: string;
  configuredFromAdmin: boolean;
}

export interface DiscoveryReport {
  status: "disabled" | "skipped" | "passed" | "failed";
  enabled: boolean;
  quota: number;
  candidateCount: number;
  selectedCount: number;
  skipped: Array<{ url: string; reason: string }>;
  runs: Array<{ url: string; runId: string; status: Status }>;
}

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
export type StockMarketDataRunStatus = "completed" | "failed";

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

export interface StockMarketDataWatchlistEntry {
  id: string;
  symbol: string;
  timeframe: string;
  provider: string;
  enabled: boolean;
  lookbackLimit: number;
  notes?: string;
  lastCollectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMarketDataCollectionRun {
  id: string;
  provider: string;
  status: StockMarketDataRunStatus;
  requestedEntries: number;
  completedEntries: number;
  upsertedCandles: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface StockPaperCycleResult {
  status: "completed" | "partial" | "failed";
  collectionRun: StockMarketDataCollectionRun;
  scan: {
    scannedEntries: number;
    createdCandidates: number;
    skippedEntries: number;
  };
  threshold: number;
  candidateLimit: number;
  eligibleCandidates: number;
  convertedCount: number;
  skippedCount: number;
  errorCount: number;
  conversions: Array<{
    candidateId: string;
    symbol: string;
    candidateScore: number;
    decisionId?: string;
    finalAction?: string;
    tradeId?: string;
    status: string;
    message: string;
  }>;
  errors: Array<{
    candidateId?: string;
    symbol?: string;
    error: string;
  }>;
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

export interface StockTradingViewSetup {
  webhookPath: string;
  secretHeader: string;
  latestSignal?: StockMarketSignal | null;
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
  marketDataWatchlist: StockMarketDataWatchlistEntry[];
  recentMarketDataRuns: StockMarketDataCollectionRun[];
  integrations: StockIntegrationStatus[];
  runner: StockRunnerStatus;
  safety: {
    mode: "paper_only";
    realOrderPlacementEnabled: false;
    message: string;
  };
}

export interface StockTradingSettings {
  integrations: StockIntegrationStatus[];
  runner: StockRunnerStatus;
  tradingView: StockTradingViewSetup;
  safety: StockTradingOverview["safety"];
}

export interface DiscoveryFormState {
  selectedIndustries: string[];
  customQueries: string;
  seedUrls: string;
  dailyQuota: string;
  searchLimit: string;
  country: string;
  lang: string;
  location: string;
  configuredFromAdmin: boolean;
}
