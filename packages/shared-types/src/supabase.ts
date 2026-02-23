/* eslint-disable max-lines -- Type definition file, comprehensive DB schema types */
/**
 * Supabase Database Types
 *
 * SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Canonical types for all apps.
 * All apps MUST import from @unit-talk/shared-types.
 *
 * NOTE: In production with Supabase CLI access, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > packages/shared-types/src/supabase.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ============================================================================
// CANONICAL ROW TYPES
// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: All apps MUST import these types.
// DO NOT redefine these interfaces in apps/** - use @unit-talk/shared-types.
// ============================================================================

/**
 * UnifiedPick - Core business entity for all picks across the platform
 */
export interface UnifiedPicksRow {
  id: string;
  created_at: string;
  updated_at: string;
  // Core pick fields
  player_name: string | null;
  sport: string | null;
  league?: string | null; // SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Sport league
  stat_type: string | null;
  line: number | null;
  odds: number | null;
  direction: string | null;
  capper: string | null;
  tier: string | null;
  // Workflow fields
  posted_to_discord: boolean;
  settlement_status: string | null;
  lifecycle_stage: string | null;
  bet_slip_id: string | null;
  ticket_type: string | null;
  // Extended fields
  user_id?: string;
  selection?: string | null;
  confidence?: number | null;
  team_id?: string | null;
  player_id?: string | null;
  game_id?: string | null;
  bet_type?: string | null;
  side?: string | null;
  source?: string | null;
  is_live?: boolean | null;
  discord_message_id?: string | null;
  settlement_result?: string | null;
  result?: string | null; // SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Alias for settlement_result
  // Analytics fields
  edge_score?: number | null;
  play_status?: string | null;
  outcome?: 'win' | 'loss' | 'push' | 'pending' | null;
  units?: number | null;
  // Professional grading
  professional_score?: number | null;
  devigged_win_prob?: number | null;
  devigged_edge?: number | null;
  clv_pct?: number | null;
  kelly_fraction?: number | null;
  // Metadata
  meta: Record<string, unknown> | null;
}

/**
 * BridgeOutbox - Event queue for cross-service communication
 */
export interface BridgeOutboxRow {
  id: string;
  created_at: string;
  updated_at: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  processed_at: string | null;
  bet_slip_id?: string;
  retry_count?: number;
}

/**
 * AgentHealth - System monitoring for agents
 */
export interface AgentHealthRow {
  id: string;
  created_at: string;
  updated_at: string;
  agent_name: string;
  agent?: string; // Alias for agent_name
  status: string;
  last_heartbeat: string;
  metadata: Record<string, unknown> | null;
  details?: Json | null;
}

/**
 * PropSettlements - Settlement records for props
 */
export interface PropSettlementsRow {
  id: string;
  created_at: string;
  updated_at: string;
  pick_id?: string;
  result?: string;
  settled_at?: string;
  actual_value?: number | null;
}

/**
 * Users - User accounts
 */
export interface UsersRow {
  id: string;
  created_at: string;
  updated_at: string;
  username: string;
  tier: string | null;
  discord_id: string | null;
  active: boolean;
  status?: string;
  last_active?: string;
}

/**
 * RawProps - Raw prop data from feeds
 * SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Extended with transformation fields
 */
export interface RawPropsRow {
  id: string;
  created_at?: string; // Optional during transformation
  updated_at?: string; // Optional during transformation
  game_id?: string | null;
  player_id?: string | null;
  team_id?: string | null;
  player_name?: string | null;
  team?: string | null;
  opponent?: string | null;
  stat_type?: string; // Optional during transformation
  prop_type?: string | null;
  market_type?: string; // Optional during transformation
  market?: string | null; // Alias for market_type
  line?: number | null;
  odds?: number | null;
  over_odds?: number | null;
  under_odds?: number | null;
  over?: number | null; // Alias for over_odds
  under?: number | null; // Alias for under_odds
  confidence?: number | null;
  expected_value?: number | null;
  provider?: string | null;
  sport?: string | null;
  sport_key?: string | null; // Sport identifier key
  game_time?: string | null;
  status?: string; // Optional during transformation
  external_id?: string;
  external_game_id?: string | null; // Game reference
  source?: string | null;
  bookmaker?: string | null;
  book?: string | null; // Alias for bookmaker
  league?: string | null;
  scraped_at?: string;
  promoted?: boolean;
  is_valid?: boolean;
  // Feed transformation fields
  name?: string | null; // Player/team name alias
  home_team?: string | null;
  away_team?: string | null;
  game_date?: string | null;
  outcome?: string | null; // Raw outcome data
  outcomes?: Json | null; // Multiple outcomes
  matchup?: string | null;
  // Analytics/scoring fields used in feed processing
  trend_confidence?: number | null;
  matchup_quality?: number | null;
  line_value_score?: number | null;
  role_stability?: number | null;
  confidence_score?: number | null;
  edge_score?: number | null;
  tier_tag?: string | null;
  auto_approved?: boolean | null;
  context_flag?: boolean | null;
  promoted_to_picks?: boolean | null;
  promoted_at?: string | null;
  is_promoted?: boolean | null;
  player_slug?: string | null;
  bet_type?: string | null;
  fair_odds?: number | null; // Calculated fair odds
  start_time?: string | null; // Game start time
  // Team reference IDs
  home_team_id?: string | null;
  away_team_id?: string | null;
  // Betting/scoring fields
  unit_size?: number | null;
  tier?: string | null;
  ev_percent?: number | null;
  trend_score?: number | null;
  matchup_score?: number | null;
  line_score?: number | null;
  role_score?: number | null;
  direction?: string | null;
  // Identifiers
  unique_key?: string | null;
  event_id?: string | null;
  // Flags
  is_alt_line?: boolean | null;
  is_primary?: boolean | null;
}

