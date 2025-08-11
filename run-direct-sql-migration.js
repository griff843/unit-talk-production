const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/smart-form/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runDirectSQLMigration() {
  console.log('🚀 RUNNING ENHANCED SCORING MIGRATION (Direct SQL)');
  console.log('==================================================');
  console.log('📅 Started at:', new Date().toLocaleString());
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  // Since we can't use exec_sql, let's add columns by checking if they exist first
  console.log('📋 Adding Enhanced Scoring Columns...');
  
  const columnsToAdd = [
    'trend_confidence',
    'edge_score', 
    'matchup_quality',
    'expected_value',
    'sharp_money',
    'line_movement',
    'player_form',
    'injury_impact',
    'weather_impact',
    'market_intelligence',
    'volume_profile',
    'closing_line_value',
    'steam_detected',
    'predicted_closing_line',
    'optimal_betting_time',
    'best_available_line',
    'best_book',
    'public_betting_percentage',
    'sharp_betting_percentage',
    'contrarian_opportunity',
    'injury_timing_advantage',
    'cross_market_arbitrage',
    'player_fatigue',
    'venue_advantage',
    'referee_impact',
    'pace_impact',
    'motivational_factors',
    'correlation_risk',
    'volatility',
    'portfolio_impact',
    'bid_ask_spread',
    'data_completeness',
    'outlier_score',
    'consistency_score',
    'data_validation_score',
    'player_name',
    'team',
    'opponent',
    'market',
    'market_type',
    'source',
    'league',
    'game_date',
    'metadata',
    'over',
    'under'
  ];

  // Check existing columns
  console.log('🔍 Checking existing table structure...');
  
  try {
    const { data: existingProps } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);
      
    if (existingProps && existingProps.length > 0) {
      const existingColumns = Object.keys(existingProps[0]);
      const missingColumns = columnsToAdd.filter(col => !existingColumns.includes(col));
      
      console.log(`✅ Found ${existingColumns.length} existing columns`);
      console.log(`📊 Need to add ${missingColumns.length} new columns`);
      
      if (missingColumns.length > 0) {
        console.log('⚠️ Missing columns:', missingColumns.slice(0, 10).join(', '), missingColumns.length > 10 ? '...' : '');
        console.log('');
        console.log('🔧 MANUAL MIGRATION REQUIRED');
        console.log('============================');
        console.log('The following SQL needs to be run in Supabase SQL Editor:');
        console.log('');
        
        // Generate the SQL for manual execution
        console.log('-- Enhanced Scoring Columns Migration');
        console.log('-- Run this in Supabase SQL Editor');
        console.log('');
        
        console.log('-- Add enhanced scoring metrics');
        console.log('ALTER TABLE raw_props');
        console.log('  ADD COLUMN IF NOT EXISTS trend_confidence NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS edge_score NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS matchup_quality NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS expected_value NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS sharp_money NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS line_movement NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS player_form NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS injury_impact NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS weather_impact NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS market_intelligence NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS volume_profile NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS closing_line_value NUMERIC;');
        console.log('');
        
        console.log('-- Add professional capper features');
        console.log('ALTER TABLE raw_props');
        console.log('  ADD COLUMN IF NOT EXISTS steam_detected BOOLEAN DEFAULT FALSE,');
        console.log('  ADD COLUMN IF NOT EXISTS predicted_closing_line NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS optimal_betting_time TEXT,');
        console.log('  ADD COLUMN IF NOT EXISTS best_available_line NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS best_book TEXT,');
        console.log('  ADD COLUMN IF NOT EXISTS public_betting_percentage NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS sharp_betting_percentage NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS contrarian_opportunity BOOLEAN DEFAULT FALSE,');
        console.log('  ADD COLUMN IF NOT EXISTS injury_timing_advantage NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS cross_market_arbitrage NUMERIC;');
        console.log('');
        
        console.log('-- Add risk management factors');
        console.log('ALTER TABLE raw_props');
        console.log('  ADD COLUMN IF NOT EXISTS player_fatigue NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS venue_advantage NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS referee_impact NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS pace_impact NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS motivational_factors NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS correlation_risk NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS volatility NUMERIC DEFAULT 5,');
        console.log('  ADD COLUMN IF NOT EXISTS portfolio_impact NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS bid_ask_spread NUMERIC DEFAULT 0.02;');
        console.log('');
        
        console.log('-- Add data quality tracking');
        console.log('ALTER TABLE raw_props');
        console.log('  ADD COLUMN IF NOT EXISTS data_completeness NUMERIC DEFAULT 0.95,');
        console.log('  ADD COLUMN IF NOT EXISTS outlier_score NUMERIC DEFAULT 0.95,');
        console.log('  ADD COLUMN IF NOT EXISTS consistency_score NUMERIC DEFAULT 0.95,');
        console.log('  ADD COLUMN IF NOT EXISTS data_validation_score NUMERIC DEFAULT 0.95;');
        console.log('');
        
        console.log('-- Add basic prop information');
        console.log('ALTER TABLE raw_props');
        console.log('  ADD COLUMN IF NOT EXISTS player_name TEXT,');
        console.log('  ADD COLUMN IF NOT EXISTS team TEXT,');
        console.log('  ADD COLUMN IF NOT EXISTS opponent TEXT,');
        console.log('  ADD COLUMN IF NOT EXISTS market TEXT,');
        console.log('  ADD COLUMN IF NOT EXISTS market_type TEXT,');
        console.log('  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT \\'optimal\\',');
        console.log('  ADD COLUMN IF NOT EXISTS league TEXT,');
        console.log('  ADD COLUMN IF NOT EXISTS game_date DATE,');
        console.log('  ADD COLUMN IF NOT EXISTS metadata JSONB;');
        console.log('');
        
        console.log('-- Add odds consistency columns');
        console.log('ALTER TABLE raw_props');
        console.log('  ADD COLUMN IF NOT EXISTS over NUMERIC,');
        console.log('  ADD COLUMN IF NOT EXISTS under NUMERIC;');
        console.log('');
        
        console.log('-- Copy existing odds data');
        console.log('UPDATE raw_props SET over = over_odds WHERE over IS NULL AND over_odds IS NOT NULL;');
        console.log('UPDATE raw_props SET under = under_odds WHERE under IS NULL AND under_odds IS NOT NULL;');
        console.log('');
        
        errorCount++;
      } else {
        console.log('✅ All enhanced scoring columns already exist!');
        successCount++;
      }
    }
  } catch (err) {
    console.log('❌ Error checking table structure:', err.message);
    errorCount++;
  }

  // Test if we can create new tables (these might work)
  console.log('');
  console.log('🏗️ TESTING NEW TABLE CREATION');
  console.log('==============================');

  try {
    // Test creating a simple table to see if we have permissions
    const { error: testError } = await supabase
      .from('test_migration_table')
      .select('*')
      .limit(1);
      
    if (testError && testError.message.includes('does not exist')) {
      console.log('⚠️ Cannot create tables via client - SQL Editor required');
      console.log('');
      console.log('📋 ADDITIONAL TABLES TO CREATE IN SQL EDITOR:');
      console.log('');
      
      console.log('-- Grading Results Table');
      console.log('CREATE TABLE IF NOT EXISTS grading_results (');
      console.log('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
      console.log('  prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,');
      console.log('  final_score NUMERIC NOT NULL,');
      console.log('  confidence NUMERIC NOT NULL,');
      console.log('  tier TEXT CHECK (tier IN (\\'S\\', \\'A\\', \\'B\\', \\'C\\', \\'D\\')) NOT NULL,');
      console.log('  edge_score NUMERIC,');
      console.log('  kelly_fraction NUMERIC,');
      console.log('  position_size NUMERIC,');
      console.log('  risk_score NUMERIC,');
      console.log('  feature_contributions JSONB,');
      console.log('  model_contributions JSONB,');
      console.log('  scenario_analysis JSONB,');
      console.log('  professional_insights JSONB,');
      console.log('  enhanced_capper_analysis JSONB,');
      console.log('  data_quality NUMERIC DEFAULT 0.95,');
      console.log('  model_agreement NUMERIC,');
      console.log('  historical_accuracy NUMERIC,');
      console.log('  model_version TEXT,');
      console.log('  config_used TEXT,');
      console.log('  created_at TIMESTAMPTZ DEFAULT NOW(),');
      console.log('  updated_at TIMESTAMPTZ DEFAULT NOW()');
      console.log(');');
      console.log('');
      
      errorCount++;
    }
  } catch (err) {
    console.log('❌ Error testing table creation:', err.message);
    errorCount++;
  }

  console.log('');
  console.log('📊 CURRENT DATABASE STATUS');
  console.log('==========================');

  try {
    const { data: propsCount } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' });
      
    console.log(`📊 Total props in database: ${propsCount?.length || 0}`);
    
    const { data: gamesCount } = await supabase
      .from('games')
      .select('id', { count: 'exact' });
      
    console.log(`🎮 Total games in database: ${gamesCount?.length || 0}`);
    
    const { data: picksCount } = await supabase
      .from('final_picks')
      .select('id', { count: 'exact' });
      
    console.log(`🎯 Total picks in database: ${picksCount?.length || 0}`);
    
    successCount++;
    
  } catch (err) {
    console.log('⚠️ Error checking database status:', err.message);
    errorCount++;
  }

  console.log('');
  console.log('🏆 MIGRATION SUMMARY');
  console.log('====================');
  console.log(`✅ Successful operations: ${successCount}`);
  console.log(`❌ Operations requiring manual SQL: ${errorCount}`);
  console.log(`📅 Completed at: ${new Date().toLocaleString()}`);

  console.log('');
  console.log('📋 NEXT STEPS:');
  console.log('==============');
  console.log('1. Copy the SQL statements above');
  console.log('2. Go to Supabase Dashboard > SQL Editor');
  console.log('3. Paste and run the SQL statements');
  console.log('4. Your database will have professional-grade scoring capabilities');
  console.log('');
  console.log('🎯 This will add:');
  console.log('✅ 45+ advanced scoring columns');
  console.log('✅ ML features and analytics');
  console.log('✅ Professional capper tools');
  console.log('✅ Risk management metrics');
  console.log('✅ Data quality tracking');
}

runDirectSQLMigration().catch(console.error);
