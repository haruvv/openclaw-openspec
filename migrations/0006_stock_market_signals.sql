CREATE TABLE IF NOT EXISTS stock_market_signals (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_signal_id TEXT,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  price REAL NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL,
  volume REAL,
  strategy_tag TEXT,
  suggested_action TEXT,
  indicators_json TEXT NOT NULL DEFAULT '{}',
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  decision_id TEXT,
  trade_id TEXT,
  status_reason TEXT,
  received_at INTEGER NOT NULL,
  FOREIGN KEY (decision_id) REFERENCES stock_ai_decisions(id) ON DELETE SET NULL,
  FOREIGN KEY (trade_id) REFERENCES stock_trades(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_market_signals_received_at ON stock_market_signals(received_at);
CREATE INDEX IF NOT EXISTS idx_stock_market_signals_symbol ON stock_market_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_market_signals_status ON stock_market_signals(status);
CREATE INDEX IF NOT EXISTS idx_stock_market_signals_source_signal_id ON stock_market_signals(source_signal_id);
