"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capperService = exports.CapperService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../shared/logger");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
if (!supabaseUrl || !supabaseKey) {
    logger_1.logger.error('Missing Supabase env vars for CapperService');
    throw new Error('Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
class CapperService {
    constructor() {
        this.performanceMetrics = {
            queryCount: 0,
            averageResponseTime: 0,
            errorCount: 0,
            lastHealthCheck: new Date().toISOString()
        };
    }
    /**
     * Test database connection
     */
    async testConnection() {
        try {
            const { data: _data, error } = await supabase
                .from('users')
                .select('id')
                .limit(1);
            if (error)
                throw error;
            logger_1.logger.info('Capper service connection test successful');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Capper service connection test failed', error);
            return false;
        }
    }
    /**
     * Get capper by Discord ID
     */
    async getCapperByDiscordId(discordId) {
        try {
            this.performanceMetrics.queryCount++;
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('discord_id', discordId)
                .single();
            if (error || !data) {
                return null;
            }
            return {
                ...data,
                name: data.display_name || data.username
            };
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching capper by Discord ID', { discordId, error });
            return null;
        }
    }
    /**
     * Create new capper profile
     */
    async createCapperProfile(capperData) {
        try {
            this.performanceMetrics.queryCount++;
            const insertData = {
                discord_id: capperData.discordId,
                username: capperData.username,
                display_name: capperData.displayName,
                tier: capperData.tier || 'rookie',
                status: 'active',
                total_picks: 0,
                wins: 0,
                losses: 0,
                pushes: 0,
                total_units: 0,
                roi: 0,
                win_rate: 0,
                current_streak: 0,
                best_streak: 0,
                worst_streak: 0
            };
            const { data, error } = await supabase
                .from('users')
                .insert(insertData)
                .select()
                .single();
            if (error)
                throw error;
            logger_1.logger.info('Capper profile created successfully', { capperId: data.id });
            return {
                ...data,
                name: data.display_name || data.username
            };
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error creating capper profile', { error, capperData });
            return null;
        }
    }
    /**
     * Get capper picks
     */
    async getCapperPicks(capperId, date, status) {
        try {
            this.performanceMetrics.queryCount++;
            let query = supabase
                .from('unified_picks')
                .select('*')
                .eq('user_id', capperId)
                .order('created_at', { ascending: false });
            if (date) {
                query = query
                    .gte('created_at', `${date}T00:00:00.000Z`)
                    .lt('created_at', `${date}T23:59:59.999Z`);
            }
            if (status) {
                query = query.eq('status', status);
            }
            const { data, error } = await query;
            if (error)
                throw error;
            return (data || []);
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error getting capper picks', { error, capperId, date, status });
            return [];
        }
    }
    /**
     * Submit a pick
     */
    async submitPick(pickData) {
        try {
            this.performanceMetrics.queryCount++;
            const enhancedPickData = {
                ...pickData,
                status: pickData.status || 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                confidence: pickData.confidence || 'medium',
                units: pickData.units || 1
            };
            const { data, error } = await supabase
                .from('unified_picks')
                .insert(enhancedPickData)
                .select()
                .single();
            if (error)
                throw error;
            logger_1.logger.info('Pick submitted successfully', { pickId: data.id });
            return data;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error submitting pick', { error, pickData });
            return null;
        }
    }
    /**
     * Update a pick
     */
    async updatePick(pickId, updates) {
        try {
            this.performanceMetrics.queryCount++;
            const { data, error } = await supabase
                .from('unified_picks')
                .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
                .eq('id', pickId)
                .select()
                .single();
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error updating pick', { error, pickId, updates });
            return null;
        }
    }
    /**
     * Delete a pick
     */
    async deletePick(pickId) {
        try {
            this.performanceMetrics.queryCount++;
            const { error } = await supabase
                .from('unified_picks')
                .delete()
                .eq('id', pickId);
            if (error)
                throw error;
            logger_1.logger.info('Pick deleted successfully', { pickId });
            return true;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error deleting pick', { error, pickId });
            return false;
        }
    }
    /**
     * Check if user has capper permissions
     */
    async hasCapperPermissions(discordId) {
        try {
            const capper = await this.getCapperByDiscordId(discordId);
            return capper !== null && capper.status === 'active';
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error checking capper permissions', { error, discordId });
            return false;
        }
    }
    /**
     * Create daily pick (alias for submitPick)
     */
    async createDailyPick(pickData) {
        return this.submitPick(pickData);
    }
    /**
     * Finalize picks
     */
    async finalizePicks(pickIds) {
        try {
            this.performanceMetrics.queryCount++;
            const { error } = await supabase
                .from('unified_picks')
                .update({
                status: 'published',
                updated_at: new Date().toISOString()
            })
                .in('id', pickIds);
            if (error)
                throw error;
            logger_1.logger.info('Picks finalized successfully', { count: pickIds.length });
            return true;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error finalizing picks', { error, pickIds });
            return false;
        }
    }
    /**
     * Get capper by ID
     */
    async getCapperById(capperId) {
        try {
            this.performanceMetrics.queryCount++;
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', capperId)
                .single();
            if (error || !data) {
                return null;
            }
            return {
                ...data,
                name: data.display_name || data.username
            };
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching capper by ID', { capperId, error });
            return null;
        }
    }
    /**
     * Get capper statistics
     */
    async getCapperStats(capperId) {
        try {
            const capper = await this.getCapperById(capperId);
            if (!capper)
                return null;
            return {
                totalPicks: capper.total_picks,
                wins: capper.wins,
                losses: capper.losses,
                pushes: capper.pushes,
                winRate: capper.win_rate,
                totalUnits: capper.total_units,
                roi: capper.roi,
                currentStreak: capper.current_streak,
                bestStreak: capper.best_streak,
                worstStreak: capper.worst_streak
            };
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching capper stats', { error, capperId });
            return null;
        }
    }
    /**
     * Log analytics event (placeholder)
     */
    async logAnalyticsEvent(event, data) {
        logger_1.logger.info('Analytics event logged', { event, data });
    }
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return this.performanceMetrics;
    }
}
exports.CapperService = CapperService;
// Export singleton instance
exports.capperService = new CapperService();
