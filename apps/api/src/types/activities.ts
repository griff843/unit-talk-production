// SPRINT-035B TD-7: Type contract pruned to match sanctioned runtime.
// Every method in every interface has a matching export in the corresponding activities barrel.
// Phantom types removed. If an activity doesn't exist, it doesn't belong here.

// Base activity parameters
export interface ActivityParams {
  [key: string]: any;
}

// Feed Agent Activities
// Barrel: agents/FeedAgent/activities/index.ts
export interface FeedAgentActivities {
  // Unified data ingestion (Dual-API via dataSourceRouter)
  ingestUnifiedData(params: { league: string; batchSize: number; timeout: number }): Promise<{
    success: boolean;
    count: number;
    source: string;
    error?: string;
    propCount?: number;
    batchId?: string;
  }>;

  // Live game detection
  getLiveGames(params?: any): Promise<{ success: boolean; games: any[]; error?: string }>;

  // Fetch feed data (used by league schedule workflows)
  fetchFeed(params: ActivityParams): Promise<{ success: boolean; message: string; data?: any }>;

  // Quota status check
  checkQuotaStatus(params: { provider: string }): Promise<{
    success: boolean;
    usage?: any;
    error?: string;
  }>;

  // SPRINT-044B: V3 provider_offers ingestion (OddsAPI + SGO)
  ingestV3ProviderOffers(params: {
    league: string;
    markets?: string[];
  }): Promise<{ success: boolean; inserted: number; updated: number; error?: string }>;
}

// Alert Agent Activities
// Barrel: agents/AlertAgent/activities/index.ts
// SPRINT-035B TD-6: USP detection methods removed (quarantined — not implemented)
export interface AlertAgentActivities {
  // Process alerts
  processAlert(params: ActivityParams): Promise<void>;

  // Evaluate alert conditions
  evaluateConditions(params: ActivityParams): Promise<void>;

  // Send alert notification (renamed from sendNotification in B-4)
  sendAlertNotification(): Promise<void>;

  // Escalate alert
  escalateAlert(params: ActivityParams): Promise<void>;
}

// Grading Agent Activities
// Barrel: agents/GradingAgent/activities/index.ts
export interface GradingAgentActivities {
  gradeNewProps(params: { league: string; isLiveMode: boolean; cycleCount: number }): Promise<{
    league: string;
    topTierProps: any[];
    gradedCount: number;
  }>;

  scoreTopTierPicks(params: { gradedProps: any[]; league: string; cycleCount: number }): Promise<{
    league: string;
    scoredPicks: any[];
    scoreCount: number;
  }>;

  updateUnifiedPicks(params: {
    scoringResults: any[];
    cycleCount: number;
    timestamp: Date;
  }): Promise<void>;

  getNewUnifiedPicks(params: { cycleCount: number }): Promise<any[]>;

  gradeSubmission(params: ActivityParams): Promise<void>;

  gradeProp(params: any): Promise<any>;

  validateGrade(params: any): Promise<any>;

  monitorGrading(params: any): Promise<any>;

  healthCheck(params: any): Promise<any>;

  validateDependencies(params: any): Promise<any>;

  // SPRINT-044D: Closing snapshot capture for CLV analysis
  captureClosingSnapshots(params: {
    lookbackHours?: number;
    closeWindowMinutes?: number;
    maxEvents?: number;
  }): Promise<{ total_events: number; captured: number; failed: number }>;
}

// Notification Agent Activities
// Barrel: agents/NotificationAgent/activities/index.ts
export interface NotificationAgentActivities {
  sendNotification(params: ActivityParams): Promise<void>;
  sendBatchNotifications(params: any[]): Promise<void>;
}

// Operator Agent Activities
// Combined from: activities/operator.ts + agents/OperatorAgent/activities/index.ts
// Worker spread order: mainOperatorActivities (pos 3) then operatorActivities (pos 11)
// OperatorAgent barrel wins on collision for: logUSPError, handleCriticalError, updateLiveGameStatus
// activities/operator.ts wins for: logError, monitorAPIQuota, checkSystemHealth, detectLiveGames, logWorkflowMetrics
export interface OperatorAgentActivities {
  // From agents/OperatorAgent/activities/index.ts (spread last, wins on collision)
  updateLiveGameStatus(params: {
    liveGames: any[];
    totalCount: number;
    leaguesWithLiveGames: string[];
    timestamp?: string | Date;
    agentId?: string;
  }): Promise<{ success: boolean; message: string; data?: any }>;

  logUSPError(params: {
    uspType: string;
    error: string;
    cycleCount?: number;
    timestamp?: string;
    agentId?: string;
  }): Promise<{ success: boolean; message: string }>;

  handleCriticalError(params: {
    errorMessage: string;
    agentId: string;
    timestamp?: string;
  }): Promise<{ success: boolean; message: string }>;

  monitorSystem(): Promise<void>;

  handleAlert(alert: any): Promise<void>;

  performMaintenance(): Promise<void>;

  // From activities/operator.ts (spread first, survives if no collision)
  logError(params: {
    error: string;
    timestamp: string | Date;
    context?: Record<string, unknown>;
    workflow?: string;
    league?: string;
    batchId?: string;
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

// Base Agent Activities
// Barrel: agents/BaseAgent/activities.ts
// Exported functions: initialize, runHealthCheck, collectMetrics, handleCommand, cleanup
// Class implements: healthCheck, collectMetrics, logActivity, initialize
export interface BaseAgentActivities {
  healthCheck(params: ActivityParams): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; status: 'pass' | 'fail'; message?: string }>;
  }>;
  collectMetrics(
    params: ActivityParams
  ): Promise<{ timestamp: Date; metrics: Record<string, number> }>;
  logActivity(params: {
    level: 'info' | 'warn' | 'error';
    message: string;
    metadata?: Record<string, any>;
  }): Promise<void>;
}

// Analytics Agent Activities
// Barrel: agents/AnalyticsAgent/activities/index.ts
export interface AnalyticsAgentActivities {
  runAnalyticsAgent(): Promise<void>;
  runAnalysis(): Promise<{ success: boolean; message: string; data?: any }>;
  performAnalyticsHealthCheck(): Promise<{ success: boolean; message: string; data?: any }>;
}

// Audit Agent Activities
// Barrel: agents/AuditAgent/activities/index.ts
export interface AuditAgentActivities {
  runAudit(params: ActivityParams): Promise<void>;
}

// SPRINT-035A B-12: CampaignAgentActivities and ContestAgentActivities removed (archived)

// Player Enrichment Agent Activities
// Barrel: agents/PlayerEnrichmentAgent/activities/index.ts
export interface PlayerEnrichmentAgentActivities {
  enrichAllPlayers(params: ActivityParams): Promise<void>;
  enrichPlayerById(params: ActivityParams & { playerId: string }): Promise<void>;
  getPlayerHeadshot(params: ActivityParams & { playerName: string; league: string }): Promise<void>;
  getMlbHeadshot(params: ActivityParams & { playerName: string }): Promise<void>;
  getNbaHeadshot(params: ActivityParams & { playerName: string }): Promise<void>;
  getNflHeadshot(params: ActivityParams & { playerName: string }): Promise<void>;
  getNhlHeadshot(params: ActivityParams & { playerName: string }): Promise<void>;
}
