// Base activity parameters
export interface ActivityParams {
  [key: string]: any;
}

// Feed Agent Activities
export interface FeedAgentActivities {
  // Optimal API ingestion
  ingestOptimalProps(params: {
    league: string;
    batchSize: number;
    timeout: number;
  }): Promise<{
    success: boolean;
    batchId: string;
    propCount: number;
    error?: string;
  }>;

  // Unified data ingestion (Elite Dual-API System)
  ingestUnifiedData(params: {
    league: string;
    batchSize: number;
    timeout: number;
  }): Promise<{
    success: boolean;
    batchId: string;
    propCount: number;
    error?: string;
  }>;

  // Fallback ingestion
  ingestFallbackProps(params: {
    league: string;
    provider: 'SGO' | 'OddsAPI';
    timeout: number;
  }): Promise<{
    success: boolean;
    batchId: string;
    propCount: number;
  }>;

  // Live game detection
  getLiveGames(params: { league: string }): Promise<Array<{
    id: string;
    league: string;
    homeTeam: string;
    awayTeam: string;
    startTime: Date;
    status: 'scheduled' | 'live' | 'completed';
    inningPeriod?: string;
  }>>;

  // Data processing
  deduplicateAndNormalize(params: {
    league: string;
    batchId: string;
  }): Promise<void>;

  deduplicateProps(params: {
    batchId: string;
    league: string;
  }): Promise<void>;

  normalizeProps(params: {
    batchId: string;
    league: string;
  }): Promise<void>;

  triggerGrading(params: {
    batchId: string;
    league: string;
    propCount: number;
  }): Promise<void>;

  // Fetch feed data
  fetchFeed(params: ActivityParams): Promise<void>;
}

// Alert Agent Activities
export interface AlertAgentActivities {
  // USP Detection
  detectSteamMovement(params: {
    leagues: string[];
    threshold: number;
    timeWindow: number;
  }): Promise<Array<{
    propId: string;
    league: string;
    oldLine: number;
    newLine: number;
    movement: number;
    timestamp: Date;
  }>>;

  detectLineMovement(params: {
    leagues: string[];
    significantThreshold: number;
    timeWindow: number;
  }): Promise<Array<{
    propId: string;
    league: string;
    movement: number;
    direction: 'up' | 'down';
    timestamp: Date;
  }>>;

  detectHedgeOpportunities(params: {
    leagues: string[];
    minProfitMargin: number;
  }): Promise<Array<{
    propId: string;
    league: string;
    hedgeOpportunity: {
      originalBet: any;
      hedgeBet: any;
      guaranteedProfit: number;
    };
  }>>;

  detectMiddleOpportunities(params: {
    leagues: string[];
    minGap: number;
  }): Promise<Array<{
    propId: string;
    league: string;
    middleOpportunity: {
      lowBet: any;
      highBet: any;
      gap: number;
      winProbability: number;
    };
  }>>;

  detectStaleLines(params: {
    leagues: string[];
    maxAge: number;
  }): Promise<Array<{
    propId: string;
    league: string;
    age: number;
    lastUpdate: Date;
  }>>;

  detectInjuryImpacts(params: {
    leagues: string[];
    sources: string[];
  }): Promise<Array<{
    playerId: string;
    playerName: string;
    league: string;
    injuryType: string;
    severity: 'minor' | 'major' | 'season-ending';
    affectedProps: string[];
    source: string;
  }>>;

  detectSuspiciousActivity(params: {
    leagues: string[];
    patterns: string[];
  }): Promise<Array<{
    propId: string;
    league: string;
    pattern: string;
    confidence: number;
    details: any;
  }>>;

  // Quota and health alerts
  sendQuotaWarning(params: {
    provider: string;
    usagePercent: number;
    remainingCalls: number;
    resetTime: Date;
  }): Promise<void>;

  sendQuotaCritical(params: {
    provider: string;
    usagePercent: number;
    remainingCalls: number;
    resetTime: Date;
  }): Promise<void>;

  sendHealthAlert(params: {
    healthScore: number;
    issues: string[];
    timestamp: Date;
  }): Promise<void>;

