/**
 * Database type override to prevent TypeScript 'never' type issues
 * This file provides more flexible types for Supabase operations
 */

import type { Database as GeneratedDatabase } from '../db/types/supabase';

// Override the generated types to be more flexible
export interface Database extends GeneratedDatabase {
  public: {
    Tables: {
      [K in keyof GeneratedDatabase['public']['Tables']]: {
        Row: any; // More flexible row type
        Insert: any; // More flexible insert type
        Update: any; // More flexible update type
      };
    };
    Views: GeneratedDatabase['public']['Views'];
    Functions: GeneratedDatabase['public']['Functions'];
    Enums: GeneratedDatabase['public']['Enums'];
  };
}

// Export commonly used table types with flexibility
export type RawPropsRow = any;
export type RawPropsInsert = any;
export type RawPropsUpdate = any;

export type AnalyticsEventsRow = any;
export type AnalyticsEventsInsert = any;
export type AnalyticsEventsUpdate = any;

export type GamesRow = any;
export type GamesInsert = any;
export type GamesUpdate = any;

export type UnifiedPicksRow = any;
export type UnifiedPicksInsert = any;
export type UnifiedPicksUpdate = any;

// Re-export the original types for reference
export type { Database as OriginalDatabase } from '../db/types/supabase';