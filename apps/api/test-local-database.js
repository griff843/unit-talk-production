#!/usr/bin/env node

/**
 * Test local PostgreSQL database connection and create necessary tables
 */

const { Pool } = require('pg');

async function testLocalDatabase() {
  console.log('🗄️ Testing local PostgreSQL database connection...\n');

  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'development_password_2024',
    database: 'unit_talk_dev'
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to local PostgreSQL database');

    // Check if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`\n📊 Found ${tables.rows.length} tables in database:`);
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Create test tables if needed
    if (tables.rows.length === 0) {
      console.log('\n🔧 Creating test tables...');

      // Create raw_props table
      await client.query(`
        CREATE TABLE IF NOT EXISTS raw_props (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sport VARCHAR(50) NOT NULL,
          stat_type VARCHAR(100),
          player_name VARCHAR(200),
          line DECIMAL(10,2),
          over_odds INTEGER,
          under_odds INTEGER,
          is_valid BOOLEAN DEFAULT true,
          processed_at TIMESTAMPTZ,
          processed_by VARCHAR(100),
          error_message TEXT,
          error_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create unified_picks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS unified_picks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          raw_prop_id UUID REFERENCES raw_props(id),
          user_id VARCHAR(100) NOT NULL,
          sport VARCHAR(50) NOT NULL,
          prediction VARCHAR(50),
          confidence DECIMAL(5,4),
          published BOOLEAN DEFAULT false,
          tier VARCHAR(10),
          score DECIMAL(10,4),
          professional_score DECIMAL(10,4),
          devigged_edge DECIMAL(10,6),
          kelly_fraction DECIMAL(10,6),
          professional_insights JSONB DEFAULT '{}'::jsonb,
          clv_tracking_id VARCHAR(100),
          feature_contributions JSONB DEFAULT '{}'::jsonb,
          risk_assessment JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create processing_logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS processing_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          processor VARCHAR(100) NOT NULL,
          summary JSONB DEFAULT '{}'::jsonb,
          processed_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      console.log('✅ Created test tables');

      // Insert test data
      await client.query(`
        INSERT INTO raw_props (sport, stat_type, player_name, line, over_odds, under_odds, is_valid)
        VALUES 
          ('NBA', 'points', 'LeBron James', 25.5, -110, -110, true),
          ('NFL', 'passing_yards', 'Josh Allen', 275.5, -115, -105, true),
          ('MLB', 'hits', 'Aaron Judge', 1.5, -120, +100, true)
        ON CONFLICT DO NOTHING
      `);

      console.log('✅ Inserted test data');
    }

    client.release();
    console.log('\n✅ Local database is ready for testing!');

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testLocalDatabase().catch(console.error);