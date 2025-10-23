"use strict";
/**
 * The Odds API Integration for Unit Talk Platform
 *
 * This module provides integration with The Odds API for comprehensive sports betting data.
 * API Documentation: https://the-odds-api.com/liveapi/guides/v4/
 *
 * Key Features:
 * - Multi-sport coverage (70+ sports including NCAAF)
 * - Live odds, spreads, totals, and moneylines
 * - Settlement data via scores endpoint
 * - Credit-based usage monitoring
 * - Rate limiting and error handling
 * - Unified data format for existing pipeline
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OddsApiClient = void 0;
exports.getCreditUsageStatus = getCreditUsageStatus;
exports.fetchAvailableSports = fetchAvailableSports;
exports.fetchOdds = fetchOdds;
exports.fetchScores = fetchScores;
exports.fetchOddsApiProps = fetchOddsApiProps;
exports.fetchSettlementData = fetchSettlementData;
exports.clearCreditUsageCache = clearCreditUsageCache;
exports.testOddsApiConnection = testOddsApiConnection;
const crypto_1 = require("crypto");
const axios_1 = __importDefault(require("axios"));
// API Configuration
const API_CONFIG = {
    baseUrl: 'https://api.the-odds-api.com/v4',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
};
// Credit monitoring for free tier (500 credits/month)
const CREDIT_MONITOR = {
    monthlyLimit: 500,
    dailyBudget: 16, // ~500/30 days
    currentUsage: 0,
    resetDate: new Date()
};
// Supported sports with their API keys
const SUPPORTED_SPORTS = {
    // American Football
    'americanfootball_nfl': 'NFL',
    'americanfootball_ncaaf': 'NCAAF',
    // Basketball  
    'basketball_nba': 'NBA',
    'basketball_ncaab': 'NCAAB',
    'basketball_wnba': 'WNBA',
    // Baseball
    'baseball_mlb': 'MLB',
    // Hockey
    'icehockey_nhl': 'NHL',
    // Soccer (major leagues)
    'soccer_epl': 'EPL',
    'soccer_uefa_champs_league': 'UEFA Champions League',
    // Tennis
    'tennis_atp': 'ATP',
    'tennis_wta': 'WTA'
};
// Betting markets available
const BETTING_MARKETS = {
    h2h: 'Head to Head (Moneyline)',
    spreads: 'Point Spreads',
    totals: 'Over/Under Totals',
    outrights: 'Tournament/Season Futures'
};
// Bookmaker regions
const BOOKMAKER_REGIONS = {
    us: 'US Bookmakers',
    uk: 'UK Bookmakers',
    eu: 'European Bookmakers',
    au: 'Australian Bookmakers'
};
/**
 * Credit usage tracking and monitoring
 */
function trackCreditUsage(creditsUsed) {
    CREDIT_MONITOR.currentUsage += creditsUsed;
    // Reset monthly usage if needed
    const now = new Date();
    if (now.getMonth() !== CREDIT_MONITOR.resetDate.getMonth()) {
        CREDIT_MONITOR.currentUsage = creditsUsed;
        CREDIT_MONITOR.resetDate = now;
    }
    console.log(`[OddsAPI] Credits used: ${creditsUsed} | Monthly total: ${CREDIT_MONITOR.currentUsage}/${CREDIT_MONITOR.monthlyLimit}`);
    // Warn if approaching limits
    if (CREDIT_MONITOR.currentUsage >= CREDIT_MONITOR.monthlyLimit * 0.8) {
        console.warn(`[OddsAPI] ⚠️ Approaching monthly credit limit: ${CREDIT_MONITOR.currentUsage}/${CREDIT_MONITOR.monthlyLimit}`);
    }
}
function canMakeRequest() {
    if (CREDIT_MONITOR.currentUsage >= CREDIT_MONITOR.monthlyLimit) {
        return {
            allowed: false,
            reason: `Monthly credit limit exceeded: ${CREDIT_MONITOR.currentUsage}/${CREDIT_MONITOR.monthlyLimit}`
        };
    }
    const dailyUsage = Math.floor(CREDIT_MONITOR.currentUsage / (new Date().getDate()));
    if (dailyUsage >= CREDIT_MONITOR.dailyBudget * 1.5) {
        return {
            allowed: false,
            reason: `Daily credit budget exceeded: ${dailyUsage}/${CREDIT_MONITOR.dailyBudget}`
        };
    }
    return { allowed: true };
}
/**
 * Get current credit usage status
 */
