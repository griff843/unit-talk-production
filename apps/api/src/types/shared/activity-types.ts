import { z } from 'zod';

export interface Game {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: string;
  league: string;
}

export interface Prop {
  id: string;
  gameId: string;
  playerId: string;
  propType: string;
  line: number;
  overOdds: number;
  underOdds: number;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: string;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  timestamp: string;
}

export interface ApiHealth {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  timestamp: string;
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectionCount: number;
  queryLatency: number;
  errorRate: number;
  timestamp: string;
}

export interface WorkflowMetrics {
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  duration: number;
  startTime: string;
  endTime?: string;
  error?: string;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
}

export interface Report {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// --- Validation Schemas ---
export const GameSchema = z.object({
  id: z.string(),
  league: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  startTime: z.string(),
  status: z.enum(['scheduled', 'live', 'completed']),
  inningPeriod: z.string().optional(),
  score: z.object({
    home: z.number(),
    away: z.number()
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.string(),
  position: z.string(),
  league: z.string(),
  status: z.enum(['active', 'injured', 'suspended', 'inactive']),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const PropSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  team: z.string(),
  opponent: z.string(),
  market: z.string(),
  line: z.number(),
  over: z.number(),
  under: z.number(),
  marketType: z.string(),
  gameTime: z.string(),
  league: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const AlertSchema = z.object({
  id: z.string(),
  type: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  message: z.string(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string()
});

export const MetricDataSchema = z.object({
  name: z.string(),
  value: z.number(),
  tags: z.record(z.string(), z.string()).optional(),
  timestamp: z.string()
});

export const HealthCheckSchema = z.object({
  name: z.string(),
  status: z.enum(['pass', 'fail']),
  message: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string()
});

export const SystemMetricsSchema = z.object({
  memoryUsage: z.number(),
  cpuUsage: z.number(),
  diskUsage: z.number(),
  networkLatency: z.number(),
  timestamp: z.string()
});

export const ApiHealthSchema = z.object({
  name: z.string(),
  healthy: z.boolean(),
  responseTime: z.number(),
  error: z.string().optional(),
  timestamp: z.string()
});

export const DatabaseHealthSchema = z.object({
  connected: z.boolean(),
  responseTime: z.number(),
  activeConnections: z.number(),
  timestamp: z.string()
});

export const WorkflowMetricsSchema = z.object({
  totalExecutions: z.number(),
  successfulExecutions: z.number(),
  failedExecutions: z.number(),
  failureRate: z.number(),
  avgExecutionTime: z.number(),
  timestamp: z.string()
});

export const DiscordEmbedSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  color: z.number().optional(),
  fields: z.array(z.object({
    name: z.string(),
    value: z.string(),
    inline: z.boolean().optional()
  })).optional(),
  footer: z.object({
    text: z.string(),
    icon_url: z.string().optional()
  }).optional(),
  timestamp: z.string().optional(),
  thumbnail: z.object({
    url: z.string()
  }).optional(),
  image: z.object({
    url: z.string()
  }).optional()
});

export const ReportSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
  startDate: z.string(),
  endDate: z.string(),
  metrics: z.array(z.string()),
  timestamp: z.string()
}); 