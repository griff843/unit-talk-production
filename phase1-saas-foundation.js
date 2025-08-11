const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/smart-form/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function phase1_CreateSaaSFoundation() {
  console.log('🏗️ PHASE 1: CREATING SAAS FOUNDATION');
  console.log('=====================================');
  console.log('⏰ Started at:', new Date().toLocaleString());
  console.log('');

  try {
    // Step 1: Create unified users table
    console.log('1️⃣ Creating unified users table...');
    const usersSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Identity
        discord_id TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT,
        email TEXT,
        
        -- Subscription & Tier
        tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus')),
        subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'trial', 'suspended')),
        subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'vip', 'enterprise')),
        subscription_expires_at TIMESTAMPTZ,
        
        -- Capper-specific fields
        is_capper BOOLEAN DEFAULT FALSE,
        capper_status TEXT DEFAULT 'inactive' CHECK (capper_status IN ('active', 'inactive', 'suspended', 'pending')),
        capper_tier TEXT,
        roles JSONB DEFAULT '["user"]',
        
        -- Performance Metrics
        total_picks INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        pushes INTEGER DEFAULT 0,
        win_rate NUMERIC DEFAULT 0,
        roi NUMERIC DEFAULT 0,
        units_won NUMERIC DEFAULT 0,
        
        -- Streaks
        streak_current INTEGER DEFAULT 0,
        streak_type TEXT CHECK (streak_type IN ('win', 'loss', 'none')) DEFAULT 'none',
        streak_best INTEGER DEFAULT 0,
        
        -- Timestamps
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_active TIMESTAMPTZ DEFAULT NOW(),
        
        -- Preferences & Settings
        timezone TEXT DEFAULT 'UTC',
        language TEXT DEFAULT 'en',
        notification_preferences JSONB DEFAULT '{}',
        privacy_settings JSONB DEFAULT '{}',
        
        -- Metadata
        metadata JSONB DEFAULT '{}',
        
        -- Soft delete
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      );
    `;

    const { error: usersError } = await supabase.rpc('exec_sql', { sql: usersSQL });
    if (usersError) throw usersError;
    console.log('   ✅ Users table created successfully');

    // Step 2: Create unified picks table
    console.log('2️⃣ Creating unified picks table...');
    const picksSQL = `
      CREATE TABLE IF NOT EXISTS unified_picks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Relationships
        user_id UUID NOT NULL,
        prop_id UUID,
        game_id UUID,
        
        -- Pick Details
        pick_type TEXT NOT NULL CHECK (pick_type IN ('single', 'parlay', 'system', 'teaser')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'void', 'cancelled')),
        
        -- Betting Information
        selection TEXT NOT NULL,
        line NUMERIC,
        odds NUMERIC NOT NULL,
        stake NUMERIC NOT NULL,
        potential_payout NUMERIC NOT NULL,
        actual_payout NUMERIC DEFAULT 0,
        profit_loss NUMERIC DEFAULT 0,
        
        -- Analysis & Confidence
        confidence INTEGER CHECK (confidence BETWEEN 1 AND 10),
        analysis TEXT,
        reasoning TEXT,
        tier_when_placed TEXT,
        
        -- Workflow Management
        pick_source TEXT NOT NULL DEFAULT 'manual' CHECK (pick_source IN ('manual', 'promoted', 'imported', 'system')),
        workflow_stage TEXT DEFAULT 'draft' CHECK (workflow_stage IN ('draft', 'pending_review', 'approved', 'published', 'settled')),
        promotion_status TEXT DEFAULT 'not_promoted' CHECK (promotion_status IN ('not_promoted', 'queued', 'promoted', 'failed')),
        promotion_data JSONB,
        
        -- Timing
        placed_at TIMESTAMPTZ DEFAULT NOW(),
        settled_at TIMESTAMPTZ,
        game_start_time TIMESTAMPTZ,
        
        -- Settlement
        settlement_source TEXT,
        settlement_details JSONB,
        actual_result NUMERIC,
        
        -- Parlay Support
        parlay_id UUID,
        parlay_leg_number INTEGER,
        parlay_total_legs INTEGER,
        parlay_total_odds NUMERIC,
        parlay_stake_allocation NUMERIC,
        
        -- Discord Integration
        discord_thread_id TEXT,
        discord_message_id TEXT,
        
        -- Tracking
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        -- Metadata
        metadata JSONB DEFAULT '{}',
        
        -- Audit
        created_by UUID,
        updated_by UUID
      );
    `;

    const { error: picksError } = await supabase.rpc('exec_sql', { sql: picksSQL });
    if (picksError) throw picksError;
    console.log('   ✅ Unified picks table created successfully');

    // Step 3: Create parlay tickets table
    console.log('3️⃣ Creating parlay tickets table...');
    const parlaySQL = `
      CREATE TABLE IF NOT EXISTS parlay_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        parlay_type TEXT NOT NULL CHECK (parlay_type IN ('parlay', 'teaser', 'round_robin', 'system')),
        total_legs INTEGER NOT NULL,
        legs_needed_to_win INTEGER DEFAULT NULL,
        total_odds NUMERIC NOT NULL,
        total_stake NUMERIC NOT NULL,
        potential_payout NUMERIC NOT NULL,
        actual_payout NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'partial')),
        legs_won INTEGER DEFAULT 0,
        legs_lost INTEGER DEFAULT 0,
        legs_pushed INTEGER DEFAULT 0,
        legs_pending INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        settled_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'
      );
    `;

    const { error: parlayError } = await supabase.rpc('exec_sql', { sql: parlaySQL });
    if (parlayError) throw parlayError;
    console.log('   ✅ Parlay tickets table created successfully');

    // Step 4: Create performance indexes
    console.log('4️⃣ Creating performance indexes...');
    const indexesSQL = `
      -- Users indexes
      CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
      CREATE INDEX IF NOT EXISTS idx_users_tier_status ON users(tier, subscription_status);
      CREATE INDEX IF NOT EXISTS idx_users_capper ON users(is_capper) WHERE is_capper = TRUE;
      CREATE INDEX IF NOT EXISTS idx_users_performance ON users(win_rate DESC, roi DESC);
      
      -- Unified picks indexes
      CREATE INDEX IF NOT EXISTS idx_unified_picks_user_status ON unified_picks(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_unified_picks_placed_at ON unified_picks(placed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_unified_picks_game_id ON unified_picks(game_id);
      CREATE INDEX IF NOT EXISTS idx_unified_picks_prop_id ON unified_picks(prop_id);
      CREATE INDEX IF NOT EXISTS idx_unified_picks_parlay ON unified_picks(parlay_id) WHERE parlay_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_unified_picks_workflow ON unified_picks(workflow_stage, promotion_status);
      
      -- Parlay tickets indexes
      CREATE INDEX IF NOT EXISTS idx_parlay_tickets_user_id ON parlay_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_parlay_tickets_status ON parlay_tickets(status);
    `;

    const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexesSQL });
    if (indexError) throw indexError;
    console.log('   ✅ Performance indexes created successfully');

    // Step 5: Create update triggers
    console.log('5️⃣ Creating automated triggers...');
    const triggersSQL = `
      -- Update timestamp function
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Apply triggers
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
      DROP TRIGGER IF EXISTS update_unified_picks_updated_at ON unified_picks;
      CREATE TRIGGER update_unified_picks_updated_at 
        BEFORE UPDATE ON unified_picks 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    const { error: triggerError } = await supabase.rpc('exec_sql', { sql: triggersSQL });
    if (triggerError) throw triggerError;
    console.log('   ✅ Automated triggers created successfully');

    console.log('');
    console.log('🎉 PHASE 1 COMPLETE!');
    console.log('==================');
    console.log('✅ Core SaaS tables created');
    console.log('✅ Performance indexes added');
    console.log('✅ Automated triggers enabled');
    console.log('✅ Ready for data migration');
    console.log('');
    console.log('⏰ Phase 1 completed at:', new Date().toLocaleString());
  } catch (error) {
    console.error('❌ Phase 1 failed:', error);
    throw error;
  }
}

phase1_CreateSaaSFoundation().catch(console.error);
