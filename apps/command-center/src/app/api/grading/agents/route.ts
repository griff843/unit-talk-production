'use server';

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { createClient } from '@/lib/supabase';

/**
 * Grading Agents API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock data removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

interface GradingAgent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  processed: number;
  pending: number;
  accuracy: number;
  avgProcessingTime: number;
  lastActivity: string;
  tier: string;
  configuration: {
    batchSize: number;
    confidenceThreshold: number;
    retryAttempts: number;
    timeoutMs: number;
  };
}

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = createClient();

    // Get grading agent health from agent_health table
    const { data: agentHealth, error: healthError } = await supabase
      .from('agent_health')
      .select('*')
      .order('created_at', { ascending: false });

    if (healthError) {
      console.error('[CC] Grading agent health query failed:', healthError.message);
      return NextResponse.json(
        { success: false, error: `Database query failed: ${healthError.message}` },
        { status: 500 }
      );
    }

    // Get pick counts from unified_picks for metrics
    const { data: pickStats, error: pickStatsError } = await supabase
      .from('unified_picks')
      .select('workflow_stage, confidence, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (pickStatsError) {
      console.error('[CC] Pick stats query failed:', pickStatsError.message);
    }

    // Calculate pick metrics
    const processed =
      pickStats?.filter(
        (p: { workflow_stage?: string }) =>
          p.workflow_stage &&
          typeof p.workflow_stage === 'string' &&
          ['approved', 'rejected', 'published', 'settled'].includes(p.workflow_stage)
      ).length || 0;

    const pending =
      pickStats?.filter(
        (p: { workflow_stage?: string }) =>
          !p.workflow_stage ||
          (typeof p.workflow_stage === 'string' &&
            ['draft', 'pending_review', 'pending'].includes(p.workflow_stage))
      ).length || 0;

    const avgConfidence =
      pickStats && pickStats.length > 0
        ? pickStats.reduce(
            (sum: number, p: { confidence?: number }) =>
              sum + (typeof p.confidence === 'number' ? p.confidence : 0),
            0
          ) / pickStats.length
        : 0;

    // Transform agent health data into grading agents format
    const gradingAgents: GradingAgent[] = [];

    // Filter for grading-related agents
    const gradingHealthRecords = agentHealth?.filter(
      (h: { agent?: string }) =>
        h.agent &&
        typeof h.agent === 'string' &&
        (h.agent.toLowerCase().includes('grading') ||
          h.agent.toLowerCase().includes('settlement') ||
          h.agent.toLowerCase().includes('promotion'))
    );

    if (gradingHealthRecords && gradingHealthRecords.length > 0) {
      for (const record of gradingHealthRecords) {
        const details = (record.details || {}) as Record<string, unknown>;
        gradingAgents.push({
          id: record.id || record.agent,
          name: record.agent,
          status:
            record.status === 'healthy'
              ? 'active'
              : record.status === 'error'
                ? 'error'
                : 'inactive',
          processed: (details.processed as number) || processed,
          pending: (details.pending as number) || pending,
          accuracy: Math.round((details.accuracy as number) || avgConfidence),
          avgProcessingTime: (details.response_time_ms as number) || 0,
          lastActivity: record.last_heartbeat || record.created_at || new Date().toISOString(),
          tier: (details.tier as string) || 'A',
          configuration: {
            batchSize: (details.batch_size as number) || 50,
            confidenceThreshold: (details.confidence_threshold as number) || 70,
            retryAttempts: (details.retry_attempts as number) || 3,
            timeoutMs: (details.timeout_ms as number) || 30000,
          },
        });
      }
    }

    // If no grading agents found in agent_health, create entry from GradingAgent if it exists
    if (gradingAgents.length === 0) {
      const mainGrading = agentHealth?.find(
        (h: { agent?: string }) =>
          h.agent && typeof h.agent === 'string' && h.agent === 'GradingAgent'
      );

      if (mainGrading) {
        const details = (mainGrading.details || {}) as Record<string, unknown>;
        gradingAgents.push({
          id: 'grading-agent-main',
          name: 'GradingAgent',
          status:
            mainGrading.status === 'healthy'
              ? 'active'
              : mainGrading.status === 'error'
                ? 'error'
                : 'inactive',
          processed,
          pending,
          accuracy: Math.round(avgConfidence),
          avgProcessingTime: (details.response_time_ms as number) || 0,
          lastActivity:
            mainGrading.last_heartbeat || mainGrading.created_at || new Date().toISOString(),
          tier: 'A',
          configuration: {
            batchSize: 50,
            confidenceThreshold: 70,
            retryAttempts: 3,
            timeoutMs: 30000,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: gradingAgents,
      count: gradingAgents.length,
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] Grading agents error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
