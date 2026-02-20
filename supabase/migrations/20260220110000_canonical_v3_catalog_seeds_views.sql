-- ============================================================================
-- CANONICAL SCHEMA V3 CATALOG - SEEDS, NORMALIZATION & CONTRACT VIEWS
-- Sprint: SPRINT-CANONICAL-V3-CATALOG-072
-- Date: 2026-02-20
--
-- AMENDED: Market type normalization hardening, segment templates,
--          provider mapping versioning, market group hierarchy.
--
-- Creates catalog layer for Canonical V3:
-- 1. Dimension tables (sports, providers, leagues)
-- 2. Outcome types & market groups with hierarchy
-- 3. Enhanced market_types table with full normalization
-- 4. Segment templates with overtime policy
-- 5. Provider mapping tables with versioning
-- 6. Contract views for Smart Form consumers
-- 7. Performance indexes
--
-- NO agent migrations. NO Smart Form changes. NO compat views.
-- DO NOT touch provider_offers table.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Participant scope for markets
CREATE TYPE IF NOT EXISTS participant_scope_type AS ENUM (
  'EVENT',       -- Full event (game totals, spread)
  'TEAM',        -- Team-specific (team total)
  'PLAYER',      -- Player props
  'FIGHTER',     -- Combat sports
  'PARTICIPANT', -- Generic participant (golf, racing)
  'NONE'         -- No participant needed
);

-- Overtime policy for segment templates
CREATE TYPE IF NOT EXISTS overtime_policy_type AS ENUM (
  'NONE',           -- No overtime (soccer regular time)
  'EXTRA_PERIOD',   -- Standard OT (NBA, NHL)
  'SUDDEN_DEATH',   -- First to score wins
  'UNLIMITED'       -- Keeps going until resolution (tennis tiebreaker)
);

