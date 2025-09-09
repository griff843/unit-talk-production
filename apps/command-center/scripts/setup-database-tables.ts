#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Setting up missing database tables...');

  try {
    // Read SQL file
    const sqlFile = join(__dirname, '../database/create-missing-tables.sql');
    const sql = readFileSync(sqlFile, 'utf8');

    // Split into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Executing ${statements.length} SQL statements...`);

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`⚡ Executing: ${statement.substring(0, 50)}...`);

        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement,
        });

        if (error) {
          console.error(`❌ Error executing statement: ${error.message}`);
          // Continue with other statements
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }

    // Test the tables
    console.log('\n🔍 Testing table creation...');

    const { data: agentHealth, error: healthError } = await supabase
      .from('agent_health')
      .select('*', { count: 'exact' })
      .limit(1);

    const { data: agentMetrics, error: metricsError } = await supabase
      .from('agent_metrics')
      .select('*', { count: 'exact' })
      .limit(1);

    const { data: securityEvents, error: eventsError } = await supabase
      .from('security_events')
      .select('*', { count: 'exact' })
      .limit(1);

    if (!healthError && !metricsError && !eventsError) {
      console.log('✅ All tables created successfully!');
      console.log(`📊 Agent Health records: ${agentHealth?.length || 0}`);
      console.log(`📊 Agent Metrics records: ${agentMetrics?.length || 0}`);
      console.log(`📊 Security Events records: ${securityEvents?.length || 0}`);
    } else {
      console.error('❌ Some tables may not have been created properly');
      if (healthError) console.error('Agent Health error:', healthError.message);
      if (metricsError) console.error('Agent Metrics error:', metricsError.message);
      if (eventsError) console.error('Security Events error:', eventsError.message);
    }
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setupDatabase()
  .then(() => {
    console.log('\n🎉 Database setup complete!');
    console.log('You can now refresh the Command Center to see real data');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
