/* eslint-disable max-lines-per-function, complexity, max-depth, no-console */
import { calculateEdgeScore } from '../agents/GradingAgent/scoring/edgeScoreEngine';
// Tranche 2, Stage 1 (2026-01-29): Canonical tier determination
import { scoreOnlyTier, normalizeScore } from '../agents/GradingAgent/scoring/TierScale';
import { supabase } from '../services/supabaseClient';

async function main() {
  try {
    // Get picks that need grading
    const { data: picks, error } = await supabase
      .from('unified_picks')
      .select('*')
      .is('edge_score', null)
      .eq('play_status', 'pending')
      .limit(100);

    if (error) {
      console.error('Error fetching picks:', error);
      return;
    }

    if (!picks || picks.length === 0) {
      console.log('No picks to grade');
      return;
    }

    console.log(`Found ${picks.length} picks to grade`);

    for (const pick of picks) {
      try {
        // Calculate edge professional_score
        const edgeScore = calculateEdgeScore(pick);

        // Determine tier — Tranche 2, Stage 1+3 (2026-01-29)
        const USE_V2 = process.env.SCORING_ENGINE_V2 === 'true';
        let tier: string;
        if (USE_V2) {
          tier = scoreOnlyTier(normalizeScore(edgeScore, 5));
        } else {
          tier = 'D';
          if (edgeScore >= 4) {
            tier = 'S';
          } else if (edgeScore >= 3) {
            tier = 'A';
          } else if (edgeScore >= 2) {
            tier = 'B';
          } else if (edgeScore >= 1) {
            tier = 'C';
          }
        }

        // Update the pick with grading results
        const { error: updateError } = await supabase
          .from('unified_picks')
          .update({
            edge_score: edgeScore,
            tier,
          })
          .eq('id', pick.id);

        if (updateError) {
          console.error(`Failed to update pick ${pick.id}:`, updateError);
          continue;
        }

        console.log(`Successfully grading_status pick ${pick.id} with tier ${tier}`);
      } catch (error) {
        console.error(`Failed to grade pick ${pick.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
