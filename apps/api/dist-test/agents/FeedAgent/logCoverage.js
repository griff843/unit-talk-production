"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCoverage = logCoverage;
const REQUIRED_MARKETS = [
    'points', 'rebounds', 'assists', 'threes', 'blocks',
    'steals', 'turnovers', 'doubleDouble', 'tripleDouble'
];
/**
 * Log coverage data to the coverage_logs table and calculate coverage metrics
 * @param log - Coverage log data
 * @param supabase - Supabase client instance
 * @returns Coverage metrics
 */
async function logCoverage(log, supabase) {
    try {
        // Log to database
        const { error } = await supabase
            .from('coverage_logs')
            .insert({
            provider: log.provider,
            data: log.data,
            timestamp: log.timestamp
        });
        if (error) {
            console.error('Error logging coverage:', error);
        }
        // Calculate coverage metrics
        const covered = new Set();
        const missing = new Set(REQUIRED_MARKETS);
        if (log.data) {
            if (log.provider === 'SportsGameOdds' && Array.isArray(log.data['markets'])) {
                log.data['markets'].forEach((market) => {
                    if (market.type) {
                        covered.add(market.type.toLowerCase());
                        missing.delete(market.type.toLowerCase());
                    }
                });
            }
            else if (log.provider === 'OddsAPI' && log.data['props']) {
                Object.keys(log.data['props']).forEach(market => {
                    covered.add(market.toLowerCase());
                    missing.delete(market.toLowerCase());
                });
            }
        }
        return {
            covered: covered.size,
            missing: Array.from(missing)
        };
    }
    catch (err) {
        console.error('Failed to log coverage:', err);
        return {
            covered: 0,
            missing: REQUIRED_MARKETS
        };
    }
}
