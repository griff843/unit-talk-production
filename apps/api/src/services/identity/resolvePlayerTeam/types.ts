/**
 * Types for Player Team Resolution
 * Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
 */

export interface TeamResolutionContext {
  /** Date for membership validation (defaults to NOW) */
  contextDate?: Date;
  /** Event ID if resolving in context of specific event */
  eventId?: string;
  /** Provider ID for provider-specific resolution */
  providerId?: number;
  /** Provider's raw player ID */
  providerPlayerId?: string;
}

export interface TeamResolutionResult {
  /** Resolved team participant ID */
  teamId: string;
  /** Team name (for logging/debugging) */
  teamName: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Resolution source */
  source: 'membership' | 'provider_map' | 'event_context' | 'fuzzy_match';
  /** Additional metadata */
  meta?: Record<string, unknown>;
}

export interface PlayerIdentifier {
  /** Participant ID (UUID) */
  participantId?: string;
  /** External ID (e.g., SGO player ID) */
  externalId?: string;
  /** Player name (for fuzzy matching) */
  playerName?: string;
  /** Sport code (required) */
  sport: string;
}

/** Helper to extract team from Supabase join result */
export function extractTeamFromJoin(teamData: unknown): { id: string; name: string } | null {
  const team = Array.isArray(teamData) ? teamData[0] : teamData;
  if (!team || typeof team !== 'object') return null;
  const typed = team as { id?: string; name?: string };
  if (!typed.id) return null;
  return { id: typed.id, name: typed.name || 'Unknown' };
}