/**
 * Games - Game/match data
 */
export interface GamesRow {
  id: string;
  created_at: string;
  updated_at: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  home_team_id?: string;
  away_team_id?: string;
  game_date: string;
  start_time: string | null;
  game_time?: string | null;
  commence_time?: string | null;
  status: string;
  external_game_id: string | null;
  matchup?: string | null;
  meta: Record<string, unknown> | null;
  // Market data
  moneyline_home?: number | null;
  moneyline_away?: number | null;
  spread?: number | null;
  total?: number | null;
  spread_odds?: number | null;
  total_over_odds?: number | null;
  total_under_odds?: number | null;
}

/**
 * Players - Player data
 */
export interface PlayersRow {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  team_id: string;
  sport: string;
  position: string;
  active: boolean;
  league?: string;
  image_url?: string | null;
  injury_status?: string | null;
}

/**
 * ClosingSnapshots - Line movement snapshots
 */
export interface ClosingSnapshotsRow {
  id: string;
  created_at: string;
  updated_at: string;
  pick_id?: string;
  closing_line?: number;
  opening_line?: number;
}

/**
 * AuditLog - Audit trail
 */
export interface AuditLogRow {
  id: string;
  created_at: string;
  updated_at: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  details?: Record<string, unknown> | null;
}

/**
 * Cappers - Capper profiles
 */
export interface CappersRow {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  active: boolean;
  handle?: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  tier?: string | null;
  trust_level?: string | null;
  discord_user_id?: string | null;
  status?: string | null;
  default_thread_id?: string;
  picks_thread_id?: string | null;
  stats?: {
    winRate?: number;
    roi?: number;
    lastPick?: string;
    isLive?: boolean;
  } | null;
}

/**
 * DailyPicks - Deprecated daily picks table
 */
export interface DailyPicksRow {
  id: string;
  created_at: string;
  updated_at: string;
}

/**
 * SmartTickets - Smart form tickets
 */
export interface SmartTicketsRow {
  id: string;
  created_at: string;
  updated_at: string;
  bet_slip_id: string;
  capper_id: string;
  sport: string;
  ticket_type: string;
  game_selections: Json;
  parlay_odds?: number | null;
  total_units: number;
  status: string;
  selection_count: number;
  notes?: string | null;
}

/**
 * Teams - Team data
 */
export interface TeamsRow {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  sport: string;
  abbreviation: string;
  active: boolean;
  league?: string;
  logo_url?: string | null;
}

/**
 * UserProfiles - Extended user profile data
 */
export interface UserProfilesRow {
  id: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  preferences?: Record<string, unknown> | null;
}

/**
 * TicketDiscordOutbox - Discord notification queue
 */
export interface TicketDiscordOutboxRow {
  id: string;
  created_at: string;
  updated_at: string;
  ticket_id?: string;
  status?: string;
  sent_at?: string | null;
}

/**
 * PlayerProjections - Player projection data
 */
export interface PlayerProjectionsRow {
  id: string;
  created_at: string;
  updated_at: string;
  player_id?: string;
  game_id?: string;
  stat_type?: string;
  projected_value?: number;
}

/**
 * OpsWorkerHeartbeats - Operations worker health
 */
export interface OpsWorkerHeartbeatsRow {
  id: string;
  created_at: string;
  updated_at: string;
  worker_name?: string;
  last_heartbeat?: string;
  status?: string;
}

/**
 * AutopilotDecisions - Autopilot decision records
 */
export interface AutopilotDecisionsRow {
  id: string;
  created_at: string;
  updated_at: string;
  decision_type?: string;
  entity_id?: string;
  decision?: string;
  reason?: string;
}

/**
 * AutopilotPolicyConfig - Autopilot policy configuration
 */
export interface AutopilotPolicyConfigRow {
  id: string;
  created_at: string;
  updated_at: string;
  policy_name?: string;
  config?: Record<string, unknown>;
  active?: boolean;
}

/**
 * AutopilotCooldowns - Autopilot cooldown tracking
 */
export interface AutopilotCooldownsRow {
  id: string;
  created_at: string;
  updated_at: string;
  entity_type?: string;
  entity_id?: string;
  cooldown_until?: string;
}

