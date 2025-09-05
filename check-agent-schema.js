const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkAgentHealthSchema() {
    console.log('🔍 Checking agent_health table schema...\n');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // Check current schema
        console.log('📊 Current agent_health data:');
        const { data, error } = await supabase
            .from('agent_health')
            .select('*')
            .limit(5);
            
        if (error) {
            console.error('❌ Error querying agent_health:', error.message);
            return;
        }
        
        console.log('📋 Columns available:', Object.keys(data[0] || {}));
        console.log('📋 Sample data:', JSON.stringify(data, null, 2));
        
        // Try to get agent activity info
        console.log('\n🤖 Checking for agent activity...');
        
        // Check agent_metrics table too
        const { data: metrics, error: metricsError } = await supabase
            .from('agent_metrics')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(5);
            
        if (metricsError) {
            console.log('❌ Error querying agent_metrics:', metricsError.message);
        } else {
            console.log('📊 Recent agent metrics:', metrics?.length || 0, 'entries');
            if (metrics && metrics.length > 0) {
                console.log('Latest metric:', JSON.stringify(metrics[0], null, 2));
            }
        }
        
    } catch (error) {
        console.error('❌ Schema check failed:', error.message);
    }
}

checkAgentHealthSchema();