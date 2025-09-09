#!/usr/bin/env tsx

/**
 * Simple Database Table Creation Script
 * Creates essential tables for Unit Talk Command Center
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']!
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!

console.log('🚀 Creating database tables...')
console.log('URL:', supabaseUrl)
console.log('Service Key exists:', !!supabaseServiceKey)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTables() {
  console.log('\n📋 Creating essential tables...\n')

  // Create users table
  console.log('⏳ Creating users table...')
  const { error: usersError } = await supabase.rpc('exec_sql', {
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
      
      CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `
  })

  if (usersError) {
    console.log(`⚠️  Users table: ${usersError.message}`)
  } else {
    console.log('✅ Users table created')
  }

  // Create agents table
  console.log('⏳ Creating agents table...')
  const { error: agentsError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('healthy', 'warning', 'error', 'inactive')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        success_rate DECIMAL(5,2) DEFAULT 0.00,
        avg_response_time INTEGER DEFAULT 0,
        total_operations INTEGER DEFAULT 0,
        configuration JSONB DEFAULT '{}'
      );
      
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    `
  })

  if (agentsError) {
    console.log(`⚠️  Agents table: ${agentsError.message}`)
  } else {
    console.log('✅ Agents table created')
  }

  // Create security_events table
  console.log('⏳ Creating security_events table...')
  const { error: securityError } = await supabase.rpc('exec_sql', {
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
      
      CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
    `
  })

  if (securityError) {
    console.log(`⚠️  Security events table: ${securityError.message}`)
  } else {
    console.log('✅ Security events table created')
  }

  // Insert sample data
  console.log('\n📝 Inserting sample data...')

  // Sample agents
  const { error: insertAgentsError } = await supabase
    .from('agents')
    .upsert([
      { name: 'AlertAgent', type: 'notification', status: 'healthy', success_rate: 98.5, total_operations: 15420 },
      { name: 'GradingAgent', type: 'picks', status: 'healthy', success_rate: 97.2, total_operations: 8934 },
      { name: 'RecapAgent', type: 'content', status: 'warning', success_rate: 89.1, total_operations: 2847 },
      { name: 'FeedAgent', type: 'content', status: 'healthy', success_rate: 99.1, total_operations: 45782 },
      { name: 'NotificationAgent', type: 'notification', status: 'healthy', success_rate: 96.8, total_operations: 12045 }
    ], { onConflict: 'name' })

  if (insertAgentsError) {
    console.log(`⚠️  Sample agents: ${insertAgentsError.message}`)
  } else {
    console.log('✅ Sample agents inserted')
  }

  // Sample users
  const { error: insertUsersError } = await supabase
    .from('users')
    .upsert([
      { discord_id: '123456789012345678', username: 'ProCapper23', display_name: 'Pro Capper', tier: 'VIP', total_picks: 247, won_picks: 184, lost_picks: 63, win_rate: 74.5, total_profit: 2847.50 },
      { discord_id: '234567890123456789', username: 'BetMaster99', display_name: 'Bet Master', tier: 'Premium', total_picks: 189, won_picks: 108, lost_picks: 81, win_rate: 57.1, total_profit: 1234.75 },
      { discord_id: '345678901234567890', username: 'LuckyStreak', display_name: 'Lucky', tier: 'Free', total_picks: 89, won_picks: 42, lost_picks: 47, win_rate: 47.2, total_profit: -156.25 }
    ], { onConflict: 'discord_id' })

  if (insertUsersError) {
    console.log(`⚠️  Sample users: ${insertUsersError.message}`)
  } else {
    console.log('✅ Sample users inserted')
  }

  // Sample security events
  const { error: insertEventsError } = await supabase
    .from('security_events')
    .insert([
      { type: 'login_attempt', severity: 'medium', description: 'Multiple failed login attempts detected', ip_address: '192.168.1.100' },
      { type: 'rate_limit', severity: 'low', description: 'API rate limit exceeded for user', ip_address: '10.0.0.45' },
      { type: 'suspicious_activity', severity: 'high', description: 'Unusual access pattern from new geographic location', ip_address: '203.0.113.15' }
    ])

  if (insertEventsError) {
    console.log(`⚠️  Sample security events: ${insertEventsError.message}`)
  } else {
    console.log('✅ Sample security events inserted')
  }

  console.log('\n🎉 Database setup complete!')
  console.log('\n📊 Verifying data...')

  // Verify data
  const { data: usersData, error: usersVerifyError } = await supabase
    .from('users')
    .select('*')
    .limit(5)

  if (!usersVerifyError && usersData) {
    console.log(`✅ Users table: ${usersData.length} records`)
  }

  const { data: agentsData, error: agentsVerifyError } = await supabase
    .from('agents')
    .select('*')
    .limit(5)

  if (!agentsVerifyError && agentsData) {
    console.log(`✅ Agents table: ${agentsData.length} records`)
  }

  const { data: eventsData, error: eventsVerifyError } = await supabase
    .from('security_events')
    .select('*')
    .limit(5)

  if (!eventsVerifyError && eventsData) {
    console.log(`✅ Security events table: ${eventsData.length} records`)
  }

  console.log('\n🚀 Ready to test the application!')
}

if (require.main === module) {
  createTables().catch(console.error)
}