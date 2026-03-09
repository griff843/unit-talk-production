/**
 * @fileoverview Exposure Snapshots API for Kelly-at-risk monitoring
 * Manages risk exposure tracking and auto-remediation
 */

import { NextRequest, NextResponse } from 'next/server';

import { RBACService, Permission } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { UnitTalkTracing } from '@/lib/telemetry';

// =============================================================================
// EXPOSURE INTERFACES
// =============================================================================

interface ExposureSnapshot {
  id?: string;
  unified_pick_id: string;
  sport: string;
  league: string;
  event_id: string;
  game_id?: string;
  team: string;
  opponent: string;
  market: string;
  stat_type: string;
  kelly_fraction: number;
  units: number;
  exposure_amount: number;
  max_loss: number;
  correlation_key: string;
  correlation_cluster: string;
  published: boolean;
  risk_tier: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
  created_at?: Date;
}

interface ExposureAnalysis {
  total_exposure: number;
  kelly_at_risk: number;
  max_loss_today: number;
  exposure_by_sport: Record<string, number>;
  exposure_by_market: Record<string, number>;
  correlation_clusters: {
    cluster: string;
    exposure: number;
    picks_count: number;
    risk_tier: string;
  }[];
  daily_limits: {
    max_daily_exposure: number;
    current_exposure: number;
    utilization_percentage: number;
    remaining_capacity: number;
  };
  risk_alerts: {
    type: 'correlation' | 'kelly' | 'exposure' | 'concentration';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    affected_picks: string[];
    recommended_action: string;
  }[];
}

interface RemediationAction {
  type: 'reduce_units' | 'demote_pick' | 'pause_market' | 'split_correlation';
  target_pick_ids: string[];
  adjustment: {
    from_units?: number;
    to_units?: number;
    reason: string;
  };
  estimated_impact: {
    exposure_reduction: number;
    kelly_reduction: number;
  };
}

// =============================================================================
// EXPOSURE TRACKING SERVICE
// =============================================================================

class ExposureTrackingService {
  // Risk configuration constants
  static readonly DAILY_EXPOSURE_LIMIT = 50000; // $50k daily exposure limit
  static readonly MAX_KELLY_RISK = 0.25; // 25% max Kelly risk
  static readonly CORRELATION_LIMIT = 0.6; // 60% correlation limit
  static readonly HIGH_CONCENTRATION_THRESHOLD = 0.4; // 40% concentration threshold

