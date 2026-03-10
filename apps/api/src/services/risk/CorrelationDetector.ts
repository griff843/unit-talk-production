/* eslint-disable security/detect-object-injection */
/**
 * CorrelationDetector — Detects correlated pending legs
 * Sprint: SPRINT-RISK-EXPOSURE-CORRELATION
 *
 * Queries pending ticket_legs and groups by event_id and participant_id
 * to detect same-game and same-player concentration.
 *
 * FAIL-CLOSED: Query errors propagate to RiskEngine (which blocks on any error).
 */

import type { CorrelationState, CorrelationCluster, RiskEngineConfig } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Detect correlation clusters among pending ticket legs.
 *
 * Returns blocked=true if any cluster exceeds config limits.
 */
export async function detectCorrelation(
  supabase: SupabaseClient,
  config: RiskEngineConfig
): Promise<CorrelationState> {
  // Query pending ticket_legs with event and participant info
  const { data: rows, error } = await supabase
    .from('ticket_legs')
    .select('id, event_id, participant_id')
    .eq('leg_status', 'pending');

  if (error) {
    throw new Error(`CorrelationDetector query failed: ${error.message}`);
  }

  const legs = rows || [];
  const clusters: CorrelationCluster[] = [];
  const blockedReasons: string[] = [];

  // Group by event_id (same-game detection)
  const byEvent: Record<string, string[]> = {};
  for (const leg of legs) {
    const eventId = leg.event_id as string | null;
    if (eventId) {
      if (!byEvent[eventId]) byEvent[eventId] = [];
      byEvent[eventId].push(leg.id as string);
    }
  }

  for (const [eventId, legIds] of Object.entries(byEvent)) {
    if (legIds.length > config.correlation_max_same_event) {
      clusters.push({
        type: 'same_event',
        key: eventId,
        count: legIds.length,
        limit: config.correlation_max_same_event,
        leg_ids: legIds,
      });
      blockedReasons.push(
        `correlation_same_event:${eventId}:${legIds.length}>${config.correlation_max_same_event}`
      );
    }
  }

  // Group by participant_id (same-player detection)
  const byParticipant: Record<string, string[]> = {};
  for (const leg of legs) {
    const participantId = leg.participant_id as string | null;
    if (participantId) {
      if (!byParticipant[participantId]) byParticipant[participantId] = [];
      byParticipant[participantId].push(leg.id as string);
    }
  }

  for (const [participantId, legIds] of Object.entries(byParticipant)) {
    if (legIds.length > config.correlation_max_same_participant) {
      clusters.push({
        type: 'same_participant',
        key: participantId,
        count: legIds.length,
        limit: config.correlation_max_same_participant,
        leg_ids: legIds,
      });
      blockedReasons.push(
        `correlation_same_participant:${participantId}:${legIds.length}>${config.correlation_max_same_participant}`
      );
    }
  }

  return {
    clusters,
    blocked: blockedReasons.length > 0,
    blocked_reasons: blockedReasons,
    computed_at: new Date().toISOString(),
  };
}
