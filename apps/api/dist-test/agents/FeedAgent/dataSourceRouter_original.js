"use strict";
/**
 * Unified Data Source Router for Unit Talk Platform
 *
 * Intelligently routes data requests between The Odds API and Optimal API
 * based on sport, market type, and data requirements.
 *
 * Routing Strategy:
 * - Odds API: Primary for NCAAF, settlement data, spreads, totals, moneylines
 * - Optimal API: Secondary for specialized player props in major sports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUnifiedData = fetchUnifiedData;
exports.fetchUnifiedSettlement = fetchUnifiedSettlement;
exports.getRoutingInfo = getRoutingInfo;
exports.getSystemStatus = getSystemStatus;
const oddsApi_1 = require("./oddsApi");
const optimal_1 = require("./optimal");
// Enhanced sport mapping with routing logic - OPTIMAL API PRIORITY
const SPORT_ROUTING_CONFIG = {
    // OPTIMAL API PRIMARY for all major sports (user preference)
    'NCAAF': {
        primary: 'optimal-api',
        secondary: 'odds-api',
        oddsApiKey: 'americanfootball_ncaaf',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'futures', 'settlement']
    },
    'NFL': {
        primary: 'optimal-api',
        secondary: 'odds-api',
        oddsApiKey: 'americanfootball_nfl',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement']
    },
    'NBA': {
        primary: 'optimal-api',
        secondary: 'odds-api',
        oddsApiKey: 'basketball_nba',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement']
    },
    'MLB': {
        primary: 'optimal-api',
        secondary: 'odds-api',
        oddsApiKey: 'baseball_mlb',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement']
    },
    'NHL': {
        primary: 'optimal-api',
        secondary: 'odds-api',
        oddsApiKey: 'icehockey_nhl',
        supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement']
    },
    // Odds API Exclusive (new sports)
    'NCAAB': {
        primary: 'odds-api',
        secondary: null,
        oddsApiKey: 'basketball_ncaab',
        supports: ['spreads', 'totals', 'moneylines', 'futures', 'settlement']
    },
    'WNBA': {
        primary: 'odds-api',
        secondary: null,
        oddsApiKey: 'basketball_wnba',
        supports: ['spreads', 'totals', 'moneylines', 'settlement']
    },
    'EPL': {
        primary: 'odds-api',
        secondary: null,
        oddsApiKey: 'soccer_epl',
        supports: ['moneylines', 'totals', 'settlement']
    },
    'ATP': {
        primary: 'odds-api',
        secondary: null,
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
    // Unknown sport - default to Odds API for broader coverage
    if (!config) {
        return {
            source: 'odds-api',
            reason: `Unknown sport ${request.sport}, defaulting to Odds API for coverage`
        };
    }
    // Settlement data always goes to Odds API (Optimal doesn't support it)
    if (request.marketType === 'settlement' || request.includeSettlement) {
        return {
            source: 'odds-api',
            reason: 'Settlement data required - only available via Odds API'
        };
    }
    // Player props preference
    if (request.marketType === 'player-props') {
        if ([...config.supports].includes('player-props') && config.primary === 'optimal-api') {
            return {
                source: 'optimal-api',
                fallback: config.secondary || undefined,
                reason: 'Player props specialist - Optimal API preferred'
            };
        }
        else {
            return {
                source: 'odds-api',
                reason: 'Player props requested but Optimal API not available for this sport'
            };
        }
    }
    // NCAAF should use Odds API (Optimal doesn't support it properly)
    if (request.sport.toUpperCase() === 'NCAAF') {
        return {
            source: 'odds-api',
            reason: 'NCAAF only available via Odds API (Optimal unsupported)'
        };
    }
    // Use configured primary source
    return {
        source: config.primary,
        fallback: config.secondary || undefined,
        reason: `Using configured primary source for ${request.sport}`
    };
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
 * Main unified data fetching function
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
        if (routing.source === 'optimal-api') {
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
                if (routing.fallback === 'optimal-api') {
                    data = await fetchFromOptimal(request);
                }
                else if (routing.fallback === 'odds-api') {
                    data = await fetchFromOddsApi(request);
                }
                console.log(`[DataRouter] Fallback successful: ${data.length} records from ${routing.fallback}`);
            }
            catch (fallbackError) {
                errors.push(`Fallback source (${routing.fallback}) failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
                console.error(`[DataRouter] Both primary and fallback sources failed`);
                // Return empty result with errors
                actualSource = routing.source; // Keep original for error reporting
            }
        }
    }
    const processingTime = Date.now() - startTime;
    // Get credit usage info if from Odds API
    let creditsUsed;
    if (actualSource === 'odds-api') {
        (0, oddsApi_1.getCreditUsageStatus)(); // Credit status tracking
        creditsUsed = 1; // Each request typically uses 1 credit
    }
    const response = {
        data,
        source: actualSource,
        sport: request.sport,
        marketType: request.marketType,
        timestamp: new Date().toISOString(),
        metadata: {
            totalRecords: data.length,
            processingTimeMs: processingTime,
            creditsUsed,
            errors
        }
    };
    console.log(`[DataRouter] Request completed:`, {
        source: actualSource,
        records: data.length,
        timeMs: processingTime,
        hasErrors: errors.length > 0
    });
    return response;
}
/**
 * Fetch settlement data (always from Odds API)
 */
