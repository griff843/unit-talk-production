require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function startFeedAgentManually() {
    console.log('🚀 Starting FeedAgent manually to restore data pipeline...\n');
    
    // Verify environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const oddsApiKey = process.env.ODDS_API_KEY;
    
    if (!supabaseUrl || !supabaseKey || !oddsApiKey) {
        console.error('❌ Missing required environment variables');
        return;
    }
    
    console.log('✅ Environment variables loaded');
    console.log('🔗 Supabase URL:', supabaseUrl);
    console.log('🔑 Odds API Key:', oddsApiKey.substring(0, 10) + '...');
    
    // Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        console.log('\n🎯 Step 1: Testing API connectivity...');
        
        // Test Odds API directly
        const sportsResponse = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${oddsApiKey}`);
        
        if (!sportsResponse.ok) {
            throw new Error(`API request failed: ${sportsResponse.status}`);
        }
        
        const sports = await sportsResponse.json();
        console.log('✅ Odds API connected, found', sports.length, 'sports');
        
        console.log('\n🎯 Step 2: Fetching today\'s NCAAF games...');
        
        // Get NCAAF odds (today's priority)
        const oddsResponse = await fetch(`https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`);
        
        if (!oddsResponse.ok) {
            throw new Error(`NCAAF odds request failed: ${oddsResponse.status}`);
        }
        
        const ncaafData = await oddsResponse.json();
        console.log('✅ NCAAF data fetched:', ncaafData.length, 'games');
        
        if (ncaafData.length === 0) {
            console.log('ℹ️ No NCAAF games today, checking NFL...');
            
            // Try NFL as fallback
            const nflResponse = await fetch(`https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`);
            
            if (nflResponse.ok) {
                const nflData = await nflResponse.json();
                console.log('✅ NFL data fetched:', nflData.length, 'games');
                
                if (nflData.length > 0) {
                    await processSportsData(supabase, nflData, 'NFL');
                }
            }
        } else {
            await processSportsData(supabase, ncaafData, 'NCAAF');
        }
        
        console.log('\n🎯 Step 3: Updating agent health...');
        
        // Update agent health to show FeedAgent is active
        const { error: healthError } = await supabase
            .from('agent_health')
            .update({
                last_run: new Date().toISOString(),
                status: 'healthy',
                updated_at: new Date().toISOString(),
                details: {
                    uptime: Date.now(),
                    version: '1.0.0',
                    manual_restart: true,
                    data_sources: 'odds-api'
                }
            })
            .eq('agent', 'FeedAgent');
            
        if (healthError) {
            console.warn('⚠️ Could not update agent health:', healthError.message);
        } else {
            console.log('✅ FeedAgent health updated');
        }
        
        console.log('\n🎉 FeedAgent manual startup complete!');
        
    } catch (error) {
        console.error('❌ FeedAgent startup failed:', error.message);
        
        // Log error to agent health
        try {
            await supabase
                .from('agent_health')
                .update({
                    last_run: new Date().toISOString(),
                    status: 'unhealthy',
                    updated_at: new Date().toISOString(),
                    details: {
                        error: error.message,
                        manual_restart_failed: true
                    }
                })
                .eq('agent', 'FeedAgent');
        } catch (e) {
            console.error('Could not log error to agent_health:', e.message);
        }
    }
}

async function processSportsData(supabase, gamesData, sport) {
    let totalPropsInserted = 0;
    
    console.log(`📊 Processing ${gamesData.length} ${sport} games...`);
    
    for (const game of gamesData) {
        try {
            // Convert each market to raw props
            for (const bookmaker of game.bookmakers || []) {
                for (const market of bookmaker.markets || []) {
                    for (const outcome of market.outcomes || []) {
                        
                        const rawProp = {
                            id: crypto.randomUUID(),
                            player_name: outcome.name || 'Team',
                            team: outcome.name,
                            opponent: 'vs',
                            market: market.key,
                            line: outcome.point || 0,
                            over: market.key === 'spreads' ? outcome.price : (outcome.price || 0),
                            under: 0,
                            market_type: market.key,
                            game_time: game.commence_time,
                            external_id: game.id,
                            external_game_id: game.id,
                            provider: 'odds-api',
                            scraped_at: new Date().toISOString(),
                            sport: sport,
                            sport_key: game.sport_key,
                            matchup: `${game.home_team} vs ${game.away_team}`
                        };
                        
                        // Insert into database
                        const { error } = await supabase
                            .from('raw_props')
                            .insert(rawProp);
                        
                        if (error && error.code !== '23505') { // Ignore duplicates
                            console.warn('⚠️ Insert error:', error.message);
                        } else if (!error) {
                            totalPropsInserted++;
                        }
                    }
                }
            }
        } catch (gameError) {
            console.warn(`⚠️ Error processing game ${game.id}:`, gameError.message);
        }
    }
    
    console.log(`✅ Inserted ${totalPropsInserted} ${sport} props into database`);
    return totalPropsInserted;
}

startFeedAgentManually();