  sendWeeklyReport(params: {
    report: any;
    webhook: string;
  }): Promise<void>;

  checkLeagueOpportunities(params: {
    league: string;
    enhanced: boolean;
  }): Promise<void>;

  // Process alerts
  processAlert(params: ActivityParams): Promise<void>;
}

// Grading Agent Activities
export interface GradingAgentActivities {
  // Grading operations
  gradeNewProps(params: {
    league: string;
    isLiveMode: boolean;
    cycleCount: number;
  }): Promise<{
    league: string;
    topTierProps: any[];
    gradedCount: number;
  }>;

  scoreTopTierPicks(params: {
    gradedProps: any[];
    league: string;
    cycleCount: number;
  }): Promise<{
    league: string;
    scoredPicks: any[];
    scoreCount: number;
  }>;

  updateUnifiedPicks(params: {
    scoringResults: any[];
    cycleCount: number;
    timestamp: Date;
  }): Promise<void>;

  getNewUnifiedPicks(params: {
    cycleCount: number;
  }): Promise<any[]>;

  // Grade submission
  gradeSubmission(params: ActivityParams): Promise<void>;
}

// Notification Agent Activities
export interface NotificationAgentActivities {
  // Discord operations
  sendCriticalDiscordAlerts(params: {
    alerts: Array<{
      type: string;
      priority: string;
      data: any;
      timestamp: Date;
    }>;
    cycleCount: number;
  }): Promise<void>;

  batchDiscordAlerts(params: {
    alerts: Array<{
      type: string;
      priority: string;
      data: any;
      timestamp: Date;
    }>;
    cycleCount: number;
  }): Promise<void>;

  buildPickEmbeds(params: {
    picks: any[];
    isLiveMode: boolean;
  }): Promise<Array<{
    embed: any;
    priority: 'critical' | 'high' | 'medium';
  }>>;

  sendDiscordEmbed(params: {
    embed: any;
    webhook: string;
    priority: string;
  }): Promise<void>;

  // Send notification
  sendNotification(params: ActivityParams): Promise<void>;
}

// Operator Agent Activities
export interface OperatorAgentActivities {
  // System monitoring
  updateLiveGameStatus(params: {
    liveGames: any[];
    totalCount: number;
    leaguesWithLiveGames: string[];
    timestamp: Date;
  }): Promise<void>;

  ensureLiveMode(params: {
    reason: string;
    games: any[];
  }): Promise<void>;

  ensureOffPeakMode(params: {
    reason: string;
  }): Promise<void>;

  // API quota management
  checkApiQuota(params: { provider: string }): Promise<{
    provider: string;
    hourlyLimit: number;
    hourlyUsed: number;
    remainingCalls: number;
    resetTime: Date;
    status: 'healthy' | 'warning' | 'critical';
  }>;

  getHourlyApiUsage(params: {
    provider: string;
    hour: number;
  }): Promise<number>;

  activateFallbackMode(params: {
    primary: string;
    fallbacks: string[];
    reason: string;
  }): Promise<void>;

  logQuotaStatus(params: {
    providers: any[];
    timestamp: Date;
  }): Promise<void>;

  // Health monitoring
  checkDatabaseHealth(): Promise<{
    connected: boolean;
    responseTime: number;
    activeConnections: number;
  }>;

  checkApiEndpoints(params: {
    endpoints: string[];
  }): Promise<Array<{
    name: string;
    healthy: boolean;
    responseTime: number;
    error?: string;
  }>>;

