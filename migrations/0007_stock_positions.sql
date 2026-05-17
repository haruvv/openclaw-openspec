CREATE TABLE IF NOT EXISTS stock_positions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  quantity REAL NOT NULL,
  average_entry_price REAL NOT NULL,
  realized_pnl REAL NOT NULL DEFAULT 0,
  last_mark_price REAL NOT NULL,
  last_marked_at INTEGER NOT NULL,
  opened_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_positions_symbol ON stock_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_positions_updated_at ON stock_positions(updated_at);
