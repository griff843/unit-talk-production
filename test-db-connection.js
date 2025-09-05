const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testDatabaseConnection() {
    console.log('🔍 Testing Unit Talk Database Connection...\n');
    
    // Check environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase environment variables');
        console.log('SUPABASE_URL:', supabaseUrl ? '✅ Present' : '❌ Missing');
        console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Present' : '❌ Missing');
        return;
    }
    
    console.log('✅ Environment variables loaded');
    console.log('🌐 Supabase URL:', supabaseUrl);
    
    // Create client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // Test basic connection
        console.log('\n📡 Testing basic connection...');
        const { data, error } = await supabase
            .from('agent_health')
            .select('id')
            .limit(1);
            
        if (error) {
            console.error('❌ Basic connection failed:', error.message);
            return;
        }
        
        console.log('✅ Basic connection successful');
        
        // Check critical tables exist
        console.log('\n🏗️ Checking v3.0.0 schema tables...');
        const tables = ['raw_props', 'unified_picks', 'users', 'agent_health', 'agent_metrics'];
        
        for (const table of tables) {
            try {
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .limit(1);
                    
                if (error) {
                    console.log(`❌ Table '${table}': ${error.message}`);
                } else {
                    console.log(`✅ Table '${table}': ${data?.length || 0} rows accessible`);
                }
            } catch (err) {
                console.log(`❌ Table '${table}': ${err.message}`);
            }
        }
        
        // Check for recent data
        console.log('\n📊 Checking data freshness...');
        try {
            const { data: recentProps, error } = await supabase
                .from('raw_props')
                .select('*')
                .gte('created_at', '2025-08-28')
                .order('created_at', { ascending: false })
                .limit(5);
                
            if (error) {
                console.log('❌ Could not check recent props:', error.message);
            } else {
                console.log(`📈 Props since Aug 28: ${recentProps?.length || 0} found`);
                if (recentProps && recentProps.length > 0) {
                    console.log('Latest prop date:', recentProps[0].created_at);
                }
            }
        } catch (err) {
            console.log('❌ Data freshness check failed:', err.message);
        }
        
        // Check agent health
        console.log('\n🤖 Checking agent status...');
        try {
            const { data: agents, error } = await supabase
                .from('agent_health')
                .select('*')
                .order('last_heartbeat', { ascending: false });
                
            if (error) {
                console.log('❌ Could not check agent health:', error.message);
            } else {
                console.log(`🤖 Total agents tracked: ${agents?.length || 0}`);
                if (agents && agents.length > 0) {
                    agents.forEach(agent => {
                        const lastSeen = new Date(agent.last_heartbeat);
                        const hoursAgo = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);
                        const status = hoursAgo < 1 ? '🟢' : hoursAgo < 24 ? '🟡' : '🔴';
                        console.log(`  ${status} ${agent.agent_name}: ${agent.status} (${Math.round(hoursAgo)}h ago)`);
                    });
                }
            }
        } catch (err) {
            console.log('❌ Agent health check failed:', err.message);
        }
        
        console.log('\n✅ Database connection test completed');
        
    } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
    }
}

testDatabaseConnection();