  getWorkflowMetrics(params: {
    timeWindow: number;
  }): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    failureRate: number;
    avgExecutionTime: number;
  }>;

  getSystemMetrics(): Promise<{
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkLatency: number;
  }>;

  logHealthStatus(params: {
    healthScore: number;
    dbHealth: any;
    apiHealth: any;
    workflowMetrics: any;
    systemMetrics: any;
    timestamp: Date;
  }): Promise<void>;

  // League and season management
  checkLeagueSeason(params: {
    league: string;
    season: string;
    currentDate: Date;
  }): Promise<boolean>;

  enablePeakMonitoring(params: {
    league: string;
    reason: string;
  }): Promise<void>;

  enableStandardMonitoring(params: {
    league: string;
    reason: string;
  }): Promise<void>;

  // Maintenance operations
  cleanupOldLogs(params: {
    retentionDays: number;
  }): Promise<void>;

  cleanupOldMetrics(params: {
    retentionDays: number;
  }): Promise<void>;

  cleanupOldRawProps(params: {
    retentionDays: number;
  }): Promise<void>;

  optimizeDatabase(): Promise<void>;

  generateDailySummary(params: {
    date: Date;
  }): Promise<void>;

  generateWeeklyReport(params: {
    startDate: Date;
    endDate: Date;
    includeMetrics: string[];
  }): Promise<any>;

  createNotionReport(params: {
    report: any;
    type: string;
  }): Promise<void>;

  // Error handling and logging
  logCriticalAlert(params: {
    type: string;
    message: string;
    timestamp: Date;
  }): Promise<void>;

  handleIngestionFailures(params: {
    failures: any[];
    cycleCount: number;
    timestamp: Date;
  }): Promise<void>;

  logPerformanceWarning(params: {
    cycleTime: number;
    maxCycleTime: number;
    cycleCount: number;
    message: string;
  }): Promise<void>;

  handleCriticalError(params: {
    error: string;
    cycleCount: number;
    timestamp: Date;
    context: string;
  }): Promise<void>;

  logFallbackActivation(params: {
    league: string;
    primaryError: string;
    cycleCount: number;
  }): Promise<void>;

  logUSPError(params: {
    uspType: string;
    error: string;
    cycleCount: number;
  }): Promise<void>;

  logGradingError(params: {
    error: string;
    leagues: string[];
    cycleCount: number;
  }): Promise<void>;

  logDiscordMetrics(params: {
    picksCount: number;
    embedsCount: number;
    cycleCount: number;
    deliveryTime: number;
  }): Promise<void>;

  logDiscordError(params: {
    error: string;
    cycleCount: number;
  }): Promise<void>;

  updateProcessingMetrics(params: {
    league: string;
    batchId: string;
    propCount: number;
    cycleCount: number;
    processingTime: number;
  }): Promise<void>;

  logError(params: {
    workflow?: string;
    league?: string;
    batchId?: string;
    error: string;
    timestamp: Date;
  }): Promise<void>;

  // Monitor system
  monitorSystem(params: ActivityParams): Promise<void>;
}

// Base Agent Activities
export interface BaseAgentActivities {
  // Health check
  healthCheck(params: ActivityParams): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
    }>;
  }>;

  // Metrics collection
  collectMetrics(params: ActivityParams): Promise<{
    timestamp: Date;
    metrics: Record<string, number>;
  }>;

  // Log activity
  logActivity(params: {
    level: 'info' | 'warn' | 'error';
    message: string;
    metadata?: Record<string, any>;
  }): Promise<void>;
}

// Analytics Agent Activities
export interface AnalyticsAgentActivities {
  runAnalysis(params: ActivityParams): Promise<void>;
}

// Audit Agent Activities
export interface AuditAgentActivities {
  runAudit(params: ActivityParams): Promise<void>;
}

// Campaign Agent Activities
export interface CampaignAgentActivities {
  createCampaign(params: ActivityParams): Promise<void>;
}

// Contest Agent Activities
export interface ContestAgentActivities {
  createContest(params: ActivityParams): Promise<void>;
}

// Player Enrichment Agent Activities
export interface PlayerEnrichmentAgentActivities {
  enrichAllPlayers(params: ActivityParams): Promise<void>;
  enrichPlayerById(params: ActivityParams & { playerId: string }): Promise<void>;
  getPlayerHeadshot(params: ActivityParams & { playerName: string; league: string }): Promise<void>;
  getMlbHeadshot(params: ActivityParams & { playerName: string }): Promise<void>;
  getNbaHeadshot(params: ActivityParams & { playerName: string }): Promise<void>;
  getNflHeadshot(params: ActivityParams & { playerName: string }): Promise<void>;
  getNhlHeadshot(params: ActivityParams & { playerName: string }): Promise<void>;
}