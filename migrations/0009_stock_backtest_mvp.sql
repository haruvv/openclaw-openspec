CREATE TABLE IF NOT EXISTS stock_candles (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(symbol, timeframe, timestamp)
);

CREATE TABLE IF NOT EXISTS stock_backtest_runs (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  strategy_tag TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  candle_count INTEGER NOT NULL,
  trade_count INTEGER NOT NULL,
  win_rate REAL,
  realized_pnl REAL NOT NULL,
  gross_profit REAL NOT NULL,
  gross_loss REAL NOT NULL,
  average_profit REAL,
  average_loss REAL,
  expectancy REAL,
  profit_factor REAL,
  maximum_drawdown REAL,
  from_ts INTEGER,
  to_ts INTEGER,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_backtest_trades (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  entry_at INTEGER NOT NULL,
  exit_at INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL NOT NULL,
  quantity REAL NOT NULL,
  gross_pnl REAL NOT NULL,
  fees REAL NOT NULL,
  slippage_cost REAL NOT NULL,
  net_pnl REAL NOT NULL,
  outcome TEXT NOT NULL,
  holding_bars INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES stock_backtest_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_candles_symbol_time ON stock_candles(symbol, timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_stock_candles_timestamp ON stock_candles(timestamp);
CREATE INDEX IF NOT EXISTS idx_stock_backtest_runs_created_at ON stock_backtest_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_backtest_runs_symbol ON stock_backtest_runs(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_backtest_runs_strategy ON stock_backtest_runs(strategy_tag);
CREATE INDEX IF NOT EXISTS idx_stock_backtest_trades_run_id ON stock_backtest_trades(run_id);
