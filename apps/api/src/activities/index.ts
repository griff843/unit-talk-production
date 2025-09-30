import {
  BaseActivityParams,
  Prop,
  Alert,
  Report
} from '../agents/BaseAgent/types/index';
import { ScoringResult } from '../agents/ScoringAgent/scoring/applyScoringLogic';
import { NotificationResult } from '../agents/NotificationAgent/types';
import {
  ActivityResult,
  FeedIngestionResult,
  ApiQuotaResult
} from '../types/shared/activity-results';
import {
  SystemHealthResult,
  LiveGameMonitorResult
} from '../workflows/support-workflows';


/**
 * TEMPORAL ACTIVITIES INDEX
 * Exports all activities for Temporal workflows
 */

// Ingestion Activities
export {
  ingestOptimalProps,
  ingestSGOProps,
  ingestOptimalGames,
  validateIngestionData
} from './ingestion';

// Processing Activities
export {
  processUSPDetection,
  scoreAndGradeProps
} from './processing';

// Alert Activities
export {
  sendDiscordAlert,
  sendOperatorAlert,
  sendApprovedPicksAlert,
  sendQuotaWarning,
  sendFallbackTrigger,
  sendWorkflowFailure,
  sendWeeklyReport
} from './alerts';

// Operator Activities
export {
  logUSPError,
  logGradingError,
  monitorAPIQuota,
  checkSystemHealth,
  detectLiveGames,
  logWorkflowMetrics,
  logError
} from './operator';

// SGO Backfill Activities
export { backfillSGOActivities } from './backfillSGOActivities';

// Missing ScoringAgent Activities
export {
  getNewUnifiedPicks,
  scoreTopTierPicks
} from '../agents/ScoringAgent/activities';

// Missing AlertAgent Activities
export { detectStaleLines } from '../agents/AlertAgent/activities';

// Activity type definitions for Temporal
export interface IngestionActivities {
  ingestOptimalProps(params: BaseActivityParams & {
    league: string;
    isLiveMode: boolean;
  }): Promise<FeedIngestionResult>;

  ingestSGOProps(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    league: string;
    isLiveMode: boolean;
  }): Promise<FeedIngestionResult>;

  ingestOptimalGames(params: BaseActivityParams & {
    leagues: string[];
    isLiveMode: boolean;
    cycleCount: number;
  }): Promise<{ success: boolean; gamesIngested: number; errors: string[] }>;

  validateIngestionData(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    league: string;
    expectedMinProps: number;
  }): Promise<ActivityResult<{ isValid: boolean; actualCount: number; issues: string[] }>>;
}

export interface ProcessingActivities {
  processUSPDetection(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    leagues: string[];
  }): Promise<ActivityResult>;

  scoreAndGradeProps(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    leagues: string[];
  }): Promise<ScoringResult>;
}

export interface AlertActivities {
  sendDiscordAlert(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    message: string;
    channel: 'approved' | 'operator';
    priority: 'critical' | 'high' | 'normal';
    metadata?: Record<string, unknown>;
  }): Promise<NotificationResult>;

  sendOperatorAlert(params: BaseActivityParams & Alert): Promise<NotificationResult>;

  sendApprovedPicksAlert(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    picks: Prop[];
    totalPicks: number;
  }): Promise<NotificationResult>;

  sendQuotaWarning(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    provider: string;
    currentUsage: number;
    limit: number;
    percentage: number;
  }): Promise<ApiQuotaResult>;

  sendFallbackTrigger(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    primaryProvider: string;
    fallbackProvider: string;
    reason: string;
  }): Promise<NotificationResult>;

  sendWorkflowFailure(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    workflowName: string;
    errorMessage: string;
  }): Promise<NotificationResult>;

  sendWeeklyReport(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    report: Report;
    webhook?: string;
  }): Promise<NotificationResult>;
}

export interface OperatorActivities {
  logUSPError(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    uspType: string;
    errorMessage: string;
  }): Promise<ActivityResult>;

  monitorAPIQuota(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    provider: string;
    currentUsage: number;
    limit: number;
  }): Promise<ApiQuotaResult>;

  checkSystemHealth(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    components: string[];
  }): Promise<SystemHealthResult>;

  detectLiveGames(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    leagues: string[];
  }): Promise<LiveGameMonitorResult>;

  logWorkflowMetrics(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    workflowName: string;
    duration: number;
    success: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<ActivityResult>;

  monitorSmartFormHealth(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    formId?: string;
  }): Promise<ActivityResult>;

  processDailyPickBatch(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    batchId: string;
    picks: any[];
  }): Promise<ActivityResult>;

  processLivePick(params: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, 
    pickId: string;
    pickData: any;
  }): Promise<ActivityResult>;

  // General logging activity for workflow error handling
  logError(params: BaseActivityParams & {
    error: string;
    timestamp: string;
    context?: Record<string, unknown>;
  }): Promise<ActivityResult>;
}