function getCreditUsageStatus() {
    const now = new Date();
    const dailyEstimate = Math.floor(CREDIT_MONITOR.currentUsage / now.getDate());
    return {
        monthlyUsed: CREDIT_MONITOR.currentUsage,
        monthlyLimit: CREDIT_MONITOR.monthlyLimit,
        dailyBudget: CREDIT_MONITOR.dailyBudget,
        dailyEstimate,
        percentUsed: Math.round((CREDIT_MONITOR.currentUsage / CREDIT_MONITOR.monthlyLimit) * 100),
        daysRemaining: 30 - now.getDate(),
        resetDate: CREDIT_MONITOR.resetDate.toISOString()
    };
}
/**
 * Make authenticated API request to The Odds API
 */
async function makeOddsApiRequest(endpoint, params) {
    const apiKey = process.env['ODDS_API_KEY'] || '8014c48eb8a05f289de049c0961ac4cf';
    if (!apiKey) {
        throw new Error('ODDS_API_KEY environment variable is required');
    }
    // Check credit limits before making request
    const creditCheck = canMakeRequest();
    if (!creditCheck.allowed) {
        throw new Error(`Request blocked: ${creditCheck.reason}`);
    }
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    try {
        const response = await axios_1.default.get(url, {
            params: {
                apiKey,
                ...params
            },
            timeout: API_CONFIG.timeout
        });
        // Track credit usage (1 credit per request)
        trackCreditUsage(1);
        // Log remaining credits from response headers
        const remainingCredits = response.headers['x-requests-remaining'];
        if (remainingCredits) {
            console.log(`[OddsAPI] Remaining credits: ${remainingCredits}`);
        }
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            const status = error.response?.status;
            const statusText = error.response?.statusText;
            const responseData = error.response?.data;
            console.error(`[OddsAPI] API Error:`, {
                status,
                statusText,
                url,
                responseData,
                params
            });
            // Handle specific error codes
            if (status === 401) {
                throw new Error('Invalid API key for The Odds API');
            }
            else if (status === 429) {
                throw new Error('Rate limit exceeded for The Odds API');
            }
            else if (status === 422) {
                throw new Error(`Invalid request parameters: ${JSON.stringify(responseData)}`);
            }
            throw new Error(`Odds API request failed (${status}): ${responseData?.message || error.message}`);
        }
        throw error;
    }
}
/**
 * Get list of available sports
 */
async function fetchAvailableSports() {
    console.log('[OddsAPI] Fetching available sports...');
    try {
        const sports = await makeOddsApiRequest('/sports');
        console.log(`[OddsAPI] Found ${sports.length} available sports`);
        // Filter to show only active sports we support
        const supportedSports = sports.filter(sport => Object.keys(SUPPORTED_SPORTS).includes(sport.key) && sport.active);
        console.log(`[OddsAPI] Supported active sports: ${supportedSports.length}`);
        supportedSports.forEach(sport => {
            console.log(`  - ${sport.title} (${sport.key})`);
        });
        return supportedSports;
    }
    catch (error) {
        console.error('[OddsAPI] Failed to fetch sports:', error);
        throw error;
    }
}
/**
 * Fetch odds for a specific sport and market
 */
async function fetchOdds(sportKey, markets = ['h2h', 'spreads', 'totals'], regions = ['us'], oddsFormat = 'american') {
    console.log(`[OddsAPI] Fetching odds for ${sportKey} - Markets: ${markets.join(', ')}`);
    try {
        const games = await makeOddsApiRequest('/sports/' + sportKey + '/odds', {
            regions: regions.join(','),
            markets: markets.join(','),
            oddsFormat,
            dateFormat: 'iso'
        });
        console.log(`[OddsAPI] Fetched odds for ${games.length} games in ${sportKey}`);
        return games;
    }
    catch (error) {
        console.error(`[OddsAPI] Failed to fetch odds for ${sportKey}:`, error);
        throw error;
    }
}
/**
 * Fetch scores/results for settlement data
 */
