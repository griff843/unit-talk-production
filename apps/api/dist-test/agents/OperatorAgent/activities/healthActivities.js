"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeHealthSnapshot = executeHealthSnapshot;
exports.logJobRun = logJobRun;
exports.completeJobRun = completeJobRun;
exports.createIncidents = createIncidents;
exports.pushToCommandCenter = pushToCommandCenter;
exports.sendHealthAlert = sendHealthAlert;
const supabaseClient_1 = require("../../../services/supabaseClient");
const logger_1 = require("../../../utils/logger");
/**
 * Execute system_health_snapshot query with comprehensive error handling
 */
async function executeHealthSnapshot() {
    const startTime = Date.now();
    try {
        logger_1.logger.info('🔍 Executing system_health_snapshot query');
        const queryStartTime = Date.now();
        // Execute the health snapshot query
        const { data, error } = await supabaseClient_1.supabaseClient
            .from('system_health_snapshot')
            .select('*')
            .single();
        const queryTime = Date.now() - queryStartTime;
        if (error) {
            logger_1.logger.error('❌ Health snapshot query failed', {
                error: error.message,
                code: error.code,
                details: error.details
            });
            throw new Error(`Health snapshot query failed: ${error.message}`);
        }
        if (!data || !data.health_data) {
            throw new Error('Health snapshot returned no data');
        }
        const healthData = data.health_data;
        const executionTime = Date.now() - startTime;
        logger_1.logger.info('✅ Health snapshot query successful', {
            sectionsRetrieved: healthData.length,
            queryTime,
            executionTime,
            sections: healthData.map(s => s.section)
        });
        return {
            success: true,
            healthData,
            executionTime,
            queryTime
        };
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('❌ Health snapshot execution failed', {
            error: errorMessage,
            executionTime
        });
        return {
            success: false,
            healthData: [],
            executionTime,
            queryTime: 0
        };
    }
}
/**
 * Log job run start with comprehensive metadata
 */
async function logJobRun(params) {
    try {
        const { data, error } = await supabaseClient_1.supabaseClient
            .from('agent_job_runs')
            .insert([{
                agent: params.agent,
                workflow: params.workflow,
                job_name: params.jobName,
                status: params.status,
                metadata: params.metadata,
                error_message: params.errorMessage,
                started_at: new Date().toISOString()
            }])
            .select('job_id')
            .single();
        if (error) {
            logger_1.logger.error('❌ Failed to log job run', {
                error: error.message,
                params
            });
            throw new Error(`Failed to log job run: ${error.message}`);
        }
        const jobId = data.job_id;
        logger_1.logger.info('📝 Job run logged successfully', {
            jobId,
            agent: params.agent,
            workflow: params.workflow,
            jobName: params.jobName,
            status: params.status
        });
        return {
            jobId,
            logged: true
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('❌ Job run logging failed', { error: errorMessage, params });
        // Return a fallback job ID for tracking
        const fallbackJobId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
            jobId: fallbackJobId,
            logged: false
        };
    }
}
/**
 * Complete job run with duration calculation and final metadata
 */
