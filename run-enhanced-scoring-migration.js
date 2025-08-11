const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/smart-form/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runEnhancedScoringMigration() {
  console.log('🚀 RUNNING ENHANCED SCORING COLUMNS MIGRATION');
  console.log('==============================================');
  console.log('📅 Started at:', new Date().toLocaleString());
  console.log('');

  const migrations = [
    {
      name: 'Enhanced Scoring Metrics',
      sql: `ALTER TABLE raw_props 
        ADD COLUMN IF NOT EXISTS trend_confidence NUMERIC,
        ADD COLUMN IF NOT EXISTS edge_score NUMERIC,
        ADD COLUMN IF NOT EXISTS matchup_quality NUMERIC,
        ADD COLUMN IF NOT EXISTS expected_value NUMERIC,
        ADD COLUMN IF NOT EXISTS sharp_money NUMERIC,
        ADD COLUMN IF NOT EXISTS line_movement NUMERIC,
        ADD COLUMN IF NOT EXISTS player_form NUMERIC,
        ADD COLUMN IF NOT EXISTS injury_impact NUMERIC,
        ADD COLUMN IF NOT EXISTS weather_impact NUMERIC,
        ADD COLUMN IF NOT EXISTS market_intelligence NUMERIC,
        ADD COLUMN IF NOT EXISTS volume_profile NUMERIC,
        ADD COLUMN IF NOT EXISTS closing_line_value NUMERIC;`,
    },
    {
      name: 'Professional Capper Features',
      sql: `ALTER TABLE raw_props 
        ADD COLUMN IF NOT EXISTS steam_detected BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS predicted_closing_line NUMERIC,
        ADD COLUMN IF NOT EXISTS optimal_betting_time TEXT,
        ADD COLUMN IF NOT EXISTS best_available_line NUMERIC,
        ADD COLUMN IF NOT EXISTS best_book TEXT,
        ADD COLUMN IF NOT EXISTS public_betting_percentage NUMERIC,
        ADD COLUMN IF NOT EXISTS sharp_betting_percentage NUMERIC,
        ADD COLUMN IF NOT EXISTS contrarian_opportunity BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS injury_timing_advantage NUMERIC,
        ADD COLUMN IF NOT EXISTS cross_market_arbitrage NUMERIC;`,
    },
    {
      name: 'Risk Management Factors',
      sql: `ALTER TABLE raw_props 
        ADD COLUMN IF NOT EXISTS player_fatigue NUMERIC,
        ADD COLUMN IF NOT EXISTS venue_advantage NUMERIC,
        ADD COLUMN IF NOT EXISTS referee_impact NUMERIC,
        ADD COLUMN IF NOT EXISTS pace_impact NUMERIC,
        ADD COLUMN IF NOT EXISTS motivational_factors NUMERIC,
        ADD COLUMN IF NOT EXISTS correlation_risk NUMERIC,
        ADD COLUMN IF NOT EXISTS volatility NUMERIC DEFAULT 5,
        ADD COLUMN IF NOT EXISTS portfolio_impact NUMERIC,
        ADD COLUMN IF NOT EXISTS bid_ask_spread NUMERIC DEFAULT 0.02;`,
    },
    {
      name: 'Data Quality Tracking',
      sql: `ALTER TABLE raw_props 
        ADD COLUMN IF NOT EXISTS data_completeness NUMERIC DEFAULT 0.95,
        ADD COLUMN IF NOT EXISTS outlier_score NUMERIC DEFAULT 0.95,
        ADD COLUMN IF NOT EXISTS consistency_score NUMERIC DEFAULT 0.95,
        ADD COLUMN IF NOT EXISTS data_validation_score NUMERIC DEFAULT 0.95;`,
    },
    {
      name: 'Basic Prop Information',
      sql: `ALTER TABLE raw_props 
        ADD COLUMN IF NOT EXISTS player_name TEXT,
        ADD COLUMN IF NOT EXISTS team TEXT,
        ADD COLUMN IF NOT EXISTS opponent TEXT,
        ADD COLUMN IF NOT EXISTS market TEXT,
        ADD COLUMN IF NOT EXISTS market_type TEXT,
        ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'optimal',
        ADD COLUMN IF NOT EXISTS league TEXT,
        ADD COLUMN IF NOT EXISTS game_date DATE,
        ADD COLUMN IF NOT EXISTS metadata JSONB;`,
    },
    {
      name: 'Odds Consistency Columns',
      sql: `ALTER TABLE raw_props 
        ADD COLUMN IF NOT EXISTS over NUMERIC,
        ADD COLUMN IF NOT EXISTS under NUMERIC;`,
    },
  ];

  let successCount = 0;
  let errorCount = 0;

  // Run column additions
  for (const migration of migrations) {
    try {
      console.log(`📋 ${migration.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });

      if (error) {
        console.log(`❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Success`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
      errorCount++;
    }
  }

  // Copy existing odds data
  console.log('');
  console.log('📋 Copying Existing Odds Data...');
  try {
    const { error: copyError1 } = await supabase.rpc('exec_sql', {
      sql: `UPDATE raw_props SET over = over_odds WHERE over IS NULL AND over_odds IS NOT NULL;`,
    });

    const { error: copyError2 } = await supabase.rpc('exec_sql', {
      sql: `UPDATE raw_props SET under = under_odds WHERE under IS NULL AND under_odds IS NOT NULL;`,
    });

    if (copyError1 || copyError2) {
      console.log(`❌ Error copying odds data`);
      errorCount++;
    } else {
      console.log(`✅ Odds data copied successfully`);
      successCount++;
    }
  } catch (err) {
    console.log(`❌ Exception copying odds: ${err.message}`);
    errorCount++;
  }

  console.log('');
  console.log('🏗️ CREATING NEW TABLES');
  console.log('=======================');

  const tables = [
    {
      name: 'Grading Results Table',
      sql: `CREATE TABLE IF NOT EXISTS grading_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
        final_score NUMERIC NOT NULL,
        confidence NUMERIC NOT NULL,
        tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')) NOT NULL,
        edge_score NUMERIC,
        kelly_fraction NUMERIC,
        position_size NUMERIC,
        risk_score NUMERIC,
        feature_contributions JSONB,
        model_contributions JSONB,
        scenario_analysis JSONB,
        professional_insights JSONB,
        enhanced_capper_analysis JSONB,
        data_quality NUMERIC DEFAULT 0.95,
        model_agreement NUMERIC,
        historical_accuracy NUMERIC,
        model_version TEXT,
        config_used TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
    },
    {
      name: 'Capper Profiles Table',
      sql: `CREATE TABLE IF NOT EXISTS capper_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        discord_id TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus')) DEFAULT 'bronze',
        total_picks INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        pushes INTEGER DEFAULT 0,
        win_rate NUMERIC GENERATED ALWAYS AS (
          CASE WHEN (wins + losses) > 0 
          THEN ROUND(wins::NUMERIC / (wins + losses), 4)
          ELSE 0 END
        ) STORED,
        roi NUMERIC DEFAULT 0,
        units_won NUMERIC DEFAULT 0,
        streak_current INTEGER DEFAULT 0,
        streak_type TEXT CHECK (streak_type IN ('win', 'loss', 'none')) DEFAULT 'none',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
    },
    {
      name: 'ML Features Table',
      sql: `CREATE TABLE IF NOT EXISTS ml_features (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
        neural_network_score NUMERIC,
        gradient_boosting_score NUMERIC,
        random_forest_score NUMERIC,
        ensemble_score NUMERIC,
        model_agreement NUMERIC,
        feature_weights JSONB,
        similar_props_performance JSONB,
        player_historical_performance JSONB,
        model_version TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`,
    },
    {
      name: 'Settlement Tracking Table',
      sql: `CREATE TABLE IF NOT EXISTS settlement_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pick_id UUID REFERENCES final_picks(id) ON DELETE CASCADE,
        game_id UUID REFERENCES games(id),
        settlement_source TEXT NOT NULL,
        original_line NUMERIC NOT NULL,
        actual_result NUMERIC,
        settlement_status TEXT CHECK (settlement_status IN ('pending', 'settled', 'void', 'disputed')) DEFAULT 'pending',
        game_completed_at TIMESTAMPTZ,
        settlement_attempted_at TIMESTAMPTZ,
        settled_at TIMESTAMPTZ,
        settlement_errors JSONB,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
    },
  ];

  for (const table of tables) {
    try {
      console.log(`📋 ${table.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });

      if (error) {
        console.log(`❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Success`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('📊 RUNNING VALIDATION QUERIES');
  console.log('==============================');

  try {
    const { data: propsCount } = await supabase.from('raw_props').select('id', { count: 'exact' });

    console.log(`📊 Total props in database: ${propsCount?.length || 0}`);

    // Check if new columns exist
    const { data: sampleProp } = await supabase
      .from('raw_props')
      .select('id, edge_score, expected_value, trend_confidence')
      .limit(1)
      .single();

    if (sampleProp) {
      console.log('✅ New scoring columns are accessible');
    }
  } catch (err) {
    console.log('⚠️ Validation query failed:', err.message);
  }

  console.log('');
  console.log('🏆 MIGRATION SUMMARY');
  console.log('====================');
  console.log(`✅ Successful operations: ${successCount}`);
  console.log(`❌ Failed operations: ${errorCount}`);
  console.log(`📅 Completed at: ${new Date().toLocaleString()}`);

  if (errorCount === 0) {
    console.log('');
    console.log('🎉 ENHANCED SCORING MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('✅ Your database now has professional-grade scoring capabilities');
    console.log('✅ ML features and capper analytics are ready');
    console.log('✅ Advanced risk management columns added');
    console.log('✅ Performance optimization ready');
  } else {
    console.log('');
    console.log('⚠️ Migration completed with some errors');
    console.log('🔧 Please review the error messages above');
  }
}

runEnhancedScoringMigration().catch(console.error);