async function fetchScores(sportKey, daysFrom = 1) {
    console.log(`[OddsAPI] Fetching scores for ${sportKey} (${daysFrom} days)`);
    try {
        const scores = await makeOddsApiRequest('/sports/' + sportKey + '/scores', {
            daysFrom,
            dateFormat: 'iso'
        });
        console.log(`[OddsAPI] Fetched scores for ${scores.length} games in ${sportKey}`);
        return scores;
    }
    catch (error) {
        console.error(`[OddsAPI] Failed to fetch scores for ${sportKey}:`, error);
        throw error;
    }
}
/**
 * Convert Odds API game data to RawProp format for existing pipeline
 */
function convertOddsApiToRawProp(game, market, outcome, bookmaker) {
    const uuid = (0, crypto_1.randomUUID)();
    // Fix: Properly map sport_key to consistent sport/league values
    const sportMapping = SUPPORTED_SPORTS[game.sport_key];
    const sport = sportMapping || game.sport_title || 'UNKNOWN';
    const league = sportMapping || game.sport_title || 'UNKNOWN';
    // Add validation logging for unmapped sports
    if (!sportMapping) {
        console.warn(`[OddsAPI] Unmapped sport_key: ${game.sport_key} → defaulting to: ${sport}`);
    }
    // Determine bet type based on market
    let betType = 'unknown';
    let line = outcome.point || 0;
    let statType = market.key;
    switch (market.key) {
        case 'h2h':
            betType = 'moneyline';
            statType = 'moneyline';
            break;
        case 'spreads':
            betType = 'spread';
            statType = 'spread';
            line = outcome.point || 0;
            break;
        case 'totals':
            betType = 'total';
            statType = 'total';
            line = outcome.point || 0;
            break;
    }
    // Convert American odds to over/under format
    const odds = outcome.price;
    const isPositive = odds > 0;
    return {
        // Required database fields
        id: uuid,
        external_game_id: game.id,
        game_id: null,
        player_name: outcome.name, // Team name for team-based bets
        team: outcome.name.includes(game.home_team) ? game.home_team : game.away_team,
        stat_type: statType,
        line: line,
        over_odds: isPositive ? odds : 0,
        under_odds: isPositive ? 0 : Math.abs(odds),
        provider: 'The Odds API',
        // Timing
        game_time: game.commence_time,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        game_date: game.commence_time.split('T')[0],
        // Teams
        home_team: game.home_team,
        away_team: game.away_team,
        opponent: outcome.name.includes(game.home_team) ? game.away_team : game.home_team,
        // Sport info - Fixed to use proper sport mapping
        sport: sport,
        sport_key: game.sport_key,
        matchup: `${game.away_team} @ ${game.home_team}`,
        // Source identification
        source: 'odds-api',
        // Default values for existing pipeline compatibility
        outcome: null,
        odds: Math.abs(odds),
        trend_confidence: 0,
        matchup_quality: 0,
        line_value_score: 0,
        role_stability: 0,
        confidence_score: 0,
        edge_score: 0,
        tier_tag: null,
        auto_approved: false,
        context_flag: false,
        promoted_to_picks: false,
        promoted_at: null,
        promoted: false,
        is_promoted: false,
        bet_type: betType,
        market_type: statType,
        outcomes: undefined,
        player_id: undefined,
        player_slug: undefined,
        external_id: game.id,
        league: league,
        fair_odds: undefined,
        market: bookmaker.title,
        start_time: game.commence_time,
        home_team_id: null,
        away_team_id: null,
        unit_size: null,
        tier: null,
        ev_percent: null,
        trend_score: null,
        matchup_score: null,
        line_score: null,
        role_score: null,
        direction: null,
        unique_key: `${game.id}-${market.key}-${outcome.name}-${bookmaker.key}`,
        event_id: game.id,
        book: bookmaker.title,
        updated_at: market.last_update,
        is_alt_line: null,
        is_primary: null,
        is_valid: undefined
    };
}
/**
 * Main function to fetch comprehensive odds data and convert to RawProp format
 */
