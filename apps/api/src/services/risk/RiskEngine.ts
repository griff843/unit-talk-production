/* eslint-disable complexity, no-console, max-lines-per-function, security/detect-object-injection */
/**
 * RiskEngine — Singleton orchestrator for risk enforcement
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * FAIL-CLOSED: Any error in risk computation → promotion BLOCKED.
 * CONSTITUTIONAL: Cannot be disabled in production (except via engine_enabled=0 config).
 *
 * Integration: Called as async pre-flight in V3ScoringAdapter before evaluatePromotion().
 */

import { detectCorrelation } from './CorrelationDetector';
import { computeDrawdown } from './DrawdownTracker';
import { evaluateDrift, recordDriftSnapshot } from './DriftEvaluator';
import { computeExposure } from './ExposureCalculator';
import { computeKellySize } from './KellySizer';
import { emitExposureBreach, emitDriftThrottle, emitEngineError } from './RiskAlertEmitter';
import { DEFAULT_RISK_CONFIG } from './types';

import type {
  CorrelationState,
  DrawdownState,
  RiskDecision,
  RiskEngineConfig,
  RiskEventRow,
  RiskSizing,
  ExposureState,
  DriftState,
} from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Config cache
let cachedConfig: RiskEngineConfig | null = null;
let configLoadedAt = 0;
const CONFIG_TTL_MS = 60_000; // 60 seconds

export class RiskEngine {
  private static instance: RiskEngine;

  private constructor() {}

  static getInstance(): RiskEngine {
    if (!RiskEngine.instance) {
      RiskEngine.instance = new RiskEngine();
    }
    return RiskEngine.instance;
  }

