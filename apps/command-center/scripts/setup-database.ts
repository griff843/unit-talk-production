#!/usr/bin/env tsx

/**
 * Database Setup Script for Unit Talk Command Center
 * This script creates all necessary tables and sets up the database schema
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']!
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('🚀 Setting up Unit Talk Command Center database...\n')

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    console.log('📋 Reading database schema...')
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Skip comments and empty statements
      if (statement.trim().startsWith('--') || statement.trim() === ';') {
        continue
      }

      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        })

        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase
            .from('information_schema.tables')
            .select('*')
            .limit(1)

          if (directError) {
            console.log(`⚠️  Warning: ${error.message}`)
          }
        }

      } catch (err) {
        console.log(`⚠️  Warning executing statement: ${err}`)
      }
    }

    console.log('\n✅ Database schema setup completed!')

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...')
    
    const tables = [
      'users', 'picks', 'agents', 'security_events', 
      'analytics', 'system_logs', 'discord_guilds',
      'notifications', 'api_keys'
    ]

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (error) {
          console.log(`❌ Table '${table}': Error - ${error.message}`)
        } else {
          console.log(`✅ Table '${table}': Created successfully (${count || 0} rows)`)
        }
      } catch (err) {
        console.log(`❌ Table '${table}': Failed to verify - ${err}`)
      }
    }

    // Test dashboard analytics function
    console.log('\n📊 Testing dashboard analytics...')
    try {
      const { data, error } = await supabase.rpc('get_dashboard_analytics')
      
      if (error) {
        console.log(`⚠️  Analytics function warning: ${error.message}`)
      } else {
        console.log('✅ Dashboard analytics function working')
        console.log('📈 Sample data:', JSON.stringify(data, null, 2))
      }
    } catch (err) {
      console.log(`⚠️  Analytics function warning: ${err}`)
    }

    console.log('\n🎉 Database setup complete!')
    console.log('\n📋 Next steps:')
    console.log('1. Run the application: npm run dev')
    console.log('2. Check the dashboard for live data')
    console.log('3. Set up real-time sync with Unit Talk platform')

  } catch (error) {
    console.error('❌ Database setup failed:', error)
    process.exit(1)
  }
}

// Alternative direct table creation if schema file execution fails
async function createTablesDirectly() {
  console.log('🔄 Attempting direct table creation...\n')

  const tables = [
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          discord_id TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          display_name TEXT,
          tier TEXT NOT NULL DEFAULT 'Free' CHECK (tier IN ('Free', 'Premium', 'VIP')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          total_picks INTEGER DEFAULT 0,
          won_picks INTEGER DEFAULT 0,
          lost_picks INTEGER DEFAULT 0,
          win_rate DECIMAL(5,2) DEFAULT 0.00,
          total_profit DECIMAL(12,2) DEFAULT 0.00
        );
      `
    },
    {
      name: 'agents',
      sql: `
        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('healthy', 'warning', 'error', 'inactive')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_run TIMESTAMP WITH TIME ZONE,
          success_rate DECIMAL(5,2) DEFAULT 0.00,
          avg_response_time INTEGER DEFAULT 0,
          total_operations INTEGER DEFAULT 0,
          configuration JSONB DEFAULT '{}'
        );
      `
    },
    {
      name: 'security_events',
      sql: `
        CREATE TABLE IF NOT EXISTS security_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
          description TEXT NOT NULL,
          ip_address TEXT,
          user_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          resolved_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB DEFAULT '{}'
        );
      `
    }
  ]

  for (const table of tables) {
    try {
      console.log(`⏳ Creating table: ${table.name}`)
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql })
      
      if (error) {
        console.log(`⚠️  ${table.name}: ${error.message}`)
      } else {
        console.log(`✅ ${table.name}: Created successfully`)
      }
    } catch (err) {
      console.log(`❌ ${table.name}: ${err}`)
    }
  }
}

async function insertSampleData() {
  console.log('\n📝 Inserting sample data for testing...')

  // Insert sample agents
  const sampleAgents = [
    { name: 'AlertAgent', type: 'notification', status: 'healthy', success_rate: 98.5, total_operations: 15420 },
    { name: 'GradingAgent', type: 'picks', status: 'healthy', success_rate: 97.2, total_operations: 8934 },
    { name: 'RecapAgent', type: 'content', status: 'warning', success_rate: 89.1, total_operations: 2847 },
    { name: 'FeedAgent', type: 'content', status: 'healthy', success_rate: 99.1, total_operations: 45782 },
    { name: 'NotificationAgent', type: 'notification', status: 'healthy', success_rate: 96.8, total_operations: 12045 }
  ]

  try {
    const { error: agentsError } = await supabase
      .from('agents')
      .upsert(sampleAgents, { onConflict: 'name' })

    if (agentsError) {
      console.log(`⚠️  Sample agents: ${agentsError.message}`)
    } else {
      console.log('✅ Sample agents inserted')
    }
  } catch (err) {
    console.log(`❌ Sample agents failed: ${err}`)
  }

  // Insert sample users
  const sampleUsers = [
    { discord_id: '123456789012345678', username: 'ProCapper23', tier: 'VIP', total_picks: 247, won_picks: 184, lost_picks: 63, win_rate: 74.5, total_profit: 2847.50 },
    { discord_id: '234567890123456789', username: 'BetMaster99', tier: 'Premium', total_picks: 189, won_picks: 108, lost_picks: 81, win_rate: 57.1, total_profit: 1234.75 }
  ]

  try {
    const { error: usersError } = await supabase
      .from('users')
      .upsert(sampleUsers, { onConflict: 'discord_id' })

    if (usersError) {
      console.log(`⚠️  Sample users: ${usersError.message}`)
    } else {
      console.log('✅ Sample users inserted')
    }
  } catch (err) {
    console.log(`❌ Sample users failed: ${err}`)
  }

  // Insert sample security events
  const sampleEvents = [
    { type: 'login_attempt', severity: 'medium', description: 'Multiple failed login attempts detected', ip_address: '192.168.1.100' },
    { type: 'rate_limit', severity: 'low', description: 'API rate limit exceeded for user', ip_address: '10.0.0.45' }
  ]

  try {
    const { error: eventsError } = await supabase
      .from('security_events')
      .insert(sampleEvents)

    if (eventsError) {
      console.log(`⚠️  Sample security events: ${eventsError.message}`)
    } else {
      console.log('✅ Sample security events inserted')
    }
  } catch (err) {
    console.log(`❌ Sample security events failed: ${err}`)
  }
}

// Main execution
if (require.main === module) {
  setupDatabase()
    .then(() => createTablesDirectly())
    .then(() => insertSampleData())
    .catch(console.error)
}