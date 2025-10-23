"use strict";
/**
 * Pick Monitoring Service
 * Real-time monitoring of active picks with odds tracking and alert generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickMonitoringService = void 0;
const logger_1 = require("../utils/logger");
const supabaseClient_1 = require("./supabaseClient");
const AutoRecheckService_1 = require("./AutoRecheckService");
const PublishGuard_1 = require("../promotion/PublishGuard");
class PickMonitoringService {
    constructor() {
        this.monitoredPicks = new Map();
        this.monitoringActive = false;
        this.updateInterval = null;
        // Default monitoring configuration
        this.DEFAULT_CONFIG = {
            oddsMovementThreshold: 10, // 10 BPS
            volumeThreshold: 50000, // $50K volume
            steamThreshold: 15, // 15 BPS steam
            clvThreshold: 5, // 5 BPS CLV change
            marketDepthThreshold: 10000, // $10K minimum depth
            updateFrequency: 60, // 60 seconds
            alertCooldown: 5, // 5 minutes
            autoRecheckEnabled: true,
            suspensionEnabled: true
        };
        this.logger = (0, logger_1.createLogger)('PickMonitoringService');
    }
    static getInstance() {
        if (!PickMonitoringService.instance) {
            PickMonitoringService.instance = new PickMonitoringService();
        }
        return PickMonitoringService.instance;
    }
    /**
     * Start monitoring service
     */
    async startMonitoring() {
        if (this.monitoringActive) {
            this.logger.warn('Monitoring already active');
            return;
        }
        this.logger.info('Starting pick monitoring service');
        // Load active picks
        await this.loadActivePicks();
        // Start monitoring loop
        this.startMonitoringLoop();
        this.monitoringActive = true;
        this.logger.info('Pick monitoring service started', {
            monitoredPicks: this.monitoredPicks.size
        });
    }
    /**
     * Stop monitoring service
     */
    stopMonitoring() {
        this.logger.info('Stopping pick monitoring service');
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.monitoringActive = false;
        this.logger.info('Pick monitoring service stopped');
    }
    /**
     * Add a pick to monitoring
     */
    async addPickToMonitoring(pick, config) {
        const monitoringConfig = { ...this.DEFAULT_CONFIG, ...config };
        const monitoredPick = {
            id: pick.id,
            propId: pick.prop_id,
            tier: pick.tier,
            status: 'active',
            gameTime: new Date(pick.game_time),
            sport: pick.sport,
            playerName: pick.player_name,
            statType: pick.stat_type,
            line: pick.line,
            initialOdds: pick.initial_odds || -110,
            currentOdds: pick.current_odds || pick.initial_odds || -110,
            lastUpdate: new Date(),
            monitoringConfig,
            alertHistory: [],
            metrics: {
                totalUpdates: 0,
                oddsChanges: 0,
                maxOddsMovement: 0,
                avgVolume: 0,
                maxVolume: 0,
                steamEvents: 0,
                alertsGenerated: 0,
                uptimePercentage: 100,
                lastSuccessfulUpdate: new Date(),
                errorCount: 0
            }
        };
        this.monitoredPicks.set(pick.id, monitoredPick);
        // Schedule auto re-checks if enabled
        if (monitoringConfig.autoRecheckEnabled) {
            await AutoRecheckService_1.autoRecheckService.scheduleRecheckForPick(pick);
        }
        this.logger.info('Pick added to monitoring', {
            pickId: pick.id,
            propId: pick.prop_id,
            tier: pick.tier
        });
    }
    /**
     * Remove pick from monitoring
     */
    removePickFromMonitoring(pickId) {
        if (this.monitoredPicks.has(pickId)) {
            this.monitoredPicks.delete(pickId);
            this.logger.info('Pick removed from monitoring', { pickId });
        }
    }
    /**
     * Update pick configuration
     */
    updatePickConfig(pickId, config) {
        const pick = this.monitoredPicks.get(pickId);
        if (!pick)
            return false;
        pick.monitoringConfig = { ...pick.monitoringConfig, ...config };
        this.logger.info('Pick monitoring config updated', { pickId, config });
        return true;
    }
    /**
     * Start monitoring loop
     */
    startMonitoringLoop() {
        // Use shortest update frequency among monitored picks
        const minFrequency = Math.min(...Array.from(this.monitoredPicks.values()).map(p => p.monitoringConfig.updateFrequency), 60 // Default 60 seconds
        );
        this.updateInterval = setInterval(async () => {
            await this.updateAllPicks();
        }, minFrequency * 1000);
        this.logger.info('Monitoring loop started', {
            updateFrequency: minFrequency,
            monitoredPicks: this.monitoredPicks.size
        });
    }
    /**
     * Update all monitored picks
     */
    async updateAllPicks() {
        const updatePromises = Array.from(this.monitoredPicks.values()).map(pick => this.updateSinglePick(pick));
        const results = await Promise.allSettled(updatePromises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
            this.logger.warn('Some pick updates failed', {
                successful,
                failed,
                total: this.monitoredPicks.size
            });
        }
    }
    /**
     * Update a single monitored pick
     */
    async updateSinglePick(pick) {
        try {
            const now = new Date();
            const timeSinceLastUpdate = (now.getTime() - pick.lastUpdate.getTime()) / 1000;
            // Skip if updated too recently based on config
            if (timeSinceLastUpdate < pick.monitoringConfig.updateFrequency) {
                return;
            }
            // Get latest odds data
            const oddsData = await this.fetchLatestOddsData(pick.propId);
            if (!oddsData) {
                pick.metrics.errorCount++;
                return;
            }
            // Check for odds movement
            const previousOdds = pick.currentOdds;
            const newOdds = oddsData.odds;
            const oddsMovement = this.calculateOddsMovement(previousOdds, newOdds);
            // Update pick data
            pick.currentOdds = newOdds;
            pick.lastUpdate = now;
            pick.metrics.totalUpdates++;
            pick.metrics.lastSuccessfulUpdate = now;
            // Track odds changes
            if (Math.abs(oddsMovement) > 0.1) {
                pick.metrics.oddsChanges++;
                pick.metrics.maxOddsMovement = Math.max(pick.metrics.maxOddsMovement, Math.abs(oddsMovement));
            }
            // Track volume metrics
            if (oddsData.volume) {
                pick.metrics.avgVolume = (pick.metrics.avgVolume + oddsData.volume) / 2;
                pick.metrics.maxVolume = Math.max(pick.metrics.maxVolume, oddsData.volume);
            }
            // Check for alerts
            await this.checkForAlerts(pick, oddsData, oddsMovement);
            // Update uptime percentage
            const totalTime = (now.getTime() - pick.lastUpdate.getTime()) / 1000;
            const successfulTime = totalTime - (pick.metrics.errorCount * 60); // Assume 60s per error
            pick.metrics.uptimePercentage = (successfulTime / totalTime) * 100;
            // Store updated data
            await this.storePickUpdate(pick, oddsData);
        }
        catch (error) {
            pick.metrics.errorCount++;
            this.logger.error('Failed to update pick', {
                error,
                pickId: pick.id,
                propId: pick.propId
            });
        }
    }
    /**
     * Check for alerts based on updated data
     */
    async checkForAlerts(pick, oddsData, oddsMovement) {
        const config = pick.monitoringConfig;
        const now = new Date();
        // Check alert cooldown
        const lastAlert = pick.alertHistory[pick.alertHistory.length - 1];
        if (lastAlert && (now.getTime() - lastAlert.timestamp.getTime()) < (config.alertCooldown * 60 * 1000)) {
            return; // Still in cooldown period
        }
        // Odds movement alert
        if (Math.abs(oddsMovement) >= config.oddsMovementThreshold) {
            await this.generateAlert(pick, {
                type: 'odds_movement',
                severity: Math.abs(oddsMovement) > 25 ? 'high' : 'medium',
                message: `Odds moved ${oddsMovement > 0 ? '+' : ''}${oddsMovement.toFixed(1)} BPS`,
                data: {
                    previousOdds: pick.currentOdds,
                    newOdds: oddsData.odds,
                    movement: oddsMovement
                }
            });
        }
        // Volume spike alert
        if (oddsData.volume && oddsData.volume > config.volumeThreshold) {
            await this.generateAlert(pick, {
                type: 'volume_spike',
                severity: oddsData.volume > config.volumeThreshold * 2 ? 'high' : 'medium',
                message: `Volume spike: $${oddsData.volume.toLocaleString()}`,
                data: {
                    volume: oddsData.volume,
                    threshold: config.volumeThreshold
                }
            });
        }
        // Steam alert
        if (oddsData.steam_strength && Math.abs(oddsData.steam_strength) >= config.steamThreshold) {
            await this.generateAlert(pick, {
                type: 'steam_alert',
                severity: Math.abs(oddsData.steam_strength) > 30 ? 'high' : 'medium',
                message: `Steam detected: ${oddsData.steam_strength > 0 ? '+' : ''}${oddsData.steam_strength} BPS`,
                data: {
                    steamStrength: oddsData.steam_strength,
                    direction: oddsData.steam_strength > 0 ? 'favorable' : 'unfavorable'
                }
            });
            pick.metrics.steamEvents++;
        }
        // Market depth alert
        if (oddsData.market_depth && oddsData.market_depth < config.marketDepthThreshold) {
            await this.generateAlert(pick, {
                type: 'market_depth',
                severity: oddsData.market_depth < config.marketDepthThreshold / 2 ? 'critical' : 'high',
                message: `Low market depth: $${oddsData.market_depth.toLocaleString()}`,
                data: {
                    marketDepth: oddsData.market_depth,
                    threshold: config.marketDepthThreshold
                }
            });
        }
        // CLV change alert
        const clvChange = this.calculateCLVChange(pick, oddsData);
        if (Math.abs(clvChange) >= config.clvThreshold) {
            await this.generateAlert(pick, {
                type: 'clv_change',
                severity: Math.abs(clvChange) > 15 ? 'high' : 'medium',
                message: `CLV changed ${clvChange > 0 ? '+' : ''}${clvChange.toFixed(1)} BPS`,
                data: {
                    clvChange,
                    newCLV: oddsData.clv || 0
                }
            });
        }
    }
    /**
     * Generate an alert
     */
    async generateAlert(pick, alertData) {
        const alert = {
            id: `${pick.id}_${Date.now()}`,
            pickId: pick.id,
            type: alertData.type,
            severity: alertData.severity,
            timestamp: new Date(),
            message: alertData.message,
            data: alertData.data,
            acknowledged: false,
            actionRequired: alertData.severity === 'critical',
            autoResolved: false
        };
        pick.alertHistory.push(alert);
        pick.metrics.alertsGenerated++;
        // Store alert in database
        await this.storeAlert(alert);
        // Handle alert through publish guard (shadow mode aware)
        await PublishGuard_1.publishGuard.handleAlertDecision(pick.id, alert.type, alert.severity, alert.message, alert.data);
        // Trigger immediate actions for critical alerts
        if (alertData.severity === 'critical') {
            await this.handleCriticalAlert(pick, alert);
        }
        this.logger.info('Alert generated', {
            pickId: pick.id,
            alertType: alert.type,
            severity: alert.severity,
            message: alert.message
        });
    }
    /**
     * Handle critical alerts
     */
    async handleCriticalAlert(pick, alert) {
        if (pick.monitoringConfig.suspensionEnabled) {
            // Auto-suspend pick for critical market depth issues
            if (alert.type === 'market_depth') {
                await this.suspendPick(pick.id, `Auto-suspended due to critical market depth: ${alert.message}`);
            }
        }
        // Trigger immediate re-check for critical alerts
        if (pick.monitoringConfig.autoRecheckEnabled) {
            // Would trigger immediate re-check through AutoRecheckService
            this.logger.info('Triggering immediate re-check for critical alert', {
                pickId: pick.id,
                alertType: alert.type
            });
        }
    }
    /**
     * Suspend a pick
     */
    async suspendPick(pickId, reason) {
        const pick = this.monitoredPicks.get(pickId);
        if (!pick)
            return;
        pick.status = 'suspended';
        try {
            await supabaseClient_1.supabaseClient
                .from('unified_picks')
                .update({
                status: 'suspended',
                suspension_reason: reason,
                suspended_at: new Date().toISOString(),
                suspended_by: 'PickMonitoringService'
            })
                .eq('id', pickId);
            this.logger.info('Pick suspended', { pickId, reason });
        }
        catch (error) {
            this.logger.error('Failed to suspend pick', { error, pickId });
        }
    }
    /**
     * Helper methods
     */
    async fetchLatestOddsData(propId) {
        try {
            const { data } = await supabaseClient_1.supabaseClient
                .from('odds_tracking')
                .select('*')
                .eq('prop_id', propId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            return data;
        }
        catch (error) {
            this.logger.error('Failed to fetch odds data', { error, propId });
            return null;
        }
    }
    calculateOddsMovement(previousOdds, newOdds) {
        if (previousOdds === 0)
            return 0;
        const difference = newOdds - previousOdds;
        return (difference / Math.abs(previousOdds)) * 10000;
    }
    calculateCLVChange(pick, oddsData) {
        const currentCLV = oddsData.clv || 0;
        const initialCLV = pick.metrics.totalUpdates === 1 ? 0 : currentCLV;
        return currentCLV - initialCLV;
    }
    async loadActivePicks() {
        try {
            const { data: picks } = await supabaseClient_1.supabaseClient
                .from('unified_picks')
                .select('*')
                .eq('status', 'active')
                .gte('game_time', new Date().toISOString()); // Only future games
            if (picks) {
                for (const pick of picks) {
                    await this.addPickToMonitoring(pick);
                }
            }
        }
        catch (error) {
            this.logger.error('Failed to load active picks', { error });
        }
    }
    async storePickUpdate(pick, oddsData) {
        try {
            await supabaseClient_1.supabaseClient
                .from('pick_monitoring_updates')
                .insert({
                pick_id: pick.id,
                current_odds: pick.currentOdds,
                odds_data: oddsData,
                metrics: pick.metrics,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('Failed to store pick update', { error, pickId: pick.id });
        }
    }
    async storeAlert(alert) {
        try {
            await supabaseClient_1.supabaseClient
                .from('pick_alerts')
                .insert({
                id: alert.id,
                pick_id: alert.pickId,
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
                data: alert.data,
                acknowledged: alert.acknowledged,
                action_required: alert.actionRequired,
                created_at: alert.timestamp.toISOString()
            });
        }
        catch (error) {
            this.logger.error('Failed to store alert', { error, alertId: alert.id });
        }
    }
    /**
     * Get monitoring statistics
     */
    getMonitoringStats() {
        const picks = Array.from(this.monitoredPicks.values());
        const alertBreakdown = picks.reduce((acc, pick) => {
            pick.alertHistory.forEach(alert => {
                acc[alert.type] = (acc[alert.type] || 0) + 1;
            });
            return acc;
        }, {});
        return {
            totalPicks: picks.length,
            activePicks: picks.filter(p => p.status === 'active').length,
            suspendedPicks: picks.filter(p => p.status === 'suspended').length,
            totalUpdates: picks.reduce((sum, p) => sum + p.metrics.totalUpdates, 0),
            totalAlerts: picks.reduce((sum, p) => sum + p.metrics.alertsGenerated, 0),
            avgUptimePercentage: picks.reduce((sum, p) => sum + p.metrics.uptimePercentage, 0) / picks.length,
            alertBreakdown
        };
    }
    /**
     * Get monitored pick details
     */
    getMonitoredPick(pickId) {
        return this.monitoredPicks.get(pickId);
    }
    /**
     * Get all monitored picks
     */
    getAllMonitoredPicks() {
        return Array.from(this.monitoredPicks.values());
    }
}
exports.pickMonitoringService = PickMonitoringService.getInstance();
