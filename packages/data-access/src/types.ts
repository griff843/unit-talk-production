/**
 * Data Access Layer Types
 * SPRINT-REPO-TRUTH-LOCK-002
 *
 * Configuration types for the canonical Supabase client factory.
 */

/** Client operating mode */
export type ClientMode = 'service_role' | 'anon' | 'user';

/** Configuration for creating a Supabase client */
export interface SupabaseClientConfig {
  /** Supabase project URL */
  url: string;
  /** Supabase key (service role, anon, or user JWT) */
  key: string;
  /** Client operating mode — determines access level */
  mode: ClientMode;
  /** Optional schema (defaults to 'public') */
  schema?: string;
  /** Optional: enable realtime subscriptions */
  realtime?: boolean;
}
