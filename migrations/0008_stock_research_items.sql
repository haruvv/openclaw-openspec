CREATE TABLE IF NOT EXISTS stock_research_items (
  id TEXT PRIMARY KEY,
  symbol TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  sentiment TEXT NOT NULL,
  importance REAL NOT NULL,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_research_items_symbol ON stock_research_items(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_research_items_category ON stock_research_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_research_items_published_at ON stock_research_items(published_at);
CREATE INDEX IF NOT EXISTS idx_stock_research_items_importance ON stock_research_items(importance);
