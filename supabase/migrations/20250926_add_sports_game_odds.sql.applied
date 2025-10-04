-- Migration: Add sports_game_odds table
-- Date: 2025-09-26
-- Description: Creates the sports_game_odds table with proper schema for game and betting market data

-- Create the sports_game_odds table
CREATE TABLE IF NOT EXISTS public.sports_game_odds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    game_id TEXT NOT NULL,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    game_date TIMESTAMPTZ NOT NULL,
    markets JSONB NOT NULL DEFAULT '{}'::jsonb,
    players JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sports_game_odds_game_id ON public.sports_game_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_sports_game_odds_sport ON public.sports_game_odds(sport);
CREATE INDEX IF NOT EXISTS idx_sports_game_odds_league ON public.sports_game_odds(league);
CREATE INDEX IF NOT EXISTS idx_sports_game_odds_game_date ON public.sports_game_odds(game_date);
CREATE INDEX IF NOT EXISTS idx_sports_game_odds_teams ON public.sports_game_odds(home_team, away_team);
CREATE INDEX IF NOT EXISTS idx_sports_game_odds_created_at ON public.sports_game_odds(created_at);

-- Add unique constraint on game_id to prevent duplicates
ALTER TABLE public.sports_game_odds
ADD CONSTRAINT unique_sports_game_odds_game_id
UNIQUE (game_id)
DEFERRABLE INITIALLY DEFERRED;

-- Add updated_at trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_sports_game_odds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sports_game_odds_updated_at
    BEFORE UPDATE ON public.sports_game_odds
    FOR EACH ROW
    EXECUTE FUNCTION update_sports_game_odds_updated_at();

-- RLS Policies
ALTER TABLE public.sports_game_odds ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
CREATE POLICY "service_role_all_sports_game_odds" ON public.sports_game_odds
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "authenticated_read_sports_game_odds" ON public.sports_game_odds
    FOR SELECT TO authenticated
    USING (true);

-- Allow anon users to read (for public data access)
CREATE POLICY "anon_read_sports_game_odds" ON public.sports_game_odds
    FOR SELECT TO anon
    USING (true);

-- Grants for proper access
GRANT ALL ON public.sports_game_odds TO service_role;
GRANT SELECT ON public.sports_game_odds TO authenticated;
GRANT SELECT ON public.sports_game_odds TO anon;

-- Insert a seed row for NFL to support joins and testing
-- Guarded to prevent duplicate insertions
INSERT INTO public.sports_game_odds (
    game_id,
    sport,
    league,
    home_team,
    away_team,
    game_date,
    markets,
    players,
    metadata
)
SELECT
    'nfl_seed_game_20250926',
    'NFL',
    'NFL',
    'Kansas City Chiefs',
    'Buffalo Bills',
    '2025-09-26 20:00:00+00'::timestamptz,
    '{"spread": {"home": -3.5, "away": 3.5}, "total": {"over": 47.5, "under": 47.5}}'::jsonb,
    '{"passing_yards": {"mahomes": {"line": 265.5, "over": -110, "under": -110}}, "rushing_yards": {"allen": {"line": 45.5, "over": -110, "under": -110}}}'::jsonb,
    '{"provider": "seed_data", "version": "1.0", "created_for": "testing"}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM public.sports_game_odds WHERE game_id = 'nfl_seed_game_20250926'
);

-- Add comment for documentation
COMMENT ON TABLE public.sports_game_odds IS 'Sports game odds and betting market data from various providers';
COMMENT ON COLUMN public.sports_game_odds.game_id IS 'Unique identifier for the game across all providers';
COMMENT ON COLUMN public.sports_game_odds.markets IS 'Available betting markets (spread, total, moneyline, etc.)';
COMMENT ON COLUMN public.sports_game_odds.players IS 'Player prop markets and odds';
COMMENT ON COLUMN public.sports_game_odds.metadata IS 'Additional provider-specific metadata and configurations';