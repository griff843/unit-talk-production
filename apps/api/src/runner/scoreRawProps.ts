// src/runner/scoreRawProps.ts
import { requireSupabase } from '../utils/supabaseUtils';

function calcEdgeScore(prop: any): number {
  // Base professional_score starts at 15
  let professional_score = 15;

  // Add points for having odds
  if (prop.over_odds || prop.under_odds) {
    professional_score += 3;
  }

  // Add points for having a valid line
  if (prop.line !== null && prop.line !== undefined) {
    professional_score += 3;
  }

  // Add points for having a valid matchup
  if (prop.matchup && prop.opponent) {
    professional_score += 3;
  }

  // Add points for having valid game time
  if (prop.game_time) {
    professional_score += 3;
  }

  // Add points for having valid player and team info
  if (prop.player_name && prop.team) {
    professional_score += 3;
  }

  // Add points for having valid stat type
  if (prop.stat_type) {
    professional_score += 3;
  }

  // Add points for being from Optimal provider
  if (prop.provider === 'Optimal') {
    professional_score += 5;
  }

  // Add points for MLB props (since we know they're good)
  if (prop.sport === 'MLB') {
    professional_score += 5;
  }

  return score;
}

async function main() {
  // First reset all scores where edge_score is not null
  const supabaseClient = requireSupabase();
      const { error: resetError } = await supabase
    .from('sports_game_odds')
    .update({
      edge_score: null,
      tier: null,
      auto_approved: false
    })
    .not('edge_score', 'is', null);

  if (resetError) {
    console.error('Error resetting scores:', resetError);
    return;
  }

  const supabaseClient = requireSupabase();
      const { data: props, error } = await supabase
    .from('sports_game_odds')
    .select('*')
    .is('edge_score', null);

  if (error) {throw error;}
  if (!props?.length) {
    console.log('No unscored props.');
    return;
  }

  let updated = 0, failed = 0;
  for (const prop of props) {
    try {
      console.log('Calculating edge professional_score for prop:', prop);
      const edge_score = calcEdgeScore(prop);
      const tier = edge_score >= 23 ? 'S'
                : edge_score >= 20 ? 'A'
                : edge_score >= 15 ? 'B'
                : edge_score >= 10 ? 'C'
                : 'D';
      const published = edge_score >= 20;

      const supabaseClient = requireSupabase();
      const { error: upErr } = await supabase
        .from('sports_game_odds')
        .update({ edge_score, tier, published })
        .eq('id', prop.id);

      if (upErr) {
        failed++;
        console.error(`[EdgeScore][FAIL] Could not update id=${prop.id} - ${upErr.message}`);
        continue;
      }
      updated++;
    } catch (e) {
      failed++;
      console.error(`[EdgeScore][EXCEPTION] id=${prop.id} - ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`[EdgeScore] ${updated} updated, ${failed} failed`);
}

main().catch(console.error);
