-- Core unified picks schema aligned with syndicate standards

-- 1) unified_picks
CREATE TABLE IF NOT EXISTS unified_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prop_id UUID REFERENCES raw_props(id) ON DELETE SET NULL,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  pick_source TEXT NOT NULL DEFAULT 'manual' CHECK (pick_source IN ('manual','promoted','events','bridge_outbox')),
  pick_type TEXT NOT NULL CHECK (pick_type IN ('single','parlay','system','teaser')),
  outcome TEXT NOT NULL,
  line NUMERIC,
  odds INTEGER,
  stake NUMERIC(8,2),
  confidence NUMERIC(5,2) CHECK (confidence >= 0 AND confidence <= 100),
  workflow_stage TEXT NOT NULL DEFAULT 'ingested' CHECK (workflow_stage IN ('ingested','validated','graded','pending_review','promoted','settled')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','push','void','cancelled')),
  published BOOLEAN NOT NULL DEFAULT false,
  tier_when_placed TEXT CHECK (tier_when_placed IN ('S','A','B','C','D')),
  analysis TEXT,
  group_key TEXT,
  -- Professional grading (denormalized for fast reads)
  score NUMERIC(5,2),
  devigged_edge NUMERIC(6,2),
  kelly_fraction NUMERIC(6,4),
  professional_insights JSONB,
  feature_contributions JSONB,
  risk_assessment JSONB,
  clv_tracking_id TEXT UNIQUE,
  processing_time INTEGER,
  rule_compliance_score INTEGER,
  sharp_grading_version TEXT,
  created_by_processor TEXT,
  is_instant BOOLEAN NOT NULL DEFAULT false,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) pick_legs for parlays/systems
CREATE TABLE IF NOT EXISTS pick_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_pick_id UUID NOT NULL REFERENCES unified_picks(id) ON DELETE CASCADE,
  leg_index INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  line NUMERIC,
  odds INTEGER,
  book TEXT,
  UNIQUE (unified_pick_id, leg_index)
);

-- 3) grading_results (versioned, latest per pick)
CREATE TABLE IF NOT EXISTS grading_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_pick_id UUID NOT NULL REFERENCES unified_picks(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('S','A','B','C','D')),
  edge_score NUMERIC(6,2),
  devigged_edge NUMERIC(6,2),
  kelly_fraction NUMERIC(6,4),
  professional_insights JSONB,
  version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unified_pick_id, version)
);

-- 4) pick_audit (append-only events)
CREATE TABLE IF NOT EXISTS pick_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_pick_id UUID NOT NULL REFERENCES unified_picks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','updated','graded','promoted','settled','deleted')),
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unified_picks_updated_at ON unified_picks;
CREATE TRIGGER trg_unified_picks_updated_at
BEFORE UPDATE ON unified_picks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

