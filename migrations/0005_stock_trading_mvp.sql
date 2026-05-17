CREATE TABLE IF NOT EXISTS stock_ai_decisions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  final_action TEXT NOT NULL,
  confidence REAL NOT NULL,
  strategy_tag TEXT,
  reasoning TEXT NOT NULL,
  risk_factors_json TEXT NOT NULL DEFAULT '[]',
  take_profit_price REAL,
  stop_loss_price REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_agent_decisions (
  id TEXT PRIMARY KEY,
  ai_decision_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  score REAL NOT NULL,
  stance TEXT NOT NULL,
  summary TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (ai_decision_id) REFERENCES stock_ai_decisions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_trades (
  id TEXT PRIMARY KEY,
  decision_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  executed_at INTEGER NOT NULL,
  execution_source TEXT NOT NULL,
  raw_execution_json TEXT NOT NULL DEFAULT '{}',
  realized_pnl REAL,
  outcome TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (decision_id) REFERENCES stock_ai_decisions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_portfolio_snapshots (
  id TEXT PRIMARY KEY,
  initial_capital REAL NOT NULL,
  total_equity REAL NOT NULL,
  cash_balance REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  captured_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_learning_items (
  id TEXT PRIMARY KEY,
  source_trade_id TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  confidence REAL NOT NULL,
  applied_to_skill INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_trade_id) REFERENCES stock_trades(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_ai_decisions_created_at ON stock_ai_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_ai_decisions_symbol ON stock_ai_decisions(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_agent_decisions_decision ON stock_agent_decisions(ai_decision_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_executed_at ON stock_trades(executed_at);
CREATE INDEX IF NOT EXISTS idx_stock_trades_symbol ON stock_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_trades_source ON stock_trades(execution_source);
CREATE INDEX IF NOT EXISTS idx_stock_portfolio_snapshots_captured_at ON stock_portfolio_snapshots(captured_at);
CREATE INDEX IF NOT EXISTS idx_stock_learning_items_created_at ON stock_learning_items(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_learning_items_category ON stock_learning_items(category);
