CREATE TABLE IF NOT EXISTS stock_trading_rules (
  id TEXT PRIMARY KEY,
  source_learning_item_id TEXT UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (source_learning_item_id) REFERENCES stock_learning_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_trading_rules_status ON stock_trading_rules(status);
CREATE INDEX IF NOT EXISTS idx_stock_trading_rules_category ON stock_trading_rules(category);
CREATE INDEX IF NOT EXISTS idx_stock_trading_rules_updated_at ON stock_trading_rules(updated_at);
