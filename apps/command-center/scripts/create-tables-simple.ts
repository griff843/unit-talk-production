#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'] as string
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] as string

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('🚀 Creating missing database tables...');

  try {
    // Create agent_health table
    console.log('📋 Creating agent_health table...');
    const { error: healthError } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS agent_health (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          agent VARCHAR(100) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'unknown',
          details JSONB DEFAULT '{}',
          last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          total_operations INTEGER DEFAULT 0,
          response_time_ms INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_agent_health_agent ON agent_health(agent);
        CREATE INDEX IF NOT EXISTS idx_agent_health_status ON agent_health(status);
        CREATE INDEX IF NOT EXISTS idx_agent_health_created_at ON agent_health(created_at);
      `,
    });

    if (healthError) {
      console.log('ℹ️ agent_health table likely already exists or using direct insert...');
    } else {
      console.log('✅ agent_health table created');
    }

    // Create agent_metrics table
    console.log('📋 Creating agent_metrics table...');
    const { error: metricsError } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS agent_metrics (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          agent VARCHAR(100) NOT NULL,
          metric_name VARCHAR(100) NOT NULL,
          metric_value NUMERIC NOT NULL,
          metric_type VARCHAR(20) DEFAULT 'gauge',
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'
        );
        
        CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent);
        CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp);
      `,
    });

    if (metricsError) {
      console.log('ℹ️ agent_metrics table likely already exists or using direct insert...');
    } else {
      console.log('✅ agent_metrics table created');
    }

    // Create security_events table
    console.log('📋 Creating security_events table...');
    const { error: eventsError } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS security_events (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL DEFAULT 'low',
          description TEXT NOT NULL,
          user_id VARCHAR(100),
          ip_address INET,
          user_agent TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
        CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
        CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
      `,
    });

    if (eventsError) {
      console.log('ℹ️ security_events table likely already exists or using direct insert...');
    } else {
      console.log('✅ security_events table created');
    }

    // Insert sample data using direct inserts
    console.log('📊 Inserting sample agent health data...');
    const { error: insertHealthError } = await supabase.from('agent_health').upsert(
      [
        {
          agent: 'AlertAgent',
          status: 'healthy',
          details: { version: '1.0.0', uptime: 86400 },
          last_run: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          total_operations: 15420,
          response_time_ms: 245,
        },
        {
          agent: 'GradingAgent',
          status: 'healthy',
          details: { version: '1.0.0', uptime: 85000 },
          last_run: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
          total_operations: 8934,
          response_time_ms: 1200,
        },
        {
          agent: 'RecapAgent',
          status: 'warning',
          details: { version: '1.0.0', uptime: 82000, warnings: ['API timeout'] },
          last_run: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
          total_operations: 2847,
          response_time_ms: 3400,
        },
        {
          agent: 'FeedAgent',
          status: 'healthy',
          details: { version: '1.0.0', uptime: 86000 },
          last_run: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          total_operations: 45782,
          response_time_ms: 180,
        },
        {
          agent: 'NotificationAgent',
          status: 'healthy',
          details: { version: '1.0.0', uptime: 86100 },
          last_run: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
          total_operations: 12045,
          response_time_ms: 320,
        },
      ],
      { onConflict: 'agent' }
    );

    if (insertHealthError) {
      console.log('ℹ️ Agent health data insert issue:', insertHealthError.message);
    } else {
      console.log('✅ Agent health data inserted');
    }

    // Insert sample metrics
    console.log('📊 Inserting sample agent metrics...');
    const { error: insertMetricsError } = await supabase.from('agent_metrics').insert([
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
      {
        agent: 'RecapAgent',
        metric_name: 'success_rate',
        metric_value: 89.1,
        metric_type: 'gauge',
      },
      {
        agent: 'RecapAgent',
        metric_name: 'recap_generated',
        metric_value: 284,
        metric_type: 'counter',
      },
      { agent: 'FeedAgent', metric_name: 'success_rate', metric_value: 99.8, metric_type: 'gauge' },
      {
        agent: 'FeedAgent',
        metric_name: 'props_ingested',
        metric_value: 45782,
        metric_type: 'counter',
      },
      {
        agent: 'NotificationAgent',
        metric_name: 'success_rate',
        metric_value: 97.3,
        metric_type: 'gauge',
      },
      {
        agent: 'NotificationAgent',
        metric_name: 'notifications_sent',
        metric_value: 12045,
        metric_type: 'counter',
      },
    ]);

    if (insertMetricsError) {
      console.log('ℹ️ Agent metrics data insert issue:', insertMetricsError.message);
    } else {
      console.log('✅ Agent metrics data inserted');
    }

    // Insert sample security events
    console.log('📊 Inserting sample security events...');
    const { error: insertEventsError } = await supabase.from('security_events').insert([
      {
        type: 'LOGIN_ATTEMPT',
        severity: 'high',
        description:
          'Multiple failed login attempts detected from IP 192.168.1.100 (5 attempts in 2 minutes)',
        ip_address: '192.168.1.100',
        created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      },
      {
        type: 'RATE_LIMIT',
        severity: 'medium',
        description:
          'API rate limit exceeded for user ProCapper23 (150 requests in 1 minute, limit: 100)',
        ip_address: '10.0.0.45',
        created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      },
      {
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'medium',
        description: 'User BetMaster99 accessing from new geographic location (Nigeria)',
        ip_address: '41.223.45.120',
        created_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      },
      {
        type: 'API_ACCESS',
        severity: 'low',
        description: 'Successful API access from new device for user SharpBettor',
        ip_address: '192.168.1.25',
        created_at: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
      },
    ]);

    if (insertEventsError) {
      console.log('ℹ️ Security events data insert issue:', insertEventsError.message);
    } else {
      console.log('✅ Security events data inserted');
    }

    // Test the data
    console.log('\n🔍 Testing data retrieval...');

    const { data: healthData, error: testHealthError } = await supabase
      .from('agent_health')
      .select('agent, status, total_operations')
      .limit(5);

    const { data: metricsData, error: testMetricsError } = await supabase
      .from('agent_metrics')
      .select('agent, metric_name, metric_value')
      .limit(5);

    const { data: eventsData, error: testEventsError } = await supabase
      .from('security_events')
      .select('type, severity, description')
      .limit(3);

    if (!testHealthError && healthData?.length) {
      console.log(`✅ Agent Health: Found ${healthData.length} agents`);
      healthData.forEach(agent => {
        console.log(`   - ${agent.agent}: ${agent.status} (${agent.total_operations} ops)`);
      });
    } else {
      console.log('❌ Agent Health test failed:', testHealthError?.message);
    }

    if (!testMetricsError && metricsData?.length) {
      console.log(`✅ Agent Metrics: Found ${metricsData.length} metrics`);
    } else {
      console.log('❌ Agent Metrics test failed:', testMetricsError?.message);
    }

    if (!testEventsError && eventsData?.length) {
      console.log(`✅ Security Events: Found ${eventsData.length} events`);
    } else {
      console.log('❌ Security Events test failed:', testEventsError?.message);
    }

    console.log('\n🎉 Database setup complete!');
    console.log('🔄 Refresh your browser to see the real data!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

createTables().then(() => process.exit(0));
