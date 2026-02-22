/**
 * Database types index - merges generated types with extensions
 *
 * SPRINT-SUPABASE-TYPE-SAFETY-LOCK-106A
 */

import type { Database as GeneratedDatabase, Json } from './database';
import type { DatabaseExtensions } from './database-extensions';

// Re-export Json type
export type { Json };

// Merge generated tables with extension tables
type MergedTables = GeneratedDatabase['public']['Tables'] & DatabaseExtensions['public']['Tables'];

// Merge generated views with extension views
type MergedViews = GeneratedDatabase['public']['Views'] & DatabaseExtensions['public']['Views'];

// Merge generated functions with extension functions
type MergedFunctions = GeneratedDatabase['public']['Functions'] &
  DatabaseExtensions['public']['Functions'];

// Merge generated enums with extension enums
type MergedEnums = GeneratedDatabase['public']['Enums'] & DatabaseExtensions['public']['Enums'];

/**
 * Merged Database type combining generated schema with extensions
 */
export interface Database {
  public: {
    Tables: MergedTables;
    Views: MergedViews;
    Functions: MergedFunctions;
    Enums: MergedEnums;
  };
}

// Type helpers
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Insertable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type Updatable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Convenience type exports for common tables
export type User = Tables<'users'>;
export type UnifiedPick = Tables<'unified_picks'>;
export type AgentHealth = Tables<'agent_health'>;
export type AgentMetrics = Tables<'agent_metrics'>;
export type AuditLog = Tables<'audit_log'>;
export type AutopilotDecision = Tables<'autopilot_decisions'>;
