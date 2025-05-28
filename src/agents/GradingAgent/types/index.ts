import { z } from 'zod';
import { BaseEventSchema, TimestampedSchema, IdentifiableSchema } from '../../../types/shared';

// --- Core Types ---
export const BetTypeEnum = z.enum(['single', 'parlay', 'teaser', 'roundrobin', 'sgp']);
export type BetType = z.infer<typeof BetTypeEnum>;

export const GradeTierEnum = z.enum(['S', 'A', 'B', 'C', 'D']);
export type GradeTier = z.infer<typeof GradeTierEnum>;

// --- Pick Types ---
export const PickLegSchema = z.object({
  player_name: z.string(),
  line_value: z.number(),
  market_type: z.string(),
  odds: z.number(),
  score: z.number().optional(),
  confidence: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PickLeg = z.infer<typeof PickLegSchema>;

export const PickSchema = IdentifiableSchema.extend({
  player_name: z.string(),
  bet_type: BetTypeEnum,
  is_parlay: z.boolean(),
  is_teaser: z.boolean(),
  is_rr: z.boolean(),
  legs: z.array(PickLegSchema).optional(),
  promoted_to_final: z.boolean(),
  is_valid: z.boolean(),
}).merge(TimestampedSchema).extend({
  promoted_final_at: z.string().datetime().optional(),
});

export type Pick = z.infer<typeof PickSchema>;

// --- Scoring Types ---
export const ScoreComponentSchema = z.object({
  value: z.number(),
  confidence: z.number(),
  factors: z.record(z.number()),
  metadata: z.record(z.unknown()),
});

export const GradeResultSchema = z.object({
  tier: GradeTierEnum,
  score: z.number(),
  confidence: z.number(),
  role_stability: z.number(),
  line_value: z.number(),
  matchup_score: z.number(),
  trend_score: z.number(),
  expected_value: z.number(),
  components: z.record(ScoreComponentSchema),
  metadata: z.record(z.unknown()),
});

export type GradeResult = z.infer<typeof GradeResultSchema>;

// --- Events ---
export const GradingEventSchema = BaseEventSchema.extend({
  type: z.enum([
    'pick_received',
    'grading_started',
    'grading_completed',
    'grading_failed',
    'pick_promoted',
    'pick_rejected'
  ]),
  data: z.object({
    pick: PickSchema,
    result: GradeResultSchema.optional(),
    error: z.string().optional(),
  }),
});

export type GradingEvent = z.infer<typeof GradingEventSchema>;

// --- Configuration ---
export const GradingThresholdsSchema = z.object({
  S: z.number(),
  A: z.number(),
  B: z.number(),
  C: z.number(),
  D: z.number(),
});

export const GradingAgentConfigSchema = z.object({
  thresholds: GradingThresholdsSchema,
  confidenceMinimum: z.number(),
  roleStabilityWeight: z.number(),
  lineValueWeight: z.number(),
  matchupWeight: z.number(),
  trendWeight: z.number(),
  expectedValueWeight: z.number(),
  rules: z.record(z.object({
    enabled: z.boolean(),
    weight: z.number(),
    threshold: z.number(),
  })),
});

export type GradingAgentConfig = z.infer<typeof GradingAgentConfigSchema>;

// --- Validation Functions ---
export function validatePick(data: unknown): Pick {
  return PickSchema.parse(data);
}

export function validateGradeResult(data: unknown): GradeResult {
  return GradeResultSchema.parse(data);
}

export function validateGradingEvent(data: unknown): GradingEvent {
  return GradingEventSchema.parse(data);
}

export function validateGradingConfig(data: unknown): GradingAgentConfig {
  return GradingAgentConfigSchema.parse(data);
} 