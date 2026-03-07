// SPRINT-035A B-1: Temporal-compatible barrel export (replaces factory pattern)
// B-6: Does NOT export `initialize` to avoid collision with BaseAgent

import { supabaseClient } from '../../../services/supabaseClient';
import { makeLogger } from '../../../utils/logger';

import { GradingAgentActivitiesImpl } from './activities';

const logger = makeLogger('GradingActivities');

let implInstance: GradingAgentActivitiesImpl | null = null;

function getImpl(): GradingAgentActivitiesImpl {
  if (!implInstance) {
    implInstance = new GradingAgentActivitiesImpl(
      {
        name: 'GradingAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
        health: {
          enabled: true,
          interval: 30,
          timeout: 5000,
          checkDb: true,
          checkExternal: false,
          endpoint: '/health',
        },
        retry: {
          enabled: true,
          maxRetries: 3,
          maxAttempts: 3,
          backoffMs: 200,
          backoff: 200,
          maxBackoffMs: 5000,
          exponential: true,
          jitter: true,
        },
      },
      { logger, supabase: supabaseClient }
    );
  }
  return implInstance;
}

// --- Workflow-critical activities (previously missing from barrel) ---

export async function gradeNewProps(params: {
  league: string;
  isLiveMode: boolean;
  cycleCount: number;
}): Promise<{ league: string; topTierProps: any[]; gradedCount: number }> {
  return getImpl().gradeNewProps(params);
}

export async function scoreTopTierPicks(params: {
  gradedProps: any[];
  league: string;
  cycleCount: number;
}): Promise<{ league: string; scoredPicks: any[]; scoreCount: number }> {
  return getImpl().scoreTopTierPicks(params);
}

export async function updateUnifiedPicks(params: {
  scoringResults: any[];
  cycleCount: number;
  timestamp: Date;
}): Promise<void> {
  return getImpl().updateUnifiedPicks(params);
}

export async function getNewUnifiedPicks(params: { cycleCount: number }): Promise<any[]> {
  return getImpl().getNewUnifiedPicks(params);
}

// --- Existing activities (converted from factory to standalone) ---

export async function gradeSubmission(params: {
  submissionId: string;
  capperName: string;
  pickData: any;
}): Promise<{ grade: string; confidence: number; feedback: string }> {
  return getImpl().gradeSubmission(params);
}

export async function gradeProp(params: {
  propId: string;
  models: string[];
  options?: Record<string, unknown>;
}): Promise<any> {
  return getImpl().gradeProp(params);
}

export async function validateGrade(params: {
  propId: string;
  grade: string;
  confidence: number;
  options?: Record<string, unknown>;
}): Promise<any> {
  return getImpl().validateGrade(params);
}

export async function monitorGrading(params: {
  interval?: number;
  thresholds?: { confidence: number; quality: number };
}): Promise<any> {
  return getImpl().monitorGrading(params);
}

export async function healthCheck(params: {
  components: string[];
  timeout?: number;
}): Promise<any> {
  return getImpl().healthCheck(params);
}

export async function validateDependencies(): Promise<any> {
  return getImpl().validateDependencies();
}
