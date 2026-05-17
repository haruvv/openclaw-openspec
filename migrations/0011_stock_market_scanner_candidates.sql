CREATE TABLE IF NOT EXISTS stock_market_candidates (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  theme TEXT,
  sector TEXT,
  strategy_tag TEXT,
  reason TEXT NOT NULL,
  score REAL NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  source_ref_id TEXT,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  last_scanned_at INTEGER NOT NULL,
  converted_decision_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(symbol, source),
  FOREIGN KEY (converted_decision_id) REFERENCES stock_ai_decisions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_market_candidates_symbol ON stock_market_candidates(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_market_candidates_status ON stock_market_candidates(status);
CREATE INDEX IF NOT EXISTS idx_stock_market_candidates_score ON stock_market_candidates(score);
CREATE INDEX IF NOT EXISTS idx_stock_market_candidates_last_scanned ON stock_market_candidates(last_scanned_at);
