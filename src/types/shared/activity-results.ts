import { z } from 'zod';

export interface ActivityResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  timestamp?: string;
  duration?: number;
}

export interface HealthCheckResult extends ActivityResult<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  healthScore: number;
  components: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
  }>;
  timestamp: string;
}> {}

export interface ApiQuotaResult extends ActivityResult<{
  provider: string;
  remainingQuota: number;
  resetTime: string;
  status: 'healthy' | 'warning' | 'critical';
}> {}

export interface MaintenanceResult extends ActivityResult<{
  operation: string;
  itemsProcessed: number;
  duration: number;
  timestamp: string;
}> {}

export interface PlayerEnrichmentResult extends ActivityResult<{
  playerId: string;
  enrichedFields: string[];
  timestamp: string;
}> {}

export interface HeadshotResult extends ActivityResult<{
  playerId: string;
  url: string;
  timestamp: string;
}> {}

export interface FeedIngestionResult extends ActivityResult<{
  feedId: string;
  itemsIngested: number;
  newItems: number;
  updatedItems: number;
  timestamp: string;
}> {}

export interface GradingResult extends ActivityResult<{
  propId: string;
  grade: string;
  confidence: number;
  features: Record<string, number>;
  timestamp: string;
}> {}

export interface AlertResult extends ActivityResult<{
  alertId: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  channels: string[];
  timestamp: string;
}> {}

// Zod schemas for validation
export const HealthCheckResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    healthScore: z.number(),
    components: z.array(z.object({
      name: z.string(),
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      message: z.string().optional()
    })),
    timestamp: z.string()
  }),
  error: z.instanceof(Error).optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional()
});

export const ApiQuotaResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    provider: z.string(),
    remainingQuota: z.number(),
    resetTime: z.string(),
    status: z.enum(['healthy', 'warning', 'critical'])
  }),
  error: z.instanceof(Error).optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional()
});

export const MaintenanceResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    operation: z.string(),
    itemsProcessed: z.number(),
    duration: z.number(),
    timestamp: z.string()
  }),
  error: z.instanceof(Error).optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional()
});

export const PlayerEnrichmentResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    playerId: z.string(),
    enrichedFields: z.array(z.string()),
    timestamp: z.string()
  }),
  error: z.instanceof(Error).optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional()
});

export const HeadshotResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    playerId: z.string(),
    url: z.string().url(),
    timestamp: z.string()
  }),
  error: z.instanceof(Error).optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional()
});

export const FeedIngestionResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    feedId: z.string(),
    itemsIngested: z.number(),
    newItems: z.number(),
    updatedItems: z.number(),
    timestamp: z.string()
  }),
  error: z.instanceof(Error).optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional()
});

export const GradingResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    propId: z.string(),
    grade: z.string(),
    confidence: z.number(),
    features: z.record(z.number()),
    timestamp: z.string()
  }),
  error: z.instanceof(Error).optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional()
});

export const AlertResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    alertId: z.string(),
    type: z.string(),
    severity: z.enum(['info', 'warning', 'error', 'critical']),
    channels: z.array(z.string()),
    timestamp: z.string()
  }),
  error: z.instanceof(Error).optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional()
}); 