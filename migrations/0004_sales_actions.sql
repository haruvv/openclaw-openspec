CREATE TABLE IF NOT EXISTS sales_outreach_messages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  site_id TEXT,
  snapshot_id TEXT,
  target_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL,
  reviewed_at INTEGER,
  sent_at INTEGER,
  error TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (site_id) REFERENCES analyzed_sites(id) ON DELETE SET NULL,
  FOREIGN KEY (snapshot_id) REFERENCES site_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_outreach_run_id ON sales_outreach_messages(run_id);
CREATE INDEX IF NOT EXISTS idx_sales_outreach_site_id ON sales_outreach_messages(site_id);
CREATE INDEX IF NOT EXISTS idx_sales_outreach_domain ON sales_outreach_messages(domain);
CREATE INDEX IF NOT EXISTS idx_sales_outreach_status ON sales_outreach_messages(status);
CREATE INDEX IF NOT EXISTS idx_sales_outreach_sent_at ON sales_outreach_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_sales_outreach_created_at ON sales_outreach_messages(created_at);

CREATE TABLE IF NOT EXISTS sales_payment_links (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  site_id TEXT,
  outreach_message_id TEXT,
  domain TEXT NOT NULL,
  recipient_email TEXT,
  amount_jpy INTEGER NOT NULL,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  stripe_payment_link_id TEXT,
  payment_link_url TEXT,
  status TEXT NOT NULL,
  expires_at INTEGER,
  sent_at INTEGER,
  error TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (site_id) REFERENCES analyzed_sites(id) ON DELETE SET NULL,
  FOREIGN KEY (outreach_message_id) REFERENCES sales_outreach_messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_payment_run_id ON sales_payment_links(run_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_site_id ON sales_payment_links(site_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_domain ON sales_payment_links(domain);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_sales_payment_created_at ON sales_payment_links(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_payment_link_id ON sales_payment_links(stripe_payment_link_id);
