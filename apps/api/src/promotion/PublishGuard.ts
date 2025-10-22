/**
 * Publish Guard
 * Routes publishing decisions through shadow mode or live publishing
 * Provides central control point for shadow mode integration
 */

import { createLogger } from '../utils/logger';
import { shadowMode, shadowWritePick, shadowPublishPreview, type ShadowPick, type ShadowAction } from '../shadow/ShadowMode';
import { supabase as supabaseClient } from '../services/supabaseClient';

export interface PromotionDecision {
  approved: boolean;
  lane: 'instant' | 'scheduled' | 'rejected';
  reasons: string[];
  pick: any;
  gateResults?: any[];
  riskScore?: number;
}

export interface PublishOptions {
  embed?: any;
  tier?: string;
  isInstant?: boolean;
  groupKey?: string;
  notifyChannels?: string[];
}

class PublishGuardService {
  private static instance: PublishGuardService;
  private logger: any;

  private constructor() {
    this.logger = createLogger('PublishGuard');
  }

  public static getInstance(): PublishGuardService {
    if (!PublishGuardService.instance) {
      PublishGuardService.instance = new PublishGuardService();
    }
    return PublishGuardService.instance;
  }

  /**
   * Central publish decision point with shadow mode routing
   */
  public async handlePromotionDecision(
    decision: PromotionDecision,
    options: PublishOptions = {}
  ): Promise<{
    published: boolean;
    shadowLogged: boolean;
    channelsNotified: string[];
  }> {
    this.logger.info('Processing promotion decision', {
      approved: decision.approved,
      lane: decision.lane,
      player: decision.pick.player_name,
      shadowMode: shadowMode.isShadowMode()
    });

    // Prepare shadow pick data
    const shadowPick: ShadowPick = this.prepareShadowPick(decision.pick, options);
    const shadowAction: ShadowAction = this.mapToShadowAction(decision.lane);
    
    // In shadow mode, log everything but don't publish publicly
    if (shadowMode.isShadowMode()) {
      return await this.handleShadowMode(shadowPick, shadowAction, decision.reasons, options);
    }

    // Normal mode - proceed with actual publishing
    return await this.handleNormalMode(decision, options, shadowPick, shadowAction);
  }

  /**
   * Handle shadow mode publishing
   */
  private async handleShadowMode(
    shadowPick: ShadowPick,
    shadowAction: ShadowAction,
    reasons: string[],
    options: PublishOptions
  ): Promise<{
    published: boolean;
    shadowLogged: boolean;
    channelsNotified: string[];
  }> {
    // Always log to shadow tables
    await shadowWritePick(shadowPick, shadowAction, reasons);

    // Send preview to private channel if configured and approved
    let channelsNotified: string[] = [];
    if (shadowAction === 'instant' || shadowAction === 'queued-10am') {
      if (options.embed) {
        await shadowPublishPreview(options.embed);
        channelsNotified = ['shadow-preview'];
      }
    }

    // Ensure unified_picks is NOT marked as published in shadow mode
    if (shadowPick.unifiedPickId) {
      await this.ensureShadowPickNotPublished(shadowPick.unifiedPickId);
    }

    this.logger.info('Shadow mode promotion logged', {
      action: shadowAction,
      reasons: reasons.slice(0, 3), // First 3 reasons for brevity
      previewSent: channelsNotified.length > 0
    });

    return {
      published: false,
      shadowLogged: true,
      channelsNotified
    };
  }

  /**
   * Handle normal mode publishing
   */
  private async handleNormalMode(
    decision: PromotionDecision,
    options: PublishOptions,
    shadowPick: ShadowPick,
    shadowAction: ShadowAction
  ): Promise<{
    published: boolean;
    shadowLogged: boolean;
    channelsNotified: string[];
  }> {
    let published = false;
    let channelsNotified: string[] = [];

    if (decision.approved && (decision.lane === 'instant' || decision.lane === 'scheduled')) {
      // Mark as published in unified_picks
      if (decision.pick.id) {
        await supabaseClient
          .from('unified_picks')
          .update({
            published: true,
            published_at: new Date().toISOString(),
            tier: options.tier || decision.pick.tier
          })
          .eq('id', decision.pick.id);
      }

      // Publish to configured channels
      if (options.embed && options.notifyChannels) {
        channelsNotified = await this.publishToChannels(options.embed, options.notifyChannels);
        published = channelsNotified.length > 0;
      }
    }

    // Also log to shadow tables for analysis (even in normal mode)
    await shadowWritePick(shadowPick, shadowAction, decision.reasons);

    this.logger.info('Normal mode promotion processed', {
      published,
      channelsNotified,
      action: shadowAction
    });

    return {
      published,
      shadowLogged: true,
      channelsNotified
    };
  }

