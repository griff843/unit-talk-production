-- Feature Store and Data Quality Tables

-- Enable extensions if needed (commented to avoid failures if not allowed)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) feature_values: stores point-in-time features per entity
CREATE TABLE IF NOT EXISTS feature_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_feature_point UNIQUE (entity_type, entity_id, feature_name, as_of)
);

CREATE INDEX IF NOT EXISTS idx_feature_values_lookup
  ON feature_values (entity_type, entity_id, feature_name, as_of DESC);

CREATE INDEX IF NOT EXISTS idx_feature_values_feature_time
  ON feature_values (feature_name, as_of DESC);

-- 2) feature_freshness: tracks last update time per feature (optionally per entity)
CREATE TABLE IF NOT EXISTS feature_freshness (
  feature_name TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  last_updated TIMESTAMPTZ NOT NULL,
  freshness_seconds INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (NOW() - last_updated))) STORED,
  PRIMARY KEY (feature_name, entity_type, entity_id)
);

-- 3) data_quality_events: log data quality issues and checks
CREATE TABLE IF NOT EXISTS data_quality_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  component TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  message TEXT NOT NULL,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_dq_events_component_time
  ON data_quality_events (component, event_time DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'feature_values_set_updated_at'
  ) THEN
    CREATE TRIGGER feature_values_set_updated_at
    BEFORE UPDATE ON feature_values
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

