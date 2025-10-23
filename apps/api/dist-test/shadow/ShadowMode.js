"use strict";
/**
 * Shadow Mode Service
 * Enables full grading → promotion → monitoring flow without public posting
 * All promotions are logged to shadow tables for testing and analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldShadow = exports.shadowWriteMetrics = exports.shadowPublishPreview = exports.shadowWritePick = exports.isShadowMode = exports.shadowMode = exports.ShadowModeService = void 0;
const logger_1 = require("../utils/logger");
const supabaseClient_1 = require("../services/supabaseClient");
const discord_js_1 = require("discord.js");
class ShadowModeService {
    constructor() {
        this.discordClient = null;
        this.shadowChannelId = null;
        this.cleanupInterval = null;
        this.logger = (0, logger_1.createLogger)('ShadowMode');
        this.shadowChannelId = process.env.SHADOW_PRIVATE_CHANNEL_ID || null;
        this.initializeService();
    }
    static getInstance() {
        if (!ShadowModeService.instance) {
            ShadowModeService.instance = new ShadowModeService();
        }
        return ShadowModeService.instance;
    }
    /**
     * Initialize shadow mode service
     */
    async initializeService() {
        if (!this.isShadowMode()) {
            this.logger.info('Shadow mode is disabled');
            return;
        }
        this.logger.info('Initializing Shadow Mode Service');
        // Initialize Discord client if private channel is configured
        if (this.shadowChannelId) {
            await this.initializeDiscordClient();
        }
        // Schedule daily cleanup
        this.scheduleCleanup();
        this.logger.info('Shadow Mode Service initialized', {
            privateChannel: !!this.shadowChannelId,
            maxDays: this.getMaxDays()
        });
    }
    /**
     * Check if shadow mode is enabled
     */
    isShadowMode() {
        return process.env.SHADOW_MODE === 'true';
    }
    /**
     * Get maximum days to keep shadow data
     */
    getMaxDays() {
        return parseInt(process.env.SHADOW_MAX_DAYS || '7', 10);
    }
    /**
     * Write a pick decision to shadow tables
     */
    async shadowWritePick(pick, decidedAction, reasons = []) {
        if (!this.isShadowMode()) {
            return;
        }
        try {
            const shadowRow = {
                raw_prop_id: pick.rawPropId,
                unified_pick_id: pick.unifiedPickId,
                sport: pick.sport,
                market: pick.market,
                player: pick.player,
                team: pick.team,
                book: pick.book,
                odds_open: pick.oddsOpen,
                odds_now: pick.oddsNow,
                line: pick.line,
                event_time: pick.eventTime?.toISOString(),
                tier: pick.tier,
                confidence: pick.confidence,
                professional_score: pick.professionalScore,
                devigged_win_prob: pick.deviggedWinProb,
                devigged_edge: pick.deviggedEdge,
                clv_pct: pick.clvPct,
                kelly_fraction: pick.kellyFraction,
                risk: pick.risk,
                chaos_muted: pick.chaosMuted,
                steam_muted: pick.steamMuted,
                is_instant: pick.isInstant,
                group_key: pick.groupKey,
                decided_action: decidedAction,
                reasons: reasons.length > 0 ? reasons : null
            };
            const { error } = await supabaseClient_1.supabase
                .from('shadow_decisions')
                .insert(shadowRow);
            if (error) {
                this.logger.error('Failed to write shadow pick', { error, pick });
            }
            else {
                this.logger.info('Shadow pick written', {
                    player: pick.player,
                    action: decidedAction,
                    reasons
                });
            }
        }
        catch (error) {
            this.logger.error('Error writing shadow pick', { error });
        }
    }
    /**
     * Publish a preview to the private shadow channel
     */
    async shadowPublishPreview(embed) {
        if (!this.isShadowMode() || !this.shadowChannelId || !this.discordClient) {
            return;
        }
        try {
            const channel = await this.discordClient.channels.fetch(this.shadowChannelId);
            if (!channel) {
                this.logger.error('Shadow channel not found', { channelId: this.shadowChannelId });
                return;
            }
            // Create shadow-prefixed embed
            const shadowEmbed = this.createShadowEmbed(embed);
            await channel.send({ embeds: [shadowEmbed] });
            this.logger.info('Shadow preview published', {
                channel: this.shadowChannelId,
                player: embed.player || 'Unknown'
            });
        }
        catch (error) {
            this.logger.error('Failed to publish shadow preview', { error });
        }
    }
    /**
     * Create a shadow-prefixed embed
     */
    createShadowEmbed(originalEmbed) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🔒 [SHADOW] ${originalEmbed.title || 'Shadow Pick'}`)
            .setColor(0x808080) // Gray color for shadow
            .setTimestamp();
        // Add description with shadow disclaimer
        const disclaimer = '**⚠️ SHADOW MODE - NOT PUBLISHED PUBLICLY**\n\n';
        embed.setDescription(disclaimer + (originalEmbed.description || ''));
        // Add fields from original embed
        if (originalEmbed.fields && Array.isArray(originalEmbed.fields)) {
            originalEmbed.fields.forEach((field) => {
                embed.addFields({
                    name: field.name,
                    value: field.value,
                    inline: field.inline !== false
                });
            });
        }
        // Add shadow metrics footer
        const metrics = this.formatShadowMetrics(originalEmbed);
        embed.addFields({
            name: '📊 Shadow Metrics',
            value: metrics,
            inline: false
        });
        // Add footer
        embed.setFooter({
            text: 'Shadow Mode | Testing Only',
            iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
        });
        return embed;
    }
    /**
     * Format shadow metrics for display
     */
    formatShadowMetrics(embed) {
        const metrics = [];
        if (embed.devigged_edge !== undefined) {
            metrics.push(`**EV**: ${(embed.devigged_edge * 100).toFixed(2)}%`);
        }
        if (embed.clv !== undefined) {
            metrics.push(`**CLV**: ${embed.clv.toFixed(1)} BPS`);
        }
        if (embed.confidence !== undefined) {
            metrics.push(`**Confidence**: ${embed.confidence}%`);
        }
        if (embed.kelly !== undefined) {
            metrics.push(`**Kelly**: ${(embed.kelly * 100).toFixed(2)}%`);
        }
        if (embed.tier !== undefined) {
            metrics.push(`**Tier**: ${embed.tier}`);
        }
        return metrics.length > 0 ? metrics.join(' | ') : 'No metrics available';
    }
    /**
     * Write metrics snapshot to shadow tables
     */
    async shadowWriteMetrics(snapshot) {
        if (!this.isShadowMode()) {
            return;
        }
        try {
            const metricsRow = {
                window: snapshot.window,
                sport: snapshot.sport || null,
                posted_ev: snapshot.postedEv,
                positive_clv_rate: snapshot.positiveCLVRate,
                avg_clv: snapshot.avgCLV,
                hit_rate: snapshot.hitRate,
                roi: snapshot.roi,
                sharpe: snapshot.sharpe,
                kelly_efficiency: snapshot.kellyEfficiency,
                max_drawdown: snapshot.maxDrawdown,
                picks_count: snapshot.picksCount,
                completed_picks: snapshot.completedPicks,
                win_rate: snapshot.winRate,
                avg_odds: snapshot.avgOdds,
                profit_factor: snapshot.profitFactor
            };
            const { error } = await supabaseClient_1.supabase
                .from('shadow_decisions')
                .insert({
                sport: snapshot.sport || 'overall',
                market: 'metrics',
                player: 'system',
                decided_action: 'metrics-snapshot',
                decision_type: 'metrics',
                additional_data: metricsRow
            });
            if (error) {
                this.logger.error('Failed to write shadow metrics', { error, snapshot });
            }
            else {
                this.logger.info('Shadow metrics written', {
                    window: snapshot.window,
                    sport: snapshot.sport || 'overall'
                });
            }
        }
        catch (error) {
            this.logger.error('Error writing shadow metrics', { error });
        }
    }
    /**
     * Record a recheck result in shadow mode
     */
    async shadowWriteRecheck(shadowPickId, recheckType, validationStatus, action, metrics) {
        if (!this.isShadowMode()) {
            return;
        }
        try {
            const recheckRow = {
                shadow_pick_id: shadowPickId,
                recheck_type: recheckType,
                scheduled_time: new Date().toISOString(),
                actual_time: new Date().toISOString(),
                validation_status: validationStatus,
                ev_at_recheck: metrics.evAtRecheck,
                clv_at_recheck: metrics.clvAtRecheck,
                odds_movement: metrics.oddsMovement,
                action,
                action_reason: `${validationStatus} at ${recheckType}`
            };
            const { error } = await supabaseClient_1.supabase
                .from('shadow_decisions')
                .insert({
                unified_pick_id: shadowPickId,
                sport: 'unknown',
                market: 'recheck',
                player: 'system',
                decided_action: 'rejected-recheck',
                decision_type: 'recheck',
                additional_data: recheckRow
            });
            if (error) {
                this.logger.error('Failed to write shadow recheck', { error });
            }
            else {
                this.logger.info('Shadow recheck written', {
                    pickId: shadowPickId,
                    type: recheckType,
                    action
                });
            }
        }
        catch (error) {
            this.logger.error('Error writing shadow recheck', { error });
        }
    }
    /**
     * Record an alert in shadow mode
     */
    async shadowWriteAlert(shadowPickId, alertType, severity, message, data = {}) {
        if (!this.isShadowMode()) {
            return;
        }
        try {
            const alertRow = {
                shadow_pick_id: shadowPickId,
                alert_type: alertType,
                severity,
                message,
                data,
                would_suspend: severity === 'critical',
                would_notify: severity === 'high' || severity === 'critical'
            };
            const { error } = await supabaseClient_1.supabase
                .from('shadow_decisions')
                .insert({
                unified_pick_id: shadowPickId,
                sport: 'unknown',
                market: 'alert',
                player: 'system',
                decided_action: alertType,
                decision_type: 'alert',
                additional_data: alertRow
            });
            if (error) {
                this.logger.error('Failed to write shadow alert', { error });
            }
            else {
                this.logger.info('Shadow alert written', {
                    pickId: shadowPickId,
                    type: alertType,
                    severity
                });
            }
        }
        catch (error) {
            this.logger.error('Error writing shadow alert', { error });
        }
    }
    /**
     * Clean up old shadow data
     */
    async cleanupOldShadow(maxDays) {
        const days = maxDays || this.getMaxDays();
        try {
            const { data, error } = await supabaseClient_1.supabase
                .rpc('cleanup_old_shadow_data', { max_days: days });
            if (error) {
                this.logger.error('Failed to cleanup shadow data', { error });
            }
            else {
                this.logger.info('Shadow data cleaned up', {
                    maxDays: days,
                    deletedPicks: data?.[0]?.deleted_picks || 0,
                    deletedMetrics: data?.[0]?.deleted_metrics || 0,
                    deletedRechecks: data?.[0]?.deleted_rechecks || 0,
                    deletedAlerts: data?.[0]?.deleted_alerts || 0
                });
            }
        }
        catch (error) {
            this.logger.error('Error cleaning up shadow data', { error });
        }
    }
    /**
     * Schedule daily cleanup
     */
    scheduleCleanup() {
        // Run cleanup daily at 3 AM
        const now = new Date();
        const tomorrow3AM = new Date(now);
        tomorrow3AM.setDate(tomorrow3AM.getDate() + 1);
        tomorrow3AM.setHours(3, 0, 0, 0);
        const msUntil3AM = tomorrow3AM.getTime() - now.getTime();
        setTimeout(() => {
            // Run first cleanup
            this.cleanupOldShadow();
            // Schedule recurring cleanup every 24 hours
            this.cleanupInterval = setInterval(() => {
                this.cleanupOldShadow();
            }, 24 * 60 * 60 * 1000);
        }, msUntil3AM);
        this.logger.info('Shadow cleanup scheduled', {
            firstRun: tomorrow3AM.toISOString()
        });
    }
    /**
     * Initialize Discord client for shadow previews
     */
    async initializeDiscordClient() {
        if (!process.env.DISCORD_TOKEN) {
            this.logger.warn('Discord token not configured, shadow previews disabled');
            return;
        }
        try {
            this.discordClient = new discord_js_1.Client({
                intents: ['Guilds', 'GuildMessages']
            });
            await this.discordClient.login(process.env.DISCORD_TOKEN);
            this.discordClient.once('ready', () => {
                this.logger.info('Discord client ready for shadow previews');
            });
        }
        catch (error) {
            this.logger.error('Failed to initialize Discord client', { error });
            this.discordClient = null;
        }
    }
    /**
     * Get shadow statistics
     */
    async getShadowStats(window = '7d') {
        try {
            const cutoff = new Date();
            const days = window === '1d' ? 1 : window === '7d' ? 7 : 30;
            cutoff.setDate(cutoff.getDate() - days);
            const { data: picks } = await supabaseClient_1.supabase
                .from('shadow_decisions')
                .select('*')
                .eq('decision_type', 'promotion')
                .gte('created_at', cutoff.toISOString());
            if (!picks || picks.length === 0) {
                return {
                    totalPicks: 0,
                    byAction: {},
                    bySport: {},
                    byTier: {},
                    rejectionReasons: {}
                };
            }
            // Aggregate statistics
            const byAction = {};
            const bySport = {};
            const byTier = {};
            const rejectionReasons = {};
            picks.forEach((pick) => {
                // By action
                byAction[pick.decided_action] = (byAction[pick.decided_action] || 0) + 1;
                // By sport
                bySport[pick.sport] = (bySport[pick.sport] || 0) + 1;
                // By tier
                if (pick.tier) {
                    byTier[pick.tier] = (byTier[pick.tier] || 0) + 1;
                }
                // Rejection reasons
                if (pick.reasons && Array.isArray(pick.reasons)) {
                    pick.reasons.forEach((reason) => {
                        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
                    });
                }
            });
            return {
                totalPicks: picks.length,
                byAction,
                bySport,
                byTier,
                rejectionReasons
            };
        }
        catch (error) {
            this.logger.error('Failed to get shadow stats', { error });
            return {
                totalPicks: 0,
                byAction: {},
                bySport: {},
                byTier: {},
                rejectionReasons: {}
            };
        }
    }
    /**
     * Check if a specific feature should be disabled in shadow mode
     */
    shouldSkipPublicAction(actionType) {
        if (!this.isShadowMode()) {
            return false;
        }
        // In shadow mode, skip all public actions
        this.logger.debug('Skipping public action in shadow mode', { actionType });
        return true;
    }
    /**
     * Cleanup on service shutdown
     */
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.discordClient) {
            this.discordClient.destroy();
            this.discordClient = null;
        }
        this.logger.info('Shadow Mode Service cleaned up');
    }
}
exports.ShadowModeService = ShadowModeService;
// Export singleton instance
exports.shadowMode = ShadowModeService.getInstance();
// Export convenience functions
const isShadowMode = () => exports.shadowMode.isShadowMode();
exports.isShadowMode = isShadowMode;
const shadowWritePick = (pick, action, reasons) => exports.shadowMode.shadowWritePick(pick, action, reasons);
exports.shadowWritePick = shadowWritePick;
const shadowPublishPreview = (embed) => exports.shadowMode.shadowPublishPreview(embed);
exports.shadowPublishPreview = shadowPublishPreview;
const shadowWriteMetrics = (snapshot) => exports.shadowMode.shadowWriteMetrics(snapshot);
exports.shadowWriteMetrics = shadowWriteMetrics;
const cleanupOldShadow = (maxDays) => exports.shadowMode.cleanupOldShadow(maxDays);
exports.cleanupOldShadow = cleanupOldShadow;
