/**
 * Scoring Writer Service
 *
 * Handles writing scoring results to scored_props table
 * Controlled by USE_VIEWS feature flag
 */

import { createClient } from '@supabase/supabase-js';
import { USE_VIEWS } from '../config/features';
import { createLogger } from '../utils/logger';

const logger = createLogger('ScoringWriter');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ScoringResult {
  prop_ref: string; // UUID from unified_picks.id
  edge: number;
  prob_win: number;
  professional_score: number;
  tier: string; // 'S', 'A', 'B', 'C'
  confidence: number;
  kelly_fraction: number;
  clv_pct: number;
}

/**
 * Write scoring results to scored_props table
 *
 * When USE_VIEWS=1: Writes to scored_props table (views auto-join)
 * When USE_VIEWS=0: Writes directly to unified_picks table (legacy)
 */
export async function writeScores(scores: ScoringResult[]): Promise<void> {
  if (scores.length === 0) {
    logger.warn('No scores to write');
    return;
  }

  if (USE_VIEWS) {
    logger.info(`Writing ${scores.length} scores to scored_props table`);

    const rows = scores.map(s => ({
      prop_ref: s.prop_ref,
      edge: s.edge,
      prob_win: s.prob_win,
      professional_score: s.professional_score,
      tier: s.tier,
      confidence: s.confidence,
      kelly_fraction: s.kelly_fraction,
      clv_pct: s.clv_pct,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('scored_props')
      .upsert(rows, { onConflict: 'prop_ref' });

    if (error) {
      logger.error('Failed to write scores to scored_props', error);
      throw error;
    }

    logger.info(`Successfully wrote ${scores.length} scores`);
  } else {
    logger.info(`Writing ${scores.length} scores to unified_picks (legacy mode)`);

    // Legacy: write directly to unified_picks
    const updates = scores.map(s => ({
      id: s.prop_ref,
      professional_score: s.professional_score,
      edge: s.edge,
      prob_win: s.prob_win,
      tier: s.tier,
      confidence: s.confidence,
      kelly_fraction: s.kelly_fraction,
      clv_pct: s.clv_pct,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('unified_picks')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      logger.error('Failed to write scores to unified_picks', error);
      throw error;
    }

    logger.info(`Successfully wrote ${scores.length} scores (legacy)`);
  }
}

/**
 * Write single scoring result (convenience method)
 */
export async function writeScore(score: ScoringResult): Promise<void> {
  await writeScores([score]);
}