-- ============================================================================
-- DIMENSION: SPORTS REGISTRY
-- Canonical sport codes with configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS sports_registry (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  has_segments BOOLEAN DEFAULT TRUE,
  default_segment_type TEXT,
  supports_live BOOLEAN DEFAULT TRUE,
  supports_player_props BOOLEAN DEFAULT TRUE,
  meta JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sports_registry IS 'Canonical sport definitions. Catalog V3.';

-- Seed sports (idempotent)
INSERT INTO sports_registry (code, display_name, has_segments, default_segment_type, supports_live, supports_player_props) VALUES
  ('NBA', 'Basketball', TRUE, 'quarter', TRUE, TRUE),
  ('NFL', 'Football', TRUE, 'quarter', TRUE, TRUE),
  ('MLB', 'Baseball', TRUE, 'inning', TRUE, TRUE),
  ('NHL', 'Hockey', TRUE, 'period', TRUE, TRUE),
  ('MMA', 'MMA', TRUE, 'round', TRUE, TRUE),
  ('UFC', 'UFC', TRUE, 'round', TRUE, TRUE),
  ('TENNIS', 'Tennis', TRUE, 'set', TRUE, FALSE),
  ('GOLF', 'Golf', FALSE, NULL, TRUE, FALSE),
  ('SOCCER', 'Soccer', TRUE, 'half', TRUE, TRUE),
  ('WNBA', 'WNBA', TRUE, 'quarter', TRUE, TRUE),
  ('NCAAB', 'College Basketball', TRUE, 'half', TRUE, TRUE),
  ('NCAAF', 'College Football', TRUE, 'quarter', TRUE, TRUE),
  ('PGA', 'PGA Tour', FALSE, NULL, TRUE, FALSE),
  ('NASCAR', 'NASCAR', FALSE, NULL, TRUE, FALSE),
  ('BOXING', 'Boxing', TRUE, 'round', TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- DIMENSION: LEAGUES
-- League definitions with sport reference
-- ============================================================================
CREATE TABLE IF NOT EXISTS leagues (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  sport_id INTEGER REFERENCES sports_registry(id),
  country TEXT,
  level TEXT DEFAULT 'professional',  -- 'professional', 'college', 'amateur'
  has_playoffs BOOLEAN DEFAULT TRUE,
  playoff_format TEXT,                 -- 'bracket', 'series', 'single_elim'
  meta JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE leagues IS 'League definitions with sport reference. Catalog V3.';

-- Seed leagues (idempotent)
INSERT INTO leagues (code, display_name, sport_id, country, level, has_playoffs, playoff_format)
SELECT code, display_name, sport_id, country, level, has_playoffs, playoff_format
FROM (VALUES
  ('NBA', 'NBA', (SELECT id FROM sports_registry WHERE code = 'NBA'), 'USA', 'professional', TRUE, 'series'),
  ('NFL', 'NFL', (SELECT id FROM sports_registry WHERE code = 'NFL'), 'USA', 'professional', TRUE, 'single_elim'),
  ('MLB', 'MLB', (SELECT id FROM sports_registry WHERE code = 'MLB'), 'USA', 'professional', TRUE, 'series'),
  ('NHL', 'NHL', (SELECT id FROM sports_registry WHERE code = 'NHL'), 'USA', 'professional', TRUE, 'series'),
  ('WNBA', 'WNBA', (SELECT id FROM sports_registry WHERE code = 'WNBA'), 'USA', 'professional', TRUE, 'series'),
  ('NCAAB', 'NCAA Basketball', (SELECT id FROM sports_registry WHERE code = 'NCAAB'), 'USA', 'college', TRUE, 'single_elim'),
  ('NCAAF', 'NCAA Football', (SELECT id FROM sports_registry WHERE code = 'NCAAF'), 'USA', 'college', TRUE, 'single_elim'),
  ('UFC', 'UFC', (SELECT id FROM sports_registry WHERE code = 'UFC'), 'USA', 'professional', FALSE, NULL),
  ('PGA', 'PGA Tour', (SELECT id FROM sports_registry WHERE code = 'PGA'), 'USA', 'professional', FALSE, NULL),
  ('EPL', 'Premier League', (SELECT id FROM sports_registry WHERE code = 'SOCCER'), 'ENG', 'professional', FALSE, NULL),
  ('MLS', 'MLS', (SELECT id FROM sports_registry WHERE code = 'SOCCER'), 'USA', 'professional', TRUE, 'single_elim'),
  ('LA_LIGA', 'La Liga', (SELECT id FROM sports_registry WHERE code = 'SOCCER'), 'ESP', 'professional', FALSE, NULL),
  ('SERIE_A', 'Serie A', (SELECT id FROM sports_registry WHERE code = 'SOCCER'), 'ITA', 'professional', FALSE, NULL),
  ('BUNDESLIGA', 'Bundesliga', (SELECT id FROM sports_registry WHERE code = 'SOCCER'), 'DEU', 'professional', FALSE, NULL),
  ('UCL', 'Champions League', (SELECT id FROM sports_registry WHERE code = 'SOCCER'), 'EUR', 'professional', TRUE, 'single_elim'),
  ('ATP', 'ATP Tour', (SELECT id FROM sports_registry WHERE code = 'TENNIS'), 'INT', 'professional', FALSE, NULL),
  ('WTA', 'WTA Tour', (SELECT id FROM sports_registry WHERE code = 'TENNIS'), 'INT', 'professional', FALSE, NULL)
) AS v(code, display_name, sport_id, country, level, has_playoffs, playoff_format)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- DIMENSION: SEGMENT TYPES (enhanced)
-- Canonical segment type definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS segment_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  display_short TEXT,
  ordinal_prefix TEXT,        -- '1st', '2nd', etc.
  applicable_sports TEXT[],   -- Sports where this segment applies
  max_segments INTEGER,       -- Max number (4 for quarters, 9 for innings)
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE segment_types IS 'Canonical segment type definitions. Catalog V3.';

-- Seed segment types (idempotent)
INSERT INTO segment_types (code, display_name, display_short, ordinal_prefix, applicable_sports, max_segments) VALUES
  ('quarter', 'Quarter', 'Q', 'Q', ARRAY['NBA', 'NFL', 'NCAAF', 'WNBA'], 4),
  ('half', 'Half', 'H', 'H', ARRAY['NBA', 'NFL', 'NCAAB', 'NCAAF', 'SOCCER'], 2),
  ('period', 'Period', 'P', 'P', ARRAY['NHL'], 3),
  ('inning', 'Inning', 'Inn', NULL, ARRAY['MLB'], 9),
  ('round', 'Round', 'Rd', 'R', ARRAY['MMA', 'UFC', 'BOXING'], 12),
  ('set', 'Set', 'Set', 'Set', ARRAY['TENNIS'], 5),
  ('game', 'Game', 'G', 'G', ARRAY['TENNIS'], 7),
  ('overtime', 'Overtime', 'OT', 'OT', ARRAY['NBA', 'NFL', 'NHL', 'NCAAB', 'NCAAF', 'SOCCER'], 5),
  ('map', 'Map', 'Map', 'Map', ARRAY['ESPORTS'], 5)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SEGMENT TEMPLATES
-- League-specific segment structures with overtime policy
-- ============================================================================
CREATE TABLE IF NOT EXISTS segment_templates (
  id SERIAL PRIMARY KEY,
  template_key TEXT NOT NULL,
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  segment_type_id INTEGER NOT NULL REFERENCES segment_types(id),
  total_segments INTEGER NOT NULL,
  overtime_policy overtime_policy_type NOT NULL DEFAULT 'NONE',
  is_playoff_variant BOOLEAN DEFAULT FALSE,
  meta JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT segment_templates_unique UNIQUE (league_id, template_key)
);

COMMENT ON TABLE segment_templates IS 'League-specific segment structures. Supports playoff variants. Catalog V3.';

CREATE INDEX IF NOT EXISTS idx_segment_templates_league ON segment_templates(league_id);
CREATE INDEX IF NOT EXISTS idx_segment_templates_type ON segment_templates(segment_type_id);

-- Seed segment templates (idempotent)
INSERT INTO segment_templates (template_key, league_id, segment_type_id, total_segments, overtime_policy, is_playoff_variant)
SELECT template_key, league_id, segment_type_id, total_segments, overtime_policy::overtime_policy_type, is_playoff_variant
FROM (VALUES
  ('nba_regular', (SELECT id FROM leagues WHERE code = 'NBA'), (SELECT id FROM segment_types WHERE code = 'quarter'), 4, 'EXTRA_PERIOD', FALSE),
  ('nba_playoff', (SELECT id FROM leagues WHERE code = 'NBA'), (SELECT id FROM segment_types WHERE code = 'quarter'), 4, 'EXTRA_PERIOD', TRUE),
  ('nfl_regular', (SELECT id FROM leagues WHERE code = 'NFL'), (SELECT id FROM segment_types WHERE code = 'quarter'), 4, 'SUDDEN_DEATH', FALSE),
  ('nfl_playoff', (SELECT id FROM leagues WHERE code = 'NFL'), (SELECT id FROM segment_types WHERE code = 'quarter'), 4, 'EXTRA_PERIOD', TRUE),
  ('mlb_regular', (SELECT id FROM leagues WHERE code = 'MLB'), (SELECT id FROM segment_types WHERE code = 'inning'), 9, 'EXTRA_PERIOD', FALSE),
  ('nhl_regular', (SELECT id FROM leagues WHERE code = 'NHL'), (SELECT id FROM segment_types WHERE code = 'period'), 3, 'SUDDEN_DEATH', FALSE),
  ('nhl_playoff', (SELECT id FROM leagues WHERE code = 'NHL'), (SELECT id FROM segment_types WHERE code = 'period'), 3, 'EXTRA_PERIOD', TRUE),
  ('soccer_regular', (SELECT id FROM leagues WHERE code = 'EPL'), (SELECT id FROM segment_types WHERE code = 'half'), 2, 'NONE', FALSE),
  ('soccer_knockout', (SELECT id FROM leagues WHERE code = 'UCL'), (SELECT id FROM segment_types WHERE code = 'half'), 2, 'EXTRA_PERIOD', TRUE),
  ('tennis_best_of_3', (SELECT id FROM leagues WHERE code = 'ATP'), (SELECT id FROM segment_types WHERE code = 'set'), 3, 'UNLIMITED', FALSE),
  ('tennis_best_of_5', (SELECT id FROM leagues WHERE code = 'ATP'), (SELECT id FROM segment_types WHERE code = 'set'), 5, 'UNLIMITED', TRUE),
  ('ufc_regular', (SELECT id FROM leagues WHERE code = 'UFC'), (SELECT id FROM segment_types WHERE code = 'round'), 3, 'NONE', FALSE),
  ('ufc_championship', (SELECT id FROM leagues WHERE code = 'UFC'), (SELECT id FROM segment_types WHERE code = 'round'), 5, 'NONE', TRUE)
) AS v(template_key, league_id, segment_type_id, total_segments, overtime_policy, is_playoff_variant)
ON CONFLICT (league_id, template_key) DO NOTHING;

-- ============================================================================
-- DIMENSION: PROVIDER REGISTRY
-- Registered sportsbook providers
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_registry (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  api_source TEXT,            -- 'odds_api', 'direct', 'aggregate'
  priority INTEGER DEFAULT 99,-- Lower = higher priority for display
  has_player_props BOOLEAN DEFAULT TRUE,
  has_live_odds BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE provider_registry IS 'Registered sportsbook providers. Catalog V3.';

-- Seed providers (idempotent)
INSERT INTO provider_registry (code, display_name, api_source, priority, has_player_props, has_live_odds) VALUES
  ('optimal', 'Optimal (Aggregate)', 'aggregate', 0, TRUE, TRUE),
  ('fanduel', 'FanDuel', 'odds_api', 1, TRUE, TRUE),
  ('draftkings', 'DraftKings', 'odds_api', 2, TRUE, TRUE),
  ('espn_bet', 'ESPN BET', 'odds_api', 3, TRUE, TRUE),
  ('bet365', 'Bet365', 'odds_api', 4, TRUE, TRUE),
  ('pinnacle', 'Pinnacle', 'odds_api', 5, TRUE, TRUE),
  ('bovada', 'Bovada', 'odds_api', 6, TRUE, FALSE),
  ('betmgm', 'BetMGM', 'odds_api', 7, TRUE, TRUE),
  ('caesars', 'Caesars', 'odds_api', 8, TRUE, TRUE),
  ('pointsbet', 'PointsBet', 'odds_api', 9, TRUE, TRUE),
  ('hard_rock', 'Hard Rock Bet', 'odds_api', 10, TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- OUTCOME TYPES
-- Canonical outcome type definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  outcome_count INTEGER NOT NULL,     -- 2 for binary, 3 for 3-way, N for multi
  is_numeric BOOLEAN DEFAULT FALSE,   -- TRUE for over/under style
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE outcome_types IS 'Canonical outcome type definitions. Catalog V3.';

-- Seed outcome types (idempotent)
INSERT INTO outcome_types (code, display_name, outcome_count, is_numeric) VALUES
  ('over_under', 'Over/Under', 2, TRUE),
  ('moneyline_2way', 'Moneyline (2-Way)', 2, FALSE),
  ('moneyline_3way', 'Moneyline (3-Way)', 3, FALSE),
  ('spread', 'Spread/Handicap', 2, TRUE),
  ('yes_no', 'Yes/No', 2, FALSE),
  ('outright', 'Outright Winner', 0, FALSE),  -- N participants
  ('correct_score', 'Correct Score', 0, FALSE),
  ('round_prop', 'Round/Period Winner', 0, FALSE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- MARKET GROUPS (with hierarchy support)
-- Market category groupings with nesting
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_groups (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  parent_group_id INTEGER REFERENCES market_groups(id),  -- Hierarchical nesting
  sort_order INTEGER DEFAULT 0,
  meta JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE market_groups IS 'Market category groupings with hierarchy. Catalog V3.';

CREATE INDEX IF NOT EXISTS idx_market_groups_parent ON market_groups(parent_group_id);

-- Seed market groups (idempotent)
INSERT INTO market_groups (code, display_name, parent_group_id, sort_order) VALUES
  ('game_lines', 'Game Lines', NULL, 1),
  ('player_props', 'Player Props', NULL, 2),
  ('team_props', 'Team Props', NULL, 3),
  ('futures', 'Futures', NULL, 4),
  ('specials', 'Specials', NULL, 5)
ON CONFLICT (code) DO NOTHING;

-- Child groups (after parents exist)
INSERT INTO market_groups (code, display_name, parent_group_id, sort_order)
SELECT child.code, child.display_name, p.id, child.sort_order
FROM (VALUES
  ('gl_spread', 'Spread', 'game_lines', 1),
  ('gl_total', 'Total', 'game_lines', 2),
  ('gl_moneyline', 'Moneyline', 'game_lines', 3),
  ('pp_points', 'Points', 'player_props', 1),
  ('pp_rebounds', 'Rebounds', 'player_props', 2),
  ('pp_assists', 'Assists', 'player_props', 3),
  ('pp_combos', 'Combos (PRA, etc.)', 'player_props', 4),
  ('pp_passing', 'Passing', 'player_props', 5),
  ('pp_rushing', 'Rushing', 'player_props', 6),
  ('pp_receiving', 'Receiving', 'player_props', 7),
  ('pp_pitching', 'Pitching', 'player_props', 8),
  ('pp_hitting', 'Hitting', 'player_props', 9),
  ('tp_team_total', 'Team Total', 'team_props', 1),
  ('tp_team_prop', 'Team Props', 'team_props', 2),
  ('alt_spread', 'Alternate Spread', 'game_lines', 10),
  ('alt_total', 'Alternate Total', 'game_lines', 11)
) AS child(code, display_name, parent_code, sort_order)
JOIN market_groups p ON p.code = child.parent_code
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- MARKET TYPES (NORMALIZED)
-- Full market type definitions with hardening
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_types (
  id SERIAL PRIMARY KEY,
  market_key TEXT NOT NULL,                               -- Human readable, stable
  display_name TEXT NOT NULL,
  sport_id INTEGER REFERENCES sports_registry(id),        -- NULL = universal
  league_id INTEGER REFERENCES leagues(id),               -- NULL = all leagues in sport
  market_group_id INTEGER REFERENCES market_groups(id),
  outcome_type_id INTEGER REFERENCES outcome_types(id),

  -- Scope and requirements
  participant_scope participant_scope_type NOT NULL DEFAULT 'NONE',
  requires_participant BOOLEAN NOT NULL DEFAULT FALSE,
  requires_line BOOLEAN NOT NULL DEFAULT FALSE,

  -- Features
  supports_alt_lines BOOLEAN DEFAULT FALSE,
  supports_live BOOLEAN DEFAULT TRUE,
  segment_type_id INTEGER REFERENCES segment_types(id),   -- If segment-specific

  -- Classification
  is_future BOOLEAN DEFAULT FALSE,
  is_derivative BOOLEAN DEFAULT FALSE,

  -- Settlement
  settlement_rule JSONB DEFAULT '{}',                     -- Future-proof settlement config

  meta JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- UNIQUE: No ambiguous market definitions
  CONSTRAINT market_types_unique UNIQUE (
    COALESCE(sport_id, 0),
    COALESCE(league_id, 0),
    market_key
  )
);

COMMENT ON TABLE market_types IS 'Normalized market types with full hardening. Catalog V3.';

CREATE INDEX IF NOT EXISTS idx_market_types_sport ON market_types(sport_id);
CREATE INDEX IF NOT EXISTS idx_market_types_league ON market_types(league_id);
CREATE INDEX IF NOT EXISTS idx_market_types_group ON market_types(market_group_id);
CREATE INDEX IF NOT EXISTS idx_market_types_scope ON market_types(participant_scope);
CREATE INDEX IF NOT EXISTS idx_market_types_active ON market_types(active) WHERE active = TRUE;

-- ============================================================================
-- SEED: MARKET TYPES
-- Comprehensive market type seeding
-- ============================================================================

-- Game lines (universal)
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
SELECT * FROM (VALUES
  ('team_moneyline', 'Moneyline', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'gl_moneyline'), (SELECT id FROM outcome_types WHERE code = 'moneyline_2way'), 'EVENT'::participant_scope_type, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
  ('team_spread', 'Spread', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'gl_spread'), (SELECT id FROM outcome_types WHERE code = 'spread'), 'EVENT'::participant_scope_type, FALSE, TRUE, TRUE, TRUE, FALSE, FALSE),
  ('game_total', 'Total', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'gl_total'), (SELECT id FROM outcome_types WHERE code = 'over_under'), 'EVENT'::participant_scope_type, FALSE, TRUE, TRUE, TRUE, FALSE, FALSE),
  ('team_total', 'Team Total', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'tp_team_total'), (SELECT id FROM outcome_types WHERE code = 'over_under'), 'TEAM'::participant_scope_type, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE)
) AS v(market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- Soccer 3-way markets
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
SELECT 'match_result_3way', 'Match Result (1X2)', s.id, NULL, (SELECT id FROM market_groups WHERE code = 'gl_moneyline'), (SELECT id FROM outcome_types WHERE code = 'moneyline_3way'), 'EVENT'::participant_scope_type, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE
FROM sports_registry s WHERE s.code = 'SOCCER'
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- NBA player props
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
SELECT market_key, display_name, sport_id, NULL, market_group_id, (SELECT id FROM outcome_types WHERE code = 'over_under'), 'PLAYER'::participant_scope_type, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE
FROM (
  SELECT 'player_points_ou' AS market_key, 'Player Points' AS display_name, (SELECT id FROM sports_registry WHERE code = 'NBA') AS sport_id, (SELECT id FROM market_groups WHERE code = 'pp_points') AS market_group_id
  UNION ALL SELECT 'player_rebounds_ou', 'Player Rebounds', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_rebounds')
  UNION ALL SELECT 'player_assists_ou', 'Player Assists', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_assists')
  UNION ALL SELECT 'player_3pm_ou', 'Player 3-Pointers Made', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_points')
  UNION ALL SELECT 'player_pra_ou', 'Player PRA', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_combos')
  UNION ALL SELECT 'player_pts_rebs_ou', 'Player Points + Rebounds', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_combos')
  UNION ALL SELECT 'player_pts_asts_ou', 'Player Points + Assists', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_combos')
  UNION ALL SELECT 'player_rebs_asts_ou', 'Player Rebounds + Assists', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_combos')
  UNION ALL SELECT 'player_steals_ou', 'Player Steals', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_points')
  UNION ALL SELECT 'player_blocks_ou', 'Player Blocks', (SELECT id FROM sports_registry WHERE code = 'NBA'), (SELECT id FROM market_groups WHERE code = 'pp_points')
) AS nba_props
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- NFL player props
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
SELECT market_key, display_name, sport_id, NULL, market_group_id, (SELECT id FROM outcome_types WHERE code = 'over_under'), 'PLAYER'::participant_scope_type, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE
FROM (
  SELECT 'player_passing_yards_ou' AS market_key, 'Passing Yards' AS display_name, (SELECT id FROM sports_registry WHERE code = 'NFL') AS sport_id, (SELECT id FROM market_groups WHERE code = 'pp_passing') AS market_group_id
  UNION ALL SELECT 'player_passing_tds_ou', 'Passing TDs', (SELECT id FROM sports_registry WHERE code = 'NFL'), (SELECT id FROM market_groups WHERE code = 'pp_passing')
  UNION ALL SELECT 'player_rushing_yards_ou', 'Rushing Yards', (SELECT id FROM sports_registry WHERE code = 'NFL'), (SELECT id FROM market_groups WHERE code = 'pp_rushing')
  UNION ALL SELECT 'player_receiving_yards_ou', 'Receiving Yards', (SELECT id FROM sports_registry WHERE code = 'NFL'), (SELECT id FROM market_groups WHERE code = 'pp_receiving')
  UNION ALL SELECT 'player_receptions_ou', 'Receptions', (SELECT id FROM sports_registry WHERE code = 'NFL'), (SELECT id FROM market_groups WHERE code = 'pp_receiving')
  UNION ALL SELECT 'player_rush_rec_yards_ou', 'Rush + Rec Yards', (SELECT id FROM sports_registry WHERE code = 'NFL'), (SELECT id FROM market_groups WHERE code = 'pp_combos')
) AS nfl_props
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- TD scorer props (yes/no)
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
SELECT 'player_tds_ou', 'Anytime TD Scorer', (SELECT id FROM sports_registry WHERE code = 'NFL'), NULL, (SELECT id FROM market_groups WHERE code = 'pp_rushing'), (SELECT id FROM outcome_types WHERE code = 'yes_no'), 'PLAYER'::participant_scope_type, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- MMA/UFC markets (fighter scope)
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
SELECT * FROM (VALUES
  ('fight_winner', 'Fight Winner', (SELECT id FROM sports_registry WHERE code = 'MMA'), NULL, (SELECT id FROM market_groups WHERE code = 'gl_moneyline'), (SELECT id FROM outcome_types WHERE code = 'moneyline_2way'), 'FIGHTER'::participant_scope_type, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
  ('fight_method', 'Method of Victory', (SELECT id FROM sports_registry WHERE code = 'MMA'), NULL, (SELECT id FROM market_groups WHERE code = 'specials'), (SELECT id FROM outcome_types WHERE code = 'outright'), 'FIGHTER'::participant_scope_type, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('fight_round_total', 'Total Rounds', (SELECT id FROM sports_registry WHERE code = 'MMA'), NULL, (SELECT id FROM market_groups WHERE code = 'gl_total'), (SELECT id FROM outcome_types WHERE code = 'over_under'), 'EVENT'::participant_scope_type, FALSE, TRUE, FALSE, TRUE, FALSE, FALSE),
  ('fighter_ko_tko', 'Win by KO/TKO', (SELECT id FROM sports_registry WHERE code = 'MMA'), NULL, (SELECT id FROM market_groups WHERE code = 'specials'), (SELECT id FROM outcome_types WHERE code = 'yes_no'), 'FIGHTER'::participant_scope_type, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE)
) AS v(market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- Golf markets (participant scope - N-way)
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
SELECT * FROM (VALUES
  ('tournament_winner', 'Tournament Winner', (SELECT id FROM sports_registry WHERE code = 'GOLF'), NULL, (SELECT id FROM market_groups WHERE code = 'futures'), (SELECT id FROM outcome_types WHERE code = 'outright'), 'PARTICIPANT'::participant_scope_type, TRUE, FALSE, FALSE, TRUE, TRUE, FALSE),
  ('top_5_finish', 'Top 5 Finish', (SELECT id FROM sports_registry WHERE code = 'GOLF'), NULL, (SELECT id FROM market_groups WHERE code = 'futures'), (SELECT id FROM outcome_types WHERE code = 'yes_no'), 'PARTICIPANT'::participant_scope_type, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE),
  ('top_10_finish', 'Top 10 Finish', (SELECT id FROM sports_registry WHERE code = 'GOLF'), NULL, (SELECT id FROM market_groups WHERE code = 'futures'), (SELECT id FROM outcome_types WHERE code = 'yes_no'), 'PARTICIPANT'::participant_scope_type, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE),
  ('head_to_head', 'Head to Head', (SELECT id FROM sports_registry WHERE code = 'GOLF'), NULL, (SELECT id FROM market_groups WHERE code = 'specials'), (SELECT id FROM outcome_types WHERE code = 'moneyline_2way'), 'PARTICIPANT'::participant_scope_type, TRUE, FALSE, FALSE, TRUE, FALSE, TRUE)
) AS v(market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- Tennis markets (set betting, segment-specific)
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, segment_type_id, is_future, is_derivative)
SELECT * FROM (VALUES
  ('match_winner', 'Match Winner', (SELECT id FROM sports_registry WHERE code = 'TENNIS'), NULL, (SELECT id FROM market_groups WHERE code = 'gl_moneyline'), (SELECT id FROM outcome_types WHERE code = 'moneyline_2way'), 'EVENT'::participant_scope_type, FALSE, FALSE, FALSE, TRUE, NULL, FALSE, FALSE),
  ('set_winner', 'Set Winner', (SELECT id FROM sports_registry WHERE code = 'TENNIS'), NULL, (SELECT id FROM market_groups WHERE code = 'specials'), (SELECT id FROM outcome_types WHERE code = 'moneyline_2way'), 'EVENT'::participant_scope_type, FALSE, FALSE, FALSE, TRUE, (SELECT id FROM segment_types WHERE code = 'set'), FALSE, FALSE),
  ('set_correct_score', 'Set Correct Score', (SELECT id FROM sports_registry WHERE code = 'TENNIS'), NULL, (SELECT id FROM market_groups WHERE code = 'specials'), (SELECT id FROM outcome_types WHERE code = 'correct_score'), 'EVENT'::participant_scope_type, FALSE, FALSE, FALSE, FALSE, (SELECT id FROM segment_types WHERE code = 'set'), FALSE, FALSE),
  ('total_games', 'Total Games', (SELECT id FROM sports_registry WHERE code = 'TENNIS'), NULL, (SELECT id FROM market_groups WHERE code = 'gl_total'), (SELECT id FROM outcome_types WHERE code = 'over_under'), 'EVENT'::participant_scope_type, FALSE, TRUE, FALSE, TRUE, NULL, FALSE, FALSE)
) AS v(market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, segment_type_id, is_future, is_derivative)
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- Futures markets
INSERT INTO market_types (market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
SELECT * FROM (VALUES
  ('championship_winner', 'Championship Winner', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'futures'), (SELECT id FROM outcome_types WHERE code = 'outright'), 'TEAM'::participant_scope_type, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE),
  ('conference_winner', 'Conference Winner', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'futures'), (SELECT id FROM outcome_types WHERE code = 'outright'), 'TEAM'::participant_scope_type, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE),
  ('division_winner', 'Division Winner', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'futures'), (SELECT id FROM outcome_types WHERE code = 'outright'), 'TEAM'::participant_scope_type, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE),
  ('mvp_winner', 'MVP', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'futures'), (SELECT id FROM outcome_types WHERE code = 'outright'), 'PLAYER'::participant_scope_type, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE),
  ('win_total', 'Season Win Total', NULL, NULL, (SELECT id FROM market_groups WHERE code = 'futures'), (SELECT id FROM outcome_types WHERE code = 'over_under'), 'TEAM'::participant_scope_type, TRUE, TRUE, FALSE, FALSE, TRUE, FALSE)
) AS v(market_key, display_name, sport_id, league_id, market_group_id, outcome_type_id, participant_scope, requires_participant, requires_line, supports_alt_lines, supports_live, is_future, is_derivative)
ON CONFLICT ON CONSTRAINT market_types_unique DO NOTHING;

-- ============================================================================
-- PROVIDER MAPPING TABLES (with versioning)
-- Versioned mappings between provider-specific and canonical entities
-- ============================================================================

-- Provider team mappings
CREATE TABLE IF NOT EXISTS provider_team_map (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES provider_registry(id),
  provider_team_id TEXT NOT NULL,      -- Provider's team ID
  provider_team_name TEXT,             -- Provider's team name (for debugging)
  canonical_team_id UUID REFERENCES participants(id),

  -- Versioning
  mapping_version INTEGER NOT NULL DEFAULT 1,
  confidence_score NUMERIC(5,4) DEFAULT 1.0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',  -- 'auto', 'manual', 'import'

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT provider_team_map_unique UNIQUE (provider_id, provider_team_id, mapping_version)
);

CREATE INDEX IF NOT EXISTS idx_provider_team_map_lookup ON provider_team_map(provider_id, mapping_version);
CREATE INDEX IF NOT EXISTS idx_provider_team_map_canonical ON provider_team_map(canonical_team_id);
CREATE INDEX IF NOT EXISTS idx_provider_team_map_valid ON provider_team_map(valid_from, valid_to);

COMMENT ON TABLE provider_team_map IS 'Provider team to canonical participant mapping with versioning. Catalog V3.';

-- Provider player mappings
CREATE TABLE IF NOT EXISTS provider_player_map (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES provider_registry(id),
  provider_player_id TEXT NOT NULL,
  provider_player_name TEXT,
  canonical_player_id UUID REFERENCES participants(id),

  -- Versioning
  mapping_version INTEGER NOT NULL DEFAULT 1,
  confidence_score NUMERIC(5,4) DEFAULT 1.0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT provider_player_map_unique UNIQUE (provider_id, provider_player_id, mapping_version)
);

CREATE INDEX IF NOT EXISTS idx_provider_player_map_lookup ON provider_player_map(provider_id, mapping_version);
CREATE INDEX IF NOT EXISTS idx_provider_player_map_canonical ON provider_player_map(canonical_player_id);
CREATE INDEX IF NOT EXISTS idx_provider_player_map_valid ON provider_player_map(valid_from, valid_to);

COMMENT ON TABLE provider_player_map IS 'Provider player to canonical participant mapping with versioning. Catalog V3.';

-- Provider market mappings
CREATE TABLE IF NOT EXISTS provider_market_map (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES provider_registry(id),
  provider_market_key TEXT NOT NULL,
  provider_market_name TEXT,
  canonical_market_type_id INTEGER REFERENCES market_types(id),

  -- Versioning
  mapping_version INTEGER NOT NULL DEFAULT 1,
  confidence_score NUMERIC(5,4) DEFAULT 1.0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT provider_market_map_unique UNIQUE (provider_id, provider_market_key, mapping_version)
);

CREATE INDEX IF NOT EXISTS idx_provider_market_map_lookup ON provider_market_map(provider_id, mapping_version);
CREATE INDEX IF NOT EXISTS idx_provider_market_map_canonical ON provider_market_map(canonical_market_type_id);
CREATE INDEX IF NOT EXISTS idx_provider_market_map_valid ON provider_market_map(valid_from, valid_to);

COMMENT ON TABLE provider_market_map IS 'Provider market to canonical market type mapping with versioning. Catalog V3.';

-- Provider event mappings
CREATE TABLE IF NOT EXISTS provider_event_map (
  id SERIAL PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES provider_registry(id),
  provider_event_id TEXT NOT NULL,
  canonical_event_id UUID REFERENCES events(id),

  -- Versioning
  mapping_version INTEGER NOT NULL DEFAULT 1,
  confidence_score NUMERIC(5,4) DEFAULT 1.0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',

  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT provider_event_map_unique UNIQUE (provider_id, provider_event_id, mapping_version)
);

CREATE INDEX IF NOT EXISTS idx_provider_event_map_lookup ON provider_event_map(provider_id, mapping_version);
CREATE INDEX IF NOT EXISTS idx_provider_event_map_canonical ON provider_event_map(canonical_event_id);
CREATE INDEX IF NOT EXISTS idx_provider_event_map_valid ON provider_event_map(valid_from, valid_to);

COMMENT ON TABLE provider_event_map IS 'Provider event to canonical event mapping with versioning. Catalog V3.';

-- ============================================================================
-- CONTRACT VIEW: view_events_for_form
-- For Smart Form event selection
-- ============================================================================
CREATE OR REPLACE VIEW view_events_for_form AS
SELECT
  e.id,
  e.external_id,
  e.sport,
  e.league,
  e.event_type,
  e.scheduled_at,
  e.status,
  hp.id AS home_participant_id,
  hp.name AS home_team,
  hp.display_name AS home_display,
  ap.id AS away_participant_id,
  ap.name AS away_team,
  ap.display_name AS away_display,
  e.venue,
  e.meta,
  e.created_at
FROM events e
LEFT JOIN participants hp ON hp.id = e.home_participant_id
LEFT JOIN participants ap ON ap.id = e.away_participant_id
WHERE e.status IN ('scheduled', 'live')
  AND e.scheduled_at > NOW() - INTERVAL '2 hours';

COMMENT ON VIEW view_events_for_form IS 'Upcoming events for Smart Form selection. Catalog V3.';

-- ============================================================================
-- CONTRACT VIEW: view_participants_for_event
-- For Smart Form player selection
-- ============================================================================
CREATE OR REPLACE VIEW view_participants_for_event AS
SELECT
  e.id AS event_id,
  e.sport,
  p.id AS participant_id,
  p.name,
  p.display_name,
  p.type AS participant_type,
  pm.role,
  pm.team_id,
  t.name AS team_name,
  CASE
    WHEN pm.team_id = e.home_participant_id THEN 'home'
    WHEN pm.team_id = e.away_participant_id THEN 'away'
    ELSE 'neutral'
  END AS side,
  p.meta AS participant_meta
FROM events e
JOIN participant_memberships pm
  ON pm.team_id IN (e.home_participant_id, e.away_participant_id)
  AND (pm.valid_to IS NULL OR pm.valid_to >= CURRENT_DATE)
  AND pm.valid_from <= CURRENT_DATE
JOIN participants p ON p.id = pm.participant_id AND p.active = TRUE
JOIN participants t ON t.id = pm.team_id
WHERE e.status IN ('scheduled', 'live');

COMMENT ON VIEW view_participants_for_event IS 'Active players for event teams. Catalog V3.';

-- ============================================================================
-- CONTRACT VIEW: view_market_types_for_sport
-- For Smart Form market selection by sport with full normalization
-- ============================================================================
CREATE OR REPLACE VIEW view_market_types_for_sport AS
SELECT
  mt.id AS market_type_id,
  mt.market_key,
  mt.display_name,
  sr.code AS sport,
  l.code AS league,
  mg.code AS market_group,
  mg.display_name AS market_group_name,
  pmg.code AS parent_group,
  ot.code AS outcome_type,
  mt.participant_scope,
  mt.requires_participant,
  mt.requires_line,
  mt.supports_alt_lines,
  mt.supports_live,
  st.code AS segment_type,
  mt.is_future,
  mt.is_derivative
FROM market_types mt
LEFT JOIN sports_registry sr ON sr.id = mt.sport_id
LEFT JOIN leagues l ON l.id = mt.league_id
LEFT JOIN market_groups mg ON mg.id = mt.market_group_id
LEFT JOIN market_groups pmg ON pmg.id = mg.parent_group_id
LEFT JOIN outcome_types ot ON ot.id = mt.outcome_type_id
LEFT JOIN segment_types st ON st.id = mt.segment_type_id
WHERE mt.active = TRUE
ORDER BY
  CASE mg.parent_group_id WHEN NULL THEN mg.sort_order ELSE pmg.sort_order END,
  mg.sort_order,
  mt.display_name;

COMMENT ON VIEW view_market_types_for_sport IS 'Active market types with full normalization. Catalog V3.';

-- ============================================================================
-- CONTRACT VIEW: view_provider_offers_current
-- Latest provider offers for CLV comparison (UNCHANGED - DO NOT TOUCH provider_offers)
-- ============================================================================
CREATE OR REPLACE VIEW view_provider_offers_current AS
SELECT DISTINCT ON (po.event_id, po.market_id, COALESCE(po.participant_id, '00000000-0000-0000-0000-000000000000'::UUID), po.provider)
  po.id,
  po.event_id,
  po.market_id,
  po.participant_id,
  po.segment_id,
  po.provider,
  po.line,
  po.over_odds,
  po.under_odds,
  po.home_odds,
  po.away_odds,
  po.yes_odds,
  po.no_odds,
  po.devigged_over,
  po.devigged_under,
  po.juice,
  po.snapshot_at,
  po.is_opening,
  po.is_closing,
  po.meta,
  po.created_at
FROM provider_offers po
ORDER BY
  po.event_id,
  po.market_id,
  COALESCE(po.participant_id, '00000000-0000-0000-0000-000000000000'::UUID),
  po.provider,
  po.snapshot_at DESC;

COMMENT ON VIEW view_provider_offers_current IS 'Latest offer per provider/market/participant. Catalog V3.';

-- ============================================================================
-- CONTRACT VIEW: view_sports_active
-- Active sports with segment info
-- ============================================================================
CREATE OR REPLACE VIEW view_sports_active AS
SELECT
  sr.id,
  sr.code,
  sr.display_name,
  sr.has_segments,
  sr.default_segment_type,
  sr.supports_live,
  sr.supports_player_props,
  st.display_name AS segment_display,
  st.max_segments,
  sr.meta
FROM sports_registry sr
LEFT JOIN segment_types st ON st.code = sr.default_segment_type
WHERE sr.active = TRUE
ORDER BY sr.display_name;

COMMENT ON VIEW view_sports_active IS 'Active sports with segment configuration. Catalog V3.';

-- ============================================================================
-- CONTRACT VIEW: view_providers_active
-- Active providers ordered by priority
-- ============================================================================
CREATE OR REPLACE VIEW view_providers_active AS
SELECT
  pr.id,
  pr.code,
  pr.display_name,
  pr.api_source,
  pr.priority,
  pr.has_player_props,
  pr.has_live_odds,
  pr.meta
FROM provider_registry pr
WHERE pr.active = TRUE
ORDER BY pr.priority ASC;

COMMENT ON VIEW view_providers_active IS 'Active providers by priority. Catalog V3.';

-- ============================================================================
-- CONTRACT VIEW: view_segment_templates_for_league
-- Segment templates with full context
-- ============================================================================
CREATE OR REPLACE VIEW view_segment_templates_for_league AS
SELECT
  st.id,
  st.template_key,
  l.code AS league,
  l.display_name AS league_name,
  sr.code AS sport,
  seg.code AS segment_type,
  seg.display_name AS segment_type_name,
  st.total_segments,
  st.overtime_policy,
  st.is_playoff_variant,
  st.meta
FROM segment_templates st
JOIN leagues l ON l.id = st.league_id
JOIN sports_registry sr ON sr.id = l.sport_id
JOIN segment_types seg ON seg.id = st.segment_type_id
WHERE st.active = TRUE
ORDER BY l.code, st.is_playoff_variant;

COMMENT ON VIEW view_segment_templates_for_league IS 'Segment templates with league context. Catalog V3.';

-- ============================================================================
-- CONTRACT VIEW: view_market_groups_hierarchy
-- Market groups with parent/child hierarchy
-- ============================================================================
CREATE OR REPLACE VIEW view_market_groups_hierarchy AS
SELECT
  mg.id,
  mg.code,
  mg.display_name,
  mg.parent_group_id,
  pmg.code AS parent_code,
  pmg.display_name AS parent_name,
  mg.sort_order,
  (
    SELECT COUNT(*) FROM market_types mt WHERE mt.market_group_id = mg.id AND mt.active = TRUE
  ) AS market_count
FROM market_groups mg
LEFT JOIN market_groups pmg ON pmg.id = mg.parent_group_id
WHERE mg.active = TRUE
ORDER BY
  COALESCE(pmg.sort_order, mg.sort_order),
  mg.sort_order;

COMMENT ON VIEW view_market_groups_hierarchy IS 'Market groups with hierarchy. Catalog V3.';

-- ============================================================================
-- PERFORMANCE INDEXES
-- Additional indexes for view and query performance
-- ============================================================================

-- Index for view_events_for_form (status + scheduled_at filter)
CREATE INDEX IF NOT EXISTS idx_events_form_filter
  ON events(status, scheduled_at)
  WHERE status IN ('scheduled', 'live');

-- Index for view_provider_offers_current (DISTINCT ON performance)
CREATE INDEX IF NOT EXISTS idx_provider_offers_current_lookup
  ON provider_offers(event_id, market_id, participant_id, provider, snapshot_at DESC);

-- Index for markets by category + active (for legacy markets table)
CREATE INDEX IF NOT EXISTS idx_markets_active_category
  ON markets(category, active)
  WHERE active = TRUE;

-- Index for sports registry active lookup
CREATE INDEX IF NOT EXISTS idx_sports_registry_active
  ON sports_registry(active)
  WHERE active = TRUE;

-- Index for provider registry priority lookup
CREATE INDEX IF NOT EXISTS idx_provider_registry_priority
  ON provider_registry(priority, active)
  WHERE active = TRUE;

-- Index for leagues by sport
CREATE INDEX IF NOT EXISTS idx_leagues_sport
  ON leagues(sport_id);

-- ============================================================================
-- updated_at TRIGGER for market_types
-- ============================================================================
CREATE TRIGGER update_market_types_updated_at
  BEFORE UPDATE ON market_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-CANONICAL-V3-CATALOG-072
--
-- CREATED TABLES:
-- - sports_registry (with SERIAL id)
-- - leagues (sport reference)
-- - segment_types (with SERIAL id)
-- - segment_templates (overtime policy, playoff variants)
-- - provider_registry (with SERIAL id)
-- - outcome_types
-- - market_groups (with hierarchy)
-- - market_types (fully normalized)
-- - provider_team_map (versioned)
-- - provider_player_map (versioned)
-- - provider_market_map (versioned)
-- - provider_event_map (versioned)
--
-- CREATED VIEWS:
-- - view_events_for_form
-- - view_participants_for_event
-- - view_market_types_for_sport
-- - view_provider_offers_current
-- - view_sports_active
-- - view_providers_active
-- - view_segment_templates_for_league
-- - view_market_groups_hierarchy
--
-- INDEXES: 20+ performance indexes
-- ============================================================================
