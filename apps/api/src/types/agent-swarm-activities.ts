// Agent Swarm Activity Type Definitions

export interface PipelineOrchestratorActivities {
  detectNewProps(params: {
    batchSize: number;
    enableValidation: boolean;
  }): Promise<{
    totalProps: number;
    batches: Array<{
      batchId: string;
      props: any[];
    }>;
  }>;

  schedulePropsForRetry(params: {
    batchId: string;
    props: any[];
    error: string;
  }): Promise<void>;

  getPipelineStatus(): Promise<{
    needsProcessing: boolean;
    queueDepth: number;
    backpressureActive: boolean;
  }>;

  getPerformanceMetrics(): Promise<{
    summary: any;
    averageProcessingTimeMs: number;
    throughputPerMinute: number;
  }>;

  optimizeBatchSize(params: {
    targetProcessingTime: number;
    maxBatchSize: number;
  }): Promise<void>;

  analyzeDataVolume(): Promise<{
    totalProps: number;
    oldProcessedProps: number;
    failedProps: number;
  }>;

  archiveOldProps(params: {
    olderThanDays: number;
    batchSize: number;
  }): Promise<{
    propsArchived: number;
    totalProcessingTimeMs: number;
  }>;

  cleanupFailedProps(params: {
    maxRetryCount: number;
    olderThanHours: number;
  }): Promise<{
    propsCleaned: number;
  }>;

  optimizeDatabaseIndexes(): Promise<void>;
}

export interface ScoringCoordinatorActivities {
  scoreBatch(params: {
    batchId: string;
    props: any[];
    useEnhanced45Factor: boolean;
    parallelProcessing: boolean;
  }): Promise<{
    results: Array<{
      propId: string;
      finalScore: number;
      confidence: number;
      tier: string;
      edgeScore: number;
      kellyFraction: number;
      processed: boolean;
      error?: string;
    }>;
    averageScore: number;
    tierDistribution: Record<string, number>;
  }>;

  getPerformanceMetrics(): Promise<{
    summary: any;
    averageProcessingTimeMs: number;
    throughputPerMinute: number;
    averageScore: number;
    averageConfidence: number;
  }>;

  enableParallelProcessing(params: {
    maxConcurrentBatches: number;
    useEnhanced45Factor: boolean;
  }): Promise<void>;
}

export interface PromotionAgentActivities {
  evaluateAndPromote(params: {
    scoringResults: Array<{
      propId: string;
      finalScore: number;
      confidence: number;
      tier: string;
      edgeScore: number;
      kellyFraction: number;
      processed: boolean;
      error?: string;
    }>;
    applyDiversificationRules: boolean;
    checkDailyQuotas: boolean;
  }): Promise<{
    promoted: any[];
    rejected: any[];
    errors: any[];
    metrics: {
      totalEvaluated: number;
      promotionRate: number;
      averageScore: number;
      processingTimeMs: number;
    };
  }>;

  getPerformanceMetrics(): Promise<{
    summary: any;
    promotionRate: number;
    averageScore: number;
    averageConfidence: number;
  }>;

  adjustPromotionCriteria(params: {
    minScore: number;
    minConfidence: number;
  }): Promise<void>;
}

export interface HealthMonitorActivities {
  performSystemHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    details: {
      checks: Array<{
        service: string;
        status: string;
        error?: string;
        details?: any;
      }>;
    };
  }>;

  checkCircuitBreakers(): Promise<{
    openBreakers: string[];
    totalBreakers: number;
  }>;

  recordBatchProcessing(params: {
    batchId: string;
    processingTimeMs: number;
    propsProcessed: number;
    successfulProps: number;
    errors: number;
  }): Promise<void>;

  sendCriticalAlert(params: {
    alertType: string;
    error?: string;
    metrics?: any;
    [key: string]: any;
  }): Promise<void>;

  sendAlert(params: {
    alertType: string;
    error?: string;
    [key: string]: any;
  }): Promise<void>;

  openCircuitBreaker(params: {
    serviceName: string;
    reason: string;
  }): Promise<void>;

  closeCircuitBreaker(params: {
    serviceName: string;
    reason: string;
  }): Promise<void>;

  attemptServiceRecovery(params: {
    serviceName: string;
    recoveryStrategy: string;
  }): Promise<void>;

  checkServiceHealth(params: {
    serviceName: string;
  }): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: any;
  }>;
}

export interface WorkflowTriggerActivities {
  triggerWorkflow(params: {
    workflowId: string;
    data?: any;
  }): Promise<void>;

  getWorkflowStatus(params: {
    workflowId: string;
  }): Promise<{
    status: string;
    details?: any;
  }>;
}

// Combined type for all agent swarm activities
export type AgentSwarmActivities = 
  & PipelineOrchestratorActivities
  & ScoringCoordinatorActivities
  & PromotionAgentActivities
  & HealthMonitorActivities
  & WorkflowTriggerActivities;