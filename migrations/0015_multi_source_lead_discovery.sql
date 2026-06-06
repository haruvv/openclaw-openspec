CREATE TABLE IF NOT EXISTS lead_candidates (
  id TEXT PRIMARY KEY,
  normalized_url TEXT NOT NULL UNIQUE,
  display_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  business_name TEXT,
  category TEXT,
  location TEXT,
  technologies_json TEXT NOT NULL DEFAULT '[]',
  source_confidence TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_candidate_sources (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_business_id TEXT,
  query TEXT,
  title TEXT,
  snippet TEXT,
  confidence TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES lead_candidates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_stage_events (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  reason_code TEXT,
  message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES lead_candidates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_contact_methods (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  source_url TEXT NOT NULL,
  confidence TEXT NOT NULL,
  label TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES lead_candidates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_priority_scores (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  total_score INTEGER NOT NULL,
  label TEXT NOT NULL,
  components_json TEXT NOT NULL DEFAULT '{}',
  reasons_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES lead_candidates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_route_decisions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  route TEXT NOT NULL,
  status TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  message TEXT NOT NULL,
  contact_method_json TEXT,
  priority_score_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES lead_candidates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_candidates_updated_at ON lead_candidates(updated_at);
CREATE INDEX IF NOT EXISTS idx_lead_candidates_domain ON lead_candidates(domain);
CREATE INDEX IF NOT EXISTS idx_lead_candidate_sources_candidate ON lead_candidate_sources(candidate_id);
CREATE INDEX IF NOT EXISTS idx_lead_candidate_sources_source ON lead_candidate_sources(source);
CREATE INDEX IF NOT EXISTS idx_lead_stage_events_candidate ON lead_stage_events(candidate_id);
CREATE INDEX IF NOT EXISTS idx_lead_contact_methods_candidate ON lead_contact_methods(candidate_id);
CREATE INDEX IF NOT EXISTS idx_lead_priority_scores_candidate ON lead_priority_scores(candidate_id);
CREATE INDEX IF NOT EXISTS idx_lead_route_decisions_candidate ON lead_route_decisions(candidate_id);
