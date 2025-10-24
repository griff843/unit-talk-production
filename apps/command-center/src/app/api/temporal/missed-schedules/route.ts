/**
 * @fileoverview Temporal missed schedules monitoring API
 * Detects and reports schedules that didn't fire within expected timeframe
 */

import { NextRequest, NextResponse } from 'next/server';
import { RBACService, Permission } from '@/lib/rbac';
import { UnitTalkTracing } from '@/lib/telemetry';
import { supabase } from '@/lib/supabase';

// =============================================================================
// MISSED SCHEDULE INTERFACES
// =============================================================================

interface MissedSchedule {
  schedule_id: string;
  schedule_spec: string;
  workflow_type: string;
  last_scheduled_at?: Date;
  next_scheduled_at?: Date;
  expected_frequency_minutes: number;
  missed_count: number;
  missing_since?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact_score: number;
  enabled: boolean;
  paused: boolean;
  paused_reason?: string;
}

interface MissedScheduleAnalysis {
  total_schedules: number;
  missed_schedules: number;
  critical_missed: number;
  average_delay_minutes: number;
  longest_missed_duration_hours: number;
  schedules: MissedSchedule[];
  recommendations: string[];
  health_score: number;
}

// =============================================================================
// MISSED SCHEDULE DETECTION SERVICE
// =============================================================================

class MissedScheduleService {
  /**
   * Detect missed schedules with comprehensive analysis
   */
  static async detectMissedSchedules(
    threshold_minutes: number = 10
  ): Promise<MissedScheduleAnalysis> {
    // Get all schedule health records
    const { data: schedules, error } = await supabase
      .from('temporal_schedule_health')
      .select('*')
      .eq('enabled', true)
      .order('missing_since', { ascending: true });

    if (error) {
      console.error('Error fetching schedule health:', error);
      return this.getEmptyAnalysis();
    }

    const currentTime = new Date();
    const missedSchedules: MissedSchedule[] = [];
    let totalDelayMinutes = 0;
    let longestMissedHours = 0;

    for (const schedule of schedules || []) {
      const analysis = await this.analyzeSchedule(schedule, currentTime, threshold_minutes);

      if (analysis.is_missed) {
        missedSchedules.push(analysis.schedule);
        totalDelayMinutes += analysis.delay_minutes;
        longestMissedHours = Math.max(longestMissedHours, analysis.delay_minutes / 60);
      }
    }

    const criticalMissed = missedSchedules.filter(s => s.severity === 'critical').length;
    const healthScore = this.calculateHealthScore(
      schedules?.length || 0,
      missedSchedules.length,
      criticalMissed
    );
    const recommendations = this.generateRecommendations(missedSchedules);

    return {
      total_schedules: schedules?.length || 0,
      missed_schedules: missedSchedules.length,
      critical_missed: criticalMissed,
      average_delay_minutes:
        missedSchedules.length > 0 ? Math.round(totalDelayMinutes / missedSchedules.length) : 0,
      longest_missed_duration_hours: Math.round(longestMissedHours * 100) / 100,
      schedules: missedSchedules,
      recommendations,
      health_score: healthScore,
    };
  }

  /**
   * Analyze individual schedule for missed executions
   */
  private static async analyzeSchedule(
    schedule: any,
    currentTime: Date,
    threshold_minutes: number
  ): Promise<{
    is_missed: boolean;
    delay_minutes: number;
    schedule: MissedSchedule;
  }> {
    const lastScheduled = schedule.last_scheduled_at ? new Date(schedule.last_scheduled_at) : null;
    const expectedFreq = schedule.expected_frequency_minutes || 60;

    // Calculate when next execution should have happened
    const expectedNext = lastScheduled
      ? new Date(lastScheduled.getTime() + expectedFreq * 60 * 1000)
      : new Date(currentTime.getTime() - expectedFreq * 60 * 1000);

    const delayMinutes = lastScheduled
      ? Math.max(0, (currentTime.getTime() - expectedNext.getTime()) / (60 * 1000))
      : expectedFreq; // If never scheduled, delay is at least the frequency

    const isMissed = delayMinutes > threshold_minutes && !schedule.paused;

    // Calculate severity based on delay and workflow importance
    let severity: MissedSchedule['severity'] = 'low';
    let impactScore = 1;

    if (isMissed) {
      const delayRatio = delayMinutes / expectedFreq;

      if (delayRatio > 5 || this.isCriticalWorkflow(schedule.workflow_type)) {
        severity = 'critical';
        impactScore = 10;
      } else if (delayRatio > 3) {
        severity = 'high';
        impactScore = 7;
      } else if (delayRatio > 1.5) {
        severity = 'medium';
        impactScore = 4;
      }

      // Boost impact for business-critical workflows
      if (this.isBusinessCritical(schedule.workflow_type)) {
        impactScore = Math.min(10, impactScore + 3);
      }
    }

    const mappedSchedule: MissedSchedule = {
      schedule_id: schedule.schedule_id,
      schedule_spec: schedule.schedule_spec || 'unknown',
      workflow_type: schedule.workflow_type,
      last_scheduled_at: lastScheduled,
      next_scheduled_at: schedule.next_scheduled_at
        ? new Date(schedule.next_scheduled_at)
        : undefined,
      expected_frequency_minutes: expectedFreq,
      missed_count: schedule.missed_count || 0,
      missing_since: schedule.missing_since ? new Date(schedule.missing_since) : undefined,
      severity,
      impact_score: impactScore,
      enabled: schedule.enabled,
      paused: schedule.paused,
      paused_reason: schedule.paused_reason,
    };

    return {
      is_missed: isMissed,
      delay_minutes: Math.round(delayMinutes),
      schedule: mappedSchedule,
    };
  }

