/**
 * Create Professional System Database Tables
 * 
 * Creates the missing professional betting system tables:
 * - clv_tracking: CLV (Closing Line Value) tracking
 * - processing_logs: System processing logs and summaries
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string
);

async function createProfessionalTables() {
  console.log('🛠️ Creating Professional System Database Tables...\n');
  
  try {
    // Create CLV Tracking table
    console.log('📊 Creating CLV Tracking table...');
    const supabaseClient = requireSupabase();
      const { error: clvError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS clv_tracking (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          
          -- Core identifiers
          propId TEXT NOT NULL,
          userId TEXT,
          sport TEXT NOT NULL,
          market TEXT NOT NULL,
          book TEXT NOT NULL,
          
          -- Line data
          openingLine DECIMAL,
          openingOdds INTEGER,
          betLine DECIMAL NOT NULL,
          betOdds INTEGER NOT NULL,
          closingLine DECIMAL,
          closingOdds INTEGER,
          
          -- Timing
          openingTime TIMESTAMPTZ,
          betTime TIMESTAMPTZ DEFAULT NOW(),
          closingTime TIMESTAMPTZ,
          gameTime TIMESTAMPTZ,
          
          -- CLV metrics
          clv DECIMAL DEFAULT 0,
          clvPercentage DECIMAL DEFAULT 0,
          beatsClosing BOOLEAN DEFAULT FALSE,
          
          -- Additional context
          modelEdge DECIMAL DEFAULT 0,
          actualResult BOOLEAN,
          profit DECIMAL,
          
          -- Devigged metrics
          deviggedOpeningProb DECIMAL,
          deviggedClosingProb DECIMAL,
          deviggedCLV DECIMAL,
          
          -- Metadata
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_clv_tracking_propid ON clv_tracking(propId);
        CREATE INDEX IF NOT EXISTS idx_clv_tracking_userid ON clv_tracking(userId);
        CREATE INDEX IF NOT EXISTS idx_clv_tracking_sport ON clv_tracking(sport);
        CREATE INDEX IF NOT EXISTS idx_clv_tracking_bettime ON clv_tracking(betTime);
      `
    });
    
    if (clvError) {
      console.error('❌ CLV Tracking table creation failed:', clvError);
    } else {
      console.log('✅ CLV Tracking table created successfully');
    }
    
    // Create Processing Logs table
    console.log('📋 Creating Processing Logs table...');
    const supabaseClient = requireSupabase();
      const { error: logsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS processing_logs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          
          -- Processing info
          processor TEXT NOT NULL,
          summary JSONB,
          
          -- Timing
          processed_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Metadata
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_processing_logs_processor ON processing_logs(processor);
        CREATE INDEX IF NOT EXISTS idx_processing_logs_processed_at ON processing_logs(processed_at);
      `
    });
    
    if (logsError) {
      console.error('❌ Processing Logs table creation failed:', logsError);
    } else {
      console.log('✅ Processing Logs table created successfully');
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    
    const supabaseClient = requireSupabase();
      const { data: clvData, error: clvCheckError } = await supabase
      .from('clv_tracking')
      .select('*')
      .limit(1);
    
    const supabaseClient = requireSupabase();
      const { data: logsData, error: logsCheckError } = await supabase
      .from('processing_logs')
      .select('*')
      .limit(1);
    
    console.log('CLV Tracking table verification:', !clvCheckError ? '✅' : '❌');
    console.log('Processing Logs table verification:', !logsCheckError ? '✅' : '❌');
    
    if (!clvCheckError && !logsCheckError) {
      console.log('\n🎉 All professional system tables created successfully!');
      console.log('✅ CLV tracking ready for closing line value monitoring');
      console.log('✅ Processing logs ready for system monitoring');
    }
    
  } catch (error) {
    console.error('❌ Error creating professional tables:', error);
    throw error;
  }
}

// Alternative method using direct SQL if RPC doesn't work
async function createTablesDirectSQL() {
  console.log('🔄 Attempting direct SQL creation...');
  
  try {
    // Note: This would require a service role key, not anon key
    console.log('⚠️ Direct SQL creation requires service role permissions');
    console.log('📝 Please run these SQL commands in Supabase SQL Editor:');
    
    const clvTableSQL = `
-- CLV Tracking Table
CREATE TABLE IF NOT EXISTS clv_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core identifiers
  propId TEXT NOT NULL,
  userId TEXT,
  sport TEXT NOT NULL,
  market TEXT NOT NULL,
  book TEXT NOT NULL,
  
  -- Line data
  openingLine DECIMAL,
  openingOdds INTEGER,
  betLine DECIMAL NOT NULL,
  betOdds INTEGER NOT NULL,
  closingLine DECIMAL,
  closingOdds INTEGER,
  
  -- Timing
  openingTime TIMESTAMPTZ,
  betTime TIMESTAMPTZ DEFAULT NOW(),
  closingTime TIMESTAMPTZ,
  gameTime TIMESTAMPTZ,
  
  -- CLV metrics
  clv DECIMAL DEFAULT 0,
  clvPercentage DECIMAL DEFAULT 0,
  beatsClosing BOOLEAN DEFAULT FALSE,
  
  -- Additional context
  modelEdge DECIMAL DEFAULT 0,
  actualResult BOOLEAN,
  profit DECIMAL,
  
  -- Devigged metrics
  deviggedOpeningProb DECIMAL,
  deviggedClosingProb DECIMAL,
  deviggedCLV DECIMAL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CLV Tracking Indexes
CREATE INDEX IF NOT EXISTS idx_clv_tracking_propid ON clv_tracking(propId);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_userid ON clv_tracking(userId);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_sport ON clv_tracking(sport);
CREATE INDEX IF NOT EXISTS idx_clv_tracking_bettime ON clv_tracking(betTime);
`;

    const logsTableSQL = `
-- Processing Logs Table
CREATE TABLE IF NOT EXISTS processing_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Processing info
  processor TEXT NOT NULL,
  summary JSONB,
  
  -- Timing
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Processing Logs Indexes
CREATE INDEX IF NOT EXISTS idx_processing_logs_processor ON processing_logs(processor);
CREATE INDEX IF NOT EXISTS idx_processing_logs_processed_at ON processing_logs(processed_at);
`;
    
    console.log('\n📋 CLV Tracking Table SQL:');
    console.log(clvTableSQL);
    
    console.log('\n📋 Processing Logs Table SQL:');
    console.log(logsTableSQL);
    
  } catch (error) {
    console.error('Error generating SQL:', error);
  }
}

createProfessionalTables()
  .then(() => {
    console.log('\n🏁 Professional table creation complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Professional table creation failed:', error);
    console.log('\n🔄 Providing SQL for manual creation...');
    createTablesDirectSQL().then(() => process.exit(1));
  });