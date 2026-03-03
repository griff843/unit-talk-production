/**
 * Shadow Mode Service
 * Enables full grading → promotion → monitoring flow without public posting
 * All promotions are logged to shadow tables for testing and analysis
 */

import { Client as DiscordClient, EmbedBuilder, TextChannel } from 'discord.js';

import { supabase as supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

export interface ShadowPick {
  rawPropId?: string;
  unifiedPickId?: string;
  sport: string;
  market: string;
  player: string;
  team?: string;
  book?: string;
  oddsOpen?: number;
  oddsNow?: number;
  line?: number;
  eventTime?: Date;
  tier?: string;
  confidence?: number;
  professionalScore?: number;
  deviggedWinProb?: number;
  deviggedEdge?: number;
  clvPct?: number;
  kellyFraction?: number;
  risk?: number;
  chaosMuted?: boolean;
  steamMuted?: boolean;
  isInstant?: boolean;
  groupKey?: string;
}

export type ShadowAction = 'instant' | 'queued-10am' | 'rejected-gate' | 'rejected-recheck';

export interface ShadowMetricsSnapshot {
  window: '7d' | '30d' | 'lifetime';
  sport?: string;
  postedEv?: number;
  positiveCLVRate?: number;
  avgCLV?: number;
  hitRate?: number;
  roi?: number;
  sharpe?: number;
  kellyEfficiency?: number;
  maxDrawdown?: number;
  picksCount?: number;
  completedPicks?: number;
  winRate?: number;
  avgOdds?: number;
  profitFactor?: number;
}

export class ShadowModeService {
  private static instance: ShadowModeService;
  private logger: any;
  private discordClient: DiscordClient | null = null;
  private shadowChannelId: string | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.logger = createLogger('ShadowMode');
    this.shadowChannelId = process.env.SHADOW_PRIVATE_CHANNEL_ID || null;
    this.initializeService();
  }

  public static getInstance(): ShadowModeService {
    if (!ShadowModeService.instance) {
      ShadowModeService.instance = new ShadowModeService();
    }
    return ShadowModeService.instance;
  }

  /**
   * Initialize shadow mode service
   */
  private async initializeService(): Promise<void> {
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
      maxDays: this.getMaxDays(),
    });
  }

  /**
   * Check if shadow mode is enabled
   */
  public isShadowMode(): boolean {
    return process.env.SHADOW_MODE === 'true';
  }

  /**
   * Get maximum days to keep shadow data
   */
  private getMaxDays(): number {
    return parseInt(process.env.SHADOW_MAX_DAYS || '7', 10);
  }

  /**
   * Write a pick decision to shadow tables
   */
  public async shadowWritePick(
    pick: ShadowPick,
    decidedAction: ShadowAction,
    reasons: string[] = []
  ): Promise<void> {
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
        reasons: reasons.length > 0 ? reasons : null,
      };

      const { error } = await supabaseClient.from('shadow_decisions').insert(shadowRow);

      if (error) {
        this.logger.error('Failed to write shadow pick', { error, pick });
      } else {
        this.logger.info('Shadow pick written', {
          player: pick.player,
          action: decidedAction,
          reasons,
        });
      }
    } catch (error) {
      this.logger.error('Error writing shadow pick', { error });
    }
  }

  /**
   * Publish a preview to the private shadow channel
   */
  public async shadowPublishPreview(embed: any): Promise<void> {
    if (!this.isShadowMode() || !this.shadowChannelId || !this.discordClient) {
      return;
    }

    try {
      const channel = (await this.discordClient.channels.fetch(
        this.shadowChannelId
      )) as TextChannel;
      if (!channel) {
        this.logger.error('Shadow channel not found', { channelId: this.shadowChannelId });
        return;
      }

      // Create shadow-prefixed embed
      const shadowEmbed = this.createShadowEmbed(embed);

      await channel.send({ embeds: [shadowEmbed] });

      this.logger.info('Shadow preview published', {
        channel: this.shadowChannelId,
        player: embed.player || 'Unknown',
      });
    } catch (error) {
      this.logger.error('Failed to publish shadow preview', { error });
    }
  }

  /**
   * Create a shadow-prefixed embed
   */
  private createShadowEmbed(originalEmbed: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🔒 [SHADOW] ${originalEmbed.title || 'Shadow Pick'}`)
      .setColor(0x808080) // Gray color for shadow
      .setTimestamp();

    // Add description with shadow disclaimer
    const disclaimer = '**⚠️ SHADOW MODE - NOT PUBLISHED PUBLICLY**\n\n';
    embed.setDescription(disclaimer + (originalEmbed.description || ''));

    // Add fields from original embed
    if (originalEmbed.fields && Array.isArray(originalEmbed.fields)) {
      originalEmbed.fields.forEach((field: any) => {
        embed.addFields({
          name: field.name,
          value: field.value,
          inline: field.inline !== false,
        });
      });
    }

    // Add shadow metrics footer
    const metrics = this.formatShadowMetrics(originalEmbed);
    embed.addFields({
      name: '📊 Shadow Metrics',
      value: metrics,
      inline: false,
    });

    // Add footer
    embed.setFooter({
      text: 'Shadow Mode | Testing Only',
      iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
    });

    return embed;
  }

  /**
   * Format shadow metrics for display
   */
  private formatShadowMetrics(embed: any): string {
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
  public async shadowWriteMetrics(snapshot: ShadowMetricsSnapshot): Promise<void> {
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
        profit_factor: snapshot.profitFactor,
      };

      const { error } = await supabaseClient.from('shadow_decisions').insert({
        sport: snapshot.sport || 'overall',
        market: 'metrics',
        player: 'system',
        decided_action: 'metrics-snapshot',
        decision_type: 'metrics',
        additional_data: metricsRow,
      });

      if (error) {
        this.logger.error('Failed to write shadow metrics', { error, snapshot });
      } else {
        this.logger.info('Shadow metrics written', {
          window: snapshot.window,
          sport: snapshot.sport || 'overall',
        });
      }
    } catch (error) {
      this.logger.error('Error writing shadow metrics', { error });
    }
  }

  /**
   * Record a recheck result in shadow mode
   */
  public async shadowWriteRecheck(
    shadowPickId: string,
    recheckType: string,
    validationStatus: string,
    action: string,
    metrics: {
      evAtRecheck?: number;
      clvAtRecheck?: number;
      oddsMovement?: number;
    }
  ): Promise<void> {
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
        action_reason: `${validationStatus} at ${recheckType}`,
      };

      const { error } = await supabaseClient.from('shadow_decisions').insert({
        unified_pick_id: shadowPickId,
        sport: 'unknown',
        market: 'recheck',
        player: 'system',
        decided_action: 'rejected-recheck',
        decision_type: 'recheck',
        additional_data: recheckRow,
      });

      if (error) {
        this.logger.error('Failed to write shadow recheck', { error });
      } else {
        this.logger.info('Shadow recheck written', {
          pickId: shadowPickId,
          type: recheckType,
          action,
        });
      }
    } catch (error) {
      this.logger.error('Error writing shadow recheck', { error });
    }
  }

  /**
   * Record an alert in shadow mode
   */
  public async shadowWriteAlert(
    shadowPickId: string,
    alertType: string,
    severity: string,
    message: string,
    data: any = {}
  ): Promise<void> {
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
        would_notify: severity === 'high' || severity === 'critical',
      };

      const { error } = await supabaseClient.from('shadow_decisions').insert({
        unified_pick_id: shadowPickId,
        sport: 'unknown',
        market: 'alert',
        player: 'system',
        decided_action: alertType,
        decision_type: 'alert',
        additional_data: alertRow,
      });

      if (error) {
        this.logger.error('Failed to write shadow alert', { error });
      } else {
        this.logger.info('Shadow alert written', {
          pickId: shadowPickId,
          type: alertType,
          severity,
        });
      }
    } catch (error) {
      this.logger.error('Error writing shadow alert', { error });
    }
  }

  /**
   * Clean up old shadow data
   */
  public async cleanupOldShadow(maxDays?: number): Promise<void> {
    const days = maxDays || this.getMaxDays();

    try {
      const { data, error } = await supabaseClient.rpc('cleanup_old_shadow_data', {
        max_days: days,
      });

      if (error) {
        this.logger.error('Failed to cleanup shadow data', { error });
      } else {
        this.logger.info('Shadow data cleaned up', {
          maxDays: days,
          deletedPicks: data?.[0]?.deleted_picks || 0,
          deletedMetrics: data?.[0]?.deleted_metrics || 0,
          deletedRechecks: data?.[0]?.deleted_rechecks || 0,
          deletedAlerts: data?.[0]?.deleted_alerts || 0,
        });
      }
    } catch (error) {
      this.logger.error('Error cleaning up shadow data', { error });
    }
  }

  /**
   * Schedule daily cleanup
   */
  private scheduleCleanup(): void {
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
      this.cleanupInterval = setInterval(
        () => {
          this.cleanupOldShadow();
        },
        24 * 60 * 60 * 1000
      );
    }, msUntil3AM);

    this.logger.info('Shadow cleanup scheduled', {
      firstRun: tomorrow3AM.toISOString(),
    });
  }

  /**
   * Initialize Discord client for shadow previews
   */
  private async initializeDiscordClient(): Promise<void> {
    if (!process.env.DISCORD_TOKEN) {
      this.logger.warn('Discord token not configured, shadow previews disabled');
      return;
    }

    try {
      this.discordClient = new DiscordClient({
        intents: ['Guilds', 'GuildMessages'],
      });

      await this.discordClient.login(process.env.DISCORD_TOKEN);

      this.discordClient.once('ready', () => {
        this.logger.info('Discord client ready for shadow previews');
      });
    } catch (error) {
      this.logger.error('Failed to initialize Discord client', { error });
      this.discordClient = null;
    }
  }

  /**
   * Get shadow statistics
   */
  public async getShadowStats(window: '1d' | '7d' | '30d' = '7d'): Promise<{
    totalPicks: number;
    byAction: Record<string, number>;
    bySport: Record<string, number>;
    byTier: Record<string, number>;
    rejectionReasons: Record<string, number>;
  }> {
    try {
      const cutoff = new Date();
      const days = window === '1d' ? 1 : window === '7d' ? 7 : 30;
      cutoff.setDate(cutoff.getDate() - days);

      const { data: picks } = await supabaseClient
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
          rejectionReasons: {},
        };
      }

      // Aggregate statistics
      const byAction: Record<string, number> = {};
      const bySport: Record<string, number> = {};
      const byTier: Record<string, number> = {};
      const rejectionReasons: Record<string, number> = {};

      picks.forEach(pick => {
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
          pick.reasons.forEach((reason: string) => {
            rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
          });
        }
      });

      return {
        totalPicks: picks.length,
        byAction,
        bySport,
        byTier,
        rejectionReasons,
      };
    } catch (error) {
      this.logger.error('Failed to get shadow stats', { error });
      return {
        totalPicks: 0,
        byAction: {},
        bySport: {},
        byTier: {},
        rejectionReasons: {},
      };
    }
  }

  /**
   * Check if a specific feature should be disabled in shadow mode
   */
  public shouldSkipPublicAction(actionType: 'publish' | 'alert' | 'webhook'): boolean {
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
  public cleanup(): void {
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

// Export singleton instance
export const shadowMode = ShadowModeService.getInstance();

// Export convenience functions
export const isShadowMode = () => shadowMode.isShadowMode();
export const shadowWritePick = (pick: ShadowPick, action: ShadowAction, reasons?: string[]) =>
  shadowMode.shadowWritePick(pick, action, reasons);
export const shadowPublishPreview = (embed: any) => shadowMode.shadowPublishPreview(embed);
export const shadowWriteMetrics = (snapshot: ShadowMetricsSnapshot) =>
  shadowMode.shadowWriteMetrics(snapshot);
export const cleanupOldShadow = (maxDays?: number) => shadowMode.cleanupOldShadow(maxDays);
