/**
 * @unit-talk/data-access
 *
 * Database access layer for Unit Talk Platform.
 *
 * SPRINT-REPO-TRUTH-LOCK-002: Populated with Supabase client factory.
 * SPRINT-REPO-ARCHITECTURE-NORMALIZATION-001: Shell created for Blueprint v2 alignment.
 *
 * Provides the canonical createSupabaseClientFromConfig() factory.
 * Apps should migrate from direct @supabase/supabase-js usage to this package.
 */

export { createSupabaseClientFromConfig } from './client';
export { type SupabaseClientConfig, type ClientMode } from './types';

// Re-export SupabaseClient type for convenience
export { type SupabaseClient } from '@supabase/supabase-js';
