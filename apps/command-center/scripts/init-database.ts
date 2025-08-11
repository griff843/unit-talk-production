#!/usr/bin/env tsx

/**
 * Initialize Database with Sample Data
 * Uses the existing Supabase client configuration
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('🚀 Initializing Unit Talk Command Center database...')
console.log('URL:', supabaseUrl ? '✅ Found' : '❌ Missing')
console.log('Anon Key:', supabaseAnonKey ? '✅ Found' : '❌ Missing')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Make sure .env.local contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function initializeDatabase() {
  console.log('\n📊 Testing database connection...')

  try {
    // Test connection by trying to select from a system table
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1)

    if (error) {
      console.log('⚠️  Connection test warning:', error.message)
    } else {
      console.log('✅ Database connection successful')
    }
  } catch (err) {
    console.log('⚠️  Connection test warning:', err)
  }

  console.log('\n📝 Inserting sample data...')

  // Insert sample agents (these will work if tables exist)
  try {
    const sampleAgents = [
      { 
        name: 'AlertAgent', 
        type: 'notification', 
        status: 'healthy', 
        success_rate: 98.5, 
        total_operations: 15420,
        last_run: new Date().toISOString()
      },
      { 
        name: 'GradingAgent', 
        type: 'picks', 
        status: 'healthy', 
        success_rate: 97.2, 
        total_operations: 8934,
        last_run: new Date().toISOString()
      },
      { 
        name: 'RecapAgent', 
        type: 'content', 
        status: 'warning', 
        success_rate: 89.1, 
        total_operations: 2847,
        last_run: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
      },
      { 
        name: 'FeedAgent', 
        type: 'content', 
        status: 'healthy', 
        success_rate: 99.1, 
        total_operations: 45782,
        last_run: new Date().toISOString()
      },
      { 
        name: 'NotificationAgent', 
        type: 'notification', 
        status: 'healthy', 
        success_rate: 96.8, 
        total_operations: 12045,
        last_run: new Date().toISOString()
      }
    ]

    console.log('⏳ Inserting sample agents...')
    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .upsert(sampleAgents, { onConflict: 'name', ignoreDuplicates: false })

    if (agentsError) {
      console.log(`⚠️  Agents: ${agentsError.message}`)
      console.log('💡 This is expected if tables don\'t exist yet. Tables may need to be created in Supabase dashboard.')
    } else {
      console.log('✅ Sample agents inserted successfully')
    }
  } catch (err) {
    console.log(`⚠️  Agents error: ${err}`)
  }

  // Insert sample users
  try {
    const sampleUsers = [
      { 
        discord_id: '123456789012345678', 
        username: 'ProCapper23', 
        display_name: 'Pro Capper', 
        tier: 'VIP', 
        total_picks: 247, 
        won_picks: 184, 
        lost_picks: 63, 
        win_rate: 74.5, 
        total_profit: 2847.50,
        last_active: new Date().toISOString()
      },
      { 
        discord_id: '234567890123456789', 
        username: 'BetMaster99', 
        display_name: 'Bet Master', 
        tier: 'Premium', 
        total_picks: 189, 
        won_picks: 108, 
        lost_picks: 81, 
        win_rate: 57.1, 
        total_profit: 1234.75,
        last_active: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      },
      { 
        discord_id: '345678901234567890', 
        username: 'LuckyStreak', 
        display_name: 'Lucky', 
        tier: 'Free', 
        total_picks: 89, 
        won_picks: 42, 
        lost_picks: 47, 
        win_rate: 47.2, 
        total_profit: -156.25,
        last_active: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
      }
    ]

    console.log('⏳ Inserting sample users...')
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .upsert(sampleUsers, { onConflict: 'discord_id', ignoreDuplicates: false })

    if (usersError) {
      console.log(`⚠️  Users: ${usersError.message}`)
    } else {
      console.log('✅ Sample users inserted successfully')
    }
  } catch (err) {
    console.log(`⚠️  Users error: ${err}`)
  }

  // Insert sample security events
  try {
    const sampleEvents = [
      { 
        type: 'login_attempt', 
        severity: 'medium', 
        description: 'Multiple failed login attempts detected from IP address', 
        ip_address: '192.168.1.100' 
      },
      { 
        type: 'rate_limit', 
        severity: 'low', 
        description: 'API rate limit exceeded for authenticated user', 
        ip_address: '10.0.0.45' 
      },
      { 
        type: 'suspicious_activity', 
        severity: 'high', 
        description: 'Unusual access pattern detected from new geographic location', 
        ip_address: '203.0.113.15' 
      }
    ]

    console.log('⏳ Inserting sample security events...')
    const { data: eventsData, error: eventsError } = await supabase
      .from('security_events')
      .insert(sampleEvents)

    if (eventsError) {
      console.log(`⚠️  Security events: ${eventsError.message}`)
    } else {
      console.log('✅ Sample security events inserted successfully')
    }
  } catch (err) {
    console.log(`⚠️  Security events error: ${err}`)
  }

  console.log('\n🔍 Verifying data insertion...')

  // Verify data was inserted
  try {
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, username, tier, total_picks, win_rate')
      .limit(10)

    if (!usersError && usersData) {
      console.log(`✅ Users table: ${usersData.length} records found`)
      usersData.forEach(user => {
        console.log(`   - ${user.username} (${user.tier}): ${user.total_picks} picks, ${user.win_rate}% win rate`)
      })
    }

    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, status, success_rate, total_operations')
      .limit(10)

    if (!agentsError && agentsData) {
      console.log(`✅ Agents table: ${agentsData.length} records found`)
      agentsData.forEach(agent => {
        console.log(`   - ${agent.name}: ${agent.status} (${agent.success_rate}% success, ${agent.total_operations} ops)`)
      })
    }

    const { data: eventsData, error: eventsError } = await supabase
      .from('security_events')
      .select('id, type, severity, description')
      .limit(10)

    if (!eventsError && eventsData) {
      console.log(`✅ Security events table: ${eventsData.length} records found`)
      eventsData.forEach(event => {
        console.log(`   - ${event.type} (${event.severity}): ${event.description}`)
      })
    }

  } catch (err) {
    console.log('⚠️  Verification error:', err)
  }

  console.log('\n🎉 Database initialization complete!')
  console.log('\n📋 Next steps:')
  console.log('1. If you see table errors above, create the tables manually in Supabase dashboard')
  console.log('2. Restart your development server: npm run dev')
  console.log('3. Check the dashboard at http://localhost:3002/dashboard')
  console.log('4. All data should now be live and functional!')
}

if (require.main === module) {
  initializeDatabase().catch(console.error)
}