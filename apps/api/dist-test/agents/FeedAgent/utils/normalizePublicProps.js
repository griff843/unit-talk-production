"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propSchema = exports.allowedMarkets = void 0;
exports.normalizePublicProps = normalizePublicProps;
const zod_1 = require("zod");
const logCoverage_1 = require("../logCoverage");
/**
 * List of allowed public prop market types for ingestion.
 * Extend as your system grows.
 */
exports.allowedMarkets = [
    'Anytime Touchdown Scorer',
    'Anytime Home Run',
    'First Basket Scorer',
    'Anytime Goal Scorer'
];
/**
 * Schema for incoming raw prop data.
 * Extend this as upstream providers evolve.
 */
exports.propSchema = zod_1.z.object({
    external_game_id: zod_1.z.string(),
    player_name: zod_1.z.string(),
    market_type: zod_1.z.string(),
    team_name: zod_1.z.string(),
    line: zod_1.z.number().optional(),
    odds: zod_1.z.number(),
    book_name: zod_1.z.string(),
    game_date: zod_1.z.string().datetime(),
    sport: zod_1.z.string().optional(),
    league: zod_1.z.string().optional(),
    // You can add more fields if needed
});
/**
 * Normalizes and validates incoming public prop data.
 * Returns only props matching allowed markets and valid schema.
 * @param rawProps Array of raw public prop objects from provider API
 * @param provider The provider name (used for logging)
 * @param enableLogging Should failures/skips be logged?
 * @param supabase Supabase client for logging coverage
 */
async function normalizePublicProps(rawProps, provider = 'SportsGameOdds', enableLogging = true, supabase) {
    const normalized = [];
    for (const prop of rawProps) {
        try {
            if (!exports.allowedMarkets.includes(prop.market_type)) {
                if (enableLogging) {
                    await (0, logCoverage_1.logCoverage)({
                        provider,
                        data: prop,
                        timestamp: new Date().toISOString()
                    }, supabase);
                }
                continue;
            }
            const parsed = exports.propSchema.parse(prop);
            const unique_key = [
                parsed.external_game_id,
                parsed.player_name,
                parsed.market_type,
                parsed.line ?? 'NA',
                parsed.book_name
            ].join('-');
            normalized.push({
                id: crypto.randomUUID(),
                external_id: unique_key,
                player_name: parsed.player_name,
                team: parsed.team_name,
                stat_type: parsed.market_type,
                line: parsed.line ?? 0,
                over_odds: parsed.odds,
                market: parsed.market_type,
                provider,
                game_time: parsed.game_date,
                scraped_at: new Date().toISOString(),
                is_valid: true
            });
        }
        catch (err) {
            if (enableLogging) {
                await (0, logCoverage_1.logCoverage)({
                    provider,
                    data: prop,
                    timestamp: new Date().toISOString()
                }, supabase);
            }
        }
    }
    return normalized;
}
