/**
 * SPRINT-DATABASE-TYPE-CENTRALIZATION-003: Smart Form Database Types
 *
 * Canonical database types are imported from @unit-talk/shared-types.
 * App-specific extensions and additional tables are defined here.
 *
 * RULE: Do NOT redefine canonical table Row types (unified_picks, bridge_outbox, etc.)
 *       Import them from @unit-talk/shared-types instead.
 */

// Import canonical types from shared-types
import type {
  Database as CanonicalDatabase,
  Json as CanonicalJson,
  Tables,
  TablesInsert,
  TablesUpdate,
  UnifiedPicksRow,
  BridgeOutboxRow,
  UsersRow,
  CappersRow,
  TeamsRow,
  PlayersRow,
  GamesRow,
  RawPropsRow,
  SmartTicketsRow,
} from '@unit-talk/shared-types';

// Re-export canonical types for backwards compatibility
export type {
  Tables,
  TablesInsert,
  TablesUpdate,
  UnifiedPicksRow,
  BridgeOutboxRow,
  UsersRow,
  CappersRow,
  TeamsRow,
  PlayersRow,
  GamesRow,
  RawPropsRow,
  SmartTicketsRow,
};

// Re-export Json type
export type Json = CanonicalJson;

// =============================================================================
// APP-SPECIFIC EXTENDED TYPES
// These extend the canonical schema with smart-form-specific fields.
// =============================================================================

/**
 * Extended Database interface for Smart Form
 *
 * This extends the canonical database with additional tables and fields
 * specific to the Smart Form application.
 */
export interface Database {
  public: {
    Tables: CanonicalDatabase['public']['Tables'] & {
      // Additional smart-form specific table: tickets
      tickets: {
        Row: {
          id: string;
          capper_id: string;
          ticket_type: string;
          unit_size: number;
          risk_amount: number;
          potential_payout: number;
          odds_format: string;
          auto_parlay: boolean;
          sport: string;
          game_date: string;
          confidence_level: number;
          user_tier: string;
          status: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          capper_id: string;
          ticket_type: string;
          unit_size: number;
          risk_amount: number;
          potential_payout: number;
          odds_format: string;
          auto_parlay: boolean;
          sport: string;
          game_date: string;
          confidence_level: number;
          user_tier: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          capper_id?: string;
          ticket_type?: string;
          unit_size?: number;
          risk_amount?: number;
          potential_payout?: number;
          odds_format?: string;
          auto_parlay?: boolean;
          sport?: string;
          game_date?: string;
          confidence_level?: number;
          user_tier?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    // SPRINT-RUNTIME-TRUTH-008: Extend Views from canonical database
    Views: CanonicalDatabase['public']['Views'];
    Functions: {
      // SPRINT-RUNTIME-TRUTH-008: Add RPC function types for typed client
      get_active_cappers: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          display_name: string;
          username: string | null;
          external_id: string | null;
        }[];
      };
      sync_cappers_from_users: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