async function fetchUnifiedSettlement(sport, daysFrom = 1) {
    const startTime = Date.now();
    console.log(`[DataRouter] Fetching settlement data for ${sport} (${daysFrom} days)`);
    const config = getRoutingConfig(sport);
    if (!config) {
        throw new Error(`No settlement configuration found for sport: ${sport}`);
    }
    try {
        const settlementData = await (0, oddsApi_1.fetchSettlementData)(config.oddsApiKey, daysFrom);
        // Convert settlement data to RawProp format for consistency
        // Note: This would need additional conversion logic for settlement-specific data
        const data = []; // Placeholder - settlement data has different structure
        const response = {
            data,
            source: 'odds-api',
            sport,
            marketType: 'settlement',
            timestamp: new Date().toISOString(),
            metadata: {
                totalRecords: settlementData.length,
                processingTimeMs: Date.now() - startTime,
                creditsUsed: 1,
                errors: []
            }
        };
        console.log(`[DataRouter] Settlement data fetched: ${settlementData.length} games`);
        return response;
    }
    catch (error) {
        console.error(`[DataRouter] Settlement fetch failed for ${sport}:`, error);
        throw error;
    }
}
/**
 * Get routing information for a sport (for debugging/admin)
 */
function getRoutingInfo(sport) {
    const config = getRoutingConfig(sport);
    if (!config) {
        return {
            supported: false,
            message: `Sport ${sport} not found in routing configuration`
        };
    }
    return {
        supported: true,
        sport: sport.toUpperCase(),
        primary: config.primary,
        secondary: config.secondary,
        oddsApiKey: config.oddsApiKey,
        supportedMarkets: config.supports,
        recommendation: config.primary === 'odds-api'
            ? 'Use Odds API for comprehensive market coverage'
            : 'Use Optimal API for specialized player props, Odds API for settlement'
    };
}
/**
 * Get system status across all data sources
 */
async function getSystemStatus() {
    const creditStatus = (0, oddsApi_1.getCreditUsageStatus)();
    return {
        timestamp: new Date().toISOString(),
        oddsApi: {
            available: true, // Would test connectivity in production
            creditStatus,
            supportedSports: Object.keys(SPORT_ROUTING_CONFIG).filter(sport => SPORT_ROUTING_CONFIG[sport].primary === 'odds-api' ||
                SPORT_ROUTING_CONFIG[sport].secondary === 'odds-api').length
        },
        optimalApi: {
            available: true, // Would test connectivity in production  
            supportedSports: Object.keys(SPORT_ROUTING_CONFIG).filter(sport => SPORT_ROUTING_CONFIG[sport].primary === 'optimal-api').length
        },
        routing: {
            totalSports: Object.keys(SPORT_ROUTING_CONFIG).length,
            oddsApiPrimary: Object.values(SPORT_ROUTING_CONFIG).filter(c => c.primary === 'odds-api').length,
            optimalApiPrimary: Object.values(SPORT_ROUTING_CONFIG).filter(c => c.primary === 'optimal-api').length
        }
    };
}
