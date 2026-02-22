/**
 * Identity Gate Service
 * Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
 * Phase 4: Fail-Closed in Scoring
 */

import { SupabaseClient } from '@supabase/supabase-js';

import {
  resolvePlayerTeam,
  isPlayerInMarketUniverse,
  PlayerIdentifier,
  TeamResolutionContext,
  TeamResolutionResult,
} from './resolvePlayerTeam';

export interface IdentityGateResult {
  canScore: boolean;
  teamResolution: TeamResolutionResult | null;
  reason: 'resolved' | 'out_of_market' | 'quarantined';
  playerIdentifier: string;
  sport: string;
  inMarketUniverse: boolean;
}

export interface IdentityGateInput {
  playerName: string;
  sport: string;
  participantId?: string;
  externalId?: string;
  context?: TeamResolutionContext;
}

function createOutOfMarketResult(identifier: string, sport: string): IdentityGateResult {
  return {
    canScore: true,
    teamResolution: null,
    reason: 'out_of_market',
    playerIdentifier: identifier,
    sport,
    inMarketUniverse: false,
  };
}

function createResolvedResult(
  teamResolution: TeamResolutionResult,
  identifier: string,
  sport: string
): IdentityGateResult {
  return {
    canScore: true,
    teamResolution,
    reason: 'resolved',
    playerIdentifier: identifier,
    sport,
    inMarketUniverse: true,
  };
}

function createQuarantinedResult(identifier: string, sport: string): IdentityGateResult {
  return {
    canScore: false,
    teamResolution: null,
    reason: 'quarantined',
    playerIdentifier: identifier,
    sport,
    inMarketUniverse: true,
  };
}

async function findParticipantId(
  supabase: SupabaseClient,
  input: IdentityGateInput
): Promise<string | null> {
  if (input.participantId) return input.participantId;

  const query = supabase
    .from('participants')
    .select('id')
    .eq('sport', input.sport)
    .eq('type', 'player');

  if (input.externalId) {
    const { data } = await query.eq('external_id', input.externalId).single();
    if (data?.id) return data.id;
  }

  if (input.playerName) {
    const { data } = await query.eq('name', input.playerName).single();
    if (data?.id) return data.id;
  }

  return null;
}

async function updateQuarantineStatus(
  supabase: SupabaseClient,
  participantId: string
): Promise<void> {
  await supabase
    .from('participants')
    .update({
      identity_status: 'quarantined',
      identity_status_updated_at: new Date().toISOString(),
    })
    .eq('id', participantId);
}

export async function checkIdentityForScoring(
  supabase: SupabaseClient,
  input: IdentityGateInput
): Promise<IdentityGateResult> {
  const participantId = await findParticipantId(supabase, input);

  if (!participantId) {
    return createOutOfMarketResult(input.playerName, input.sport);
  }

  const playerIdentifier: PlayerIdentifier = {
    participantId,
    externalId: input.externalId,
    playerName: input.playerName,
    sport: input.sport,
  };

  const teamResolution = await resolvePlayerTeam(supabase, playerIdentifier, input.context);

  if (teamResolution) {
    return createResolvedResult(teamResolution, participantId, input.sport);
  }

  const inMarketUniverse = await isPlayerInMarketUniverse(supabase, participantId);

  if (inMarketUniverse) {
    await updateQuarantineStatus(supabase, participantId);
    return createQuarantinedResult(participantId, input.sport);
  }

  return createOutOfMarketResult(participantId, input.sport);
}

export async function checkIdentityForScoringBatch(
  supabase: SupabaseClient,
  inputs: IdentityGateInput[]
): Promise<Map<string, IdentityGateResult>> {
  const results = new Map<string, IdentityGateResult>();
  for (const input of inputs) {
    const key = input.participantId || input.externalId || input.playerName;
    results.set(key, await checkIdentityForScoring(supabase, input));
  }
  return results;
}

interface Logger {
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
}

export function logIdentityGateDecision(
  logger: Logger,
  result: IdentityGateResult,
  propId?: string
): void {
  const meta = {
    propId,
    player: result.playerIdentifier,
    sport: result.sport,
    reason: result.reason,
    inMarketUniverse: result.inMarketUniverse,
    canScore: result.canScore,
    teamId: result.teamResolution?.teamId,
    teamName: result.teamResolution?.teamName,
    confidence: result.teamResolution?.confidence,
    source: result.teamResolution?.source,
  };

  if (result.reason === 'quarantined') {
    logger.warn('[IDENTITY-GATE] Player quarantined - scoring blocked', meta);
  } else if (result.reason === 'out_of_market') {
    logger.info('[IDENTITY-GATE] Player out of market universe', meta);
  } else {
    logger.info('[IDENTITY-GATE] Player identity resolved', meta);
  }
}
