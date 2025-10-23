"use strict";
/**
 * Unified Data Source Router for Unit Talk Platform
 *
 * Intelligently routes data requests between SGO, The Odds API, and Optimal API
 * based on sport, market type, and data requirements.
 *
 * Routing Strategy (UPDATED Sept 18, 2025):
 * - SGO API: PRIMARY for all major sports - comprehensive coverage with real-time updates
 * - Odds API: Secondary for settlement data, NCAAF, and fallback
 * - Optimal API: Tertiary fallback (currently expired API key)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUnifiedData = fetchUnifiedData;
exports.getCreditStatus = getCreditStatus;
exports.healthCheck = healthCheck;
const oddsApi_1 = require("./oddsApi");
const optimal_1 = require("./optimal");
const sgoFetcher_1 = require("../../logic/providers/sgoFetcher");
// Enhanced sport mapping with routing logic - SGO API PRIORITY
const SPORT_ROUTING_CONFIG = {
    // SGO API PRIMARY for all major sports (real-time, comprehensive coverage)
    'NFL': {
        primary: 'sgo-api',
        secondary: 'odds-api',
        tertiary: 'optimal-api',
        sgoLeagueID: 'NFL',
        oddsApiKey: 'americanfootball_nfl',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement']
    },
    'NBA': {
        primary: 'sgo-api',
        secondary: 'odds-api',
        tertiary: 'optimal-api',
        sgoLeagueID: 'NBA',
        oddsApiKey: 'basketball_nba',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement']
    },
    'MLB': {
        primary: 'sgo-api',
        secondary: 'odds-api',
        tertiary: 'optimal-api',
        sgoLeagueID: 'MLB',
        oddsApiKey: 'baseball_mlb',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement']
    },
    'NHL': {
        primary: 'sgo-api',
        secondary: 'odds-api',
        tertiary: 'optimal-api',
        sgoLeagueID: 'NHL',
        oddsApiKey: 'icehockey_nhl',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement']
    },
    // NCAAF uses Odds API as primary (SGO may have limited coverage)
    'NCAAF': {
        primary: 'odds-api',
        secondary: 'sgo-api',
        tertiary: null,
        sgoLeagueID: 'NCAAF',
        oddsApiKey: 'americanfootball_ncaaf',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'futures', 'settlement']
    },
    // Odds API Exclusive (new sports not yet in SGO)
    'NCAAB': {
        primary: 'odds-api',
        secondary: null,
        tertiary: null,
        sgoLeagueID: 'NCAAB',
        oddsApiKey: 'basketball_ncaab',
        supports: ['spreads', 'totals', 'moneylines', 'futures', 'settlement']
    },
    'WNBA': {
        primary: 'odds-api',
        secondary: 'sgo-api',
        tertiary: null,
        sgoLeagueID: 'WNBA',
        oddsApiKey: 'basketball_wnba',
        supports: ['spreads', 'totals', 'moneylines', 'settlement']
    },
    'EPL': {
        primary: 'odds-api',
        secondary: null,
        tertiary: null,
        sgoLeagueID: null,
        oddsApiKey: 'soccer_epl',
        supports: ['moneylines', 'totals', 'settlement']
    },
    'ATP': {
        primary: 'odds-api',
        secondary: null,
        tertiary: null,
        sgoLeagueID: null,
        oddsApiKey: 'tennis_atp',
        supports: ['moneylines', 'settlement']
    }
};
/**
 * Get routing configuration for a sport
 */
function getRoutingConfig(sport) {
    const normalizedSport = sport.toUpperCase();
    return SPORT_ROUTING_CONFIG[normalizedSport] || null;
}
/**
 * Determine optimal data source based on request
 */
function determineDataSource(request) {
    // Force source if specified
    if (request.forceSource) {
        return {
            source: request.forceSource,
            reason: 'User-specified force override'
        };
    }
    const config = getRoutingConfig(request.sport);
    // Unknown sport - default to SGO for broader coverage
    if (!config) {
        return {
            source: 'sgo-api',
            fallback: 'odds-api',
            reason: `Unknown sport ${request.sport}, defaulting to SGO API for comprehensive coverage`
        };
    }
    // Settlement data always goes to Odds API (SGO and Optimal don't support it)
    if (request.marketType === 'settlement' || request.includeSettlement) {
        return {
            source: 'odds-api',
            reason: 'Settlement data required - only available via Odds API'
        };
    }
    // Use configured routing strategy
    return {
        source: config.primary,
        fallback: config.secondary || undefined,
        tertiary: config.tertiary || undefined,
        reason: `Using configured primary source (${config.primary}) for ${request.sport}`
    };
}
/**
 * Fetch data from SGO API
 */
