/**
 * Rollout API Routes - Command Center Integration
 *
 * API endpoints for managing the shadow→canary→full rollout system
 * from the Command Center dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

interface RolloutConfiguration {
  unified_picks_migration: boolean;
  cache_first_architecture: boolean;
  shadow_mode_enabled: boolean;
  alert_system_changes: boolean;
  retention_sweeps_enabled: boolean;
  clv_tracking_enabled: boolean;
}

/**
 * GET /api/rollout - Get current rollout status
 */
export async function GET() {
  try {
    // For now, we'll simulate active rollout data
    // In production, this would query the actual rollout status
    const mockRolloutStatus = {
      rolloutId: 'rollout-unified-picks-1727280000000',
      phase: 'canary',
      status: 'in_progress',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      currentPhase: {
        name: 'canary',
        description: 'Segment-based rollout with Discord alerts enabled',
        requirements: ['Shadow phase completed', 'Segment allocation ready', 'Alert precision validated'],
        duration: {
          min: 240,
          max: 1440,
          stabilization: 30
        }
      },
      phaseProgress: 65,
      metrics: {
        cacheHitRate: 87.3,
        averageLatency: 1234,
        errorRate: 0.008,
        alertPrecision: 96.2,
        dataConsistencyRate: 99.7,
        creditUsage: {
          current: 892,
          baseline: 1000,
          efficiency: 112.1
        },
        usersAffected: 1247,
        performanceScore: 94
      },
      segments: {
        activeSegments: 3,
        totalUsers: 1247,
        segmentPerformance: {
          'vip_plus': 98,
          'nfl': 94,
          'tier_s_cappers': 96
        },
        segmentHealth: {
          'vip_plus': 'healthy',
          'nfl': 'healthy',
          'tier_s_cappers': 'warning'
        }
      },
      killSwitchStatus: [
        {
          name: 'critical_error_rate',
          armed: true,
          triggered: false,
          lastCheck: new Date().toISOString(),
          currentValue: 0.008,
          threshold: 0.10,
          status: 'normal'
        },
        {
          name: 'cache_failure_cascade',
          armed: true,
          triggered: false,
          lastCheck: new Date().toISOString(),
          currentValue: 87.3,
          threshold: 50,
          status: 'normal'
        },
        {
          name: 'segment_failure_cascade',
          armed: true,
          triggered: false,
          lastCheck: new Date().toISOString(),
          currentValue: 0.02,
          threshold: 0.10,
          status: 'warning'
        }
      ],
      validationResults: [
        {
          gateName: 'alert_precision',
          type: 'alert_precision',
          passed: true,
          actualValue: 96.2,
          threshold: 95,
          weight: 1.0,
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        {
          gateName: 'segment_error_rate',
          type: 'error_rate',
          passed: true,
          actualValue: 0.8,
          threshold: 1,
          weight: 1.0,
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        {
          gateName: 'credit_efficiency',
          type: 'cache_performance',
          passed: true,
          actualValue: 112.1,
          threshold: 110,
          weight: 0.6,
          timestamp: new Date().toISOString(),
          retryCount: 0
        }
      ],
      lastCheckpoint: new Date().toISOString()
    };

    return NextResponse.json(mockRolloutStatus);

  } catch (error) {
    console.error('Failed to get rollout status', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: 'Failed to fetch rollout status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rollout - Start a new rollout
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const configuration: RolloutConfiguration = {
      unified_picks_migration: body.unified_picks_migration ?? true,
      cache_first_architecture: body.cache_first_architecture ?? true,
      shadow_mode_enabled: body.shadow_mode_enabled ?? true,
      alert_system_changes: body.alert_system_changes ?? true,
      retention_sweeps_enabled: body.retention_sweeps_enabled ?? true,
      clv_tracking_enabled: body.clv_tracking_enabled ?? true
    };

    console.log('Starting new rollout', { configuration });

    // In a real implementation, we would start the actual rollout
    // For now, we'll simulate a successful start
    const rolloutId = `rollout-unified-picks-${Date.now()}`;

    // Store rollout start in database
    const client = getSupabaseClient();
    if (client) {
      await client
        .from('rollout_deployments')
        .insert({
          id: rolloutId,
          phase: 'shadow',
          status: 'in_progress',
          started_at: new Date().toISOString(),
          phase_progress: 0,
          configuration: configuration,
          metadata: {
            source: 'command_center',
            initiatedBy: 'command_center_user' // Would be actual user ID
          }
        });
    }

    console.log('Rollout started successfully', { rolloutId });

    return NextResponse.json({
      success: true,
      rolloutId,
      message: 'Rollout started successfully'
    });

  } catch (error) {
    console.error('Failed to start rollout', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: 'Failed to start rollout' },
      { status: 500 }
    );
  }
}