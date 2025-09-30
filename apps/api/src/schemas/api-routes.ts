import { z } from 'zod';

// Common validation schemas
export const commonSchemas = {
  id: z.string().uuid('Invalid ID format'),
  positiveNumber: z.number().positive('Must be a positive number'),
  nonEmptyString: z.string().min(1, 'Cannot be empty'),
  optionalString: z.string().optional(),
  dateString: z.string().datetime('Invalid date format'),
  sport: z.enum(['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'WNBA']),
  pickType: z.enum(['single', 'parlay', 'system', 'teaser']),
  pickSource: z.enum(['manual', 'promoted', 'events', 'bridge_outbox']),
  workflowStage: z.enum(['ingested', 'validated', 'graded', 'pending_review', 'promoted', 'settled']),
  pickStatus: z.enum(['pending', 'won', 'lost', 'push', 'void', 'cancelled']),
  tier: z.enum(['S', 'A', 'B', 'C', 'D']),
  userRole: z.enum(['member', 'trial', 'vip', 'vip_plus', 'capper', 'staff', 'admin', 'owner', 'operator']),
  book: z.enum(['fanduel', 'draftkings', 'betmgm', 'caesars', 'pointsbet', 'barstool', 'unibet']),
};

// === Ingestion Watchlist Schemas ===
export const watchlistConfigSchema = z.object({
  body: z.object({
    sports: z.array(commonSchemas.sport).min(1, 'At least one sport required'),
    books: z.array(commonSchemas.book).min(1, 'At least one book required'),
    rateLimit: z.object({
      requestsPerMinute: z.number().int().min(1).max(100),
      burstLimit: z.number().int().min(1).max(500),
      cooldownSeconds: z.number().int().min(0).max(3600),
    }),
    filters: z.object({
      minOdds: z.number().optional(),
      maxOdds: z.number().optional(),
      excludeParlays: z.boolean().default(false),
      includeAltLines: z.boolean().default(true),
    }).optional(),
    enabled: z.boolean().default(true),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
  }),
});

export const watchlistQuerySchema = z.object({
  query: z.object({
    sport: commonSchemas.sport.optional(),
    book: commonSchemas.book.optional(),
    enabled: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  }),
});

// === Settlement Schemas ===
export const settlementRunSchema = z.object({
  body: z.object({
    gameId: commonSchemas.id.optional(),
    sport: commonSchemas.sport.optional(),
    forceRegrade: z.boolean().default(false),
    dryRun: z.boolean().default(false),
    batchSize: z.number().int().min(1).max(1000).default(100),
  }),
});

export const settlementStatusSchema = z.object({
  params: z.object({
    runId: commonSchemas.id,
  }),
});

// === Credit Usage Schemas ===
export const creditUsageQuerySchema = z.object({
  query: z.object({
    provider: z.enum(['optimal', 'odds-api', 'espn']).optional(),
    startDate: commonSchemas.dateString.optional(),
    endDate: commonSchemas.dateString.optional(),
    granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  }),
});

export const creditBudgetUpdateSchema = z.object({
  body: z.object({
    provider: z.enum(['optimal', 'odds-api', 'espn']),
    monthlyBudget: z.number().positive(),
    alertThresholds: z.object({
      warning: z.number().min(0).max(1), // 0.8 = 80%
      critical: z.number().min(0).max(1), // 0.9 = 90%
    }),
    overagePolicy: z.enum(['stop', 'continue', 'throttle']),
  }),
});

// === Alert Replay Schemas ===
export const alertReplaySchema = z.object({
  body: z.object({
    alertId: commonSchemas.id.optional(),
    pickId: commonSchemas.id.optional(),
    userId: commonSchemas.id.optional(),
    type: z.enum(['injury', 'line_movement', 'steam', 'middle', 'arbitrage', 'clv_alert']).optional(),
    timeRange: z.object({
      start: commonSchemas.dateString,
      end: commonSchemas.dateString,
    }).optional(),
    filters: z.object({
      sport: commonSchemas.sport.optional(),
      minSeverity: z.enum(['low', 'medium', 'high']).optional(),
      channel: z.enum(['discord', 'email', 'sms', 'webhook']).optional(),
    }).optional(),
    dryRun: z.boolean().default(true),
  }),
});

// === Cache Metrics Schemas ===
export const cacheMetricsQuerySchema = z.object({
  query: z.object({
    namespace: z.string().optional(),
    timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
    includeDetails: z.enum(['true', 'false']).transform(val => val === 'true').default(false),
  }),
});

export const cacheInvalidateSchema = z.object({
  body: z.object({
    namespaces: z.array(z.string()).min(1),
    pattern: z.string().optional(),
    confirm: z.boolean().default(false),
  }),
});

// === Unified Picks Schemas ===
export const unifiedPickCreateSchema = z.object({
  body: z.object({
    userId: commonSchemas.id,
    propId: commonSchemas.id.optional(),
    gameId: commonSchemas.id.optional(),
    pickSource: commonSchemas.pickSource.default('manual'),
    pickType: commonSchemas.pickType,
    outcome: commonSchemas.nonEmptyString,
    line: z.number().optional(),
    odds: z.number().optional(),
    stake: z.number().positive().optional(),
    confidence: z.number().min(0).max(10).optional(),
    analysis: z.string().max(2000).optional(),
    groupKey: z.string().optional(),
    isInstant: z.boolean().default(false),
  }),
});

export const unifiedPickUpdateSchema = z.object({
  params: z.object({
    id: commonSchemas.id,
  }),
  body: z.object({
    workflowStage: commonSchemas.workflowStage.optional(),
    status: commonSchemas.pickStatus.optional(),
    published: z.boolean().optional(),
    tierWhenPlaced: commonSchemas.tier.optional(),
    analysis: z.string().max(2000).optional(),
    confidence: z.number().min(0).max(10).optional(),
    clvTrackingId: commonSchemas.id.optional(),
  }),
});

export const unifiedPickQuerySchema = z.object({
  query: z.object({
    userId: commonSchemas.id.optional(),
    pickType: commonSchemas.pickType.optional(),
    workflowStage: commonSchemas.workflowStage.optional(),
    status: commonSchemas.pickStatus.optional(),
    published: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
    sport: commonSchemas.sport.optional(),
    startDate: commonSchemas.dateString.optional(),
    endDate: commonSchemas.dateString.optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100').default(25),
    sortBy: z.enum(['placedAt', 'updatedAt', 'confidence', 'odds']).default('placedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const unifiedPickBatchSchema = z.object({
  body: z.object({
    operation: z.enum(['update_status', 'bulk_delete', 'bulk_publish']),
    pickIds: z.array(commonSchemas.id).min(1).max(100),
    updateData: z.object({
      status: commonSchemas.pickStatus.optional(),
      workflowStage: commonSchemas.workflowStage.optional(),
      published: z.boolean().optional(),
    }).optional(),
  }),
});

// === Feature Flags Schemas ===
export const featureFlagSchema = z.object({
  body: z.object({
    name: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid flag name format'),
    description: z.string().max(500),
    enabled: z.boolean().default(false),
    rolloutPercentage: z.number().min(0).max(100).default(0),
    conditions: z.object({
      userTiers: z.array(commonSchemas.tier).optional(),
      sports: z.array(commonSchemas.sport).optional(),
      environments: z.array(z.enum(['development', 'staging', 'production'])).optional(),
    }).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const featureFlagUpdateSchema = z.object({
  params: z.object({
    name: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  }),
  body: z.object({
    enabled: z.boolean().optional(),
    rolloutPercentage: z.number().min(0).max(100).optional(),
    conditions: z.object({
      userTiers: z.array(commonSchemas.tier).optional(),
      sports: z.array(commonSchemas.sport).optional(),
      environments: z.array(z.enum(['development', 'staging', 'production'])).optional(),
    }).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

export const featureFlagEvaluateSchema = z.object({
  body: z.object({
    userId: commonSchemas.id,
    userTier: commonSchemas.tier,
    sport: commonSchemas.sport.optional(),
    environment: z.enum(['development', 'staging', 'production']),
    flags: z.array(z.string()).min(1),
  }),
});

// === Shadow Mode Schemas ===
export const shadowModeConfigSchema = z.object({
  body: z.object({
    enabled: z.boolean(),
    trafficPercentage: z.number().min(0).max(100),
    components: z.array(z.enum(['grading', 'alerts', 'settlement', 'feed_agent'])),
    invariants: z.object({
      maxLatencyMs: z.number().positive().default(5000),
      maxMemoryMb: z.number().positive().default(1024),
      maxErrorRate: z.number().min(0).max(1).default(0.05),
    }),
    monitoring: z.object({
      enableDetailedLogs: z.boolean().default(false),
      enableMetrics: z.boolean().default(true),
      enableAlerts: z.boolean().default(true),
    }),
  }),
});

export const shadowModeReportSchema = z.object({
  query: z.object({
    component: z.enum(['grading', 'alerts', 'settlement', 'feed_agent']).optional(),
    startDate: commonSchemas.dateString.optional(),
    endDate: commonSchemas.dateString.optional(),
    includeDetails: z.enum(['true', 'false']).transform(val => val === 'true').default(false),
  }),
});

// === Audit Logging Schema ===
export const auditLogQuerySchema = z.object({
  query: z.object({
    action: z.string().optional(),
    userId: commonSchemas.id.optional(),
    resourceType: z.enum(['pick', 'user', 'feature_flag', 'settlement', 'cache']).optional(),
    resourceId: commonSchemas.id.optional(),
    startDate: commonSchemas.dateString.optional(),
    endDate: commonSchemas.dateString.optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100').default(25),
  }),
});

// === Error Response Schema ===
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string(),
  })).optional(),
  correlationId: z.string().optional(),
  timestamp: z.string().datetime(),
});

// === Success Response Schemas ===
export const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  meta: z.object({
    total: z.number().optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
    hasNextPage: z.boolean().optional(),
  }).optional(),
  correlationId: z.string().optional(),
  timestamp: z.string().datetime(),
});

// Export all schemas organized by route group
export const routeSchemas = {
  ingestion: {
    watchlistConfig: watchlistConfigSchema,
    watchlistQuery: watchlistQuerySchema,
  },
  settlement: {
    run: settlementRunSchema,
    status: settlementStatusSchema,
  },
  ops: {
    creditUsageQuery: creditUsageQuerySchema,
    creditBudgetUpdate: creditBudgetUpdateSchema,
  },
  alerts: {
    replay: alertReplaySchema,
  },
  cache: {
    metricsQuery: cacheMetricsQuerySchema,
    invalidate: cacheInvalidateSchema,
  },
  unifiedPicks: {
    create: unifiedPickCreateSchema,
    update: unifiedPickUpdateSchema,
    query: unifiedPickQuerySchema,
    batch: unifiedPickBatchSchema,
  },
  featureFlags: {
    create: featureFlagSchema,
    update: featureFlagUpdateSchema,
    evaluate: featureFlagEvaluateSchema,
  },
  shadowMode: {
    config: shadowModeConfigSchema,
    report: shadowModeReportSchema,
  },
  audit: {
    query: auditLogQuerySchema,
  },
};

export default routeSchemas;