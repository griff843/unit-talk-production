/**
 * TEMPORAL ACTIVITIES INDEX
 * Exports all activities for Temporal workflows
 */

// Ingestion Activities
export {
  ingestOptimalProps,
  ingestSGOProps,
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
  monitorAPIQuota,
  checkSystemHealth,
  detectLiveGames,
  logWorkflowMetrics
} from './operator';

// Activity type definitions for Temporal
export interface IngestionActivities {
  ingestOptimalProps(params: {
    league: string;
    isLiveMode: boolean;
    cycleCount: number;
  }): Promise<{ success: boolean; propsIngested: number; errors: string[] }>;

  ingestSGOProps(params: {
    league: string;
    isLiveMode: boolean;
    cycleCount: number;
  }): Promise<{ success: boolean; propsIngested: number; errors: string[] }>;

  validateIngestionData(params: {
    league: string;
    expectedMinProps: number;
  }): Promise<{ isValid: boolean; actualCount: number; issues: string[] }>;
}

export interface ProcessingActivities {
  processUSPDetection(params: {
    leagues: string[];
    cycleCount: number;
  }): Promise<{ success: boolean; uspResults: any[]; errors: string[] }>;

  scoreAndGradeProps(params: {
    leagues: string[];
    cycleCount: number;
  }): Promise<{ success: boolean; propsScored: number; propsPromoted: number; errors: string[] }>;
}

export interface AlertActivities {
  sendDiscordAlert(params: {
    message: string;
    channel: 'approved' | 'operator';
    priority: 'critical' | 'high' | 'normal';
    metadata?: any;
  }): Promise<{ success: boolean; error?: string }>;

  sendOperatorAlert(params: {
    type: 'workflow_failure' | 'quota_warning' | 'fallback_trigger' | 'system_error';
    message: string;
    severity: 'critical' | 'high' | 'normal';
    metadata?: any;
  }): Promise<{ success: boolean; error?: string }>;

  sendApprovedPicksAlert(params: {
    picks: any[];
    cycleCount: number;
    totalPicks: number;
  }): Promise<{ success: boolean; error?: string }>;

  sendQuotaWarning(params: {
    provider: string;
    currentUsage: number;
    limit: number;
    percentage: number;
  }): Promise<{ success: boolean; error?: string }>;

  sendFallbackTrigger(params: {
    primaryProvider: string;
    fallbackProvider: string;
    reason: string;
  }): Promise<{ success: boolean; error?: string }>;

  sendWorkflowFailure(params: {
    workflowName: string;
    error: string;
    cycleCount: number;
  }): Promise<{ success: boolean; error?: string }>;

  sendWeeklyReport(params: {
    report: any;
    webhook?: string;
  }): Promise<{ success: boolean; error?: string }>;
}

export interface OperatorActivities {
  logUSPError(params: {
    uspType: string;
    error: string;
    cycleCount: number;
  }): Promise<{ success: boolean }>;

  monitorAPIQuota(params: {
    provider: string;
    currentUsage: number;
    limit: number;
  }): Promise<{ success: boolean; shouldFallback: boolean; percentage: number }>;

  checkSystemHealth(params: {
    cycleCount: number;
    components: string[];
  }): Promise<{ success: boolean; healthScore: number; issues: string[] }>;

  detectLiveGames(params: {
    leagues: string[];
  }): Promise<{ success: boolean; liveGames: any[]; errors: string[] }>;

  logWorkflowMetrics(params: {
    workflowName: string;
    duration: number;
    success: boolean;
    cycleCount: number;
    metadata?: any;
  }): Promise<{ success: boolean }>;
}