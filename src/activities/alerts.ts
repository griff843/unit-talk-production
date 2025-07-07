import { createLogger } from '../utils/logger';
import axios from 'axios';

const logger = createLogger('AlertActivities');

/**
 * ALERT ACTIVITIES
 * Core activities for sending alerts to Discord, Notion, email, and SMS
 */

export async function sendDiscordAlert(params: {
  message: string;
  channel: 'approved' | 'operator';
  priority: 'critical' | 'high' | 'normal';
  metadata?: any;
}): Promise<{ success: boolean; error?: string }> {
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
        timestamp: new Date().toISOString(),
        fields: Object.entries(params.metadata).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true
        }))
      }] : undefined
    };

    const response = await axios.post(webhookUrl, payload, {
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
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

  } catch (error) {
    logger.error(`❌ Discord alert failed for ${params.channel}:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function sendOperatorAlert(params: {
  type: 'workflow_failure' | 'quota_warning' | 'fallback_trigger' | 'system_error';
  message: string;
  severity: 'critical' | 'high' | 'normal';
  metadata?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const alertMessage = `**${params.type.toUpperCase()}**: ${params.message}`;
    
    return await sendDiscordAlert({
      message: alertMessage,
      channel: 'operator',
      priority: params.severity,
      metadata: {
        type: params.type,
        timestamp: new Date().toISOString(),
        ...params.metadata
      }
    });

  } catch (error) {
    logger.error(`❌ Operator alert failed:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function sendApprovedPicksAlert(params: {
  picks: any[];
  cycleCount: number;
  totalPicks: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const message = `**New Approved Picks - Cycle ${params.cycleCount}**\n\n` +
      `📊 **${params.picks.length} S/A Tier Picks** (${params.totalPicks} total processed)\n\n` +
      params.picks.slice(0, 10).map(pick => 
        `🎯 **${pick.player_name}** (${pick.team}) - ${pick.stat_type} ${pick.line} (${pick.tier} tier)`
      ).join('\n') +
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

  } catch (error) {
    logger.error(`❌ Approved picks alert failed:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function sendQuotaWarning(params: {
  provider: string;
  currentUsage: number;
  limit: number;
  percentage: number;
}): Promise<{ success: boolean; error?: string }> {
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

  } catch (error) {
    logger.error(`❌ Quota warning failed:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function sendFallbackTrigger(params: {
  primaryProvider: string;
  fallbackProvider: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
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

  } catch (error) {
    logger.error(`❌ Fallback trigger alert failed:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function sendWorkflowFailure(params: {
  workflowName: string;
  error: string;
  cycleCount: number;
}): Promise<{ success: boolean; error?: string }> {
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

  } catch (error) {
    logger.error(`❌ Workflow failure alert failed:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function sendWeeklyReport(params: {
  report: any;
  webhook?: string;
}): Promise<{ success: boolean; error?: string }> {
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
        timestamp: new Date().toISOString(),
        fields: [
          { name: 'Props Processed', value: String(params.report.totalProps || 0), inline: true },
          { name: 'Promoted Picks', value: String(params.report.promotedPicks || 0), inline: true },
          { name: 'Success Rate', value: `${params.report.successRate || 0}%`, inline: true }
        ]
      }]
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.status === 204) {
      logger.info(`✅ Weekly report sent successfully`);
      return { success: true };
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

  } catch (error) {
    logger.error(`❌ Weekly report failed:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}