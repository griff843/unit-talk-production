/**
 * @fileoverview Ops Discord Embed Builder
 *
 * Builds Fortune-100 quality Discord embeds for:
 * - SLO incident notifications
 * - Weekly ops digests
 *
 * Part of PR7: Incident Routing + Ops Digest
 *
 * @module services/ops/OpsDiscordEmbedBuilder
 */

import { EmbedBuilder } from 'discord.js';

import { IncidentRecord } from './OpsIncidentRouter';

// ============================================================================
// Types
// ============================================================================

export interface OpsDigestData {
  periodStart: string;
  periodEnd: string;
  incidentCounts: {
    total: number;
    critical: number;
    warning: number;
    open: number;
    acknowledged: number;
    resolved: number;
  };
  topNoisySlos: Array<{
    slo_id: string;
    slo_name: string;
    incident_count: number;
  }>;
  timingMetrics: {
    avg_time_to_ack_minutes: number | null;
    avg_time_to_resolve_minutes: number | null;
    median_time_to_ack_minutes: number | null;
    median_time_to_resolve_minutes: number | null;
  };
  evaluationHealth: {
    total_evaluations: number;
    successful_evaluations: number;
    error_rate: number;
  };
  sloHealthSummary: Array<{
    slo_id: string;
    slo_name: string;
    current_status: string;
    last_evaluation: string;
    week_incidents: number;
  }>;
}

// ============================================================================
// Color Constants
// ============================================================================

const COLORS = {
  CRITICAL: 0xff0000, // Red
  WARNING: 0xffa500, // Orange
  RESOLVED: 0x00ff00, // Green
  ACKNOWLEDGED: 0xffff00, // Yellow
  INFO: 0x0099ff, // Blue
  DIGEST: 0x7b68ee, // Medium Slate Blue
};

const SEVERITY_EMOJIS = {
  critical: '🔴',
  warning: '🟡',
  open: '🚨',
  acknowledged: '👀',
  resolved: '✅',
};

const STATUS_LABELS = {
  open: 'OPEN',
  acknowledged: 'ACKNOWLEDGED',
  resolved: 'RESOLVED',
};

// ============================================================================
// Incident Embed Builder
// ============================================================================

/**
 * Build Discord embed for an SLO incident
 */