async function completeJobRun(params) {
    try {
        // Use the database function for atomic completion
        const { data, error } = await supabaseClient_1.supabaseClient
            .rpc('complete_job_run', {
            p_job_id: params.jobId,
            p_status: params.status,
            p_metadata: params.metadata,
            p_error_message: params.errorMessage
        });
        if (error) {
            logger_1.logger.error('❌ Failed to complete job run', {
                error: error.message,
                jobId: params.jobId,
                status: params.status
            });
            throw new Error(`Failed to complete job run: ${error.message}`);
        }
        // Get the duration from the updated record
        const { data: jobData } = await supabaseClient_1.supabaseClient
            .from('agent_job_runs')
            .select('duration_ms')
            .eq('job_id', params.jobId)
            .single();
        const duration = jobData?.duration_ms || 0;
        logger_1.logger.info('✅ Job run completed successfully', {
            jobId: params.jobId,
            status: params.status,
            duration,
            hasError: !!params.errorMessage
        });
        return {
            completed: true,
            duration
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('❌ Job run completion failed', {
            error: errorMessage,
            jobId: params.jobId,
            status: params.status
        });
        return {
            completed: false,
            duration: 0
        };
    }
}
/**
 * Create health incidents with idempotent deduplication
 */
async function createIncidents(params) {
    const incidentsCreated = [];
    const duplicatesSkipped = [];
    try {
        logger_1.logger.info('🚨 Creating health incidents', {
            totalIncidents: params.incidents.length,
            kinds: params.incidents.map(i => i.kind)
        });
        for (const incident of params.incidents) {
            try {
                // Use the database function for idempotent incident creation
                const { data, error } = await supabaseClient_1.supabaseClient
                    .rpc('create_health_incident', {
                    p_kind: incident.kind,
                    p_severity: incident.severity,
                    p_details: {
                        ...incident.details,
                        section: incident.section,
                        createdBy: 'HealthWorkflow',
                        timestamp: new Date().toISOString()
                    }
                });
                if (error) {
                    logger_1.logger.error('❌ Failed to create incident', {
                        error: error.message,
                        incident: incident.kind,
                        section: incident.section
                    });
                    continue;
                }
                if (data) {
                    incidentsCreated.push(incident.kind);
                    logger_1.logger.info('✅ Incident created', {
                        incidentId: data,
                        kind: incident.kind,
                        severity: incident.severity,
                        section: incident.section
                    });
                }
                else {
                    duplicatesSkipped.push(incident.kind);
                    logger_1.logger.info('⏭️ Incident skipped (duplicate)', {
                        kind: incident.kind,
                        section: incident.section
                    });
                }
            }
            catch (incidentError) {
                const errorMessage = incidentError instanceof Error ? incidentError.message : String(incidentError);
                logger_1.logger.error('❌ Individual incident creation failed', {
                    error: errorMessage,
                    incident: incident.kind
                });
            }
        }
        logger_1.logger.info('📊 Incident creation summary', {
            created: incidentsCreated.length,
            skipped: duplicatesSkipped.length,
            total: params.incidents.length
        });
        return {
            incidentsCreated,
            duplicatesSkipped,
            totalProcessed: params.incidents.length
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('❌ Incident creation batch failed', { error: errorMessage });
        return {
            incidentsCreated,
            duplicatesSkipped,
            totalProcessed: params.incidents.length
        };
    }
}
/**
 * Push health data to Command Center via API
 */
async function pushToCommandCenter(params) {
    const startTime = Date.now();
    const endpoint = process.env.COMMAND_CENTER_API_URL || 'http://localhost:3004/api/system/health';
    try {
        logger_1.logger.info('📡 Pushing health data to Command Center', {
            endpoint,
            sectionsCount: params.healthData.length,
            executionMetrics: params.executionMetrics
        });
        const payload = {
            timestamp: params.timestamp,
            source: 'HealthWorkflow',
            executionMetrics: params.executionMetrics,
            healthSections: params.healthData.reduce((acc, section) => {
                acc[section.section] = {
                    status: section.status,
                    count_recent: section.count_recent,
                    count_total: section.count_total,
                    last_updated: section.last_updated,
                    details: section.details,
                    thresholds: section.thresholds,
                    alerts: section.alerts,
                    incident_badges: section.alerts.length > 0
                };
                return acc;
            }, {})
        };
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Source': 'HealthWorkflow',
                'X-Timestamp': params.timestamp
            },
            body: JSON.stringify(payload),
            timeout: 10000 // 10 second timeout
        });
        const responseTime = Date.now() - startTime;
        if (!response.ok) {
            throw new Error(`Command Center API returned ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        logger_1.logger.info('✅ Command Center push successful', {
            endpoint,
            responseTime,
            statusCode: response.status,
            result
        });
        return {
            pushed: true,
            endpoint,
            responseTime
        };
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('❌ Command Center push failed', {
            endpoint,
            responseTime,
            error: errorMessage
        });
        return {
            pushed: false,
            endpoint,
            responseTime
        };
    }
}
/**
 * Send health monitoring alerts via Discord/notification system
 */
async function sendHealthAlert(params) {
    try {
        logger_1.logger.info('🔔 Sending health alert', {
            alertType: params.alertType,
            priority: params.priority,
            message: params.message
        });
        // Format the alert for Discord
        const embedColor = this.getAlertColor(params.priority);
        const emoji = this.getAlertEmoji(params.alertType);
        const discordPayload = {
            embeds: [{
                    title: `${emoji} Health Monitoring Alert`,
                    description: params.message,
                    color: embedColor,
                    fields: [
                        {
                            name: 'Alert Type',
                            value: params.alertType,
                            inline: true
                        },
                        {
                            name: 'Priority',
                            value: params.priority.toUpperCase(),
                            inline: true
                        },
                        {
                            name: 'Timestamp',
                            value: new Date().toISOString(),
                            inline: true
                        }
                    ],
                    footer: {
                        text: 'OperatorAgent HealthWorkflow'
                    },
                    timestamp: new Date().toISOString()
                }]
        };
        // Add details as additional fields if critical or high priority
        if (params.priority === 'critical' || params.priority === 'high') {
            if (typeof params.details === 'object' && params.details !== null) {
                const detailsText = JSON.stringify(params.details, null, 2);
                if (detailsText.length < 1000) {
                    discordPayload.embeds[0].fields.push({
                        name: 'Details',
                        value: `\`\`\`json\n${detailsText}\`\`\``,
                        inline: false
                    });
                }
            }
        }
        // Send to Discord webhook
        const webhookUrl = process.env.DISCORD_HEALTH_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(discordPayload)
            });
            if (!response.ok) {
                throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
            }
            logger_1.logger.info('✅ Health alert sent successfully', {
                alertType: params.alertType,
                priority: params.priority,
                webhookStatus: response.status
            });
        }
        else {
            logger_1.logger.warn('⚠️ No Discord webhook URL configured - alert not sent', {
                alertType: params.alertType,
                priority: params.priority
            });
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('❌ Health alert failed', {
            error: errorMessage,
            alertType: params.alertType,
            priority: params.priority
        });
        // Don't throw - alerts are best effort
    }
}
// Helper functions
function getAlertColor(priority) {
    switch (priority) {
        case 'critical': return 0xFF0000; // Red
        case 'high': return 0xFF8C00; // Dark Orange
        case 'medium': return 0xFFD700; // Gold
        case 'low': return 0x00FF00; // Green
        default: return 0x808080; // Gray
    }
}
function getAlertEmoji(alertType) {
    switch (alertType) {
        case 'health_check_complete': return '✅';
        case 'critical_incidents': return '🚨';
        case 'system_degraded': return '⚠️';
        case 'health_check_failed': return '❌';
        default: return '📊';
    }
}
