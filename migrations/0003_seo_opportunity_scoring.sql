ALTER TABLE targets ADD COLUMN opportunity_score INTEGER;
ALTER TABLE targets ADD COLUMN opportunity_findings TEXT;

ALTER TABLE analyzed_sites ADD COLUMN latest_opportunity_score INTEGER;

ALTER TABLE site_snapshots ADD COLUMN opportunity_score INTEGER;
ALTER TABLE site_snapshots ADD COLUMN opportunity_findings_json TEXT NOT NULL DEFAULT '[]';
