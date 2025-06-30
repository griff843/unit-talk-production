"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capperService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../shared/logger");

class CapperService {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase configuration');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        
        // Initialize performance monitoring
        this.performanceMetrics = {
            queryCount: 0,
            averageResponseTime: 0,
            errorCount: 0,
            lastHealthCheck: new Date()
        };
        
        // Initialize cache for frequently accessed data
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Start health monitoring
        this.startHealthMonitoring();
    }

    // Performance monitoring
    startHealthMonitoring() {
        setInterval(async () => {
            try {
                const startTime = Date.now();
                await this.testConnection();
                const responseTime = Date.now() - startTime;
                
                this.performanceMetrics.lastHealthCheck = new Date();
                this.performanceMetrics.averageResponseTime = 
                    (this.performanceMetrics.averageResponseTime + responseTime) / 2;
                
                // Log performance metrics every 5 minutes
                logger_1.logger.info('CapperService Health Check', {
                    metrics: this.performanceMetrics,
                    cacheSize: this.cache.size
                });
            } catch (error) {
                this.performanceMetrics.errorCount++;
                logger_1.logger.error('Health check failed', { error });
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    // Cache management
    getCacheKey(method, params) {
        return `${method}:${JSON.stringify(params)}`;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    clearCache() {
        this.cache.clear();
        logger_1.logger.info('Cache cleared');
    }

    async testConnection() {
        try {
            const { error } = await this.supabase.from('cappers').select('count').limit(1);
            return !error;
        }
        catch (error) {
            logger_1.logger.error('Database connection test failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    async getCapperByDiscordId(discordId) {
        const cacheKey = this.getCacheKey('getCapperByDiscordId', { discordId });
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            this.performanceMetrics.queryCount++;
            const startTime = Date.now();
            
            const { data, error } = await this.supabase
                .from('cappers')
                .select('*')
                .eq('discord_id', discordId)
                .single();
            
            const responseTime = Date.now() - startTime;
            this.performanceMetrics.averageResponseTime = 
                (this.performanceMetrics.averageResponseTime + responseTime) / 2;
            
            if (error) throw error;
            
            this.setCache(cacheKey, data);
            return data;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching capper by Discord ID', {
                discordId,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    async createCapper(capperData) {
        try {
            this.performanceMetrics.queryCount++;
            const { data, error } = await this.supabase
                .from('cappers')
                .insert(capperData)
                .select()
                .single();
            if (error) throw error;
            
            // Clear relevant cache entries
            this.clearCache();
            
            logger_1.logger.info('Capper created successfully', { capperId: data.id });
            return data;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error creating capper', {
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    // MISSING METHOD: createCapperProfile (alias for createCapper)
    async createCapperProfile(capperData) {
        logger_1.logger.info('Creating capper profile', { discordId: capperData.discordId });
        
        // Transform the data to match database schema
        const dbCapperData = {
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
            worst_streak: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        return await this.createCapper(dbCapperData);
    }

    async updateCapper(discordId, updates) {
        try {
            this.performanceMetrics.queryCount++;
            const { data, error } = await this.supabase
                .from('cappers')
                .update(updates)
                .eq('discord_id', discordId)
                .select()
                .single();
            if (error) throw error;
            
            // Clear relevant cache entries
            this.clearCache();
            
            return data;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error updating capper', {
                discordId,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    async getCappersWithStats() {
        const cacheKey = this.getCacheKey('getCappersWithStats', {});
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            this.performanceMetrics.queryCount++;
            const { data, error } = await this.supabase
                .from('cappers')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });
            if (error) throw error;
            
            const result = data || [];
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching cappers with stats', {
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }

    async submitPick(pickData) {
        try {
            this.performanceMetrics.queryCount++;
            const { data, error } = await this.supabase
                .from('picks')
                .insert(pickData)
                .select()
                .single();
            if (error) throw error;
            
            // Clear relevant cache entries
            this.clearCache();
            
            logger_1.logger.info('Pick submitted successfully', { pickId: data.id });
            return data;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error submitting pick', {
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    // MISSING METHOD: createDailyPick (alias for submitPick)
    async createDailyPick(pickData) {
        logger_1.logger.info('Creating daily pick', { capperId: pickData.capper_id });
        
        // Ensure required fields are present
        const enhancedPickData = {
            ...pickData,
            status: pickData.status || 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        return await this.submitPick(enhancedPickData);
    }

    async getPicksForCapper(capperId, status) {
        const cacheKey = this.getCacheKey('getPicksForCapper', { capperId, status });
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            this.performanceMetrics.queryCount++;
            let query = this.supabase
                .from('picks')
                .select('*')
                .eq('capper_id', capperId)
                .order('created_at', { ascending: false });
            if (status) {
                query = query.eq('status', status);
            }
            const { data, error } = await query;
            if (error) throw error;
            
            const result = data || [];
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching picks for capper', {
                capperId,
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }

    // MISSING METHOD: getCapperPicks (alias for getPicksForCapper)
    async getCapperPicks(capperId, date, status) {
        logger_1.logger.info('Getting capper picks', { capperId, date, status });
        
        if (date) {
            // If date is specified, use getPicksForDate with capper filter
            const picks = await this.getPicksForDate(date, status);
            return picks.filter(pick => pick.capper_id === capperId);
        }
        
        return await this.getPicksForCapper(capperId, status);
    }

    async getPicksForDate(date, status) {
        const cacheKey = this.getCacheKey('getPicksForDate', { date, status });
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            this.performanceMetrics.queryCount++;
            let query = this.supabase
                .from('picks')
                .select('*')
                .gte('created_at', `${date}T00:00:00.000Z`)
                .lt('created_at', `${date}T23:59:59.999Z`)
                .order('created_at', { ascending: false });
            if (status) {
                query = query.eq('status', status);
            }
            const { data, error } = await query;
            if (error) throw error;
            
            const result = data || [];
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching picks for date', {
                date,
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }

    async updatePick(pickId, updates) {
        try {
            this.performanceMetrics.queryCount++;
            const { data, error } = await this.supabase
                .from('picks')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', pickId)
                .select()
                .single();
            if (error) throw error;
            
            // Clear relevant cache entries
            this.clearCache();
            
            return data;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error updating pick', {
                pickId,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    async deletePick(pickId) {
        try {
            this.performanceMetrics.queryCount++;
            const { error } = await this.supabase
                .from('picks')
                .delete()
                .eq('id', pickId);
            if (error) throw error;
            
            // Clear relevant cache entries
            this.clearCache();
            
            logger_1.logger.info('Pick deleted successfully', { pickId });
            return true;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error deleting pick', {
                pickId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    async finalizePicks(pickIds) {
        try {
            this.performanceMetrics.queryCount++;
            const { error } = await this.supabase
                .from('picks')
                .update({ 
                    status: 'published',
                    updated_at: new Date().toISOString()
                })
                .in('id', pickIds);
            if (error) throw error;
            
            // Clear relevant cache entries
            this.clearCache();
            
            logger_1.logger.info('Picks finalized successfully', { count: pickIds.length });
            return true;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error finalizing picks', {
                pickIds,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    async getCapperStats(capperId) {
        const cacheKey = this.getCacheKey('getCapperStats', { capperId });
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            this.performanceMetrics.queryCount++;
            const { data: capper, error: capperError } = await this.supabase
                .from('cappers')
                .select('stats')
                .eq('id', capperId)
                .single();
            if (capperError) throw capperError;
            
            const { data: picks, error: picksError } = await this.supabase
                .from('picks')
                .select('status, result, units')
                .eq('capper_id', capperId);
            if (picksError) throw picksError;
            
            // Calculate comprehensive stats
            const totalPicks = picks?.length || 0;
            const wonPicks = picks?.filter(p => p.result === 'won').length || 0;
            const lostPicks = picks?.filter(p => p.result === 'lost').length || 0;
            const pushPicks = picks?.filter(p => p.result === 'push').length || 0;
            const totalUnits = picks?.reduce((sum, pick) => sum + (pick.units || 0), 0) || 0;
            
            const stats = {
                total_picks: totalPicks,
                pending_picks: picks?.filter(p => p.status === 'pending').length || 0,
                published_picks: picks?.filter(p => p.status === 'published').length || 0,
                won_picks: wonPicks,
                lost_picks: lostPicks,
                push_picks: pushPicks,
                win_rate: totalPicks > 0 ? (wonPicks / totalPicks * 100).toFixed(2) : 0,
                total_units: totalUnits,
                roi: totalUnits > 0 ? ((wonPicks - lostPicks) / totalUnits * 100).toFixed(2) : 0,
                ...(capper?.stats || {})
            };
            
            this.setCache(cacheKey, stats);
            return stats;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching capper stats', {
                capperId,
                error: error instanceof Error ? error.message : String(error)
            });
            return {};
        }
    }

    async logAnalyticsEvent(event) {
        try {
            this.performanceMetrics.queryCount++;
            const { error } = await this.supabase
                .from('analytics_events')
                .insert({
                event_type: event.event_type,
                capper_id: event.capper_id,
                event_data: event.event_data,
                metadata: event.metadata,
                created_at: new Date().toISOString()
            });
            if (error) throw error;
            return true;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error logging analytics event', {
                event,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    async getRecentAnalytics(capperId, limit = 100) {
        const cacheKey = this.getCacheKey('getRecentAnalytics', { capperId, limit });
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            this.performanceMetrics.queryCount++;
            let query = this.supabase
                .from('analytics_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (capperId) {
                query = query.eq('capper_id', capperId);
            }
            const { data, error } = await query;
            if (error) throw error;
            
            const result = data || [];
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            this.performanceMetrics.errorCount++;
            logger_1.logger.error('Error fetching recent analytics', {
                capperId,
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }

    // Fortune 100 Production Features
    async getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            cacheHitRate: this.cache.size > 0 ? 
                (this.performanceMetrics.queryCount / this.cache.size).toFixed(2) : 0,
            uptime: Date.now() - (this.performanceMetrics.lastHealthCheck?.getTime() || Date.now())
        };
    }

    async bulkUpdateCapperStats() {
        logger_1.logger.info('Starting bulk capper stats update');
        try {
            const cappers = await this.getCappersWithStats();
            const updatePromises = cappers.map(async (capper) => {
                const stats = await this.getCapperStats(capper.id);
                return this.updateCapper(capper.discord_id, { stats });
            });
            
            await Promise.all(updatePromises);
            logger_1.logger.info('Bulk capper stats update completed', { count: cappers.length });
            return true;
        } catch (error) {
            logger_1.logger.error('Bulk capper stats update failed', { error });
            return false;
        }
    }

    async generateComprehensiveReport(capperId, dateRange) {
        logger_1.logger.info('Generating comprehensive report', { capperId, dateRange });
        try {
            const [capper, picks, analytics] = await Promise.all([
                this.getCapperByDiscordId(capperId),
                this.getCapperPicks(capperId),
                this.getRecentAnalytics(capperId, 1000)
            ]);

            return {
                capper,
                picks,
                analytics,
                stats: await this.getCapperStats(capper?.id),
                generatedAt: new Date().toISOString(),
                reportId: `report_${capperId}_${Date.now()}`
            };
        } catch (error) {
            logger_1.logger.error('Error generating comprehensive report', { error });
            return null;
        }
    }
}

exports.capperService = new CapperService();