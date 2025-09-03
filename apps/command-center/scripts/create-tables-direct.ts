#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
});

async function createTablesAndData() {
  console.log('🚀 Creating tables via REST API...');

  try {
    // Since we can't use exec_sql, we'll create tables by trying to insert data
    // If the table doesn't exist, we'll get an error, then create it manually via the dashboard

    // First, let's try to insert some sample data and see what happens
    console.log('📊 Attempting to create agent_health table by inserting data...');

    const agents = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        agent: 'AlertAgent',
        status: 'healthy',
        details: { version: '1.0.0', uptime: 86400 },
        last_run: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        total_operations: 15420,
        response_time_ms: 245,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        agent: 'GradingAgent',
        status: 'healthy',
        details: { version: '1.0.0', uptime: 85000 },
        last_run: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        total_operations: 8934,
        response_time_ms: 1200,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        agent: 'RecapAgent',
        status: 'warning',
        details: { version: '1.0.0', uptime: 82000, warnings: ['API timeout'] },
        last_run: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
        total_operations: 2847,
        response_time_ms: 3400,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        agent: 'FeedAgent',
        status: 'healthy',
        details: { version: '1.0.0', uptime: 86000 },
        last_run: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        total_operations: 45782,
        response_time_ms: 180,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        agent: 'NotificationAgent',
        status: 'healthy',
        details: { version: '1.0.0', uptime: 86100 },
        last_run: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        total_operations: 12045,
        response_time_ms: 320,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Let's try creating a simple table structure by making direct API calls
    // We'll use the PostgREST API that Supabase exposes

    console.log('🔧 Creating tables via direct PostgreSQL connection...');

    // Use the Supabase management API to create tables
    const createTableQueries = [
      // Agent Health table
      `CREATE TABLE IF NOT EXISTS agent_health (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        agent VARCHAR(100) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        details JSONB DEFAULT '{}',
        last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        total_operations INTEGER DEFAULT 0,
        response_time_ms INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,

      // Agent Metrics table
      `CREATE TABLE IF NOT EXISTS agent_metrics (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        agent VARCHAR(100) NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        metric_value NUMERIC NOT NULL,
        metric_type VARCHAR(20) DEFAULT 'gauge',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'
      );`,

      // Security Events table
      `CREATE TABLE IF NOT EXISTS security_events (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'low',
        description TEXT NOT NULL,
        user_id VARCHAR(100),
        ip_address INET,
        user_agent TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_agent_health_agent ON agent_health(agent);`,
      `CREATE INDEX IF NOT EXISTS idx_agent_health_status ON agent_health(status);`,
      `CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent);`,
      `CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);`,
    ];

    // Try making a direct connection using a different approach
    console.log('📋 Using alternative table creation method...');

    // Let's use fetch to make direct calls to the Supabase REST API
    const supabaseRestUrl = `${supabaseUrl}/rest/v1/`;
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    };

    // First try to check if tables exist by querying them
    console.log('🔍 Checking existing tables...');

    try {
      const response = await fetch(`${supabaseRestUrl}agent_health?limit=1`, {
        headers: headers,
      });

      if (response.status === 200) {
        console.log('✅ agent_health table exists');
      } else if (response.status === 406 || response.status === 404) {
        console.log('❌ agent_health table does not exist');

        // Since we can't create tables via REST API, let's provide SQL commands
        console.log('\n🏗️ MANUAL TABLE CREATION REQUIRED');
        console.log('Please run the following SQL commands in your Supabase SQL editor:');
        console.log('\n' + '='.repeat(80));

        createTableQueries.forEach((query, index) => {
          console.log(`\n-- Query ${index + 1}:`);
          console.log(query);
        });

        console.log('\n' + '='.repeat(80));
        console.log('\nAfter creating tables, run the data insertion script.');
      }
    } catch (error) {
      console.log('❌ Error checking tables:', error);
    }

    // If we can't create tables automatically, let's at least prepare the data
    console.log('\n📊 Preparing sample data for insertion...');

    console.log('\n-- Agent Health Data:');
    agents.forEach(agent => {
      console.log(
        `INSERT INTO agent_health (id, agent, status, details, last_run, total_operations, response_time_ms, created_at, updated_at) VALUES ('${agent.id}', '${agent.agent}', '${agent.status}', '${JSON.stringify(agent.details)}', '${agent.last_run}', ${agent.total_operations}, ${agent.response_time_ms}, '${agent.created_at}', '${agent.updated_at}');`
      );
    });

    const metrics = [
      {
        agent: 'AlertAgent',
        metric_name: 'success_rate',
        metric_value: 98.5,
        metric_type: 'gauge',
      },
      {
        agent: 'AlertAgent',
        metric_name: 'alerts_sent',
        metric_value: 1542,
        metric_type: 'counter',
      },
      {
        agent: 'GradingAgent',
        metric_name: 'success_rate',
        metric_value: 94.2,
        metric_type: 'gauge',
      },
      {
        agent: 'GradingAgent',
        metric_name: 'picks_graded',
        metric_value: 8934,
        metric_type: 'counter',
      },
      { agent: 'FeedAgent', metric_name: 'success_rate', metric_value: 99.8, metric_type: 'gauge' },
      {
        agent: 'FeedAgent',
        metric_name: 'props_ingested',
        metric_value: 45782,
        metric_type: 'counter',
      },
    ];

    console.log('\n-- Agent Metrics Data:');
    metrics.forEach(metric => {
      console.log(
        `INSERT INTO agent_metrics (agent, metric_name, metric_value, metric_type, timestamp) VALUES ('${metric.agent}', '${metric.metric_name}', ${metric.metric_value}, '${metric.metric_type}', NOW());`
      );
    });

    const events = [
      {
        type: 'LOGIN_ATTEMPT',
        severity: 'high',
        description: 'Multiple failed login attempts detected from IP 192.168.1.100',
        ip_address: '192.168.1.100',
      },
      {
        type: 'RATE_LIMIT',
        severity: 'medium',
        description: 'API rate limit exceeded for user ProCapper23',
        ip_address: '10.0.0.45',
      },
    ];

    console.log('\n-- Security Events Data:');
    events.forEach(event => {
      console.log(
        `INSERT INTO security_events (type, severity, description, ip_address, created_at) VALUES ('${event.type}', '${event.severity}', '${event.description}', '${event.ip_address}', NOW());`
      );
    });

    console.log('\n🎯 NEXT STEPS:');
    console.log(
      '1. Go to your Supabase dashboard: https://app.supabase.com/project/lxqmuzmqtnnlpfapvief/sql'
    );
    console.log('2. Copy and paste the SQL commands above');
    console.log('3. Run them in the SQL editor');
    console.log('4. Come back and refresh the Command Center');

    console.log('\n🚀 Alternative: Manual table creation in Supabase dashboard');
    console.log(
      "If the SQL editor approach doesn't work, create tables manually with these specs:"
    );
    console.log('\nTable: agent_health');
    console.log('- id: UUID (Primary key, default: gen_random_uuid())');
    console.log('- agent: VARCHAR(100) (Not null, unique)');
    console.log('- status: VARCHAR(20) (Not null, default: "unknown")');
    console.log('- details: JSONB (default: {})');
    console.log('- last_run: TIMESTAMP WITH TIME ZONE (default: NOW())');
    console.log('- total_operations: INTEGER (default: 0)');
    console.log('- response_time_ms: INTEGER (default: 0)');
    console.log('- created_at: TIMESTAMP WITH TIME ZONE (default: NOW())');
    console.log('- updated_at: TIMESTAMP WITH TIME ZONE (default: NOW())');
  } catch (error) {
    console.error('❌ Table creation failed:', error);
  }
}

createTablesAndData()
  .then(() => {
    console.log('\n🎉 Setup preparation complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
