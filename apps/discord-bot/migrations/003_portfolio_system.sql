-- Create picks table
CREATE TABLE IF NOT EXISTS picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    sport TEXT NOT NULL,
    pick_type TEXT NOT NULL,
    team_name TEXT NOT NULL,
    odds DECIMAL NOT NULL,
    units DECIMAL NOT NULL,
    confidence INTEGER CHECK (confidence >= 1 AND confidence <= 10),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'pushed', 'cancelled')),
    result_type TEXT,
    profit_loss DECIMAL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user_profiles
        FOREIGN KEY(user_id)
        REFERENCES user_profiles(discord_id)
        ON DELETE CASCADE
);

-- Create pick_analytics table for aggregated stats
CREATE TABLE IF NOT EXISTS pick_analytics (
    user_id TEXT PRIMARY KEY,
    total_picks INTEGER DEFAULT 0,
    won_picks INTEGER DEFAULT 0,
    lost_picks INTEGER DEFAULT 0,
    pushed_picks INTEGER DEFAULT 0,
    total_units_risked DECIMAL DEFAULT 0,
    total_units_won DECIMAL DEFAULT 0,
    total_units_lost DECIMAL DEFAULT 0,
    roi DECIMAL DEFAULT 0,
    win_rate DECIMAL DEFAULT 0,
    average_odds DECIMAL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user_profiles
        FOREIGN KEY(user_id)
        REFERENCES user_profiles(discord_id)
        ON DELETE CASCADE
);

-- Create pick_trends table for tracking performance patterns
CREATE TABLE IF NOT EXISTS pick_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    sport TEXT NOT NULL,
    time_period TEXT NOT NULL,
    win_rate DECIMAL DEFAULT 0,
    roi DECIMAL DEFAULT 0,
    units_per_play DECIMAL DEFAULT 0,
    favorite_pick_type TEXT,
    best_sport TEXT,
    worst_sport TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user_profiles
        FOREIGN KEY(user_id)
        REFERENCES user_profiles(discord_id)
        ON DELETE CASCADE
);

-- Create functions and triggers for analytics
CREATE OR REPLACE FUNCTION update_pick_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update pick_analytics when a pick is added or status changes
    INSERT INTO pick_analytics (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO UPDATE
    SET
        total_picks = (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id),
        won_picks = (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status = 'won'),
        lost_picks = (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status = 'lost'),
        pushed_picks = (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status = 'pushed'),
        total_units_risked = (SELECT COALESCE(SUM(units), 0) FROM picks WHERE user_id = NEW.user_id),
        total_units_won = (SELECT COALESCE(SUM(CASE WHEN status = 'won' THEN profit_loss ELSE 0 END), 0) FROM picks WHERE user_id = NEW.user_id),
        total_units_lost = (SELECT COALESCE(SUM(CASE WHEN status = 'lost' THEN units ELSE 0 END), 0) FROM picks WHERE user_id = NEW.user_id),
        roi = CASE 
            WHEN (SELECT COALESCE(SUM(units), 0) FROM picks WHERE user_id = NEW.user_id) > 0 
            THEN ((SELECT COALESCE(SUM(profit_loss), 0) FROM picks WHERE user_id = NEW.user_id) / 
                  (SELECT COALESCE(SUM(units), 0) FROM picks WHERE user_id = NEW.user_id)) * 100
            ELSE 0
        END,
        win_rate = CASE 
            WHEN (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status IN ('won', 'lost')) > 0 
            THEN ((SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status = 'won')::DECIMAL / 
                  (SELECT COUNT(*) FROM picks WHERE user_id = NEW.user_id AND status IN ('won', 'lost'))) * 100
            ELSE 0
        END,
        average_odds = (SELECT AVG(odds) FROM picks WHERE user_id = NEW.user_id),
        last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER picks_analytics_trigger
AFTER INSERT OR UPDATE ON picks
FOR EACH ROW
EXECUTE FUNCTION update_pick_analytics();

-- Create indexes for performance
CREATE INDEX idx_picks_user_id ON picks(user_id);
CREATE INDEX idx_picks_sport ON picks(sport);
CREATE INDEX idx_picks_status ON picks(status);
CREATE INDEX idx_picks_created_at ON picks(created_at);

-- Create view for quick stats access
CREATE OR REPLACE VIEW user_pick_stats AS
SELECT 
    u.discord_id,
    u.username,
    u.membership_tier,
    COALESCE(pa.total_picks, 0) as total_picks,
    COALESCE(pa.won_picks, 0) as won_picks,
    COALESCE(pa.lost_picks, 0) as lost_picks,
    COALESCE(pa.pushed_picks, 0) as pushed_picks,
    COALESCE(pa.roi, 0) as roi,
    COALESCE(pa.win_rate, 0) as win_rate,
    COALESCE(pa.total_units_won - pa.total_units_lost, 0) as net_units
FROM 
    user_profiles u
LEFT JOIN 
    pick_analytics pa ON u.discord_id = pa.user_id
WHERE 
    u.membership_tier IN ('vip_plus', 'black_label', 'admin', 'owner'); 