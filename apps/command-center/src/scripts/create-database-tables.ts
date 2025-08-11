/**
 * Create Command Center Database Tables
 * Run this script to set up all required tables in Supabase
 */

import { supabase } from '../lib/supabase'

async function createTables() {
  console.log('🗄️  Creating Command Center database tables...')

  try {
    // Create agents table
    console.log('Creating agents table...')
    const { error: agentsError } = await supabase.rpc('create_agents_table', {})
    
    if (agentsError && !agentsError.message.includes('already exists')) {
      // If RPC doesn't exist, create table directly
      const { error: createAgentsError } = await supabase
        .from('agents')
        .select('*')
        .limit(1)
      
      if (createAgentsError && createAgentsError.message.includes('does not exist')) {
        console.log('Agents table does not exist, it needs to be created in Supabase dashboard')
        console.log('Please run this SQL in your Supabase SQL editor:')
        console.log(`
-- Create agents table
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'inactive',
  last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_operations INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.0,
  avg_response_time INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON public.agents(type);

-- Enable RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow authenticated users to read agents" ON public.agents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage agents" ON public.agents
  FOR ALL USING (auth.role() = 'service_role');
        `)
      }
    }

    // Create security_events table
    console.log('Creating security_events table...')
    const { error: securityError } = await supabase
      .from('security_events')
      .select('*')
      .limit(1)
    
    if (securityError && securityError.message.includes('does not exist')) {
      console.log('Security events table needs to be created in Supabase dashboard:')
      console.log(`
-- Create security_events table
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) DEFAULT 'medium',
  description TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read security events" ON public.security_events
  FOR SELECT USING (auth.role() = 'authenticated');
      `)
    }

    // Insert sample data for agents
    console.log('Inserting sample agent data...')
    const sampleAgents = [
      {
        name: 'AlertAgent',
        type: 'notification',
        status: 'healthy',
        total_operations: 1247,
        success_rate: 98.5,
        avg_response_time: 150,
        metadata: { endpoint: '/api/alerts', version: '1.0.0' }
      },
      {
        name: 'GradingAgent',
        type: 'analysis',
        status: 'healthy',
        total_operations: 3421,
        success_rate: 96.2,
        avg_response_time: 230,
        metadata: { endpoint: '/api/grading', version: '2.1.0' }
      },
      {
        name: 'RecapAgent',
        type: 'content',
        status: 'warning',
        total_operations: 892,
        success_rate: 94.1,
        avg_response_time: 180,
        metadata: { endpoint: '/api/recap', version: '1.5.2' }
      },
      {
        name: 'FeedAgent',
        type: 'ingestion',
        status: 'healthy',
        total_operations: 5673,
        success_rate: 99.1,
        avg_response_time: 95,
        metadata: { endpoint: '/api/feed', version: '3.0.1' }
      },
      {
        name: 'NotificationAgent',
        type: 'notification',
        status: 'error',
        total_operations: 2156,
        success_rate: 87.3,
        avg_response_time: 320,
        metadata: { endpoint: '/api/notifications', version: '1.2.0' }
      }
    ]

    for (const agent of sampleAgents) {
      const { error } = await supabase
        .from('agents')
        .upsert(agent, { onConflict: 'name' })
      
      if (error) {
        console.log(`Note: Could not insert agent ${agent.name} - may need table creation first`)
      } else {
        console.log(`✅ Inserted/updated agent: ${agent.name}`)
      }
    }

    // Insert sample security events
    console.log('Inserting sample security events...')
    const sampleEvents = [
      {
        type: 'failed_login',
        severity: 'medium',
        description: 'Multiple failed login attempts detected',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0...',
        metadata: { attempts: 5, blocked: true }
      },
      {
        type: 'unauthorized_api_access',
        severity: 'high',
        description: 'Attempt to access restricted API endpoint',
        ip_address: '10.0.0.45',
        metadata: { endpoint: '/api/admin', method: 'DELETE' }
      },
      {
        type: 'suspicious_activity',
        severity: 'critical',
        description: 'Unusual data access pattern detected',
        ip_address: '203.0.113.42',
        metadata: { data_volume: '10GB', time_window: '5min' }
      }
    ]

    for (const event of sampleEvents) {
      const { error } = await supabase
        .from('security_events')
        .insert(event)
      
      if (error) {
        console.log(`Note: Could not insert security event - may need table creation first`)
      } else {
        console.log(`✅ Inserted security event: ${event.type}`)
      }
    }

    console.log('✅ Database setup completed!')
    console.log('\nNext steps:')
    console.log('1. If you see SQL above, run it in your Supabase SQL editor')
    console.log('2. Then re-run this script to insert sample data')
    console.log('3. Test the API endpoints')

  } catch (error) {
    console.error('❌ Database setup failed:', error)
    console.log('\nManual setup required:')
    console.log('Please create the tables manually in Supabase dashboard using the SQL provided above')
  }
}

// Run the setup
createTables()