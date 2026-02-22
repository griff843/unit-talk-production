/**
 * Identity Resolution Service
 * Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
 *
 * Provides identity resolution for players, teams, and events.
 * Used by scoring and feed ingestion to ensure correct entity mapping.
 */

export {
  resolvePlayerTeam,
  resolvePlayerTeamsBatch,
  isPlayerInMarketUniverse,
  findFuzzyMatches,
  stringSimilarity,
  type PlayerIdentifier,
  type TeamResolutionContext,
  type TeamResolutionResult,
} from './resolvePlayerTeam';

export {
  checkIdentityForScoring,
  checkIdentityForScoringBatch,
  logIdentityGateDecision,
  type IdentityGateResult,
  type IdentityGateInput,
} from './identityGate';
