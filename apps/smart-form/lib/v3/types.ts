/**
 * V3 Catalog Types for Smart Form
 * SPRINT-SMARTFORM-UX-REBUILD-080
 *
 * TypeScript interfaces matching Canonical V3 view schemas
 */

// ============================================================================
// SPORT
// ============================================================================

export interface V3Sport {
  id: number;
  code: string;
  display_name: string;
  has_segments: boolean;
  default_segment_type: string | null;
  supports_live: boolean;
  supports_player_props: boolean;
  segment_display: string | null;
  max_segments: number | null;
  meta: Record<string, unknown>;
}

// ============================================================================
// EVENT
// ============================================================================

export interface V3Event {
  id: string;
  external_id: string | null;
  sport: string;
  league: string | null;
  event_type: string;
  scheduled_at: string;
  status: 'scheduled' | 'live' | 'completed' | 'postponed' | 'cancelled';
  home_participant_id: string | null;
  home_team: string | null;
  home_display: string | null;
  away_participant_id: string | null;
  away_team: string | null;
  away_display: string | null;
  venue: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// MARKET GROUP
// ============================================================================

export interface V3MarketGroup {
  id: number;
  code: string;
  display_name: string;
  parent_group_id: number | null;
  parent_code: string | null;
  parent_name: string | null;
  sort_order: number;
  market_count: number;
}

// ============================================================================
// MARKET TYPE
// ============================================================================

export type ParticipantScope = 'EVENT' | 'TEAM' | 'PLAYER' | 'FIGHTER' | 'PARTICIPANT' | 'NONE';

export interface V3MarketType {
  market_type_id: number;
  market_key: string;
  display_name: string;
  sport: string | null;
  league: string | null;
  market_group: string;
  market_group_name: string;
  parent_group: string | null;
  outcome_type: string;
  participant_scope: ParticipantScope;
  requires_participant: boolean;
  requires_line: boolean;
  supports_alt_lines: boolean;
  supports_live: boolean;
  segment_type: string | null;
  is_future: boolean;
  is_derivative: boolean;
}

// ============================================================================
// SEGMENT TYPE
// ============================================================================

export interface V3SegmentType {
  id: number;
  code: string;
  display_name: string;
  display_short: string | null;
  ordinal_prefix: string | null;
  applicable_sports: string[];
  max_segments: number | null;
}

// ============================================================================
// PARTICIPANT (Player/Team)
// ============================================================================

export interface V3Participant {
  event_id: string;
  sport: string;
  participant_id: string;
  name: string;
  display_name: string | null;
  participant_type: 'team' | 'player' | 'fighter' | 'golfer' | 'driver';
  role: string;
  team_id: string | null;
  team_name: string | null;
  side: 'home' | 'away' | 'neutral';
  participant_meta: Record<string, unknown>;
}

// ============================================================================
// PROVIDER OFFER
// ============================================================================

export interface V3ProviderOffer {
  id: string;
  event_id: string;
  market_type_id: number;
  market_key: string;
  market_name: string;
  participant_id: string | null;
  participant_name: string | null;
  segment_type_id: number | null;
  segment_type: string | null;
  provider_id: number;
  provider: string;
  provider_name: string;
  line: number | null;
  over_odds: number | null;
  under_odds: number | null;
  home_odds: number | null;
  away_odds: number | null;
  yes_odds: number | null;
  no_odds: number | null;
  devigged_over: number | null;
  devigged_under: number | null;
  juice: number | null;
  snapshot_at: string;
  is_opening: boolean;
  is_closing: boolean;
  mapping_confidence: number | null;
  meta: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// BEST OFFER (Aggregated)
// ============================================================================

export interface V3BestOffer {
  event_id: string;
  market_type_id: number;
  market_key: string;
  market_name: string;
  participant_id: string | null;
  participant_name: string | null;
  segment_type_id: number | null;
  segment_type: string | null;
  best_over_odds: number | null;
  best_over_line: number | null;
  best_over_provider: string | null;
  best_over_provider_id: number | null;
  best_under_odds: number | null;
  best_under_line: number | null;
  best_under_provider: string | null;
  best_under_provider_id: number | null;
  best_home_odds: number | null;
  best_home_provider: string | null;
  best_away_odds: number | null;
  best_away_provider: string | null;
  provider_count: number;
  oldest_snapshot: string;
  newest_snapshot: string;
}

// ============================================================================
// TICKET SUBMISSION
// ============================================================================

export type Selection = 'over' | 'under' | 'home' | 'away' | 'yes' | 'no' | 'draw';
export type TicketType = 'single' | 'parlay' | 'round_robin' | 'teaser';
export type SubmitStatus = 'inserted' | 'exists' | 'error';

export interface V3LegOverride {
  line?: number;
  odds?: number;
  provider?: string;
}

export interface V3LegPayload {
  event_id: string;
  market_type_id: number;
  segment_type_id?: number;
  selection: Selection;
  provider_offer_id?: string;
  participant_id?: string;
  line?: number;
  odds?: number;
  provider?: string;
  override?: V3LegOverride;
}

export interface V3SubmitTicketInput {
  bet_slip_id: string;
  user_id: string;
  ticket_type: TicketType;
  total_stake: number;
  legs: V3LegPayload[];
  meta?: Record<string, unknown>;
}

export interface V3LegError {
  leg_index: number;
  errors: string[];
}

export interface V3SubmitTicketResult {
  ticket_id: string | null;
  leg_ids: string[] | null;
  status: SubmitStatus;
  error_details: V3LegError[] | null;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface V3TicketLeg {
  id: string; // Client-side UUID for React key
  event_id: string;
  event_display: string;
  market_type_id: number;
  market_display: string;
  segment_type_id?: number;
  segment_display?: string;
  participant_id?: string;
  participant_display?: string;
  selection: Selection;
  provider_offer_id?: string;
  provider?: string;
  line?: number;
  odds?: number;
  override?: V3LegOverride;
  isManual: boolean;
}

export interface V3TicketState {
  ticket_type: TicketType;
  total_stake: number;
  bet_slip_id: string;
  legs: V3TicketLeg[];
}

// ============================================================================
// FORM STATE
// ============================================================================

export interface V3FormState {
  sport: string;
  event: V3Event | null;
  marketGroup: string;
  marketType: V3MarketType | null;
  segmentType: V3SegmentType | null;
  participant: V3Participant | null;
  selectedOffer: V3ProviderOffer | null;
  isManualMode: boolean;
  manualLine: string;
  manualOdds: string;
  manualProvider: string;
  selection: Selection | null;
  override: V3LegOverride | null;
}

export const INITIAL_FORM_STATE: V3FormState = {
  sport: '',
  event: null,
  marketGroup: '',
  marketType: null,
  segmentType: null,
  participant: null,
  selectedOffer: null,
  isManualMode: false,
  manualLine: '',
  manualOdds: '',
  manualProvider: '',
  selection: null,
  override: null,
};
