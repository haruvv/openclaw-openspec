CREATE TABLE IF NOT EXISTS stock_market_data_watchlist (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  provider TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  lookback_limit INTEGER NOT NULL,
  notes TEXT,
  last_collected_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(symbol, timeframe, provider)
);

CREATE TABLE IF NOT EXISTS stock_market_data_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_entries INTEGER NOT NULL,
  completed_entries INTEGER NOT NULL,
  upserted_candles INTEGER NOT NULL,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_market_data_watchlist_enabled ON stock_market_data_watchlist(enabled);
CREATE INDEX IF NOT EXISTS idx_stock_market_data_watchlist_symbol ON stock_market_data_watchlist(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_market_data_runs_created_at ON stock_market_data_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_market_data_runs_status ON stock_market_data_runs(status);
