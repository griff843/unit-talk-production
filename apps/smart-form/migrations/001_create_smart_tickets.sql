--MMigration: Create smart_tickets table for Unit Talk Smart Form
-- This migration creates the complete table structure for smart form submissions

-- Create the smart_tickets table
CREATE TABLE IF NOT EXISTS public.smart_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Step 1: Essential Information
    bet_slip_id TEXT UNIQUE NOT NULL,
    capper TEXT NOT NULL,
    ticket_type TEXT NOT NULL CHECK (ticket_type IN ('single', 'parlay', 'teaser', 'round_robin')),
    sport TEXT NOT NULL,
    game_date DATE NOT NULL,
    user_tier TEXT NOT NULL CHECK (user_tier IN ('free', 'vip', 'vip_plus')),
    
    -- Step 2: Configuration
    unit_size DECIMAL(3,1) NOT NULL CHECK (unit_size >= 0.5 AND unit_size <= 5.0),
    odds_format TEXT NOT NULL CHECK (odds_format IN ('AMERICAN', 'DECIMAL', 'FRACTIONAL')),
    auto_parlay BOOLEAN DEFAULT true,
    confidence_level INTEGER NOT NULL CHECK (confidence_level >= 1 AND confidence_level <= 10),
    
    -- Step 3: Bet Details
    bet_type TEXT NOT NULL,
    market_type TEXT NOT NULL CHECK (market_type IN ('pre_game', 'live', 'player_prop', 'team_prop', 'game_prop', 'futures')),
    
    -- Step 4: Game Selections (JSONB for flexibility)
    game_selections JSONB NOT NULL DEFAULT '[]',
    legs JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    
    -- Status and tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'processing', 'completed', 'error')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    timezone TEXT DEFAULT 'UTC',
    current_step INTEGER DEFAULT 1,
    completed_steps INTEGER[] DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Processing metadata
    processing_id TEXT,
    error_message TEXT,
    submission_metadata JSONB DEFAULT '{}'
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_smart_tickets_capper ON public.smart_tickets(capper);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_sport ON public.smart_tickets(sport);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_game_date ON public.smart_tickets(game_date);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_status ON public.smart_tickets(status);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_bet_slip_id ON public.smart_tickets(bet_slip_id);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_created_at ON public.smart_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_user_tier ON public.smart_tickets(user_tier);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_smart_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_smart_tickets_updated_at_trigger
    BEFORE UPDATE ON public.smart_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_smart_tickets_updated_at();

-- Create webhook notification trigger (for SmartFormBridge)
CREATE OR REPLACE FUNCTION notify_smart_ticket_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'submitted' THEN
        PERFORM pg_notify('smart_ticket_inserted', json_build_object(
            'id', NEW.id,
            'capper', NEW.capper,
            'ticket_type', NEW.ticket_type,
            'sport', NEW.sport,
            'game_date', NEW.game_date
        )::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_smart_ticket_insert_trigger
    AFTER INSERT OR UPDATE OF status ON public.smart_tickets
    FOR EACH ROW
    WHEN (NEW.status = 'submitted')
    EXECUTE FUNCTION notify_smart_ticket_insert();

-- Insert sample data for testing
INSERT INTO public.smart_tickets (
    bet_slip_id,
    capper,
    ticket_type,
    sport,
    game_date,
    user_tier,
    unit_size,
    odds_format,
    confidence_level,
    bet_type,
    market_type,
    game_selections,
    legs,
    notes,
    status
) VALUES (
    'test-001',
    'Griff843',
    'single',
    'NFL',
    '2024-12-20',
    'vip_plus',
    2.5,
    'AMERICAN',
    8,
    'spread',
    'pre_game',
    '[{"team": "Chiefs", "line": "-3.5", "odds": -110}]'::jsonb,
    '[]'::jsonb,
    'Testing the smart form integration',
    'submitted'
) ON CONFLICT (bet_slip_id) DO NOTHING;

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'smart_tickets'
ORDER BY ordinal_position;