export function buildIncidentEmbed(
  incident: IncidentRecord,
  options: {
    correlationId: string;
    environment: string;
    commandCenterUrl: string;
    isUpdate?: boolean;
    escalationRoleId?: string;
  }
): EmbedBuilder {
  const { correlationId, environment, commandCenterUrl, isUpdate, escalationRoleId } = options;

  // Determine color based on severity and status
  let color: number;
  if (incident.status === 'resolved') {
    color = COLORS.RESOLVED;
  } else if (incident.status === 'acknowledged') {
    color = COLORS.ACKNOWLEDGED;
  } else if (incident.severity === 'critical') {
    color = COLORS.CRITICAL;
  } else {
    color = COLORS.WARNING;
  }

  const severityEmoji = SEVERITY_EMOJIS[incident.severity] || '⚠️';
  const statusEmoji = SEVERITY_EMOJIS[incident.status] || '📋';
  const statusLabel = STATUS_LABELS[incident.status] || incident.status.toUpperCase();

  // Build title
  const title = isUpdate
    ? `${statusEmoji} OPS INCIDENT UPDATE: ${incident.slo_name}`
    : `${severityEmoji} OPS INCIDENT: ${incident.slo_name}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp(new Date(incident.opened_at));

  // Description with status
  let description = `**Status:** ${statusEmoji} ${statusLabel}`;
  if (incident.severity === 'critical' && incident.status === 'open' && escalationRoleId) {
    description += `\n\n🚨 **CRITICAL ALERT** - <@&${escalationRoleId}>`;
  }
  embed.setDescription(description);

  // Main fields
  embed.addFields(
    {
      name: '📊 SLO Details',
      value: [
        `**SLO:** ${incident.slo_name}`,
        `**Severity:** ${incident.severity.toUpperCase()}`,
        `**ID:** \`${incident.slo_id.substring(0, 8)}...\``,
      ].join('\n'),
      inline: true,
    },
    {
      name: '📈 Metrics',
      value: [
        `**Current:** ${formatNumber(incident.trigger_value)}`,
        `**Threshold:** ${formatNumber(incident.trigger_threshold)}`,
        `**Delta:** ${formatDelta(incident.trigger_value, incident.trigger_threshold)}`,
      ].join('\n'),
      inline: true,
    },
    {
      name: '⏱️ Timeline',
      value: [
        `**Opened:** ${formatTimestamp(incident.opened_at)}`,
        incident.acknowledged_at
          ? `**Acknowledged:** ${formatTimestamp(incident.acknowledged_at)}`
          : '**Acknowledged:** -',
        incident.resolved_at
          ? `**Resolved:** ${formatTimestamp(incident.resolved_at)}`
          : '**Resolved:** -',
      ].join('\n'),
      inline: false,
    }
  );

  // Duration field if resolved
  if (incident.resolved_at && incident.opened_at) {
    const durationMs =
      new Date(incident.resolved_at).getTime() - new Date(incident.opened_at).getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    embed.addFields({
      name: '⏲️ Resolution Time',
      value: `${durationMinutes} minutes`,
      inline: true,
    });
  }

  // Evidence summary (if available)
  if (incident.evidence && Object.keys(incident.evidence).length > 0) {
    const evidenceSummary = Object.entries(incident.evidence)
      .slice(0, 3)
      .map(([key, value]) => `**${key}:** ${String(value).substring(0, 50)}`)
      .join('\n');

    embed.addFields({
      name: '🔍 Evidence',
      value: evidenceSummary || 'No evidence available',
      inline: false,
    });
  }

  // Command Center link
  const dashboardUrl = `${commandCenterUrl}/dashboard/ops`;
  embed.addFields({
    name: '🔗 Actions',
    value: `[Open Command Center](${dashboardUrl})`,
    inline: false,
  });

  // Footer with traceability
  embed.setFooter({
    text: `${environment.toUpperCase()} | incident: ${incident.incident_id.substring(0, 8)} | corr: ${correlationId.substring(0, 8)}`,
    iconURL: 'https://i.imgur.com/unit-talk-logo.png',
  });

  return embed;
}

// ============================================================================
// Digest Embed Builder
// ============================================================================

/**
 * Build Discord embed for weekly ops digest
 */
