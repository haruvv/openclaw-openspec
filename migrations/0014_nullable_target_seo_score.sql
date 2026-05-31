CREATE TABLE IF NOT EXISTS targets_next (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  contact_email TEXT,
  industry TEXT,
  seo_score INTEGER,
  diagnostics TEXT NOT NULL,
  opportunity_score INTEGER,
  opportunity_findings TEXT,
  status TEXT NOT NULL,
  proposal_path TEXT,
  hil_token TEXT,
  payment_link_url TEXT,
  payment_link_id TEXT,
  payment_link_expires_at INTEGER,
  payment_reminder_sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR REPLACE INTO targets_next (
  id, domain, url, contact_email, industry, seo_score, diagnostics,
  opportunity_score, opportunity_findings, status, proposal_path, hil_token,
  payment_link_url, payment_link_id, payment_link_expires_at,
  payment_reminder_sent_at, created_at, updated_at
)
SELECT
  id, domain, url, contact_email, industry, seo_score, diagnostics,
  opportunity_score, opportunity_findings, status, proposal_path, hil_token,
  payment_link_url, payment_link_id, payment_link_expires_at,
  payment_reminder_sent_at, created_at, updated_at
FROM targets;

DROP TABLE targets;
ALTER TABLE targets_next RENAME TO targets;
CREATE INDEX IF NOT EXISTS idx_targets_status ON targets(status);