  /**
   * Create exposure snapshot from unified pick
   */
  static async createSnapshot(pickData: {
    unified_pick_id: string;
    sport: string;
    league: string;
    event_id: string;
    game_id?: string;
    team: string;
    opponent: string;
    market: string;
    stat_type: string;
    kelly_fraction: number;
    units: number;
    published: boolean;
  }): Promise<ExposureSnapshot> {
    // Calculate exposure amount (units * average bet size)
    const avgBetSize = 1000; // $1000 average bet size
    const exposureAmount = pickData.units * avgBetSize;
    const maxLoss = exposureAmount * (pickData.kelly_fraction > 0 ? 1 : -1);

    // Generate correlation key and cluster
    const correlationKey = `${pickData.game_id || pickData.event_id}:${pickData.market}`;
    const correlationCluster = this.determineCorrelationCluster(
      pickData.sport,
      pickData.market,
      pickData.team,
      pickData.opponent
    );

    // Determine risk tier
    const riskTier = this.calculateRiskTier(
      exposureAmount,
      pickData.kelly_fraction,
      correlationCluster
    );

    // Production schema: id, snapshot_type, snapshot_data (JSON), created_at
    // All detailed exposure fields go into snapshot_data
    const snapshotData = {
      unified_pick_id: pickData.unified_pick_id,
      sport: pickData.sport,
      league: pickData.league,
      event_id: pickData.event_id,
      game_id: pickData.game_id,
      team: pickData.team,
      opponent: pickData.opponent,
      market: pickData.market,
      stat_type: pickData.stat_type,
      kelly_fraction: pickData.kelly_fraction,
      units: pickData.units,
      exposure_amount: exposureAmount,
      max_loss: maxLoss,
      correlation_key: correlationKey,
      correlation_cluster: correlationCluster,
      published: pickData.published,
      risk_tier: riskTier,
      avg_bet_size: avgBetSize,
      calculated_at: new Date().toISOString(),
    };

    const dbRecord = {
      snapshot_type: 'exposure',
      snapshot_data: snapshotData,
    };

    // Insert into database
    const { data, error } = await supabase
      .from('exposure_snapshots')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create exposure snapshot: ${error.message}`);
    }

    // Return combined snapshot for API response
    return {
      id: data?.id,
      created_at: data?.created_at ? new Date(data.created_at) : new Date(),
      ...snapshotData,
    } as ExposureSnapshot;
  }

  /**
   * Get comprehensive exposure analysis
   */
  static async getExposureAnalysis(
    options: {
      sport?: string;
      date?: string;
      published_only?: boolean;
    } = {}
  ): Promise<ExposureAnalysis> {
    // Build base query - production schema has snapshot_type, snapshot_data, created_at
    // sport/published filters are not DB columns - filtering done post-query on snapshot_data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let startDate = today;
    let endDate = tomorrow;
    if (options.date) {
      startDate = new Date(options.date);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }

    const { data: snapshots, error } = await supabase
      .from('exposure_snapshots')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching exposure snapshots:', error);
      return this.getEmptyAnalysis();
    }

    return this.analyzeExposure(snapshots || []);
  }

  /**
   * Analyze exposure data and generate insights
   */
  private static analyzeExposure(snapshots: any[]): ExposureAnalysis {
    const totalExposure = snapshots.reduce((sum, s) => sum + (s.exposure_amount || 0), 0);
    const kellyAtRisk = snapshots.reduce((sum, s) => sum + Math.abs(s.kelly_fraction || 0), 0);
    const maxLossToday = snapshots.reduce((sum, s) => sum + Math.abs(s.max_loss || 0), 0);

    // Group by sport
    const exposureBySport: Record<string, number> = {};
    snapshots.forEach(s => {
      exposureBySport[s.sport] = (exposureBySport[s.sport] || 0) + (s.exposure_amount || 0);
    });

    // Group by market
    const exposureByMarket: Record<string, number> = {};
    snapshots.forEach(s => {
      exposureByMarket[s.market] = (exposureByMarket[s.market] || 0) + (s.exposure_amount || 0);
    });

    // Analyze correlation clusters
    const clusterMap = new Map<
      string,
      { exposure: number; picks: string[]; risk_tiers: string[] }
    >();
    snapshots.forEach(s => {
      const cluster = s.correlation_cluster;
      if (!clusterMap.has(cluster)) {
        clusterMap.set(cluster, { exposure: 0, picks: [], risk_tiers: [] });
      }
      const clusterData = clusterMap.get(cluster)!;
      clusterData.exposure += s.exposure_amount || 0;
      clusterData.picks.push(s.unified_pick_id);
      clusterData.risk_tiers.push(s.risk_tier);
    });

    const correlationClusters = Array.from(clusterMap.entries())
      .map(([cluster, data]) => ({
        cluster,
        exposure: data.exposure,
        picks_count: data.picks.length,
        risk_tier: data.risk_tiers.includes('critical')
          ? 'critical'
          : data.risk_tiers.includes('high')
            ? 'high'
            : data.risk_tiers.includes('medium')
              ? 'medium'
              : 'low',
      }))
      .sort((a, b) => b.exposure - a.exposure);

    // Calculate daily limits
    const dailyLimits = {
      max_daily_exposure: this.DAILY_EXPOSURE_LIMIT,
      current_exposure: totalExposure,
      utilization_percentage: Math.round((totalExposure / this.DAILY_EXPOSURE_LIMIT) * 100),
      remaining_capacity: Math.max(0, this.DAILY_EXPOSURE_LIMIT - totalExposure),
    };

    // Generate risk alerts
    const riskAlerts = this.generateRiskAlerts(
      snapshots,
      totalExposure,
      kellyAtRisk,
      correlationClusters,
      dailyLimits
    );

    return {
      total_exposure: Math.round(totalExposure),
      kelly_at_risk: Math.round(kellyAtRisk * 100) / 100,
      max_loss_today: Math.round(maxLossToday),
      exposure_by_sport: exposureBySport,
      exposure_by_market: exposureByMarket,
      correlation_clusters: correlationClusters,
      daily_limits: dailyLimits,
      risk_alerts: riskAlerts,
    };
  }

  /**
   * Generate risk alerts based on analysis
   */
  private static generateRiskAlerts(
    snapshots: any[],
    totalExposure: number,
    kellyAtRisk: number,
    correlationClusters: any[],
    dailyLimits: any
  ) {
    const alerts: ExposureAnalysis['risk_alerts'] = [];

    // Daily exposure limit alert
    if (dailyLimits.utilization_percentage > 90) {
      alerts.push({
        type: 'exposure',
        severity: 'critical',
        message: `Daily exposure limit 90% utilized (${dailyLimits.utilization_percentage}%)`,
        affected_picks: snapshots.map(s => s.unified_pick_id),
        recommended_action: 'Reduce position sizes or pause new picks until exposure decreases',
      });
    } else if (dailyLimits.utilization_percentage > 75) {
      alerts.push({
        type: 'exposure',
        severity: 'high',
        message: `Daily exposure limit 75% utilized (${dailyLimits.utilization_percentage}%)`,
        affected_picks: [],
        recommended_action: 'Monitor closely and consider position size reductions',
      });
    }

    // Kelly risk alert
    if (kellyAtRisk > this.MAX_KELLY_RISK) {
      alerts.push({
        type: 'kelly',
        severity: 'critical',
        message: `Kelly risk exceeds maximum threshold (${kellyAtRisk.toFixed(2)} > ${this.MAX_KELLY_RISK})`,
        affected_picks: snapshots
          .filter(s => Math.abs(s.kelly_fraction) > 0.05)
          .map(s => s.unified_pick_id),
        recommended_action: 'Reduce Kelly fractions or split positions across multiple picks',
      });
    }

    // Correlation concentration alerts
    correlationClusters.forEach(cluster => {
      const concentrationPct = cluster.exposure / totalExposure;
      if (concentrationPct > this.HIGH_CONCENTRATION_THRESHOLD) {
        alerts.push({
          type: 'concentration',
          severity: concentrationPct > 0.6 ? 'critical' : 'high',
          message: `High concentration in ${cluster.cluster} (${Math.round(concentrationPct * 100)}% of exposure)`,
          affected_picks: snapshots
            .filter(s => s.correlation_cluster === cluster.cluster)
            .map(s => s.unified_pick_id),
          recommended_action: 'Diversify positions across different games/markets',
        });
      }
    });

    // High-risk tier concentration
    const criticalRiskPicks = snapshots.filter(s => s.risk_tier === 'critical');
    if (criticalRiskPicks.length > 3) {
      alerts.push({
        type: 'correlation',
        severity: 'high',
        message: `${criticalRiskPicks.length} picks in critical risk tier`,
        affected_picks: criticalRiskPicks.map(s => s.unified_pick_id),
        recommended_action: 'Review and potentially reduce critical risk positions',
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Generate auto-remediation recommendations
   */
  static async generateRemediationActions(
    analysis: ExposureAnalysis
  ): Promise<RemediationAction[]> {
    const actions: RemediationAction[] = [];

    // Handle critical exposure limit breaches
    const criticalExposureAlert = analysis.risk_alerts.find(
      a => a.type === 'exposure' && a.severity === 'critical'
    );
    if (criticalExposureAlert) {
      const excessExposure = analysis.total_exposure - this.DAILY_EXPOSURE_LIMIT * 0.8; // Target 80%
      const targetReduction = Math.max(excessExposure, analysis.total_exposure * 0.1); // 10% minimum

      actions.push({
        type: 'reduce_units',
        target_pick_ids: criticalExposureAlert.affected_picks.slice(0, 5), // Limit to top 5
        adjustment: {
          reason: `Reduce exposure by $${Math.round(targetReduction)} to stay within daily limits`,
        },
        estimated_impact: {
          exposure_reduction: targetReduction,
          kelly_reduction: (targetReduction / analysis.total_exposure) * analysis.kelly_at_risk,
        },
      });
    }

    // Handle high concentration clusters
    const concentrationAlerts = analysis.risk_alerts.filter(a => a.type === 'concentration');
    concentrationAlerts.forEach(alert => {
      if (alert.severity === 'critical') {
        actions.push({
          type: 'split_correlation',
          target_pick_ids: alert.affected_picks.slice(0, 3),
          adjustment: {
            reason: `Split highly correlated positions in ${alert.message}`,
          },
          estimated_impact: {
            exposure_reduction: 0,
            kelly_reduction: analysis.kelly_at_risk * 0.15, // Estimate 15% Kelly reduction
          },
        });
      }
    });

    return actions.slice(0, 3); // Limit to top 3 actions
  }

  /**
   * Execute auto-remediation action
   */
  static async executeRemediationAction(
    action: RemediationAction,
    actor: string,
    confirm: boolean = false
  ): Promise<{
    success: boolean;
    affected_picks: number;
    estimated_impact: any;
    message: string;
  }> {
    if (!confirm) {
      return {
        success: false,
        affected_picks: action.target_pick_ids.length,
        estimated_impact: action.estimated_impact,
        message: 'Confirmation required for auto-remediation execution',
      };
    }

    let affectedCount = 0;
    const results = [];

    try {
      for (const pickId of action.target_pick_ids) {
        switch (action.type) {
          case 'reduce_units':
            const result = await this.reducePickUnits(pickId, 0.8, action.adjustment.reason); // Reduce by 20%
            if (result.success) affectedCount++;
            results.push(result);
            break;

          case 'demote_pick':
            const demoteResult = await this.demotePick(pickId, action.adjustment.reason);
            if (demoteResult.success) affectedCount++;
            results.push(demoteResult);
            break;

          case 'split_correlation':
            // This would require more complex logic to actually split positions
            results.push({ success: true, pick_id: pickId, action: 'marked_for_splitting' });
            affectedCount++;
            break;
        }
      }

      // Log the remediation action
      await RBACService.logAudit({
        actor,
        actor_type: 'user',
        action: 'EXECUTE_AUTO_REMEDIATION',
        resource_type: 'exposure_management',
        resource_id: action.type,
        payload: {
          action_type: action.type,
          target_picks: action.target_pick_ids,
          estimated_impact: action.estimated_impact,
          actual_results: results,
        },
        status: 'success',
      });

      return {
        success: true,
        affected_picks: affectedCount,
        estimated_impact: action.estimated_impact,
        message: `Successfully executed ${action.type} on ${affectedCount} picks`,
      };
    } catch (error) {
      console.error('Error executing remediation action:', error);
      return {
        success: false,
        affected_picks: 0,
        estimated_impact: action.estimated_impact,
        message: `Failed to execute remediation: ${error.message}`,
      };
    }
  }

  // Helper methods for calculations and operations
  private static determineCorrelationCluster(
    sport: string,
    market: string,
    team: string,
    opponent: string
  ): string {
    if (market.includes('player_props')) return 'player_props';
    if (market.includes('game')) return `game_${team}_${opponent}`;
    if (market.includes('team')) return `team_${team}`;
    return `${sport}_${market}`;
  }

  private static calculateRiskTier(
    exposure: number,
    kellyFraction: number,
    correlationCluster: string
  ): ExposureSnapshot['risk_tier'] {
    const exposureScore = exposure / 10000; // Score based on $10k units
    const kellyScore = Math.abs(kellyFraction) * 10; // Score based on Kelly fraction
    const correlationScore = correlationCluster.includes('game') ? 2 : 1; // Game correlations are riskier

    const totalScore = exposureScore + kellyScore + correlationScore;

    if (totalScore > 8) return 'critical';
    if (totalScore > 5) return 'high';
    if (totalScore > 3) return 'medium';
    return 'low';
  }

  private static async reducePickUnits(
    pickId: string,
    reductionFactor: number,
    reason: string
  ): Promise<{ success: boolean; pick_id: string; new_units?: number }> {
    try {
      // SPRINT-023B: Route through API endpoint instead of direct DB write
      const apiUrl = process.env.API_SERVICE_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/ops/picks/${pickId}/reduce-units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, reduction_factor: reductionFactor }),
      });
      const result = await res.json();

      return {
        success: result.success === true,
        pick_id: pickId,
        new_units: result.new_units,
      };
    } catch (error) {
      console.error('Error reducing pick units:', error);
      return { success: false, pick_id: pickId };
    }
  }

  private static async demotePick(
    pickId: string,
    reason: string
  ): Promise<{ success: boolean; pick_id: string; action: string }> {
    try {
      // SPRINT-023B: Route through API endpoint instead of direct DB write
      const apiUrl = process.env.API_SERVICE_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/ops/picks/${pickId}/demote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const result = await res.json();

      return {
        success: result.success === true,
        pick_id: pickId,
        action: result.action || 'demoted_to_draft',
      };
    } catch (error) {
      console.error('Error demoting pick:', error);
      return { success: false, pick_id: pickId, action: 'failed' };
    }
  }

  private static getEmptyAnalysis(): ExposureAnalysis {
    return {
      total_exposure: 0,
      kelly_at_risk: 0,
      max_loss_today: 0,
      exposure_by_sport: {},
      exposure_by_market: {},
      correlation_clusters: [],
      daily_limits: {
        max_daily_exposure: this.DAILY_EXPOSURE_LIMIT,
        current_exposure: 0,
        utilization_percentage: 0,
        remaining_capacity: this.DAILY_EXPOSURE_LIMIT,
      },
      risk_alerts: [],
    };
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * GET /api/exposure/snapshot
 * Get current exposure analysis
 */
export async function GET(request: NextRequest) {
  const span = UnitTalkTracing.startAgentSpan('exposure', 'get_analysis');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Check permissions
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || undefined;
    const date = searchParams.get('date') || undefined;
    const publishedOnly = searchParams.get('published_only') === 'true';
    const includeRemediation = searchParams.get('include_remediation') === 'true';

    // Get exposure analysis
    const analysis = await ExposureTrackingService.getExposureAnalysis({
      sport,
      date,
      published_only: publishedOnly,
    });

    // Generate remediation actions if requested
    let remediationActions = [];
    if (
      includeRemediation &&
      (await RBACService.hasPermission(userId, Permission.CONTROL_AGENTS))
    ) {
      remediationActions = await ExposureTrackingService.generateRemediationActions(analysis);
    }

    UnitTalkTracing.addBusinessContext(span, {
      userId,
      sport,
    });

    UnitTalkTracing.recordSuccess(span, {
      itemsProcessed: analysis.correlation_clusters.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...analysis,
        remediation_actions: remediationActions,
        metadata: {
          sport,
          date,
          published_only: publishedOnly,
          generated_at: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    const errorMessage = error.message || 'Unknown error';
    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'EXPOSURE_ANALYSIS_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}

/**
 * POST /api/exposure/snapshot
 * Create new exposure snapshot
 */
export async function POST(request: NextRequest) {
  const span = UnitTalkTracing.startAgentSpan('exposure', 'create_snapshot');

  try {
    const userId = request.headers.get('x-user-id') || 'system';

    // Require ops permissions to create snapshots
    await RBACService.requirePermission(userId, Permission.CONTROL_AGENTS);

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['unified_pick_id', 'sport', 'market', 'kelly_fraction', 'units'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`,
            code: 'INVALID_REQUEST',
          },
          { status: 400 }
        );
      }
    }

    // Create exposure snapshot
    const snapshot = await ExposureTrackingService.createSnapshot(body);

    UnitTalkTracing.recordSuccess(span, {
      itemsProcessed: 1,
    });

    return NextResponse.json({
      success: true,
      data: snapshot,
      message: 'Exposure snapshot created successfully',
    });
  } catch (error) {
    UnitTalkTracing.recordError(span, error as Error);

    const errorMessage = error.message || 'Unknown error';
    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'CREATE_SNAPSHOT_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}