async function fetchFromSGO(request) {
    console.log(`[DataRouter] Fetching from SGO API: ${request.sport}`);
    const config = getRoutingConfig(request.sport);
    if (!config?.sgoLeagueID) {
        throw new Error(`No SGO configuration found for sport: ${request.sport}`);
    }
    const apiKey = process.env.SGO_API_KEY;
    if (!apiKey) {
        throw new Error('SGO_API_KEY environment variable not set');
    }
    try {
        // Fetch data from SGO
        const sgoProps = await (0, sgoFetcher_1.fetchAndFlattenSGOProps)({
            apiKey,
            leagueID: config.sgoLeagueID,
            oddsAvailable: true,
            limit: 100
        });
        console.log(`[SGO] Fetched ${sgoProps.length} props from SGO API`);
        // CRITICAL FIX: Group OVER/UNDER pairs correctly
        const groupedProps = new Map();
        // Group props by unique key (player + stat + line)
        sgoProps.forEach((sgoProp) => {
            const key = `${sgoProp.playerName || 'unknown'}-${sgoProp.statType}-${sgoProp.line}`;
            if (!groupedProps.has(key)) {
                groupedProps.set(key, {});
            }
            const group = groupedProps.get(key);
            if (sgoProp.direction === 'over') {
                group.over = sgoProp;
            }
            else if (sgoProp.direction === 'under') {
                group.under = sgoProp;
            }
        });
        // Transform grouped props to RawProp format
        const rawProps = Array.from(groupedProps.values())
            .filter(group => group.over && group.under) // Only include complete pairs
            .map((group) => {
            const overProp = group.over;
            const underProp = group.under;
            return {
                // Required fields
                id: crypto.randomUUID(),
                player_name: overProp.playerName || '',
                sport: request.sport,
                team: overProp.homeTeam || '',
                opponent: overProp.awayTeam || '',
                stat_type: overProp.statType || '',
                line: parseFloat(String(overProp.line)) || 0,
                game_date: overProp.startsAtUTC ? new Date(overProp.startsAtUTC).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                matchup: `${overProp.homeTeam} vs ${overProp.awayTeam}`,
                // Market and odds fields - NOW WITH BOTH SIDES!
                market: overProp.statType || '',
                market_type: 'player_prop',
                over: parseFloat(String(overProp.odds)) || 0,
                under: parseFloat(String(underProp.odds)) || 0,
                over_odds: parseFloat(String(overProp.odds)) || null,
                under_odds: parseFloat(String(underProp.odds)) || null,
                // Game timing
                game_time: overProp.startsAtUTC || new Date().toISOString(),
                start_time: overProp.startsAtUTC || null,
                // Provider and metadata
                provider: 'SGO',
                external_id: overProp.eventID || crypto.randomUUID(),
                external_game_id: overProp.eventID || null,
                game_id: null, // Set to null to avoid foreign key constraint
                sport_key: request.sport.toLowerCase(),
                // Data quality and validation
                is_valid: true,
                is_primary: true,
                is_alt_line: false,
                auto_approved: false,
                context_flag: false,
                promoted: false,
                is_promoted: false,
                promoted_to_picks: false,
                steam_detected: false,
                contrarian_opportunity: false,
                is_canary: false,
                // Professional scoring columns (default values)
                professional_score: null,
                kelly_fraction: null,
                tier: null,
                confidence: null,
                edge_score: null,
                processing_time: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                // Additional fields
                source_url: null,
                notes: null,
                tags: null,
                source: 'SGO',
                confidence_score: null,
                edge_score_decimal: null,
                line_movement: null,
                sharp_money: null,
                closing_line_value: null,
                injury_timing_advantage: null,
                cross_market_arbitrage: null,
                position: null,
                description: null,
                sportsbook: null,
                direction: null, // This will be set in scoring logic
            };
        });
        return rawProps;
    }
    catch (error) {
        console.error(`[DataRouter] SGO API error for ${request.sport}:`, error);
        throw error;
    }
}
/**
 * Fetch data from Optimal API
 */
async function fetchFromOptimal(request) {
    console.log(`[DataRouter] Fetching from Optimal API: ${request.sport}`);
    try {
        return await (0, optimal_1.fetchOptimalProps)(request.sport, request.date);
    }
    catch (error) {
        console.error(`[DataRouter] Optimal API error for ${request.sport}:`, error);
        throw error;
    }
}
/**
 * Fetch data from Odds API
 */
async function fetchFromOddsApi(request) {
    console.log(`[DataRouter] Fetching from Odds API: ${request.sport}`);
    const config = getRoutingConfig(request.sport);
    if (!config) {
        throw new Error(`No Odds API configuration found for sport: ${request.sport}`);
    }
    try {
        // Determine markets to fetch
        const markets = [];
        if (!request.marketType || request.marketType === 'spreads') {
            markets.push('spreads');
        }
        if (!request.marketType || request.marketType === 'totals') {
            markets.push('totals');
        }
        if (!request.marketType || request.marketType === 'moneylines') {
            markets.push('h2h');
        }
        if (request.marketType === 'futures') {
            markets.push('outrights');
        }
        // Default to comprehensive markets if none specified
        if (markets.length === 0) {
            markets.push('h2h', 'spreads', 'totals');
        }
        return await (0, oddsApi_1.fetchOddsApiProps)(config.oddsApiKey, markets);
    }
    catch (error) {
        console.error(`[DataRouter] Odds API error for ${request.sport}:`, error);
        throw error;
    }
}
/**
 * Main unified data fetching function with SGO priority
 */
