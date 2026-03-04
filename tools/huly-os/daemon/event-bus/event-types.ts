// SPRINT-EVENT-BUS-011: Event type definitions and Zod validation
// Shared union type for all event bus events.

import { z } from 'zod';

export const EVENT_TYPES = [
  'repo.push',
  'repo.pr_opened',
  'ci.workflow_failed',
  'operator.tick',
  'drift.warning_threshold_exceeded',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_SOURCES = ['github', 'ci', 'operator', 'manual'] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const SEVERITY_LEVELS = ['low', 'med', 'high'] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

export const BusEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(EVENT_TYPES),
  ts: z.string().datetime(),
  source: z.enum(EVENT_SOURCES),
  payload: z.record(z.unknown()),
  dedupeKey: z.string().optional(),
  severity: z.enum(SEVERITY_LEVELS).optional(),
});

export type BusEvent = z.infer<typeof BusEventSchema>;
