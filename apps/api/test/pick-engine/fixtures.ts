/**
 * Shared test fixtures for pick-engine tests (SPRINT-035)
 */
import type { PickEngineInput, PickEngineConfig } from '@/pick-engine/pick-engine';
import type { MarketPolicy } from '@/pick-engine/pick-policy';

import { DEFAULT_CONFIG } from '@/pick-engine/pick-engine';

/**
 * Creates a PickEngineInput that passes ALL default filters.
 * Override individual fields to trigger specific rejections.
 */
export function makeInput(overrides: Partial<PickEngineInput> = {}): PickEngineInput {
  return {
    market_key: 'test-mk-1',
    event_id: 'event-1',
    market_type_id: 1,
    participant_id: 'player-1',
    snapshot_at: '2026-01-15T12:00:00Z',
    p_final: 0.62,
    p_market_devig: 0.55,
    edge_final: 0.07,
    tier: 'A',
    book_count: 5,
    providers: ['dk', 'fd', 'mgm', 'czr', 'bet365'],
    p_open_devig: 0.5,
    p_close_devig: 0.52,
    clv_prob: 0.02,
    book_count_close: 5,
    score: 85,
    uncertainty_final: 0.15,
    clv_forecast: 0.03,
    devig_mode: 'multiplicative',
    ...overrides,
  };
}

export function makePolicy(overrides: Partial<MarketPolicy> = {}): MarketPolicy {
  return {
    id: 1,
    sport: 'NBA',
    market_type: 'player_points_ou',
    tier: 'A',
    enabled: true,
    min_edge: 0.03,
    min_confidence: 60,
    stake_multiplier: 1.0,
    ...overrides,
  };
}

export { DEFAULT_CONFIG };
