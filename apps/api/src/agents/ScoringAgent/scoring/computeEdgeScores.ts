/**
 * Combined Edge Score Computation
 * Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
 *
 * Computes both PRE and POST scores in a single call.
 * Useful for artifact writes that need both scores.
 */

import { computeEdgeScorePre, EdgePreInput, EdgePreOutput } from './edgeEnginePre';
import { computeEdgeScorePost, EdgePostInput, EdgePostOutput } from './edgeEngineV1';

export interface CombinedEdgeInput {
  pick_id: string;
  sport: string;
  stat_type: string;
  side: 'over' | 'under' | 'yes' | 'no';

  // Entry data (used by both PRE and POST)
  entry_line: number;
  entry_odds: number;

  // PRE-only data (entry-time)
  projection?: number | null;
  opening_line?: number | null;
  opening_odds?: number | null;

  // POST-only data (closing data)
  closing_line?: number | null;
  closing_odds?: number | null;

  // Metadata
  player_name?: string;
}

export interface CombinedEdgeScores {
  pre: EdgePreOutput;
  post: EdgePostOutput;
}

/**
 * Compute both PRE and POST scores for a pick.
 *
 * PRE score uses only entry-time data (no closing lines).
 * POST score uses closing data for CLV validation.
 */
export function computeEdgeScores(input: CombinedEdgeInput): CombinedEdgeScores {
  // Build PRE input (entry-time data only)
  const preInput: EdgePreInput = {
    pick_id: input.pick_id,
    sport: input.sport,
    stat_type: input.stat_type,
    side: input.side,
    entry_line: input.entry_line,
    entry_odds: input.entry_odds,
    projection: input.projection,
    opening_line: input.opening_line,
    opening_odds: input.opening_odds,
    player_name: input.player_name,
  };

  // Build POST input (includes closing data)
  const postInput: EdgePostInput = {
    pick_id: input.pick_id,
    sport: input.sport,
    stat_type: input.stat_type,
    side: input.side,
    entry_line: input.entry_line,
    entry_odds: input.entry_odds,
    closing_line: input.closing_line ?? null,
    closing_odds: input.closing_odds ?? null,
    player_name: input.player_name,
  };

  // Compute both scores
  const pre = computeEdgeScorePre(preInput);
  const post = computeEdgeScorePost(postInput);

  return { pre, post };
}

/**
 * Batch computation for multiple picks
 */
export function computeEdgeScoresBatch(inputs: CombinedEdgeInput[]): CombinedEdgeScores[] {
  return inputs.map(input => computeEdgeScores(input));
}