  /**
   * Main promotion gate method.
   * Returns a RiskDecision indicating whether the promotion should proceed.
   *
   * FAIL-CLOSED: Any error → { allowed: false, decision: 'BLOCK' }
   */
  async evaluateForPromotion(
    supabase: SupabaseClient,
    pickId: string,
    kellyFraction: number,
    eventId?: string,
    sizingInputs?: { winProbability: number; decimalOdds: number }
  ): Promise<RiskDecision> {
    const traceId = `risk-${pickId}-${Date.now()}`;

    try {
      // 1. Load config
      const config = await this.getConfig(supabase);

      // 2. Engine bypass
      if (!config.engine_enabled) {
        return {
          allowed: true,
          decision: 'ALLOW',
          blocked_reasons: [],
          warnings: ['risk_engine_disabled'],
          exposure_state: null,
          drift_state: null,
          correlation_state: null,
          drawdown_state: null,
          sizing: null,
          trace_id: traceId,
        };
      }

      const blockedReasons: string[] = [];
      const warnings: string[] = [];

      // 3. Compute exposure
      const exposure = await computeExposure(supabase, config);

      // 4. Check total Kelly thresholds
      if (exposure.total_kelly_exposure > config.total_kelly_critical) {
        blockedReasons.push(
          `total_kelly_critical:${exposure.total_kelly_exposure.toFixed(4)}>${config.total_kelly_critical}`
        );
      } else if (exposure.total_kelly_exposure > config.total_kelly_high) {
        blockedReasons.push(
          `total_kelly_high:${exposure.total_kelly_exposure.toFixed(4)}>${config.total_kelly_high}`
        );
      }

      // 5. Check event-level exposure
      if (eventId && exposure.exposure_by_event[eventId]) {
        const eventExposure = exposure.exposure_by_event[eventId];
        if (eventExposure > config.event_kelly_limit) {
          blockedReasons.push(
            `event_kelly_limit:${eventId}:${eventExposure.toFixed(4)}>${config.event_kelly_limit}`
          );
        }
      }

      // 5a. Check sport-level exposure
      for (const [sport, sportExposure] of Object.entries(exposure.exposure_by_sport)) {
        if (sportExposure > config.sport_kelly_limit) {
          blockedReasons.push(
            `sport_kelly_limit:${sport}:${sportExposure.toFixed(4)}>${config.sport_kelly_limit}`
          );
        }
      }

      // 5b. Check correlation
      const correlation = await detectCorrelation(supabase, config);
      if (correlation.blocked) {
        blockedReasons.push(...correlation.blocked_reasons);
      }

      // 5c. Check drawdown
      const drawdown = await computeDrawdown(supabase, config);
      if (drawdown.frozen) {
        blockedReasons.push(
          `drawdown_freeze:${drawdown.drawdown_fraction.toFixed(4)}>${config.drawdown_freeze_threshold}`
        );
      }

      // 6. Evaluate drift
      const drift = await evaluateDrift(supabase, config);

      if (drift.blocked) {
        blockedReasons.push(
          `drift_brier_block:${drift.global_brier?.toFixed(4)}>${config.drift_brier_block}`
        );
      }

      if (!drift.sufficient_data && drift.sample_size > 0) {
        warnings.push(`drift_insufficient_data:${drift.sample_size}<${config.drift_min_settled}`);
      }

      // Record drift snapshot (non-blocking)
      recordDriftSnapshot(supabase, drift, config).catch(() => {});

      // 7. Compute bankroll-aware sizing (if inputs provided)
      let sizing: RiskSizing | null = null;
      if (sizingInputs) {
        const sizingResult = computeKellySize(
          sizingInputs.winProbability,
          sizingInputs.decimalOdds,
          {
            total_bankroll: config.bankroll_total,
            kelly_multiplier: config.bankroll_kelly_multiplier,
            max_bet_fraction: config.bankroll_max_bet_fraction,
            min_bet_units: 1.0,
            daily_loss_limit: 0.1,
          }
        );
        sizing = {
          raw_kelly: sizingResult.raw_kelly,
          fractional_kelly: sizingResult.fractional_kelly,
          recommended_units: sizingResult.recommended_units,
          recommended_fraction: sizingResult.recommended_fraction,
          capped: sizingResult.capped,
          cap_reason: sizingResult.cap_reason,
          has_edge: sizingResult.has_edge,
        };
      }

      // 8. Make decision
      const allowed = blockedReasons.length === 0;
      const decision: RiskDecision = {
        allowed,
        decision: allowed ? 'ALLOW' : 'BLOCK',
        blocked_reasons: blockedReasons,
        warnings,
        exposure_state: exposure,
        drift_state: drift,
        correlation_state: correlation,
        drawdown_state: drawdown,
        sizing,
        trace_id: traceId,
      };

      // 8. Record risk event
      await this.recordEvent(supabase, {
        event_type: allowed ? 'PROMOTION_ALLOWED' : 'PROMOTION_BLOCKED',
        severity: allowed
          ? 'info'
          : blockedReasons.some(r => r.startsWith('total_kelly_critical'))
            ? 'emergency'
            : 'critical',
        pick_id: pickId,
        event_id: eventId,
        decision: decision.decision,
        reason_codes: blockedReasons.length > 0 ? blockedReasons : warnings,
        exposure_snapshot: exposure,
        drift_snapshot: drift,
        config_snapshot: config,
        trace_id: traceId,
      });

      // 9. Emit Discord alerts for blocks
      if (!allowed) {
        if (exposure.breaches.length > 0) {
          emitExposureBreach(exposure.total_kelly_exposure, exposure.breaches).catch(() => {});
        }
        if (drift.blocked) {
          emitDriftThrottle(drift).catch(() => {});
        }
      }

      return decision;
    } catch (error) {
      // FAIL-CLOSED: any error = block
      const errorMsg = error instanceof Error ? error.message : 'Unknown risk engine error';
      console.error(`[RiskEngine] FAIL-CLOSED error: ${errorMsg}`);

      // Record engine error event (best-effort)
      this.recordEvent(supabase, {
        event_type: 'ENGINE_ERROR',
        severity: 'emergency',
        pick_id: pickId,
        decision: 'BLOCK',
        reason_codes: ['risk_engine_error', errorMsg],
        trace_id: traceId,
      }).catch(() => {});

      // Emit Discord alert (best-effort)
      emitEngineError(errorMsg).catch(() => {});

      return {
        allowed: false,
        decision: 'BLOCK',
        blocked_reasons: ['risk_engine_error'],
        warnings: [errorMsg],
        exposure_state: null,
        drift_state: null,
        correlation_state: null,
        drawdown_state: null,
        sizing: null,
        trace_id: traceId,
      };
    }
  }

  /**
   * Standalone exposure computation (for API/dashboard).
   */
  async computeExposure(supabase: SupabaseClient): Promise<ExposureState> {
    const config = await this.getConfig(supabase);
    return computeExposure(supabase, config);
  }

