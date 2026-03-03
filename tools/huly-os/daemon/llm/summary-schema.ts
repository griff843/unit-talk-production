// SPRINT-LLM-PROVIDER-INTEGRATION-008: Strict schema for LLM summary validation

import { z } from 'zod';

/**
 * Zod schema for validating LLM-generated summaries.
 * Rejects responses that don't match the expected structure.
 */
export const ReportSummarySchema = z.object({
  summary: z.string().min(1, 'summary must be non-empty'),
  risks: z.array(z.string()),
  suggestedActions: z.array(z.string()),
  priorityItems: z.array(z.string()),
});
