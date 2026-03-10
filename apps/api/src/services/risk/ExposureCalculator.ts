/* eslint-disable complexity, max-lines-per-function, security/detect-object-injection */
/**
 * ExposureCalculator — Computes aggregate Kelly exposure from scored_legs
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * Queries scored_legs joined with ticket_legs where legs are pending.
 * Returns total Kelly exposure, per-event breakdown, and breach detection.
 */

import type { ExposureBreach, ExposureState, RiskEngineConfig } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Compute aggregate exposure from live scored legs.
 *
 * Uses scored_legs.kelly_fraction for pending ticket_legs to determine
 * total, per-event, and per-sport Kelly exposure.
 */
export async function computeExposure(
  supabase: SupabaseClient,
  config: RiskEngineConfig
): Promise<ExposureState> {
  // Query: all latest scored legs for pending ticket legs with positive kelly
  // Join through ticket_legs → events for sport
  const { data: rows, error } = await supabase
    .from('scored_legs')
    .select(
      `
      kelly_fraction,
      ticket_legs!inner (
        event_id,
        leg_status,
        events!inner (
          sport
        )
      )
    `
    )
    .eq('is_latest', true)
    .not('kelly_fraction', 'is', null)
    .gt('kelly_fraction', 0);

  if (error) {
    throw new Error(`ExposureCalculator query failed: ${error.message}`);
  }

  // Filter to pending legs (Supabase nested filter limitations)
  const pendingRows = (rows || []).filter((r: any) => r.ticket_legs?.leg_status === 'pending');

  // Aggregate
  let totalKelly = 0;
  const byEvent: Record<string, number> = {};
  const bySport: Record<string, number> = {};

  for (const row of pendingRows) {
    const kelly = Number((row as any).kelly_fraction) || 0;
    const eventId = (row as any).ticket_legs?.event_id as string | null;
    const sport = (row as any).ticket_legs?.events?.sport as string | null;

    totalKelly += kelly;

    if (eventId) {
      byEvent[eventId] = (byEvent[eventId] || 0) + kelly;
    }
    if (sport) {
      bySport[sport] = (bySport[sport] || 0) + kelly;
    }
  }

  // Find max single event exposure
  let maxEvent: ExposureState['max_single_event'] = null;
  for (const [eventId, exposure] of Object.entries(byEvent)) {
    if (!maxEvent || exposure > maxEvent.exposure) {
      maxEvent = { event_id: eventId, exposure };
    }
  }

  // Herfindahl index (concentration metric)
  const hhi = computeHerfindahl(byEvent, totalKelly);

  // Detect breaches
  const breaches = detectBreaches(totalKelly, byEvent, bySport, config);

  return {
    total_kelly_exposure: round(totalKelly, 5),
    total_pending_legs: pendingRows.length,
    total_pending_events: Object.keys(byEvent).length,
    exposure_by_event: Object.fromEntries(
      Object.entries(byEvent).map(([k, v]) => [k, round(v, 5)])
    ),
    exposure_by_sport: Object.fromEntries(
      Object.entries(bySport).map(([k, v]) => [k, round(v, 5)])
    ),
    max_single_event: maxEvent
      ? { event_id: maxEvent.event_id, exposure: round(maxEvent.exposure, 5) }
      : null,
    herfindahl_index: round(hhi, 5),
    breaches,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Herfindahl-Hirschman Index for concentration measurement.
 * HHI = sum(share_i^2) where share_i = event_exposure / total_exposure
 * Range: 1/N (perfectly diverse) to 1.0 (perfectly concentrated)
 */
function computeHerfindahl(byEvent: Record<string, number>, total: number): number {
  if (total <= 0) return 0;
  const events = Object.values(byEvent);
  if (events.length === 0) return 0;

  let hhi = 0;
  for (const exposure of events) {
    const share = exposure / total;
    hhi += share * share;
  }
  return hhi;
}

/**
 * Detect exposure breaches against config thresholds.
 */
function detectBreaches(
  totalKelly: number,
  byEvent: Record<string, number>,
  bySport: Record<string, number>,
  config: RiskEngineConfig
): ExposureBreach[] {
  const breaches: ExposureBreach[] = [];

  // Total Kelly critical
  if (totalKelly > config.total_kelly_critical) {
    breaches.push({
      dimension: 'total',
      key: 'total_kelly',
      current: round(totalKelly, 5),
      limit: config.total_kelly_critical,
      severity: 'critical',
    });
  } else if (totalKelly > config.total_kelly_high) {
    // Total Kelly high
    breaches.push({
      dimension: 'total',
      key: 'total_kelly',
      current: round(totalKelly, 5),
      limit: config.total_kelly_high,
      severity: 'high',
    });
  }

  // Per-event breaches
  for (const [eventId, exposure] of Object.entries(byEvent)) {
    if (exposure > config.event_kelly_limit) {
      breaches.push({
        dimension: 'event',
        key: eventId,
        current: round(exposure, 5),
        limit: config.event_kelly_limit,
        severity: 'critical',
      });
    }
  }

  // Per-sport breaches
  for (const [sport, exposure] of Object.entries(bySport)) {
    if (exposure > config.sport_kelly_limit) {
      breaches.push({
        dimension: 'sport',
        key: sport,
        current: round(exposure, 5),
        limit: config.sport_kelly_limit,
        severity: 'high',
      });
    }
  }

  return breaches;
}

function round(n: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}
