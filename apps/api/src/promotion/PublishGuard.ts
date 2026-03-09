/**
 * Publish Guard
 * Routes publishing decisions through AutopilotGuard (sole authority for side effects)
 * Phase 6.5: All side effects now go through AutopilotGuard
 */

import { autopilotGuard } from '../lib/AutopilotGuard';
import { lifecycleUpdate } from '../lib/lifecycle';
import { supabase as supabaseClient } from '../services/supabaseClient';
import {
  shadowMode,
  shadowWritePick,
  shadowPublishPreview,
  type ShadowPick,
  type ShadowAction,
} from '../shadow/ShadowMode';
import { createLogger } from '../utils/logger';

// NOTE: shadowMode is imported for internal logging only.
// ALL gating decisions MUST go through AutopilotGuard (Phase 6.5 requirement).

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
   * Central publish decision point - ALL decisions go through AutopilotGuard
   * Phase 6.5: AutopilotGuard is the sole authority for side effects
   */
  public async handlePromotionDecision(
    decision: PromotionDecision,
    options: PublishOptions = {}
  ): Promise<{
    published: boolean;
    shadowLogged: boolean;
    channelsNotified: string[];
  }> {
    // Phase 6.5: Check AutopilotGuard FIRST - it is the sole authority
    const guardResult = await autopilotGuard.assertMayPerformSideEffect({
      action: 'DISCORD_POST',
      agent_name: 'PublishGuard',
      pick_id: decision.pick?.id,
      metadata: {
        lane: decision.lane,
        tier: options.tier,
        player: decision.pick?.player_name,
      },
    });

    this.logger.info('Processing promotion decision via AutopilotGuard', {
      approved: decision.approved,
      lane: decision.lane,
      player: decision.pick?.player_name,
      autopilotAllowed: guardResult.allowed,
      autopilotMode: guardResult.mode,
      autopilotDecision: guardResult.decision,
    });

    // Prepare shadow pick data for logging
    const shadowPick: ShadowPick = this.prepareShadowPick(decision.pick, options);
    const shadowAction: ShadowAction = this.mapToShadowAction(decision.lane);

    // If AutopilotGuard blocks, log to shadow and return
    if (!guardResult.allowed) {
      return await this.handleShadowMode(shadowPick, shadowAction, decision.reasons, options);
    }

    // AutopilotGuard allowed - proceed with actual publishing
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
      previewSent: channelsNotified.length > 0,
    });

    return {
      published: false,
      shadowLogged: true,
      channelsNotified,
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
        await lifecycleUpdate(
          supabaseClient,
          decision.pick.id,
          {
            published: true,
            published_at: new Date().toISOString(),
            tier: options.tier || decision.pick.tier,
          },
          { writerRole: 'promoter', skipTransitionValidation: true }
        );
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
      action: shadowAction,
    });

    return {
      published,
      shadowLogged: true,
      channelsNotified,
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
      groupKey: options.groupKey,
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
      await lifecycleUpdate(
        supabaseClient,
        pickId,
        { published: false, shadow_mode: true, shadow_logged_at: new Date().toISOString() },
        { writerRole: 'promoter', skipTransitionValidation: true }
      );
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
   * Handle recheck decision - gates through AutopilotGuard
   * Phase 6.5: AutopilotGuard determines if actions can proceed
   */
  public async handleRecheckDecision(
    pickId: string,
    recheckType: string,
    validationStatus: 'valid' | 'warning' | 'invalid' | 'cancelled',
    action: string,
    metrics: any = {}
  ): Promise<void> {
    // Phase 6.5: Check AutopilotGuard for any side effect decisions
    const guardResult = await autopilotGuard.assertMayPerformSideEffect({
      action: 'DB_POSTED_MUTATION',
      agent_name: 'PublishGuard.handleRecheckDecision',
      pick_id: pickId,
      metadata: { recheckType, validationStatus, action },
    });

    // Always log to shadow for analysis
    const { data: shadowPickRecord } = await supabaseClient
      .from('shadow_decisions')
      .select('id')
      .eq('unified_pick_id', pickId)
      .eq('decision_type', 'promotion')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (shadowPickRecord) {
      await shadowMode.shadowWriteRecheck(
        shadowPickRecord.id,
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
          `CLV: ${metrics.clvAtRecheck || 'N/A'}`,
        ]);
      }
    }

    this.logger.info('Recheck decision processed', {
      pickId,
      recheckType,
      validationStatus,
      action,
      autopilotAllowed: guardResult.allowed,
      autopilotMode: guardResult.mode,
    });
  }

  /**
   * Handle alert decision - gates through AutopilotGuard
   * Phase 6.5: AutopilotGuard determines if alerts can be sent
   */
  public async handleAlertDecision(
    pickId: string,
    alertType: string,
    severity: string,
    message: string,
    data: any = {}
  ): Promise<void> {
    // Phase 6.5: Check AutopilotGuard for alert side effects
    const guardResult = await autopilotGuard.assertMayPerformSideEffect({
      action: 'DISCORD_ALERT',
      agent_name: 'PublishGuard.handleAlertDecision',
      pick_id: pickId,
      metadata: { alertType, severity, message },
    });

    // Always log to shadow for analysis
    const { data: shadowPick } = await supabaseClient
      .from('shadow_decisions')
      .select('id')
      .eq('unified_pick_id', pickId)
      .eq('decision_type', 'promotion')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (shadowPick) {
      await shadowMode.shadowWriteAlert(shadowPick.id, alertType, severity, message, data);
    }

    // Only process actual alert if AutopilotGuard allows
    if (guardResult.allowed) {
      this.logger.info('Processing alert (AutopilotGuard allowed)', {
        pickId,
        alertType,
        severity,
      });
      // Would trigger actual alert mechanisms here
    } else {
      this.logger.info('Alert blocked by AutopilotGuard', {
        pickId,
        alertType,
        severity,
        reason: guardResult.reason,
        mode: guardResult.mode,
      });
    }
  }

  /**
   * Check if public actions should be skipped
   * Phase 6.5: Delegates to AutopilotGuard - the sole authority for side effects
   * @deprecated Use autopilotGuard.assertMayPerformSideEffect() directly
   */
  public async shouldSkipPublicAction(
    actionType: 'publish' | 'alert' | 'webhook'
  ): Promise<boolean> {
    const actionMap: Record<string, 'DISCORD_POST' | 'DISCORD_ALERT' | 'WEBHOOK_CALL'> = {
      publish: 'DISCORD_POST',
      alert: 'DISCORD_ALERT',
      webhook: 'WEBHOOK_CALL',
    };
    const result = await autopilotGuard.assertMayPerformSideEffect({
      action: actionMap[actionType] || 'WEBHOOK_CALL',
      agent_name: 'PublishGuard.shouldSkipPublicAction',
    });
    return !result.allowed;
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
