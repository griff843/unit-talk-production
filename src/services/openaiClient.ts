// src/services/openaiClient.ts
//
// Centralised OpenAI client initialisation.
// Wraps the raw OpenAI SDK with our enterprise-grade cost-guard / circuit-breaker.

import { getOpenAICostGuard } from './openaiCostGuard';
import { supabase } from './supabaseClient';
import { logger } from './logging';

/**
 * Singleton CostGuard – enforces token quotas & cost ceilings.
 * The first call initialises underlying tables if persistence is enabled.
 */
const costGuard = getOpenAICostGuard(supabase, logger);

/**
 * Wrapped OpenAI client.
 * All calls go through costGuard which:
 *  1. Tracks token usage & estimated cost
 *  2. Applies daily / weekly circuit-breaker limits
 *  3. Provides transparent fallback logic if quotas are hit
 */
export const openai = costGuard.createClient();

// Re-export helpers for diagnostics (optional)
export const getOpenAIUsageMetrics = () => costGuard.getMetrics();
export const getOpenAICircuitStatus  = () => costGuard.getCircuitStatus();
