/**
 * @fileoverview Phase 8: Autopilot Intelligence API endpoint
 *
 * Provides endpoints for:
 * - True accuracy metrics
 * - CLV performance data
 * - Confidence calibration
 * - Learning loop state and controls
 * - Signal weights management
 */

import { NextRequest, NextResponse } from 'next/server';
import { RBACService, Permission } from '@/lib/rbac';
import { UnitTalkTracing } from '@/lib/telemetry';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

interface AccuracyDaily {
  date: string;
  total_settled: number;
  wins: number;
  losses: number;
  pushes: number;
  true_accuracy_rate: number | null;
  approved_accuracy_rate: number | null;
  roi: number | null;
  false_positive_rate: number | null;
  false_negative_rate: number | null;
}

interface CLVDaily {
  date: string;
  total_with_clv: number;
  clv_positive_count: number;
  clv_negative_count: number;
  avg_clv_absolute: number | null;
  clv_beat_close_rate: number | null;
  clv_weighted_accuracy: number | null;
}

interface CalibrationDaily {
  date: string;
  calibration_score: number | null;
  brier_score: number | null;
  overconfidence_delta: number | null;
  underconfidence_delta: number | null;
  total_calibrated: number;
  tier_a_count: number;
  tier_b_count: number;
  tier_c_count: number;
  tier_d_count: number;
  calibration_buckets: Array<{
    bucket_min: number;
    expected: number;
    actual: number;
    count: number;
  }>;
}

interface SignalWeights {
  version: number;
  accuracy_weight: number;
  clv_weight: number;
  confidence_weight: number;
  stability_weight: number;
  max_adjustment_pct: number;
  min_sample_size: number;
  activated_at: string | null;
  activated_by: string | null;
}

interface LearningState {
  learning_enabled: boolean;
  current_cycle: number;
  last_learning_run: string | null;
  next_scheduled_run: string | null;
  adjustments_today: number;
  max_daily_adjustments: number;
  cooldown_until: string | null;
  cooldown_reason: string | null;
  baseline_accuracy: number | null;
  baseline_clv: number | null;
}

interface LearningAdjustment {
  id: string;
  from_version: number;
  to_version: number;
  adjustment_type: string;
  weights_before: Record<string, number>;
  weights_after: Record<string, number>;
  evidence_snapshot: Record<string, unknown>;
  accuracy_before: number | null;
  accuracy_after_projected: number | null;
  sample_size: number;
  safety_checks_passed: boolean;
  proposed_by: string;
  approved_by: string | null;
  applied_at: string;
  reason: string;
}

// =============================================================================
// INTELLIGENCE SERVICE
// =============================================================================

