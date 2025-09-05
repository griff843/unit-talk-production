require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkPipelineRestored() {
    console.log('🔍 Checking if data pipeline has been restored...\n');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // Check for today's data
        const today = new Date().toISOString().split('T')[0];
        console.log('📅 Checking for data on:', today);
        
        // Check raw_props
        const { data: todayProps, error } = await supabase
            .from('raw_props')
            .select('*')
            .gte('scraped_at', today)
            .order('scraped_at', { ascending: false });
            
        if (error && error.code !== '42P01') { // Not table doesn't exist
            console.log('⚠️ Error checking raw_props:', error.message);
        } else if (todayProps) {
            console.log(`✅ Today's props in database: ${todayProps.length}`);
            
            if (todayProps.length > 0) {
                console.log('📊 Latest data:');
                console.log(`  - Sport: ${todayProps[0].sport}`);
                console.log(`  - Scraped: ${todayProps[0].scraped_at}`);
                console.log(`  - Provider: ${todayProps[0].provider}`);
                console.log(`  - Market: ${todayProps[0].market}`);
            }
        }
        
        // Check agent health updates
        console.log('\n🤖 Checking agent health status...');
        const { data: agents, error: agentError } = await supabase
            .from('agent_health')
            .select('*')
            .order('updated_at', { ascending: false });
            
        if (agentError) {
            console.log('⚠️ Error checking agent health:', agentError.message);
        } else if (agents) {
            console.log(`📋 Agent status (${agents.length} agents):`);
            
            agents.forEach(agent => {
                const lastUpdate = new Date(agent.updated_at);
                const hoursAgo = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
                const status = hoursAgo < 1 ? '🟢' : hoursAgo < 24 ? '🟡' : '🔴';
                console.log(`  ${status} ${agent.agent}: ${agent.status} (${Math.round(hoursAgo)}h ago)`);
            });
        }
        
        // Show data ingestion stats
        console.log('\n📊 Data Pipeline Statistics:');
        
        // Count by provider
        const { data: providerStats } = await supabase
            .from('raw_props')
            .select('provider')
            .gte('scraped_at', today);
            
        if (providerStats) {
            const stats = {};
            providerStats.forEach(item => {
                stats[item.provider] = (stats[item.provider] || 0) + 1;
            });
            
            Object.entries(stats).forEach(([provider, count]) => {
                console.log(`  📡 ${provider}: ${count} props`);
            });
        }
        
        // Check for recent activity
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentProps } = await supabase
            .from('raw_props')
            .select('*')
            .gte('scraped_at', oneHourAgo);
            
        if (recentProps && recentProps.length > 0) {
            console.log(`\n✅ PIPELINE RESTORED! ${recentProps.length} props ingested in last hour`);
            console.log('🎯 Data is now flowing into the system');
        } else {
            console.log('\n⚠️ No recent activity in last hour');
        }
        
    } catch (error) {
        console.error('❌ Pipeline check failed:', error.message);
    }
}

checkPipelineRestored();