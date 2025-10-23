"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDiscordAlert = sendDiscordAlert;
exports.sendOperatorAlert = sendOperatorAlert;
exports.sendApprovedPicksAlert = sendApprovedPicksAlert;
exports.sendQuotaWarning = sendQuotaWarning;
exports.sendFallbackTrigger = sendFallbackTrigger;
exports.sendWorkflowFailure = sendWorkflowFailure;
exports.sendWeeklyReport = sendWeeklyReport;
const axios_1 = __importDefault(require("axios"));
const dateUtils_1 = require("../utils/dateUtils");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.makeLogger)('AlertActivities');
/**
 * ALERT ACTIVITIES
 * Core activities for sending alerts to Discord, Notion, email, and SMS
 */
async function sendDiscordAlert(params) {
    try {
        const webhookUrl = params.channel === 'approved'
            ? process.env['DISCORD_APPROVED_WEBHOOK_URL']
            : process.env['DISCORD_OPERATOR_WEBHOOK_URL'];
        if (!webhookUrl) {
            throw new Error(`Discord webhook URL not configured for ${params.channel} channel`);
        }
        // Add emoji prefix for operator alerts
        const prefixedMessage = params.channel === 'operator'
            ? `🚨 ${params.message}`
            : params.message;
        const payload = {
            content: prefixedMessage,
            embeds: params.metadata ? [{
                    title: `${params.priority.toUpperCase()} Alert`,
                    description: params.message,
                    color: params.priority === 'critical' ? 0xFF0000 :
                        params.priority === 'high' ? 0xFF8C00 : 0x00FF00,
                    timestamp: (0, dateUtils_1.toISOString)(new Date()),
                    fields: Object.entries(params.metadata).map(([key, value]) => ({
                        name: key,
                        value: String(value),
                        inline: true
                    }))
                }] : undefined
        };
        const response = await axios_1.default.post(webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        if (response.status === 204) {
            logger.info(`✅ Discord alert sent to ${params.channel}`, {
                channel: params.channel,
                priority: params.priority,
                messageLength: params.message.length
            });
            return { success: true };
        }
        else {
            throw new Error(`Unexpected response status: ${response.status}`);
        }
    }
    catch (error) {
        const errorContext = typeof error === 'object' && error !== null ? error : undefined;
        logger.error(`❌ Discord alert failed for ${params.channel}:`, errorContext);
        return {
            success: false,
            error: String(error)
        };
    }
}
async function sendOperatorAlert(params) {
    try {
        const alertMessage = `**${params.type.toUpperCase()}**: ${params.message}`;
        return await sendDiscordAlert({
            message: alertMessage,
            channel: 'operator',
            priority: params.severity,
            metadata: {
                type: params.type,
                timestamp: (0, dateUtils_1.toISOString)(new Date()),
                ...params.metadata
            }
        });
    }
    catch (error) {
        const errorContext = typeof error === 'object' && error !== null ? error : undefined;
        logger.error(`❌ Operator alert failed:`, errorContext);
        return {
            success: false,
            error: String(error)
        };
    }
}
async function sendApprovedPicksAlert(params) {
    try {
        const message = `**New Approved Picks - Cycle ${params.cycleCount}**\n\n` +
            `📊 **${params.picks.length} S/A Tier Picks** (${params.totalPicks} total processed)\n\n` +
            params.picks.slice(0, 10).map(pick => `🎯 **${pick.player_name}** (${pick.team}) - ${pick.stat_type} ${pick.line} (${pick.tier} tier)`).join('\n') +
            (params.picks.length > 10 ? `\n\n... and ${params.picks.length - 10} more picks` : '');
        return await sendDiscordAlert({
            message,
            channel: 'approved',
            priority: 'high',
            metadata: {
                cycleCount: params.cycleCount,
                picksCount: params.picks.length,
                totalProcessed: params.totalPicks
            }
        });
    }
    catch (error) {
        const errorContext = typeof error === 'object' && error !== null ? error : undefined;
        logger.error(`❌ Approved picks alert failed:`, errorContext);
        return {
            success: false,
            error: String(error)
        };
    }
}
async function sendQuotaWarning(params) {
    try {
        const message = `API Quota Warning: ${params.provider} at ${params.percentage}% usage (${params.currentUsage}/${params.limit})`;
        return await sendOperatorAlert({
            type: 'quota_warning',
            message,
            severity: params.percentage > 95 ? 'critical' : 'high',
            metadata: {
                provider: params.provider,
                currentUsage: params.currentUsage,
                limit: params.limit,
                percentage: params.percentage
            }
        });
    }
    catch (error) {
        const errorContext = typeof error === 'object' && error !== null ? error : undefined;
        logger.error(`❌ Quota warning failed:`, errorContext);
        return {
            success: false,
            error: String(error)
        };
    }
}
async function sendFallbackTrigger(params) {
    try {
        const message = `Fallback Activated: ${params.primaryProvider} → ${params.fallbackProvider}. Reason: ${params.reason}`;
        return await sendOperatorAlert({
            type: 'fallback_trigger',
            message,
            severity: 'high',
            metadata: {
                primaryProvider: params.primaryProvider,
                fallbackProvider: params.fallbackProvider,
                reason: params.reason
            }
        });
    }
    catch (error) {
        const errorContext = typeof error === 'object' && error !== null ? error : undefined;
        logger.error(`❌ Fallback trigger alert failed:`, errorContext);
        return {
            success: false,
            error: String(error)
        };
    }
}
async function sendWorkflowFailure(params) {
    try {
        const message = `Workflow Failure: ${params.workflowName} failed on cycle ${params.cycleCount}. Error: ${params.error}`;
        return await sendOperatorAlert({
            type: 'workflow_failure',
            message,
            severity: 'critical',
            metadata: {
                workflowName: params.workflowName,
                cycleCount: params.cycleCount,
                error: params.error
            }
        });
    }
    catch (error) {
        const errorContext = typeof error === 'object' && error !== null ? error : undefined;
        logger.error(`❌ Workflow failure alert failed:`, errorContext);
        return {
            success: false,
            error: String(error)
        };
    }
}
async function sendWeeklyReport(params) {
    try {
        const webhookUrl = params.webhook || process.env['DISCORD_APPROVED_WEBHOOK_URL'];
        if (!webhookUrl) {
            throw new Error('Weekly report webhook URL not configured');
        }
        const message = `📊 **Weekly Performance Report**\n\n` +
            `**Total Props Processed**: ${params.report.totalProps || 0}\n` +
            `**S/A Tier Picks**: ${params.report.promotedPicks || 0}\n` +
            `**Success Rate**: ${params.report.successRate || 0}%\n` +
            `**Average Cycle Time**: ${params.report.avgCycleTime || 0}s\n\n` +
            `**Top Performing Leagues**: ${(params.report.topLeagues || []).join(', ')}`;
        const payload = {
            content: message,
            embeds: [{
                    title: 'Weekly Performance Summary',
                    color: 0x00FF00,
                    timestamp: (0, dateUtils_1.toISOString)(new Date()),
                    fields: [
                        { name: 'Props Processed', value: String(params.report.totalProps || 0), inline: true },
                        { name: 'Promoted Picks', value: String(params.report.promotedPicks || 0), inline: true },
                        { name: 'Success Rate', value: `${params.report.successRate || 0}%`, inline: true }
                    ]
                }]
        };
        const response = await axios_1.default.post(webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        if (response.status === 204) {
            logger.info(`✅ Weekly report sent successfully`);
            return { success: true };
        }
        else {
            throw new Error(`Unexpected response status: ${response.status}`);
        }
    }
    catch (error) {
        const errorContext = typeof error === 'object' && error !== null ? error : undefined;
        logger.error(`❌ Weekly report failed:`, errorContext);
        return {
            success: false,
            error: String(error)
        };
    }
}