// ============================================================================
// CONVENIENCE TYPE ALIASES
// These provide shorter names for common use cases
// ============================================================================

/** Alias for UnifiedPicksRow */
export type UnifiedPick = UnifiedPicksRow;

/** Alias for GamesRow */
export type Game = GamesRow;

/** Alias for PlayersRow */
export type Player = PlayersRow;

/** Alias for TeamsRow */
export type Team = TeamsRow;

/** Alias for CappersRow */
export type Capper = CappersRow;

/** Alias for UsersRow */
export type User = UsersRow;

/** Alias for RawPropsRow */
export type RawProp = RawPropsRow;

// Note: AgentHealth is defined in agent.ts for runtime status
// Use AgentHealthRow for database row type

/** Alias for PropSettlementsRow */
export type PropSettlement = PropSettlementsRow;

/** Alias for SmartTicketsRow */
export type SmartTicket = SmartTicketsRow;

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

export interface Database {
  public: {
    Tables: {
      unified_picks: {
        Row: UnifiedPicksRow;
        Insert: Partial<UnifiedPicksRow>;
        Update: Partial<UnifiedPicksRow>;
        Relationships: [];
      };
      bridge_outbox: {
        Row: BridgeOutboxRow;
        Insert: Partial<BridgeOutboxRow>;
        Update: Partial<BridgeOutboxRow>;
        Relationships: [];
      };
      agent_health: {
        Row: AgentHealthRow;
        Insert: Partial<AgentHealthRow>;
        Update: Partial<AgentHealthRow>;
        Relationships: [];
      };
      prop_settlements: {
        Row: PropSettlementsRow;
        Insert: Partial<PropSettlementsRow>;
        Update: Partial<PropSettlementsRow>;
        Relationships: [];
      };
      users: {
        Row: UsersRow;
        Insert: Partial<UsersRow>;
        Update: Partial<UsersRow>;
        Relationships: [];
      };
      raw_props: {
        Row: RawPropsRow;
        Insert: Partial<RawPropsRow>;
        Update: Partial<RawPropsRow>;
        Relationships: [];
      };
      games: {
        Row: GamesRow;
        Insert: Partial<GamesRow>;
        Update: Partial<GamesRow>;
        Relationships: [];
      };
      players: {
        Row: PlayersRow;
        Insert: Partial<PlayersRow>;
        Update: Partial<PlayersRow>;
        Relationships: [];
      };
      closing_snapshots: {
        Row: ClosingSnapshotsRow;
        Insert: Partial<ClosingSnapshotsRow>;
        Update: Partial<ClosingSnapshotsRow>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: Partial<AuditLogRow>;
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
      cappers: {
        Row: CappersRow;
        Insert: Partial<CappersRow>;
        Update: Partial<CappersRow>;
        Relationships: [];
      };
      daily_picks: {
        Row: DailyPicksRow;
        Insert: Partial<DailyPicksRow>;
        Update: Partial<DailyPicksRow>;
        Relationships: [];
      };
      smart_tickets: {
        Row: SmartTicketsRow;
        Insert: Partial<SmartTicketsRow>;
        Update: Partial<SmartTicketsRow>;
        Relationships: [];
      };
      teams: {
        Row: TeamsRow;
        Insert: Partial<TeamsRow>;
        Update: Partial<TeamsRow>;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfilesRow;
        Insert: Partial<UserProfilesRow>;
        Update: Partial<UserProfilesRow>;
        Relationships: [];
      };
      ticket_discord_outbox: {
        Row: TicketDiscordOutboxRow;
        Insert: Partial<TicketDiscordOutboxRow>;
        Update: Partial<TicketDiscordOutboxRow>;
        Relationships: [];
      };
      player_projections: {
        Row: PlayerProjectionsRow;
        Insert: Partial<PlayerProjectionsRow>;
        Update: Partial<PlayerProjectionsRow>;
        Relationships: [];
      };
      ops_worker_heartbeats: {
        Row: OpsWorkerHeartbeatsRow;
        Insert: Partial<OpsWorkerHeartbeatsRow>;
        Update: Partial<OpsWorkerHeartbeatsRow>;
        Relationships: [];
      };
      autopilot_decisions: {
        Row: AutopilotDecisionsRow;
        Insert: Partial<AutopilotDecisionsRow>;
        Update: Partial<AutopilotDecisionsRow>;
        Relationships: [];
      };
      autopilot_policy_config: {
        Row: AutopilotPolicyConfigRow;
        Insert: Partial<AutopilotPolicyConfigRow>;
        Update: Partial<AutopilotPolicyConfigRow>;
        Relationships: [];
      };
      autopilot_cooldowns: {
        Row: AutopilotCooldownsRow;
        Insert: Partial<AutopilotCooldownsRow>;
        Update: Partial<AutopilotCooldownsRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/** Get Row type for a table */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/** Get Insert type for a table */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

/** Get Update type for a table */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
