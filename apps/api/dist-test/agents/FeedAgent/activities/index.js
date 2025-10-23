"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activities = void 0;
exports.getProviderHealth = getProviderHealth;
exports.fetchFromProviderActivity = fetchFromProviderActivity;
exports.ingestUnifiedData = ingestUnifiedData;
exports.fetchFeed = fetchFeed;
exports.checkQuotaStatus = checkQuotaStatus;
exports.getLiveGames = getLiveGames;
const workflow_1 = require("@temporalio/workflow");
const fetchRawProps_1 = require("../../IngestionAgent/fetchRawProps");
const dataSourceRouter_1 = require("../dataSourceRouter");
const supabaseClient_1 = require("../../../services/supabaseClient");
const circuitBreakers = new Map();
const CIRCUIT_BREAKER_THRESHOLD = 10;
const CIRCUIT_BREAKER_TIMEOUT = 10 * 60 * 1000; // 10 minutes
// Exponential backoff with jitter
function calculateBackoff(attempt) {
    const base = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
    const jitter = Math.random() * 0.1 * base; // 10% jitter
    return Math.floor(base + jitter);
}
// Circuit breaker implementation
function checkCircuitBreaker(provider) {
    const state = circuitBreakers.get(provider);
    if (!state)
        return true;
    if (state.isOpen) {
        const now = Date.now();
        if (now - state.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
            state.isOpen = false;
            state.failures = 0;
            console.log(`Circuit breaker reset for ${provider}`);
            return true;
        }
        return false;
    }
    return true;
}
function recordFailure(provider) {
    const state = circuitBreakers.get(provider) || { failures: 0, lastFailureTime: 0, isOpen: false };
    state.failures++;
    state.lastFailureTime = Date.now();
    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
        state.isOpen = true;
        console.error(`Circuit breaker opened for ${provider} after ${state.failures} failures`);
    }
    circuitBreakers.set(provider, state);
}
function recordSuccess(provider) {
    const state = circuitBreakers.get(provider);
    if (state) {
        state.failures = 0;
        state.isOpen = false;
    }
}
const providerHealthMap = new Map();
// Export function to get provider health for monitoring endpoint
function getProviderHealth() {
    const providers = {};
    const circuitBreakersObj = {};
    // Convert provider health map to object
    for (const [provider, health] of providerHealthMap.entries()) {
        providers[provider] = health;
    }
    // Convert circuit breakers map to object
    for (const [provider, state] of circuitBreakers.entries()) {
        circuitBreakersObj[provider] = state;
    }
    return { providers, circuitBreakers: circuitBreakersObj };
}
// Activity function for fetching data from providers
async function fetchFromProviderActivity(provider) {
    try {
        // Create a basic provider config for the activity
        const providerConfig = {
            name: provider,
            enabled: true,
            url: 'https://api.example.com',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            apiKey: 'mock-key',
            headers: {},
            rateLimit: {
                requests: 100,
                window: 60000
            }
        };
        const result = await (0, fetchRawProps_1.fetchRawProps)(providerConfig);
        // Ensure all RawProp objects have required id field
        const propsWithIds = result.map(prop => ({
            ...prop,
            id: prop.id || crypto.randomUUID()
        }));
        return propsWithIds;
    }
    catch (error) {
        console.error(`Failed to fetch from provider ${provider}:`, error);
        throw error;
    }
}
// New unified data ingestion activity with database persistence
async function ingestUnifiedData(params) {
    const provider = `${params.league.toLowerCase()}-ingestion`;
    let attempt = 0;
    const maxAttempts = 3;
    // Check circuit breaker
    if (!checkCircuitBreaker(provider)) {
        return {
            success: false,
            count: 0,
            source: 'circuit-breaker',
            error: 'Circuit breaker is open - too many recent failures'
        };
    }
    while (attempt < maxAttempts) {
        try {
            console.log(`[FeedAgent] Starting unified ingestion for ${params.league} (attempt ${attempt + 1})`);
            // Fetch data from unified router
            const response = await (0, dataSourceRouter_1.fetchUnifiedData)({
                sport: params.league,
                marketType: 'player-props'
            });
            console.log(`[FeedAgent] Fetched ${response.data.length} props from ${response.source}`);
            // **CRITICAL FIX: Actually persist data to database**
            if (response.data.length > 0) {
                const batchId = crypto.randomUUID();
                const timestamp = new Date();
                // Extract unique games from the props
                const gamesMap = new Map();
                response.data.forEach(prop => {
                    if (prop.game_id && !gamesMap.has(prop.game_id)) {
                        gamesMap.set(prop.game_id, {
                            id: crypto.randomUUID(),
                            external_game_id: prop.game_id,
                            sport: params.league,
                            home_team: prop.home_team || prop.team,
                            away_team: prop.away_team || prop.opponent,
                            game_date: prop.game_date || prop.game_time || timestamp.toISOString(),
                            status: 'scheduled',
                            created_at: timestamp.toISOString(),
                            updated_at: timestamp.toISOString(),
                            metadata: {
                                source: response.source,
                                batch_id: batchId
                            }
                        });
                    }
                });
                // Insert games if any were found
                if (gamesMap.size > 0) {
                    const games = Array.from(gamesMap.values());
                    console.log(`[FeedAgent] Inserting ${games.length} unique games`);
                    const { error: gamesError } = await supabaseClient_1.supabaseClient
                        .from('games')
                        .upsert(games, {
                        onConflict: 'external_game_id',
                        ignoreDuplicates: true
                    });
                    if (gamesError) {
                        console.warn(`[FeedAgent] Games insert warning:`, gamesError);
                    }
                    else {
                        console.log(`[FeedAgent] Successfully stored ${games.length} games`);
                    }
                }
                // Prepare props for insertion with proper structure
                const propsForDB = response.data.map(prop => ({
                    id: crypto.randomUUID(),
                    external_prop_id: prop.id || crypto.randomUUID(),
                    sport: params.league,
                    league: params.league,
                    player_name: prop.player_name,
                    stat_type: prop.stat_type,
                    line: prop.line,
                    over_odds: prop.over_odds,
                    under_odds: prop.under_odds,
                    game_id: prop.game_id,
                    team: prop.team,
                    opponent: prop.opponent,
                    game_date: prop.game_date || timestamp.toISOString(),
                    source: response.source,
                    provider: response.source,
                    batch_id: batchId,
                    created_at: timestamp.toISOString(),
                    updated_at: timestamp.toISOString(),
                    processed_at: null,
                    raw_data: JSON.stringify(prop),
                    metadata: {
                        source: response.source,
                        batch_id: batchId,
                        processing_time_ms: response.metadata.processingTimeMs,
                        league: params.league
                    }
                }));
                // Insert in batches to handle large datasets
                const batchSize = params.batchSize || 100;
                let insertedCount = 0;
                for (let i = 0; i < propsForDB.length; i += batchSize) {
                    const batch = propsForDB.slice(i, i + batchSize);
                    const { error: insertError } = await supabaseClient_1.supabaseClient
                        .from('raw_props')
                        .insert(batch);
                    if (insertError) {
                        console.error(`[FeedAgent] Database insert failed for batch ${Math.floor(i / batchSize) + 1}:`, insertError);
                        throw new Error(`Database insert failed: ${insertError.message}`);
                    }
                    insertedCount += batch.length;
                    console.log(`[FeedAgent] Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(propsForDB.length / batchSize)} (${insertedCount} total)`);
                }
                console.log(`[FeedAgent] Successfully persisted ${insertedCount} props to database with batch_id: ${batchId}`);
                // Update provider health
                recordSuccess(provider);
                const health = {
                    provider,
                    lastSuccess: new Date(),
                    status: 'healthy',
                    consecutiveFailures: 0
                };
                providerHealthMap.set(provider, health);
                return {
                    success: true,
                    count: insertedCount,
                    source: response.source,
                    propCount: insertedCount,
                    batchId
                };
            }
            else {
                console.warn(`[FeedAgent] No props received from ${response.source} for ${params.league}`);
                return {
                    success: true,
                    count: 0,
                    source: response.source
                };
            }
        }
        catch (error) {
            attempt++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[FeedAgent] Attempt ${attempt} failed for ${params.league}:`, errorMessage);
            // Record failure for circuit breaker
            recordFailure(provider);
            // Update provider health
            const health = {
                provider,
                lastSuccess: providerHealthMap.get(provider)?.lastSuccess || null,
                status: attempt >= maxAttempts ? 'failed' : 'degraded',
                consecutiveFailures: attempt,
                lastError: errorMessage
            };
            providerHealthMap.set(provider, health);
            if (attempt < maxAttempts) {
                const backoffMs = calculateBackoff(attempt - 1);
                console.log(`[FeedAgent] Waiting ${backoffMs}ms before retry ${attempt + 1}`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
            else {
                return {
                    success: false,
                    count: 0,
                    source: 'failed',
                    error: `All ${maxAttempts} attempts failed. Last error: ${errorMessage}`
                };
            }
        }
    }
    return {
        success: false,
        count: 0,
        source: 'exhausted',
        error: 'Maximum retry attempts exhausted'
    };
}
// Export the activity for Temporal workflows
exports.activities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '10 minutes',
    retry: {
        maximumAttempts: 3,
        initialInterval: '1s',
    }
});
// Feed activity for schedule workflows
async function fetchFeed(params) {
    try {
        console.log(`[FeedAgent] Fetching ${params.league} feed data (peak time: ${params.isPeakTime || false})`);
        // Fetch unified data for the league
        const response = await (0, dataSourceRouter_1.fetchUnifiedData)({
            sport: params.league,
            marketType: 'player-props'
        });
        return {
            success: true,
            message: `Successfully fetched ${response.data.length} items for ${params.league}`,
            data: {
                league: params.league,
                count: response.data.length,
                source: response.source,
                isPeakTime: params.isPeakTime || false,
                timestamp: params.timestamp || new Date().toISOString()
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[FeedAgent] Failed to fetch feed for ${params.league}:`, errorMessage);
        return {
            success: false,
            message: `Failed to fetch feed for ${params.league}: ${errorMessage}`
        };
    }
}
// Remove duplicate function - using the one defined earlier
// Missing activities that Temporal workflows are trying to call
async function checkQuotaStatus(params) {
    try {
        console.log(`[FeedAgent] Checking quota status for ${params.provider}`);
        // Implement actual quota checking logic here
        // For now, return a basic response
        return {
            success: true,
            usage: {
                remaining: 9999, // Placeholder
                used: 1,
                resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }
        };
    }
    catch (error) {
        console.error(`[FeedAgent] Quota check failed:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
async function getLiveGames() {
    try {
        console.log(`[FeedAgent] Fetching live games`);
        // Implement actual live games detection
        // For now, return empty array
        return {
            success: true,
            games: []
        };
    }
    catch (error) {
        console.error(`[FeedAgent] Live games fetch failed:`, error);
        return {
            success: false,
            games: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
// All required activities are already individually exported above
// No additional exports needed
