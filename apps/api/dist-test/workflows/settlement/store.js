"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementStore = void 0;
const logger_1 = require("../../utils/logger");
class SettlementStore {
    constructor(supabase) {
        this.logger = (0, logger_1.createLogger)('SettlementStore');
        this.supabase = supabase;
    }
    /**
     * Idempotently update a pick's settlement status
     * Only updates if settled_at is NULL (unless force=true)
     */
    async updateSettlement(update, force = false) {
        try {
            // Build the update query
            let query = this.supabase
                .from('unified_picks')
                .update({
                actual_stat: update.actualStat,
                outcome: update.outcome,
                settled_at: new Date().toISOString(),
                settlement_source: update.settlementSource,
                settlement_version: 1,
                settlement_notes: update.settlementNotes || null,
                status: this.mapOutcomeToStatus(update.outcome),
                workflow_stage: 'settled'
            })
                .eq('id', update.pickId);
            // Only update if not already settled (unless force mode)
            if (!force) {
                query = query.is('settled_at', null);
            }
            const { data, error } = await query.select('id');
            if (error) {
                this.logger.error('Failed to update settlement', {
                    pickId: update.pickId,
                    error
                });
                return false;
            }
            if (!data || data.length === 0) {
                this.logger.debug('Pick already settled or not found', {
                    pickId: update.pickId
                });
                return false;
            }
            this.logger.info('Pick settled successfully', {
                pickId: update.pickId,
                outcome: update.outcome,
                actualStat: update.actualStat
            });
            // Trigger any post-settlement workflows
            await this.triggerPostSettlement(update.pickId, update.outcome);
            return true;
        }
        catch (error) {
            this.logger.error('Settlement update failed', {
                pickId: update.pickId,
                error
            });
            return false;
        }
    }
    /**
     * Batch update multiple settlements
     */
    async batchUpdateSettlements(updates, force = false) {
        const result = {
            succeeded: [],
            failed: [],
            skipped: []
        };
        // Process in chunks to avoid overwhelming the database
        const chunkSize = 50;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (update) => {
                const success = await this.updateSettlement(update, force);
                if (success) {
                    result.succeeded.push(update.pickId);
                }
                else {
                    result.failed.push(update.pickId);
                }
            }));
        }
        return result;
    }
    /**
     * Get unsettled picks for a specific date range
     */
    async getUnsettledPicks(options) {
        let query = this.supabase
            .from('unified_picks')
            .select(`
        id,
        user_id,
        prop_id,
        game_id,
        pick_type,
        outcome,
        line,
        odds,
        sport,
        stat_type,
        player_name,
        game_date,
        external_game_id,
        external_player_id,
        group_key
      `)
            .is('settled_at', null)
            .order('game_date', { ascending: true });
        if (options.league) {
            query = query.eq('sport', options.league);
        }
        if (options.dateFrom) {
            query = query.gte('game_date', options.dateFrom);
        }
        if (options.dateTo) {
            query = query.lte('game_date', options.dateTo);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }
        const { data, error } = await query;
        if (error) {
            this.logger.error('Failed to fetch unsettled picks', { error });
            throw error;
        }
        return data || [];
    }
    /**
     * Mark picks as void (e.g., due to player not playing)
     */
    async voidPicks(pickIds, reason) {
        try {
            const { error } = await this.supabase
                .from('unified_picks')
                .update({
                outcome: 'void',
                status: 'void',
                settled_at: new Date().toISOString(),
                settlement_notes: reason,
                workflow_stage: 'settled'
            })
                .in('id', pickIds)
                .is('settled_at', null);
            if (error) {
                this.logger.error('Failed to void picks', { pickIds, error });
                return false;
            }
            this.logger.info('Picks voided', { count: pickIds.length, reason });
            return true;
        }
        catch (error) {
            this.logger.error('Error voiding picks', { error });
            return false;
        }
    }
    /**
     * Get settlement statistics
     */
    async getSettlementStats(dateFrom, dateTo) {
        let query = this.supabase
            .from('raw_props')
            .select('id, processed_at, outcome, sport', { count: 'exact' });
        if (dateFrom) {
            query = query.gte('game_date', dateFrom);
        }
        if (dateTo) {
            query = query.lte('game_date', dateTo);
        }
        const { data, count, error } = await query;
        if (error) {
            this.logger.error('Failed to get settlement stats', { error });
            throw error;
        }
        const settled = data?.filter(p => p.processed_at !== null && p.outcome !== null) || [];
        const byOutcome = {};
        const byLeague = {};
        for (const pick of settled) {
            if (pick.outcome) {
                byOutcome[pick.outcome] = (byOutcome[pick.outcome] || 0) + 1;
            }
            byLeague[pick.sport] = (byLeague[pick.sport] || 0) + 1;
        }
        return {
            total: count || 0,
            settled: settled.length,
            unsettled: (count || 0) - settled.length,
            byOutcome,
            byLeague
        };
    }
    mapOutcomeToStatus(outcome) {
        // Map settlement outcome to pick status
        switch (outcome) {
            case 'win':
                return 'won';
            case 'loss':
                return 'lost';
            case 'push':
                return 'push';
            case 'void':
                return 'void';
            default:
                return 'pending';
        }
    }
    async triggerPostSettlement(pickId, outcome) {
        try {
            // Update user statistics
            await this.updateUserStats(pickId, outcome);
            // Trigger notifications if needed
            if (outcome === 'win') {
                await this.triggerWinNotification(pickId);
            }
            // Update any related parlays
            await this.updateRelatedParlays(pickId);
        }
        catch (error) {
            this.logger.error('Post-settlement trigger failed', { pickId, error });
            // Don't throw - settlement was successful, just post-processing failed
        }
    }
    async updateUserStats(pickId, outcome) {
        // Get the pick details
        const { data: pick } = await this.supabase
            .from('unified_picks')
            .select('user_id, stake')
            .eq('id', pickId)
            .single();
        if (!pick)
            return;
        // Update user statistics based on outcome
        const updates = {};
        switch (outcome) {
            case 'win':
                updates.total_wins = this.supabase.rpc('increment', { x: 1 });
                updates.total_profit = this.supabase.rpc('increment', { x: pick.stake });
                break;
            case 'loss':
                updates.total_losses = this.supabase.rpc('increment', { x: 1 });
                updates.total_profit = this.supabase.rpc('decrement', { x: pick.stake });
                break;
            case 'push':
                updates.total_pushes = this.supabase.rpc('increment', { x: 1 });
                break;
        }
        if (Object.keys(updates).length > 0) {
            await this.supabase
                .from('user_stats')
                .upsert({
                user_id: pick.user_id,
                ...updates
            });
        }
    }
    async triggerWinNotification(pickId) {
        // This would integrate with NotificationAgent
        // For now, just log
        this.logger.info('Win notification triggered', { pickId });
    }
    async updateRelatedParlays(pickId) {
        // Find any parlays that include this pick
        const { data: pick } = await this.supabase
            .from('unified_picks')
            .select('group_key')
            .eq('id', pickId)
            .single();
        if (!pick?.group_key)
            return;
        // Get all picks in the same group
        const { data: groupPicks } = await this.supabase
            .from('unified_picks')
            .select('id, outcome, settled_at')
            .eq('group_key', pick.group_key);
        if (!groupPicks || groupPicks.length <= 1)
            return;
        // Check if all legs are settled
        const allSettled = groupPicks.every(p => p.settled_at !== null);
        if (allSettled) {
            // Calculate parlay outcome
            const outcomes = groupPicks.map(p => p.outcome);
            const parlayOutcome = this.calculateParlayOutcome(outcomes);
            // Update the parlay record (if there's a separate parlay table)
            this.logger.info('Parlay fully settled', {
                groupKey: pick.group_key,
                outcome: parlayOutcome
            });
        }
    }
    calculateParlayOutcome(outcomes) {
        if (outcomes.includes('loss'))
            return 'loss';
        if (outcomes.includes('void'))
            return 'void';
        if (outcomes.every(o => o === 'push'))
            return 'push';
        if (outcomes.every(o => o === 'win'))
            return 'win';
        return 'win'; // Some wins and pushes
    }
}
exports.SettlementStore = SettlementStore;
//# sourceMappingURL=store.js.map