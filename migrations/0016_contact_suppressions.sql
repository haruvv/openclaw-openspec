CREATE TABLE IF NOT EXISTS contact_suppressions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(kind, value)
);

CREATE INDEX IF NOT EXISTS idx_contact_suppressions_kind_value ON contact_suppressions(kind, value);
CREATE INDEX IF NOT EXISTS idx_contact_suppressions_created_at ON contact_suppressions(created_at);
