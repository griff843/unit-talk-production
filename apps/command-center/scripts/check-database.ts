#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars for script. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  console.log('🔍 Checking database structure and data...');

  try {
    // Check for existing tables that the command center expects
    const tablesToCheck = [
      'agent_health',
      'agent_metrics',
      'security_events',
      'unified_picks', // daily_picks is provided as a view for compatibility
      'raw_props',
      'games',
      'cappers',
      'users',
    ];

    for (const table of tablesToCheck) {
      console.log(`\n📋 Checking table: ${table}`);

      try {
        const { data, error } = await supabase.from(table).select('*').limit(3);

        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: Found ${data?.length || 0} records`);
          if (data && data.length > 0) {
            console.log(`   Sample columns: ${Object.keys(data[0]).slice(0, 5).join(', ')}`);
          }
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err}`);
      }
    }

    // Try to get schema information
    console.log('\n🏗️ Checking schema information...');
    const { data: schemaData, error: schemaError } = await supabase.rpc('get_schema_info').select();

    if (schemaError) {
      console.log('ℹ️ Could not get schema info via RPC');
    } else {
      console.log('✅ Schema info retrieved');
    }

    // Check if we can create tables directly
    console.log('\n🔧 Testing direct table creation...');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS agent_health_test (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        agent VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: createTableSQL });
      if (error) {
        console.log(`❌ Direct SQL creation failed: ${error.message}`);
      } else {
        console.log('✅ Direct SQL creation works');

        // Clean up test table
        await supabase.rpc('exec_sql', { sql_query: 'DROP TABLE IF EXISTS agent_health_test;' });
      }
    } catch (err) {
      console.log(`❌ Direct SQL error: ${err}`);
    }

    // Try creating tables using the direct client method
    console.log('\n🏗️ Attempting to create required tables...');

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- Create agent_health table
        CREATE TABLE IF NOT EXISTS agent_health (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          agent VARCHAR(100) NOT NULL UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'unknown',
          details JSONB DEFAULT '{}',
          last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          total_operations INTEGER DEFAULT 0,
          response_time_ms INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create agent_metrics table  
        CREATE TABLE IF NOT EXISTS agent_metrics (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          agent VARCHAR(100) NOT NULL,
          metric_name VARCHAR(100) NOT NULL,
          metric_value NUMERIC NOT NULL,
          metric_type VARCHAR(20) DEFAULT 'gauge',
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'
        );

        -- Create security_events table
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

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_agent_health_agent ON agent_health(agent);
        CREATE INDEX IF NOT EXISTS idx_agent_health_status ON agent_health(status);
        CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent);
        CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
      `,
    });

    if (createError) {
      console.log(`❌ Table creation failed: ${createError.message}`);
    } else {
      console.log('✅ Tables created successfully');

      // Insert sample data
      console.log('\n📊 Inserting sample data...');

      const agents = [
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
      ];

      const { error: insertError } = await supabase
        .from('agent_health')
        .upsert(agents, { onConflict: 'agent' });

      if (insertError) {
        console.log(`❌ Data insertion failed: ${insertError.message}`);
      } else {
        console.log('✅ Sample agent data inserted');
      }

      // Insert sample metrics
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
        {
          agent: 'FeedAgent',
          metric_name: 'success_rate',
          metric_value: 99.8,
          metric_type: 'gauge',
        },
        {
          agent: 'FeedAgent',
          metric_name: 'props_ingested',
          metric_value: 45782,
          metric_type: 'counter',
        },
      ];

      const { error: metricsError } = await supabase.from('agent_metrics').insert(metrics);

      if (metricsError) {
        console.log(`❌ Metrics insertion failed: ${metricsError.message}`);
      } else {
        console.log('✅ Sample metrics data inserted');
      }

      // Insert sample security events
      const events = [
        {
          type: 'LOGIN_ATTEMPT',
          severity: 'high',
          description: 'Multiple failed login attempts detected',
          ip_address: '192.168.1.100',
          created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
        },
        {
          type: 'RATE_LIMIT',
          severity: 'medium',
          description: 'API rate limit exceeded',
          ip_address: '10.0.0.45',
          created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        },
      ];

      const { error: eventsError } = await supabase.from('security_events').insert(events);

      if (eventsError) {
        console.log(`❌ Events insertion failed: ${eventsError.message}`);
      } else {
        console.log('✅ Sample events data inserted');
      }
    }

    // Final verification
    console.log('\n🔍 Final verification...');

    const { data: finalHealthData, error: finalHealthError } = await supabase
      .from('agent_health')
      .select('agent, status, total_operations')
      .limit(5);

    if (!finalHealthError && finalHealthData?.length) {
      console.log(`✅ VERIFICATION PASSED: Found ${finalHealthData.length} agents`);
      finalHealthData.forEach(agent => {
        console.log(`   - ${agent.agent}: ${agent.status} (${agent.total_operations} ops)`);
      });
    } else {
      console.log('❌ VERIFICATION FAILED:', finalHealthError?.message);
    }
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase()
  .then(() => {
    console.log('\n🎉 Database check complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  });