  /**
   * Check if workflow type is critical
   */
  private static isCriticalWorkflow(workflowType: string): boolean {
    const criticalWorkflows = [
      'GradingWorkflow',
      'AlertWorkflow',
      'DataIngestionWorkflow',
      'HealthCheckWorkflow',
    ];
    return criticalWorkflows.some(critical =>
      workflowType.toLowerCase().includes(critical.toLowerCase())
    );
  }

  /**
   * Check if workflow type is business critical
   */
  private static isBusinessCritical(workflowType: string): boolean {
    const businessCritical = ['grading', 'publishing', 'alert', 'settlement', 'financial'];
    return businessCritical.some(critical => workflowType.toLowerCase().includes(critical));
  }

  /**
   * Calculate overall schedule health score (0-100)
   */
  private static calculateHealthScore(
    totalSchedules: number,
    missedSchedules: number,
    criticalMissed: number
  ): number {
    if (totalSchedules === 0) return 100;

    const missedRatio = missedSchedules / totalSchedules;
    const criticalRatio = criticalMissed / totalSchedules;

    // Base score from missed ratio
    let score = (1 - missedRatio) * 100;

    // Additional penalty for critical misses
    score -= criticalRatio * 30;

    return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
  }

  /**
   * Generate actionable recommendations
   */
  private static generateRecommendations(missedSchedules: MissedSchedule[]): string[] {
    const recommendations: string[] = [];

    if (missedSchedules.length === 0) {
      return ['All schedules are executing within expected timeframes'];
    }

    const critical = missedSchedules.filter(s => s.severity === 'critical');
    const high = missedSchedules.filter(s => s.severity === 'high');
    const longRunning = missedSchedules.filter(
      s => s.missing_since && Date.now() - s.missing_since.getTime() > 4 * 60 * 60 * 1000
    );

    if (critical.length > 0) {
      recommendations.push(
        `URGENT: ${critical.length} critical schedule(s) missed. Immediate investigation required.`
      );
    }

    if (high.length > 0) {
      recommendations.push(
        `${high.length} high-priority schedule(s) missed. Review within 1 hour.`
      );
    }

    if (longRunning.length > 0) {
      recommendations.push(
        `${longRunning.length} schedule(s) missing for >4 hours. Check Temporal cluster health.`
      );
    }

    // Workflow-specific recommendations
    const workflowTypes = [...new Set(missedSchedules.map(s => s.workflow_type))];
    if (workflowTypes.includes('GradingWorkflow')) {
      recommendations.push(
        'GradingWorkflow missed - picks may not be processed. Check grading queue.'
      );
    }
    if (workflowTypes.includes('AlertWorkflow')) {
      recommendations.push(
        'AlertWorkflow missed - users may not receive notifications. Verify Discord bot.'
      );
    }

    // General recommendations based on patterns
    if (missedSchedules.length > 5) {
      recommendations.push(
        'Multiple schedules missed - check Temporal cluster capacity and health.'
      );
    }

    return recommendations;
  }

  /**
   * Get empty analysis structure
   */
  private static getEmptyAnalysis(): MissedScheduleAnalysis {
    return {
      total_schedules: 0,
      missed_schedules: 0,
      critical_missed: 0,
      average_delay_minutes: 0,
      longest_missed_duration_hours: 0,
      schedules: [],
      recommendations: ['No schedule data available'],
      health_score: 0,
    };
  }