  /**
   * Standalone drift evaluation (for API/dashboard).
   */
  async evaluateDrift(supabase: SupabaseClient): Promise<DriftState> {
    const config = await this.getConfig(supabase);
    return evaluateDrift(supabase, config);
  }

  /**
   * Load config from risk_engine_config table with 60s cache.
   */
  async getConfig(supabase: SupabaseClient): Promise<RiskEngineConfig> {
    if (cachedConfig && Date.now() - configLoadedAt < CONFIG_TTL_MS) {
      return cachedConfig;
    }

    const { data: rows, error } = await supabase
      .from('risk_engine_config')
      .select('config_key, config_value');

    if (error || !rows || rows.length === 0) {
      // Fall back to defaults if config table is empty or inaccessible
      console.warn('[RiskEngine] Config load failed, using defaults:', error?.message);
      cachedConfig = { ...DEFAULT_RISK_CONFIG };
      configLoadedAt = Date.now();
      return cachedConfig;
    }

    const configMap: Record<string, number> = {};
    for (const row of rows) {
      configMap[row.config_key] = Number(row.config_value);
    }

    cachedConfig = {
      total_kelly_high: configMap['total_kelly_high'] ?? DEFAULT_RISK_CONFIG.total_kelly_high,
      total_kelly_critical:
        configMap['total_kelly_critical'] ?? DEFAULT_RISK_CONFIG.total_kelly_critical,
      event_kelly_limit: configMap['event_kelly_limit'] ?? DEFAULT_RISK_CONFIG.event_kelly_limit,
      drift_brier_block: configMap['drift_brier_block'] ?? DEFAULT_RISK_CONFIG.drift_brier_block,
      drift_min_settled: configMap['drift_min_settled'] ?? DEFAULT_RISK_CONFIG.drift_min_settled,
      engine_enabled: (configMap['engine_enabled'] ?? 1) === 1,
      bankroll_total: configMap['bankroll_total'] ?? DEFAULT_RISK_CONFIG.bankroll_total,
      bankroll_kelly_multiplier:
        configMap['bankroll_kelly_multiplier'] ?? DEFAULT_RISK_CONFIG.bankroll_kelly_multiplier,
      bankroll_max_bet_fraction:
        configMap['bankroll_max_bet_fraction'] ?? DEFAULT_RISK_CONFIG.bankroll_max_bet_fraction,
      sport_kelly_limit: configMap['sport_kelly_limit'] ?? DEFAULT_RISK_CONFIG.sport_kelly_limit,
      correlation_max_same_event:
        configMap['correlation_max_same_event'] ?? DEFAULT_RISK_CONFIG.correlation_max_same_event,
      correlation_max_same_participant:
        configMap['correlation_max_same_participant'] ??
        DEFAULT_RISK_CONFIG.correlation_max_same_participant,
      drawdown_freeze_threshold:
        configMap['drawdown_freeze_threshold'] ?? DEFAULT_RISK_CONFIG.drawdown_freeze_threshold,
      drawdown_lookback_days:
        configMap['drawdown_lookback_days'] ?? DEFAULT_RISK_CONFIG.drawdown_lookback_days,
    };
    configLoadedAt = Date.now();
    return cachedConfig;
  }

  /**
   * Record a risk event to the risk_events table.
   */
  private async recordEvent(supabase: SupabaseClient, event: RiskEventRow): Promise<void> {
    const { error } = await supabase.from('risk_events').insert({
      event_type: event.event_type,
      severity: event.severity,
      pick_id: event.pick_id ?? null,
      sport: event.sport ?? null,
      event_id: event.event_id ?? null,
      decision: event.decision,
      reason_codes: event.reason_codes,
      exposure_snapshot: event.exposure_snapshot ?? null,
      drift_snapshot: event.drift_snapshot ?? null,
      config_snapshot: event.config_snapshot ?? null,
      trace_id: event.trace_id ?? null,
    });

    if (error) {
      console.error('[RiskEngine] Failed to record event:', error.message);
    }
  }

  /**
   * Clear config cache (useful for testing).
   */
  static resetConfigCache(): void {
    cachedConfig = null;
    configLoadedAt = 0;
  }
}