  /**
   * Prepare shadow pick data from decision
   */
  private prepareShadowPick(pick: any, options: PublishOptions): ShadowPick {
    return {
      rawPropId: pick.raw_prop_id || pick.prop_id,
      unifiedPickId: pick.id,
      sport: pick.sport || 'Unknown',
      market: pick.stat_type || pick.market || 'Unknown',
      player: pick.player_name || 'Unknown Player',
      team: pick.team_name,
      book: pick.book,
      oddsOpen: pick.initial_odds,
      oddsNow: pick.current_odds || pick.initial_odds,
      line: pick.line,
      eventTime: pick.game_time ? new Date(pick.game_time) : undefined,
      tier: options.tier || pick.tier,
      confidence: pick.confidence ? Math.round(pick.confidence * 100) : undefined,
      professionalScore: pick.professional_score,
      deviggedWinProb: pick.devigged_win_prob,
      deviggedEdge: pick.devigged_edge || pick.expected_value,
      clvPct: pick.clv_tracking?.current_clv_bps,
      kellyFraction: pick.kelly_fraction || pick.kelly_fraction,
      risk: pick.risk_score,
      chaosMuted: pick.chaos_muted,
      steamMuted: pick.steam_muted,
      isInstant: options.isInstant,
      groupKey: options.groupKey
    };
  }

  /**
   * Map decision lane to shadow action
   */
  private mapToShadowAction(lane: string): ShadowAction {
    switch (lane) {
      case 'instant':
        return 'instant';
      case 'scheduled':
        return 'queued-10am';
      case 'rejected':
      default:
        return 'rejected-gate';
    }
  }

  /**
   * Ensure pick is not marked as published in shadow mode
   */
  private async ensureShadowPickNotPublished(pickId: string): Promise<void> {
    try {
      await supabaseClient
        .from('unified_picks')
        .update({
          published: false,
          shadow_mode: true,
          shadow_logged_at: new Date().toISOString()
        })
        .eq('id', pickId);
    } catch (error) {
      this.logger.error('Failed to update shadow pick status', { error, pickId });
    }
  }

  /**
   * Publish to actual channels (normal mode only)
   */
  private async publishToChannels(embed: any, channels: string[]): Promise<string[]> {
    // This would integrate with actual Discord publishing logic
    // For now, return mock successful channels
    this.logger.info('Publishing to channels', { channels: channels.length });
    
    // In a real implementation, this would:
    // 1. Send to Discord channels
    // 2. Send to webhooks
    // 3. Send to other notification systems
    // 4. Return list of successful channels
    
    return channels; // Mock success
  }

  /**
   * Handle recheck decision in shadow or normal mode
   */
  public async handleRecheckDecision(
    pickId: string,
    recheckType: string,
    validationStatus: 'valid' | 'warning' | 'invalid' | 'cancelled',
    action: string,
    metrics: any = {}
  ): Promise<void> {
    if (shadowMode.isShadowMode()) {
      // Find corresponding shadow pick
      const { data: shadowPick } = await supabaseClient
        .from('shadow_decisions')
        .select('id')
        .eq('unified_pick_id', pickId)
        .eq('decision_type', 'promotion')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (shadowPick) {
        await shadowMode.shadowWriteRecheck(
          shadowPick.id,
          recheckType,
          validationStatus,
          action,
          metrics
        );
      }

      // If recheck fails, write new rejection row
      if (validationStatus === 'invalid' || validationStatus === 'cancelled') {
        const { data: originalPick } = await supabaseClient
          .from('unified_picks')
          .select('*')
          .eq('id', pickId)
          .single();

        if (originalPick) {
          const shadowPick = this.prepareShadowPick(originalPick, {});
          await shadowWritePick(shadowPick, 'rejected-recheck', [
            `${recheckType}: ${validationStatus}`,
            `EV: ${metrics.evAtRecheck || 'N/A'}`,
            `CLV: ${metrics.clvAtRecheck || 'N/A'}`
          ]);
        }
      }
    }

    this.logger.info('Recheck decision processed', {
      pickId,
      recheckType,
      validationStatus,
      action,
      shadowMode: shadowMode.isShadowMode()
    });
  }

  /**
   * Handle alert decision in shadow or normal mode
   */
  public async handleAlertDecision(
    pickId: string,
    alertType: string,
    severity: string,
    message: string,
    data: any = {}
  ): Promise<void> {
    if (shadowMode.isShadowMode()) {
      // Find corresponding shadow pick
      const { data: shadowPick } = await supabaseClient
        .from('shadow_decisions')
        .select('id')
        .eq('unified_pick_id', pickId)
        .eq('decision_type', 'promotion')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (shadowPick) {
        await shadowMode.shadowWriteAlert(
          shadowPick.id,
          alertType,
          severity,
          message,
          data
        );
      }
    } else {
      // In normal mode, process actual alert
      this.logger.info('Processing normal mode alert', {
        pickId,
        alertType,
        severity
      });
      // Would trigger actual alert mechanisms here
    }
  }

  /**
   * Check if public actions should be skipped
   */
  public shouldSkipPublicAction(actionType: 'publish' | 'alert' | 'webhook' | 'notification'): boolean {
    return shadowMode.shouldSkipPublicAction(actionType);
  }

  /**
   * Get publish guard statistics
   */
  public async getPublishStats(): Promise<{
    mode: 'shadow' | 'normal';
    shadowStats?: any;
  }> {
    const mode = shadowMode.isShadowMode() ? 'shadow' : 'normal';
    
    if (mode === 'shadow') {
      const shadowStats = await shadowMode.getShadowStats('7d');
      return { mode, shadowStats };
    }

    return { mode };
  }
}

// Export both the class and the singleton instance
export { PublishGuardService };
export const publishGuard = PublishGuardService.getInstance();
export default PublishGuardService;