class AutopilotIntelligenceService {
  /**
   * Get daily accuracy metrics
   */
  static async getAccuracyDaily(days: number = 30): Promise<AccuracyDaily[]> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('autopilot_accuracy_daily')
        .select('*')
        .gte('date', cutoffDate)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching accuracy daily:', error);
        return [];
      }

      return (data || []) as unknown as AccuracyDaily[];
    } catch (error) {
      console.error('Error in getAccuracyDaily:', error);
      return [];
    }
  }

  /**
   * Get accuracy by agent
   */
  static async getAccuracyByAgent(days: number = 7): Promise<
    Array<{
      agent_name: string;
      total_settled: number;
      wins: number;
      losses: number;
      true_accuracy_rate: number | null;
      approved_accuracy_rate: number | null;
    }>
  > {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('autopilot_accuracy_by_agent')
        .select('*')
        .gte('date', cutoffDate)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching accuracy by agent:', error);
        return [];
      }

      // Aggregate by agent
      const agentMap = new Map<
        string,
        {
          agent_name: string;
          total_settled: number;
          wins: number;
          losses: number;
          accuracySum: number;
          approvedAccuracySum: number;
          count: number;
        }
      >();

      for (const rawRow of data || []) {
        const row = rawRow as {
          agent_name: string;
          total_settled: number;
          wins: number;
          losses: number;
          true_accuracy_rate: number | null;
          approved_accuracy_rate: number | null;
        };
        const existing = agentMap.get(row.agent_name) || {
          agent_name: row.agent_name,
          total_settled: 0,
          wins: 0,
          losses: 0,
          accuracySum: 0,
          approvedAccuracySum: 0,
          count: 0,
        };

        existing.total_settled += row.total_settled || 0;
        existing.wins += row.wins || 0;
        existing.losses += row.losses || 0;
        if (row.true_accuracy_rate) {
          existing.accuracySum += row.true_accuracy_rate;
          existing.count++;
        }
        if (row.approved_accuracy_rate) {
          existing.approvedAccuracySum += row.approved_accuracy_rate;
        }

        agentMap.set(row.agent_name, existing);
      }

      return Array.from(agentMap.values()).map((a) => ({
        agent_name: a.agent_name,
        total_settled: a.total_settled,
        wins: a.wins,
        losses: a.losses,
        true_accuracy_rate: a.count > 0 ? a.accuracySum / a.count : null,
        approved_accuracy_rate: a.count > 0 ? a.approvedAccuracySum / a.count : null,
      }));
    } catch (error) {
      console.error('Error in getAccuracyByAgent:', error);
      return [];
    }
  }

  /**
   * Get daily CLV metrics
   */
  static async getCLVDaily(days: number = 30): Promise<CLVDaily[]> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('autopilot_clv_daily')
        .select('*')
        .gte('date', cutoffDate)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching CLV daily:', error);
        return [];
      }

      return (data || []) as unknown as CLVDaily[];
    } catch (error) {
      console.error('Error in getCLVDaily:', error);
      return [];
    }
  }

  /**
   * Get daily calibration metrics
   */
  static async getCalibrationDaily(days: number = 30): Promise<CalibrationDaily[]> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('autopilot_confidence_calibration_daily')
        .select('*')
        .gte('date', cutoffDate)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching calibration daily:', error);
        return [];
      }

      return (data || []) as unknown as CalibrationDaily[];
    } catch (error) {
      console.error('Error in getCalibrationDaily:', error);
      return [];
    }
  }

  /**
   * Get active signal weights
   */
  static async getSignalWeights(): Promise<SignalWeights | null> {
    try {
      const { data, error } = await supabase.rpc('get_active_signal_weights');

      if (error) {
        console.error('Error fetching signal weights:', error);
        return null;
      }

      return data as SignalWeights;
    } catch (error) {
      console.error('Error in getSignalWeights:', error);
      return null;
    }
  }

  /**
   * Get learning state
   */
  static async getLearningState(): Promise<LearningState | null> {
    try {
      const { data, error } = await supabase.rpc('get_autopilot_learning_state');

      if (error) {
        console.error('Error fetching learning state:', error);
        return null;
      }

      return data as LearningState;
    } catch (error) {
      console.error('Error in getLearningState:', error);
      return null;
    }
  }

  /**
   * Get recent learning adjustments
   */
  static async getLearningAdjustments(limit: number = 10): Promise<LearningAdjustment[]> {
    try {
      const { data, error } = await supabase
        .from('autopilot_learning_adjustments')
        .select('*')
        .order('applied_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching learning adjustments:', error);
        return [];
      }

      return (data || []) as unknown as LearningAdjustment[];
    } catch (error) {
      console.error('Error in getLearningAdjustments:', error);
      return [];
    }
  }

  /**
   * Toggle learning enabled
   */
  static async setLearningEnabled(
    enabled: boolean,
    actor: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('set_autopilot_learning_enabled', {
        p_enabled: enabled,
        p_actor: actor,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Compute accuracy for a specific date
   */
  static async computeAccuracy(date: string): Promise<{ success: boolean; id?: string }> {
    try {
      const { data, error } = await supabase.rpc('compute_autopilot_accuracy_daily', {
        p_date: date,
      });

      if (error) {
        console.error('Error computing accuracy:', error);
        return { success: false };
      }

      return { success: true, id: data as string };
    } catch (error) {
      console.error('Error in computeAccuracy:', error);
      return { success: false };
    }
  }

  /**
   * Compute CLV for a specific date
   */
  static async computeCLV(date: string): Promise<{ success: boolean; id?: string }> {
    try {
      const { data, error } = await supabase.rpc('compute_autopilot_clv_daily', {
        p_date: date,
      });

      if (error) {
        console.error('Error computing CLV:', error);
        return { success: false };
      }

      return { success: true, id: data as string };
    } catch (error) {
      console.error('Error in computeCLV:', error);
      return { success: false };
    }
  }

  /**
   * Compute calibration for a specific date
   */
  static async computeCalibration(date: string): Promise<{ success: boolean; id?: string }> {
    try {
      const { data, error } = await supabase.rpc('compute_autopilot_confidence_calibration', {
        p_date: date,
      });

      if (error) {
        console.error('Error computing calibration:', error);
        return { success: false };
      }

      return { success: true, id: data as string };
    } catch (error) {
      console.error('Error in computeCalibration:', error);
      return { success: false };
    }
  }

  /**
   * Get intelligence summary for dashboard
   */
  static async getIntelligenceSummary(): Promise<{
    accuracy: {
      last7Days: number | null;
      approvedAccuracy: number | null;
      totalSettled: number;
      trend: 'up' | 'down' | 'stable';
    };
    clv: {
      beatCloseRate: number | null;
      avgCLV: number | null;
      trend: 'up' | 'down' | 'stable';
    };
    calibration: {
      score: number | null;
      overconfidenceDelta: number | null;
      status: 'good' | 'warning' | 'critical';
    };
    learning: {
      enabled: boolean;
      cooldownActive: boolean;
      lastAdjustment: string | null;
    };
  }> {
    try {
      // Get 7-day accuracy
      const accuracyData = await this.getAccuracyDaily(7);
      const avgAccuracy =
        accuracyData.length > 0
          ? accuracyData.reduce((sum, d) => sum + (d.true_accuracy_rate || 0), 0) /
            accuracyData.length
          : null;
      const avgApprovedAccuracy =
        accuracyData.length > 0
          ? accuracyData.reduce((sum, d) => sum + (d.approved_accuracy_rate || 0), 0) /
            accuracyData.length
          : null;
      const totalSettled = accuracyData.reduce((sum, d) => sum + (d.total_settled || 0), 0);

      // Calculate accuracy trend
      let accuracyTrend: 'up' | 'down' | 'stable' = 'stable';
      if (accuracyData.length >= 2) {
        const recent = accuracyData.slice(0, 3).reduce((s, d) => s + (d.true_accuracy_rate || 0), 0) / 3;
        const older = accuracyData.slice(-3).reduce((s, d) => s + (d.true_accuracy_rate || 0), 0) / 3;
        if (recent > older + 2) accuracyTrend = 'up';
        else if (recent < older - 2) accuracyTrend = 'down';
      }

      // Get 7-day CLV
      const clvData = await this.getCLVDaily(7);
      const avgBeatCloseRate =
        clvData.length > 0
          ? clvData.reduce((sum, d) => sum + (d.clv_beat_close_rate || 0), 0) / clvData.length
          : null;
      const avgCLV =
        clvData.length > 0
          ? clvData.reduce((sum, d) => sum + (d.avg_clv_absolute || 0), 0) / clvData.length
          : null;

      // Calculate CLV trend
      let clvTrend: 'up' | 'down' | 'stable' = 'stable';
      if (clvData.length >= 2) {
        const recent = clvData.slice(0, 3).reduce((s, d) => s + (d.clv_beat_close_rate || 0), 0) / 3;
        const older = clvData.slice(-3).reduce((s, d) => s + (d.clv_beat_close_rate || 0), 0) / 3;
        if (recent > older + 5) clvTrend = 'up';
        else if (recent < older - 5) clvTrend = 'down';
      }

      // Get latest calibration
      const calibrationData = await this.getCalibrationDaily(1);
      const latestCalibration = calibrationData[0] || null;
      let calibrationStatus: 'good' | 'warning' | 'critical' = 'good';
      if (latestCalibration) {
        const overconf = Math.abs(latestCalibration.overconfidence_delta || 0);
        if (overconf > 15) calibrationStatus = 'critical';
        else if (overconf > 8) calibrationStatus = 'warning';
      }

      // Get learning state
      const learningState = await this.getLearningState();
      const adjustments = await this.getLearningAdjustments(1);

      return {
        accuracy: {
          last7Days: avgAccuracy,
          approvedAccuracy: avgApprovedAccuracy,
          totalSettled,
          trend: accuracyTrend,
        },
        clv: {
          beatCloseRate: avgBeatCloseRate,
          avgCLV: avgCLV,
          trend: clvTrend,
        },
        calibration: {
          score: latestCalibration?.calibration_score ?? null,
          overconfidenceDelta: latestCalibration?.overconfidence_delta ?? null,
          status: calibrationStatus,
        },
        learning: {
          enabled: learningState?.learning_enabled ?? false,
          cooldownActive:
            learningState?.cooldown_until != null &&
            new Date(learningState.cooldown_until) > new Date(),
          lastAdjustment: adjustments[0]?.applied_at ?? null,
        },
      };
    } catch (error) {
      console.error('Error in getIntelligenceSummary:', error);
      return {
        accuracy: { last7Days: null, approvedAccuracy: null, totalSettled: 0, trend: 'stable' },
        clv: { beatCloseRate: null, avgCLV: null, trend: 'stable' },
        calibration: { score: null, overconfidenceDelta: null, status: 'good' },
        learning: { enabled: false, cooldownActive: false, lastAdjustment: null },
      };
    }
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/autopilot/intelligence
 * Get Phase 8 intelligence metrics
 */
export async function GET(request: NextRequest) {
  const span = UnitTalkTracing.startAgentSpan('admin', 'get_autopilot_intelligence');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Require view dashboard permission
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'summary';
    const days = parseInt(searchParams.get('days') || '7', 10);

    let response: Record<string, unknown> = {};

    switch (view) {
      case 'accuracy':
        response = {
          daily: await AutopilotIntelligenceService.getAccuracyDaily(days),
          byAgent: await AutopilotIntelligenceService.getAccuracyByAgent(days),
        };
        break;

      case 'clv':
        response = {
          daily: await AutopilotIntelligenceService.getCLVDaily(days),
        };
        break;

      case 'calibration':
        response = {
          daily: await AutopilotIntelligenceService.getCalibrationDaily(days),
        };
        break;

      case 'learning':
        response = {
          state: await AutopilotIntelligenceService.getLearningState(),
          weights: await AutopilotIntelligenceService.getSignalWeights(),
          adjustments: await AutopilotIntelligenceService.getLearningAdjustments(20),
        };
        break;

      case 'weights':
        response = {
          weights: await AutopilotIntelligenceService.getSignalWeights(),
        };
        break;

      case 'summary':
      default:
        response = {
          summary: await AutopilotIntelligenceService.getIntelligenceSummary(),
          weights: await AutopilotIntelligenceService.getSignalWeights(),
          learningState: await AutopilotIntelligenceService.getLearningState(),
        };
        break;
    }

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      data: response,
      phase: 8,
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: 'INTELLIGENCE_GET_ERROR',
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}

/**
 * POST /api/admin/autopilot/intelligence
 * Execute intelligence actions (compute metrics, toggle learning)
 */
export async function POST(request: NextRequest) {
  const span = UnitTalkTracing.startAgentSpan('admin', 'autopilot_intelligence_action');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    const body = await request.json();
    const { action, params } = body;

    let result: Record<string, unknown> = {};

    switch (action) {
      case 'compute_accuracy':
        await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);
        const accuracyDate = params?.date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        result = await AutopilotIntelligenceService.computeAccuracy(accuracyDate);
        break;

      case 'compute_clv':
        await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);
        const clvDate = params?.date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        result = await AutopilotIntelligenceService.computeCLV(clvDate);
        break;

      case 'compute_calibration':
        await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);
        const calDate = params?.date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        result = await AutopilotIntelligenceService.computeCalibration(calDate);
        break;

      case 'compute_all':
        await RBACService.requirePermission(userId, Permission.FREEZE_SYSTEM);
        const allDate = params?.date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [accResult, clvResult, calResult] = await Promise.all([
          AutopilotIntelligenceService.computeAccuracy(allDate),
          AutopilotIntelligenceService.computeCLV(allDate),
          AutopilotIntelligenceService.computeCalibration(allDate),
        ]);
        result = {
          accuracy: accResult,
          clv: clvResult,
          calibration: calResult,
        };
        break;

      case 'toggle_learning':
        await RBACService.requirePermission(userId, Permission.SYSTEM_CONFIG);
        const enabled = params?.enabled === true;
        result = await AutopilotIntelligenceService.setLearningEnabled(enabled, userId);

        // Log audit event
        await RBACService.logAudit({
          actor: userId,
          actor_type: 'user',
          action: 'AUTOPILOT_LEARNING_TOGGLE',
          resource_type: 'autopilot',
          resource_id: 'learning_state',
          payload: { enabled },
          status: 'success',
        });
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            code: 'INVALID_ACTION',
          },
          { status: 400 }
        );
    }

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      data: result,
      action,
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    const statusCode = (error as Error).message?.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'INTELLIGENCE_ACTION_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}
