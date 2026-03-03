/**
 * @fileoverview Discord Backlog Nudge Playbook
 *
 * Alerts ops team when Discord notification backlog grows.
 * EXECUTABLE: Can send Discord webhooks directly.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/playbooks/DiscordBacklogNudgePlaybook
 */

import {
  ActionRecord,
  ExecutionContext,
  ExecutionResult,
  ExecutionType,
  PlaybookId,
} from '../types';

import { BasePlaybook } from './BasePlaybook';

// ============================================================================
// DiscordBacklogNudgePlaybook Class
// ============================================================================

export class DiscordBacklogNudgePlaybook extends BasePlaybook {
  readonly id: PlaybookId = 'DISCORD_BACKLOG_NUDGE';
  readonly name = 'Discord Backlog Nudge';
  readonly description = 'Alert ops team when Discord notification backlog grows';
  readonly executionType: ExecutionType = 'EXECUTABLE';
  readonly requiredKnobs: string[] = ['DISCORD_WEBHOOK'];

  private discordWebhookUrl: string | undefined;

  constructor() {
    super();
    this.discordWebhookUrl = process.env.OPS_DISCORD_WEBHOOK_URL;
  }

  /**
   * Execute the playbook - send Discord notification
   */
  async execute(context: ExecutionContext, dryRun: boolean): Promise<ExecutionResult> {
    this.logger.info('Executing DISCORD_BACKLOG_NUDGE playbook', {
      incidentId: context.incident_id,
      correlationId: context.correlation_id,
      dryRun,
    });

    const actions: ActionRecord[] = [];

    try {
      // Build the Discord embed
      const embed = this.buildDiscordEmbed(context);

      if (dryRun) {
        this.logger.info('DRY RUN: Would send Discord notification', { embed });

        actions.push(
          this.createAction('send_discord_notification', true, {
            targetKnob: 'DISCORD_WEBHOOK',
            newValue: 'Discord notification (dry run)',
          })
        );

        return this.createSuccessResult(actions, dryRun, context);
      }

      // Check if webhook URL is configured
      if (!this.discordWebhookUrl) {
        this.logger.warn('Discord webhook URL not configured');

        actions.push(
          this.createAction('send_discord_notification', false, {
            targetKnob: 'DISCORD_WEBHOOK',
            error: 'OPS_DISCORD_WEBHOOK_URL not configured',
          })
        );

        // Return recommendations instead
        return {
          success: true,
          execution_id: '',
          playbook_id: this.id,
          execution_type: 'RECOMMENDATION_ONLY',
          status: 'skipped',
          actions_taken: actions,
          recommendations: this.getRecommendations(context),
          duration_ms: 0,
          dry_run: dryRun,
        };
      }

      // Send the webhook
      const response = await fetch(this.discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'Unit Talk Ops',
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      }

      actions.push(
        this.createAction('send_discord_notification', true, {
          targetKnob: 'DISCORD_WEBHOOK',
          newValue: 'Discord notification sent',
        })
      );

      this.logger.info('Discord backlog nudge sent', {
        incidentId: context.incident_id,
      });

      return this.createSuccessResult(actions, dryRun, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send Discord notification', { error: errorMessage });

      actions.push(
        this.createAction('send_discord_notification', false, {
          targetKnob: 'DISCORD_WEBHOOK',
          error: errorMessage,
        })
      );

      return this.createFailedResult(errorMessage, dryRun);
    }
  }

  /**
   * Build Discord embed for the notification
   */
  private buildDiscordEmbed(context: ExecutionContext): object {
    const commandCenterUrl = process.env.COMMAND_CENTER_URL || 'http://localhost:3004';

    return {
      title: '⚠️ Discord Notification Backlog Alert',
      description: 'The Discord notification queue is backing up. Please investigate.',
      color: 0xffa500, // Orange
      fields: [
        {
          name: 'Incident ID',
          value: context.incident_id,
          inline: true,
        },
        {
          name: 'Triggered By',
          value: context.triggered_by,
          inline: true,
        },
        ...(context.trigger_value !== undefined
          ? [
              {
                name: 'Backlog Size',
                value: `${context.trigger_value} notifications pending`,
                inline: true,
              },
            ]
          : []),
        ...(context.trigger_threshold !== undefined
          ? [
              {
                name: 'Threshold',
                value: `${context.trigger_threshold} notifications`,
                inline: true,
              },
            ]
          : []),
        {
          name: 'Action Required',
          value: [
            '1. Check `incident_notifications` table for stuck messages',
            '2. Verify Discord bot is running and healthy',
            '3. Check Discord API rate limits',
            '4. Review OpsNotificationWorker logs',
          ].join('\n'),
          inline: false,
        },
      ],
      footer: {
        text: `Auto-Remediation System | ${new Date().toISOString()}`,
      },
      url: `${commandCenterUrl}/ops/incidents/${context.incident_id}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get rollback steps
   */
  getRollbackSteps(_context: ExecutionContext): string[] {
    // No rollback needed - just sent a notification
    return [
      'No rollback needed - this playbook only sends notifications.',
      'If the backlog persists, investigate the root cause.',
    ];
  }

  /**
   * Get recommendations if execution is not possible
   */
  getRecommendations(context: ExecutionContext): string[] {
    return [
      '⚠️ DISCORD NOTIFICATION BACKLOG DETECTED',
      '',
      '🔧 RECOMMENDED ACTIONS:',
      '',
      '1. Check notification backlog:',
      '   SELECT COUNT(*), status',
      '   FROM incident_notifications',
      "   WHERE sent_at IS NULL OR sent_at > NOW() - INTERVAL '1 hour'",
      '   GROUP BY status;',
      '',
      '2. Check OpsNotificationWorker health:',
      '   - Review ./dev.sh logs for worker errors',
      '   - Check OPS_NOTIFICATION_WORKER_ENABLED env var',
      '',
      '3. Verify Discord connectivity:',
      '   - Test webhook URL manually',
      '   - Check Discord API status: https://discordstatus.com',
      '',
      '4. Process stuck notifications:',
      '   - Restart OpsNotificationWorker: docker-compose restart api',
      '   - Or manually trigger poll via API',
      '',
      '5. Configure webhook URL if missing:',
      '   - Set OPS_DISCORD_WEBHOOK_URL in environment',
      '   - Restart services after configuration',
      '',
      `Incident ID: ${context.incident_id}`,
      `Backlog size: ${context.trigger_value || 'unknown'}`,
    ];
  }
}