  /**
   * Update missed schedule status
   */
  static async updateMissedScheduleStatus(
    scheduleId: string,
    updates: {
      missed_count?: number;
      is_missing?: boolean;
      missing_since?: Date | null;
      last_scheduled_at?: Date;
    }
  ): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.missed_count !== undefined) {
      updateData.missed_count = updates.missed_count;
    }
    if (updates.is_missing !== undefined) {
      updateData.is_missing = updates.is_missing;
    }
    if (updates.missing_since !== undefined) {
      updateData.missing_since = updates.missing_since?.toISOString() || null;
    }
    if (updates.last_scheduled_at !== undefined) {
      updateData.last_scheduled_at = updates.last_scheduled_at.toISOString();
    }

    const { error } = await supabase
      .from('temporal_schedule_health')
      .update(updateData)
      .eq('schedule_id', scheduleId);

    if (error) {
      console.error('Error updating missed schedule status:', error);
      throw error;
    }
  }

  /**
   * Record missed schedule alert
   */
  static async recordMissedScheduleAlert(
    schedule: MissedSchedule,
    actor: string = 'system'
  ): Promise<void> {
    // Log to audit trail
    await RBACService.logAudit({
      actor,
      actor_type: 'system',
      action: 'MISSED_SCHEDULE_DETECTED',
      resource_type: 'temporal_schedule',
      resource_id: schedule.schedule_id,
      payload: {
        workflow_type: schedule.workflow_type,
        severity: schedule.severity,
        missing_since: schedule.missing_since,
        delay_minutes: schedule.missing_since
          ? Math.round((Date.now() - schedule.missing_since.getTime()) / 60000)
          : 0,
      },
      status: 'success',
    });

    // Record as system metric
    await supabase.from('system_metrics').insert({
      metric: 'temporal_missed_schedule',
      value: 1,
      labels: JSON.stringify({
        schedule_id: schedule.schedule_id,
        workflow_type: schedule.workflow_type,
        severity: schedule.severity,
      }),
      source: 'temporal_monitor',
    });
  }
}

// =============================================================================
// API ENDPOINT
// =============================================================================

/**
 * GET /api/temporal/missed-schedules
 * Get missed Temporal schedules analysis
 */
export async function GET(request: NextRequest) {
  const span = UnitTalkTracing.startTemporalSpan('TemporalMonitoring', 'get_missed_schedules');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Check permissions
    await RBACService.requirePermission(userId, Permission.VIEW_DASHBOARD);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const thresholdMinutes = parseInt(searchParams.get('threshold') || '10');
    const includeResolved = searchParams.get('include_resolved') === 'true';

    // Detect missed schedules
    const analysis = await MissedScheduleService.detectMissedSchedules(thresholdMinutes);

    // Filter out resolved schedules if requested
    if (!includeResolved) {
      analysis.schedules = analysis.schedules.filter(
        s => s.missing_since && Date.now() - s.missing_since.getTime() < 24 * 60 * 60 * 1000
      );
    }

    UnitTalkTracing.addBusinessContext(span, {
      userId,
    });

    UnitTalkTracing.recordSuccess(span, {
      itemsProcessed: analysis.schedules.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...analysis,
        metadata: {
          threshold_minutes: thresholdMinutes,
          include_resolved: includeResolved,
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
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'MISSED_SCHEDULES_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}

/**
 * POST /api/temporal/missed-schedules/:id/resolve
 * Mark a missed schedule as resolved
 */
export async function POST(request: NextRequest) {
  const span = UnitTalkTracing.startTemporalSpan('TemporalMonitoring', 'resolve_missed_schedule');

  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Require ops permissions to resolve issues
    await RBACService.requirePermission(userId, Permission.CONTROL_AGENTS);

    const body = await request.json();
    const { schedule_id, resolution_note } = body;

    if (!schedule_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: schedule_id',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    // Update schedule status
    await MissedScheduleService.updateMissedScheduleStatus(schedule_id, {
      is_missing: false,
      missing_since: null,
      last_scheduled_at: new Date(),
    });

    // Log resolution
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'RESOLVE_MISSED_SCHEDULE',
      resource_type: 'temporal_schedule',
      resource_id: schedule_id,
      payload: {
        resolution_note,
        resolved_at: new Date().toISOString(),
      },
      status: 'success',
    });

    UnitTalkTracing.recordSuccess(span);

    return NextResponse.json({
      success: true,
      message: 'Missed schedule marked as resolved',
      data: {
        schedule_id,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
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
        code: statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'RESOLVE_SCHEDULE_ERROR',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}
