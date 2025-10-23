"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiMonitoringService = void 0;
const supabaseClient_1 = require("./supabaseClient");
// Simple logger for API monitoring
class SimpleLogger {
    constructor(context) {
        this.context = context;
    }
    error(message, meta) {
        console.error(`[${this.context}] ERROR: ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
    info(message, meta) {
        console.log(`[${this.context}] INFO: ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
    warn(message, meta) {
        console.warn(`[${this.context}] WARN: ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
}
const _Logger = SimpleLogger;
class ApiMonitoringService {
    constructor() {
        this.alertThresholds = {
            consecutiveFailures: 3,
            responseTimeThreshold: 10000, // 10 seconds
            dataStaleThreshold: 5, // 5 minutes
            criticalFailureThreshold: 5, // 5 consecutive failures = critical
        };
        this.providerConfigs = {
            optimal_api: {
                name: 'Optimal API',
                endpoint: 'https://api.optimal-bet.com/v1/events',
                expectedUpdateInterval: 1, // 1 minute
                priority: 'high',
            },
            odds_api: {
                name: 'Odds API',
                endpoint: 'https://api.the-odds-api.com/v4/sports',
                expectedUpdateInterval: 2, // 2 minutes
                priority: 'medium',
            },
        };
        this.logger = new SimpleLogger('ApiMonitoring');
    }
    /**
     * Monitor API health and detect issues
     */
    async checkApiHealth(provider, apiKey) {
        const config = this.providerConfigs[provider];
        if (!config) {
            throw new Error(`Unknown provider: ${provider}`);
        }
        const healthStatus = {
            provider,
            status: 'healthy',
            lastSuccess: null,
            lastFailure: null,
            consecutiveFailures: 0,
        };
        try {
            const startTime = Date.now();
            // Test API connection
            const response = await this.testApiConnection(provider, config.endpoint, apiKey);
            const responseTime = Date.now() - startTime;
            healthStatus.responseTime = responseTime;
            healthStatus.lastSuccess = new Date();
            // Check for specific error patterns
            if (response.status === 401 || response.status === 403) {
                healthStatus.status = 'expired';
                healthStatus.errorMessage = 'API Key expired or invalid';
                await this.triggerAlert('api_key_expired', provider, 'critical', `${config.name} API key has expired or is invalid`, {
                    httpStatus: response.status,
                    responseTime,
                });
            }
            else if (response.status === 429) {
                healthStatus.status = 'failed';
                healthStatus.errorMessage = 'API quota exceeded';
                await this.triggerAlert('quota_exceeded', provider, 'high', `${config.name} API quota has been exceeded`, {
                    httpStatus: response.status,
                    responseTime,
                });
            }
            else if (response.status >= 500) {
                healthStatus.status = 'failed';
                healthStatus.errorMessage = `Server error: ${response.status}`;
                await this.triggerAlert('provider_down', provider, 'high', `${config.name} server is experiencing issues`, {
                    httpStatus: response.status,
                    responseTime,
                });
            }
            else if (responseTime > this.alertThresholds.responseTimeThreshold) {
                healthStatus.status = 'degraded';
                healthStatus.errorMessage = `Slow response time: ${responseTime}ms`;
            }
            // Check data freshness
            const dataFreshness = await this.checkDataFreshness(provider);
            healthStatus.dataFreshness = dataFreshness;
            if (dataFreshness.isStale) {
                healthStatus.status = healthStatus.status === 'healthy' ? 'degraded' : healthStatus.status;
                await this.triggerAlert('data_stale', provider, 'medium', `Data from ${config.name} is stale (last update: ${dataFreshness.lastUpdate})`, {
                    lastUpdate: dataFreshness.lastUpdate,
                    expectedInterval: dataFreshness.expectedUpdateInterval,
                });
            }
            // Update success metrics
            await this.updateHealthMetrics(provider, healthStatus);
            return healthStatus;
        }
        catch (error) {
            healthStatus.status = 'failed';
            healthStatus.lastFailure = new Date();
            healthStatus.errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Get previous failure count
            const previousStatus = await this.getLatestHealthStatus(provider);
            healthStatus.consecutiveFailures = (previousStatus?.consecutiveFailures || 0) + 1;
            // Determine severity based on consecutive failures
            const severity = healthStatus.consecutiveFailures >= this.alertThresholds.criticalFailureThreshold ? 'critical' : 'high';
            await this.triggerAlert('connection_failed', provider, severity, `Failed to connect to ${config.name}`, {
                error: healthStatus.errorMessage,
                consecutiveFailures: healthStatus.consecutiveFailures,
            });
            await this.updateHealthMetrics(provider, healthStatus);
            this.logger.error(`API health check failed for ${provider}`, {
                error: healthStatus.errorMessage,
                consecutiveFailures: healthStatus.consecutiveFailures,
            });
            return healthStatus;
        }
    }
    /**
     * Test API connection with proper error detection
     */
    async testApiConnection(provider, endpoint, apiKey) {
        const headers = {
            'Accept': 'application/json',
            'User-Agent': 'Unit-Talk-Monitor/1.0',
        };
        if (apiKey) {
            if (provider === 'optimal_api') {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
            else if (provider === 'odds_api') {
                // Odds API uses query parameter, not header
                endpoint += `?apiKey=${apiKey}`;
            }
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        try {
            const response = await fetch(endpoint, {
                headers,
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('API request timed out');
            }
            throw error;
        }
    }
    /**
     * Check data freshness based on last ingestion
     */
    async checkDataFreshness(provider) {
        const config = this.providerConfigs[provider];
        try {
            // Check when we last successfully ingested data from this provider
            const { data: lastIngestion, error } = await supabaseClient_1.supabaseClient
                .from('data_ingestion_log')
                .select('created_at, records_processed')
                .eq('provider', provider)
                .eq('status', 'success')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (error) {
                // If table doesn't exist, assume data is fresh (no false alarms)
                if (error.code === '42P01') {
                    this.logger.info(`data_ingestion_log table not found - assuming fresh data for ${provider}`);
                    return {
                        lastUpdate: new Date(), // Use current time to indicate fresh
                        expectedUpdateInterval: config?.expectedUpdateInterval || 5,
                        isStale: false, // Not stale if we can't check
                    };
                }
                // Not found is OK for individual records
                if (error.code !== 'PGRST116') {
                    throw error;
                }
            }
            const now = new Date();
            const lastUpdate = lastIngestion ? new Date(lastIngestion.created_at) : new Date();
            const minutesSinceLastUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));
            const isStale = minutesSinceLastUpdate > (config?.expectedUpdateInterval || 5);
            return {
                lastUpdate,
                expectedUpdateInterval: config?.expectedUpdateInterval || 5,
                isStale,
            };
        }
        catch (error) {
            this.logger.warn(`Cannot check data freshness for ${provider} - assuming fresh to prevent false alarms`, { error });
            // Return fresh status to prevent false alarms when monitoring is not set up
            return {
                lastUpdate: new Date(),
                expectedUpdateInterval: config?.expectedUpdateInterval || 5,
                isStale: false,
            };
        }
    }
    /**
     * Trigger alert and store in database
     */
    async triggerAlert(alertType, provider, severity, message, details) {
        const alert = {
            alertType,
            provider,
            severity,
            message,
            details,
            triggeredAt: new Date(),
            resolved: false,
        };
        try {
            // Store alert in database
            const { data, error } = await supabaseClient_1.supabaseClient
                .from('data_ingestion_alerts')
                .insert([alert])
                .select()
                .single();
            if (error) {
                // If alerts table doesn't exist, just log the alert
                if (error.code === '42P01') {
                    this.logger.warn(`data_ingestion_alerts table not found - logging alert only`, {
                        provider,
                        alertType,
                        message,
                        severity
                    });
                    console.error(`🚨 ALERT [${severity.toUpperCase()}]: ${message}`, {
                        provider,
                        alertType,
                        details,
                    });
                    return;
                }
                throw error;
            }
            this.logger.error(`🚨 DATA INGESTION ALERT [${severity.toUpperCase()}]`, {
                alertId: data.id,
                provider,
                alertType,
                message,
                details,
            });
            // Send real-time notification to Command Center
            await this.sendCommandCenterNotification(data);
            return data;
        }
        catch (error) {
            this.logger.warn('Alert storage not available - logging only', { provider, message, severity });
            // Even if database fails, still log critical alerts
            console.error(`🚨 ALERT [${severity.toUpperCase()}]: ${message}`, {
                provider,
                alertType,
                details,
            });
        }
    }
    /**
     * Send real-time notification to Command Center
     */
    async sendCommandCenterNotification(alert) {
        try {
            // Send to Command Center real-time channel
            const { error } = await supabaseClient_1.supabaseClient
                .from('realtime_notifications')
                .insert([{
                    channel: 'command_center',
                    event_type: 'data_ingestion_alert',
                    severity: alert.severity,
                    title: `${alert.provider} Data Issue`,
                    message: alert.message,
                    data: {
                        alertId: alert.id,
                        alertType: alert.alertType,
                        provider: alert.provider,
                        details: alert.details,
                    },
                    created_at: new Date().toISOString(),
                }]);
            if (error)
                throw error;
            // Also trigger Supabase realtime broadcast
            const channel = supabaseClient_1.supabaseClient.channel('command_center_alerts');
            await channel.send({
                type: 'broadcast',
                event: 'data_alert',
                payload: {
                    alertId: alert.id,
                    alertType: alert.alertType,
                    provider: alert.provider,
                    severity: alert.severity,
                    message: alert.message,
                    triggeredAt: alert.triggeredAt,
                },
            });
        }
        catch (error) {
            this.logger.error('Failed to send Command Center notification', { error, alert });
        }
    }
    /**
     * Update health metrics in database
     */
    async updateHealthMetrics(provider, healthStatus) {
        try {
            const { error } = await supabaseClient_1.supabaseClient
                .from('api_health_status')
                .upsert({
                provider,
                status: healthStatus.status,
                last_success: healthStatus.lastSuccess,
                last_failure: healthStatus.lastFailure,
                error_message: healthStatus.errorMessage,
                http_status: healthStatus.httpStatus,
                response_time: healthStatus.responseTime,
                consecutive_failures: healthStatus.consecutiveFailures,
                data_freshness: healthStatus.dataFreshness,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'provider'
            });
            if (error) {
                // If health status table doesn't exist, just log the status
                if (error.code === '42P01') {
                    this.logger.info(`api_health_status table not found - health status not persisted for ${provider}:${healthStatus.status}`);
                    return;
                }
                throw error;
            }
        }
        catch (error) {
            this.logger.warn('Health metrics storage not available - status not persisted', { provider, status: healthStatus.status });
        }
    }
    /**
     * Get latest health status from database
     */
    async getLatestHealthStatus(provider) {
        try {
            const { data, error } = await supabaseClient_1.supabaseClient
                .from('api_health_status')
                .select('*')
                .eq('provider', provider)
                .single();
            if (error) {
                // If table doesn't exist, return null (no previous status)
                if (error.code === '42P01') {
                    this.logger.info(`api_health_status table not found - no previous status for ${provider}`);
                    return null;
                }
                if (error.code === 'PGRST116')
                    return null; // Not found
                throw error;
            }
            return {
                provider: data.provider,
                status: data.status,
                lastSuccess: data.last_success ? new Date(data.last_success) : null,
                lastFailure: data.last_failure ? new Date(data.last_failure) : null,
                errorMessage: data.error_message,
                httpStatus: data.http_status,
                responseTime: data.response_time,
                consecutiveFailures: data.consecutive_failures || 0,
                dataFreshness: data.data_freshness,
            };
        }
        catch (error) {
            this.logger.warn('Health status retrieval not available', { provider });
            return null;
        }
    }
    /**
     * Monitor all configured APIs
     */
    async monitorAllApis() {
        const results = {};
        for (const [provider, _config] of Object.entries(this.providerConfigs)) {
            try {
                // Get API key from environment
                const apiKey = provider === 'optimal_api'
                    ? process.env.OPTIMAL_API_KEY
                    : process.env.ODDS_API_KEY;
                results[provider] = await this.checkApiHealth(provider, apiKey);
            }
            catch (error) {
                this.logger.error(`Failed to monitor ${provider}`, { error });
                results[provider] = {
                    provider,
                    status: 'failed',
                    lastSuccess: null,
                    lastFailure: new Date(),
                    errorMessage: error instanceof Error ? error.message : 'Monitoring failed',
                    consecutiveFailures: 1,
                };
            }
        }
        return results;
    }
    /**
     * Get active alerts for Command Center dashboard
     */
    async getActiveAlerts() {
        try {
            const { data, error } = await supabaseClient_1.supabaseClient
                .from('data_ingestion_alerts')
                .select('*')
                .eq('resolved', false)
                .order('triggered_at', { ascending: false })
                .limit(50);
            if (error) {
                // If alerts table doesn't exist, return empty array
                if (error.code === '42P01') {
                    this.logger.info('data_ingestion_alerts table not found - no alerts available');
                    return [];
                }
                throw error;
            }
            return data || [];
        }
        catch (error) {
            this.logger.warn('Active alerts retrieval not available', { error });
            return [];
        }
    }
    /**
     * Acknowledge alert
     */
    async acknowledgeAlert(alertId, acknowledgedBy) {
        try {
            const { error } = await supabaseClient_1.supabaseClient
                .from('data_ingestion_alerts')
                .update({
                acknowledged_by: acknowledgedBy,
                acknowledged_at: new Date().toISOString(),
            })
                .eq('id', alertId);
            if (error)
                throw error;
        }
        catch (error) {
            this.logger.error('Failed to acknowledge alert', { error, alertId });
            throw error;
        }
    }
    /**
     * Resolve alert
     */
    async resolveAlert(alertId, resolvedBy) {
        try {
            const { error } = await supabaseClient_1.supabaseClient
                .from('data_ingestion_alerts')
                .update({
                resolved: true,
                resolved_by: resolvedBy,
                resolved_at: new Date().toISOString(),
            })
                .eq('id', alertId);
            if (error)
                throw error;
            // Send resolution notification to Command Center
            await this.sendCommandCenterNotification({
                id: alertId,
                alertType: 'connection_failed', // Will be overridden
                provider: 'system',
                severity: 'low',
                message: `Alert ${alertId} resolved by ${resolvedBy}`,
                details: { resolvedBy, resolvedAt: new Date() },
                triggeredAt: new Date(),
                resolved: true,
            });
        }
        catch (error) {
            this.logger.error('Failed to resolve alert', { error, alertId });
            throw error;
        }
    }
}
exports.apiMonitoringService = new ApiMonitoringService();