async function fetchUnifiedData(request) {
    const startTime = Date.now();
    const errors = [];
    console.log(`[DataRouter] Processing request:`, {
        sport: request.sport,
        marketType: request.marketType,
        date: request.date,
        forceSource: request.forceSource
    });
    // Determine routing strategy
    const routing = determineDataSource(request);
    console.log(`[DataRouter] Routing decision: ${routing.source} (${routing.reason})`);
    let data = [];
    let actualSource = routing.source;
    try {
        // Attempt primary source
        if (routing.source === 'sgo-api') {
            data = await fetchFromSGO(request);
        }
        else if (routing.source === 'optimal-api') {
            data = await fetchFromOptimal(request);
        }
        else if (routing.source === 'odds-api') {
            data = await fetchFromOddsApi(request);
        }
        console.log(`[DataRouter] Successfully fetched ${data.length} records from ${routing.source}`);
    }
    catch (primaryError) {
        errors.push(`Primary source (${routing.source}) failed: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}`);
        console.warn(`[DataRouter] Primary source failed, attempting fallback:`, primaryError);
        // Attempt fallback if available
        if (routing.fallback) {
            try {
                actualSource = routing.fallback;
                if (routing.fallback === 'sgo-api') {
                    data = await fetchFromSGO(request);
                }
                else if (routing.fallback === 'optimal-api') {
                    data = await fetchFromOptimal(request);
                }
                else if (routing.fallback === 'odds-api') {
                    data = await fetchFromOddsApi(request);
                }
                console.log(`[DataRouter] Fallback successful: ${data.length} records from ${routing.fallback}`);
            }
            catch (fallbackError) {
                errors.push(`Fallback source (${routing.fallback}) failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
                console.warn(`[DataRouter] Fallback failed, attempting tertiary:`, fallbackError);
                // Attempt tertiary fallback if available
                if (routing.tertiary) {
                    try {
                        actualSource = routing.tertiary;
                        if (routing.tertiary === 'sgo-api') {
                            data = await fetchFromSGO(request);
                        }
                        else if (routing.tertiary === 'optimal-api') {
                            data = await fetchFromOptimal(request);
                        }
                        else if (routing.tertiary === 'odds-api') {
                            data = await fetchFromOddsApi(request);
                        }
                        console.log(`[DataRouter] Tertiary fallback successful: ${data.length} records from ${routing.tertiary}`);
                    }
                    catch (tertiaryError) {
                        errors.push(`Tertiary source (${routing.tertiary}) failed: ${tertiaryError instanceof Error ? tertiaryError.message : 'Unknown error'}`);
                        console.error(`[DataRouter] All sources failed`);
                        // Return empty result with errors
                        actualSource = routing.source; // Keep original for error reporting
                    }
                }
            }
        }
    }
    const processingTime = Date.now() - startTime;
    const response = {
        data,
        source: actualSource,
        sport: request.sport,
        marketType: request.marketType,
        timestamp: new Date().toISOString(),
        metadata: {
            totalRecords: data.length,
            processingTimeMs: processingTime,
            errors,
        }
    };
    console.log(`[DataRouter] Request completed: ${JSON.stringify({
        source: actualSource,
        records: data.length,
        timeMs: processingTime,
        hasErrors: errors.length > 0
    })}`);
    return response;
}
/**
 * Get current credit usage for cost monitoring
 */
async function getCreditStatus() {
    try {
        const oddsApiStatus = await (0, oddsApi_1.getCreditUsageStatus)();
        return {
            oddsApi: oddsApiStatus,
            optimal: { status: 'API key expired - needs renewal' },
            sgo: { status: 'Active and operational' }
        };
    }
    catch (error) {
        return {
            oddsApi: { used: 0, remaining: 0 },
            optimal: { status: 'API key expired - needs renewal' },
            sgo: { status: 'Active and operational' }
        };
    }
}
/**
 * Health check for all data sources
 */
async function healthCheck() {
    const results = {
        sgo: { status: 'healthy', message: 'SGO API operational' },
        oddsApi: { status: 'healthy', message: 'Odds API operational' },
        optimal: { status: 'unhealthy', message: 'API key expired - needs renewal' }
    };
    // Test SGO API
    try {
        const apiKey = process.env.SGO_API_KEY;
        if (!apiKey) {
            results.sgo = { status: 'unhealthy', message: 'SGO_API_KEY not configured' };
        }
        else {
            // Quick test call
            await (0, sgoFetcher_1.fetchAndFlattenSGOProps)({
                apiKey,
                leagueID: 'NFL',
                limit: 1,
                oddsAvailable: true
            });
        }
    }
    catch (error) {
        results.sgo = { status: 'unhealthy', message: `SGO API error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
    // Test Odds API
    try {
        await (0, oddsApi_1.getCreditUsageStatus)();
    }
    catch (error) {
        results.oddsApi = { status: 'unhealthy', message: `Odds API error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
    return results;
}