async function fetchOddsApiProps(sportKey = 'americanfootball_ncaaf', markets = ['h2h', 'spreads', 'totals']) {
    try {
        console.log(`[OddsAPI] Fetching comprehensive data for ${sportKey}`);
        const games = await fetchOdds(sportKey, markets);
        const rawProps = [];
        for (const game of games) {
            for (const bookmaker of game.bookmakers) {
                for (const market of bookmaker.markets) {
                    if (markets.includes(market.key)) {
                        for (const outcome of market.outcomes) {
                            const rawProp = convertOddsApiToRawProp(game, market, outcome, bookmaker);
                            rawProps.push(rawProp);
                        }
                    }
                }
            }
        }
        console.log(`[OddsAPI] Converted ${rawProps.length} odds to RawProp format for ${sportKey}`);
        return rawProps;
    }
    catch (error) {
        console.error(`[OddsAPI] Error fetching props for ${sportKey}:`, error);
        return [];
    }
}
/**
 * Get settlement data for completed games
 */
async function fetchSettlementData(sportKey, daysFrom = 1) {
    try {
        const scores = await fetchScores(sportKey, daysFrom);
        // Filter to only completed games with scores
        const settledGames = scores.filter(scoreItem => scoreItem.completed &&
            scoreItem.scores &&
            scoreItem.scores.length > 0);
        console.log(`[OddsAPI] Found ${settledGames.length} completed games with settlement data`);
        return settledGames;
    }
    catch (error) {
        console.error(`[OddsAPI] Error fetching settlement data for ${sportKey}:`, error);
        return [];
    }
}
/**
 * Clear credit usage cache (for testing)
 */
function clearCreditUsageCache() {
    CREDIT_MONITOR.currentUsage = 0;
    CREDIT_MONITOR.resetDate = new Date();
}
/**
 * Test API connectivity and credit status
 */
async function testOddsApiConnection() {
    try {
        console.log('[OddsAPI] Testing API connection...');
        const sports = await fetchAvailableSports();
        const creditStatus = getCreditUsageStatus();
        return {
            connected: true,
            availableSports: sports.length,
            creditStatus
        };
    }
    catch (error) {
        return {
            connected: false,
            availableSports: 0,
            creditStatus: getCreditUsageStatus(),
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
/**
 * OddsApiClient class for compatibility with existing code
 */
class OddsApiClient {
    // private _apiKey: string; // Unused - commented out
    constructor(_apiKey) {
        // this._apiKey = apiKey || process.env['ODDS_API_KEY'] || '8014c48eb8a05f289de049c0961ac4cf';
        // API key handling removed as unused
    }
    async fetchAvailableSports() {
        return fetchAvailableSports();
    }
    async fetchOdds(sportKey, markets = ['h2h', 'spreads', 'totals'], regions = ['us'], oddsFormat = 'american') {
        return fetchOdds(sportKey, markets, regions, oddsFormat);
    }
    async fetchScores(sportKey, daysFrom = 1) {
        return fetchScores(sportKey, daysFrom);
    }
    async fetchOddsApiProps(sportKey = 'americanfootball_ncaaf', markets = ['h2h', 'spreads', 'totals']) {
        return fetchOddsApiProps(sportKey, markets);
    }
    async fetchSettlementData(sportKey, daysFrom = 1) {
        return fetchSettlementData(sportKey, daysFrom);
    }
    async testConnection() {
        return testOddsApiConnection();
    }
    getCreditUsageStatus() {
        return getCreditUsageStatus();
    }
    clearCreditUsageCache() {
        return clearCreditUsageCache();
    }
}
exports.OddsApiClient = OddsApiClient;
