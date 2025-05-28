import { z } from 'zod';
import { DatabaseError, ValidationError } from '../../utils/errorHandling';

// --- Validation Result Types ---
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// --- Generic Validation Functions ---
export async function validateOrThrow<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string
): Promise<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Validation failed${context ? ` for ${context}` : ''}`,
        {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        }
      );
    }
    throw error;
  }
}

// --- Database Model Validation ---
export const DatabaseModelSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
});

export async function validateDatabaseModel<T extends z.ZodType>(
  schema: T,
  data: unknown
): Promise<z.infer<T>> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DatabaseError('Database model validation failed', {
        errors: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    throw error;
  }
}

// --- Configuration Validation ---
export const BaseConfigSchema = z.object({
  enabled: z.boolean(),
  version: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});

// --- API Validation ---
export const PaginationSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

// --- Event Validation ---
export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  source: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

// --- Metric Validation ---
export const MetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  labels: z.record(z.string()).optional(),
  timestamp: z.string().datetime(),
});

// --- Alert Validation ---
export const AlertSchema = z.object({
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  message: z.string(),
  source: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
  channels: z.array(z.enum(['email', 'slack', 'discord', 'pagerduty'])),
}); 