export function buildDigestEmbed(
  digest: OpsDigestData,
  options: {
    correlationId: string;
    environment: string;
    commandCenterUrl: string;
  }
): EmbedBuilder {
  const { correlationId, environment, commandCenterUrl } = options;

  const embed = new EmbedBuilder()
    .setTitle('📊 Weekly Ops Digest')
    .setColor(COLORS.DIGEST)
    .setTimestamp();

  // Period
  const periodStr = `${formatDate(digest.periodStart)} - ${formatDate(digest.periodEnd)}`;
  embed.setDescription(`**Period:** ${periodStr}\n**Environment:** ${environment.toUpperCase()}`);

  // Incident summary
  const incidentSummary = [
    `🔴 Critical: **${digest.incidentCounts.critical}**`,
    `🟡 Warning: **${digest.incidentCounts.warning}**`,
    `📊 Total: **${digest.incidentCounts.total}**`,
    '',
    `🚨 Open: ${digest.incidentCounts.open}`,
    `👀 Acknowledged: ${digest.incidentCounts.acknowledged}`,
    `✅ Resolved: ${digest.incidentCounts.resolved}`,
  ].join('\n');

  embed.addFields({
    name: '📋 Incident Summary',
    value: incidentSummary,
    inline: true,
  });

  // Timing metrics
  const timingStr = [
    `**Avg Time to Ack:** ${formatMinutes(digest.timingMetrics.avg_time_to_ack_minutes)}`,
    `**Avg Time to Resolve:** ${formatMinutes(digest.timingMetrics.avg_time_to_resolve_minutes)}`,
    `**Median TTR:** ${formatMinutes(digest.timingMetrics.median_time_to_resolve_minutes)}`,
  ].join('\n');

  embed.addFields({
    name: '⏱️ Response Metrics',
    value: timingStr,
    inline: true,
  });

  // Top noisy SLOs
  if (digest.topNoisySlos && digest.topNoisySlos.length > 0) {
    const noisyStr = digest.topNoisySlos
      .slice(0, 5)
      .map((slo, i) => `${i + 1}. **${slo.slo_name}**: ${slo.incident_count} incidents`)
      .join('\n');

    embed.addFields({
      name: '🔊 Top Noisy SLOs',
      value: noisyStr,
      inline: false,
    });
  }

  // Evaluation health
  const evalHealth = [
    `**Total Evaluations:** ${digest.evaluationHealth.total_evaluations}`,
    `**Successful:** ${digest.evaluationHealth.successful_evaluations}`,
    `**Error Rate:** ${digest.evaluationHealth.error_rate}%`,
  ].join('\n');

  embed.addFields({
    name: '🔍 Evaluation Health',
    value: evalHealth,
    inline: true,
  });

  // SLO health summary (compact)
  if (digest.sloHealthSummary && digest.sloHealthSummary.length > 0) {
    const healthByStatus = {
      GREEN: digest.sloHealthSummary.filter(s => s.current_status === 'GREEN').length,
      YELLOW: digest.sloHealthSummary.filter(s => s.current_status === 'YELLOW').length,
      RED: digest.sloHealthSummary.filter(s => s.current_status === 'RED').length,
    };

    const healthStr = [
      `🟢 Healthy: **${healthByStatus.GREEN}**`,
      `🟡 Warning: **${healthByStatus.YELLOW}**`,
      `🔴 Critical: **${healthByStatus.RED}**`,
    ].join('\n');

    embed.addFields({
      name: '📊 Current SLO Health',
      value: healthStr,
      inline: true,
    });
  }

  // Command Center link
  embed.addFields({
    name: '🔗 Full Report',
    value: `[Open Ops Dashboard](${commandCenterUrl}/dashboard/ops)`,
    inline: false,
  });

  // Footer
  embed.setFooter({
    text: `${environment.toUpperCase()} | Weekly Digest | corr: ${correlationId.substring(0, 8)}`,
    iconURL: 'https://i.imgur.com/unit-talk-logo.png',
  });

  return embed;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(value: number): string {
  if (value === null || value === undefined) return 'N/A';
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(2);
}

function formatDelta(current: number, threshold: number): string {
  if (current === null || threshold === null) return 'N/A';
  const delta = current - threshold;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${formatNumber(delta)}`;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
  } catch {
    return isoString;
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return 'N/A';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

// ============================================================================
// Utility Functions for Message Content
// ============================================================================

/**
 * Build message content for escalation (outside embed)
 */
export function buildEscalationContent(
  incident: IncidentRecord,
  escalationRoleId?: string
): string {
  if (!escalationRoleId || incident.severity !== 'critical' || incident.status !== 'open') {
    return '';
  }

  return `🚨 **CRITICAL OPS INCIDENT** <@&${escalationRoleId}>\n`;
}

/**
 * Build message content for digest
 */
export function buildDigestContent(digest: OpsDigestData): string {
  const criticalCount = digest.incidentCounts.critical;
  if (criticalCount > 0) {
    return `📊 Weekly Ops Digest - **${criticalCount} critical incidents** this week\n`;
  }
  return '📊 Weekly Ops Digest\n';
}
