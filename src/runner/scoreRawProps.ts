// src/runner/scoreRawProps.ts
import { supabase } from '../services/supabaseClient';

async function main() {
  const { data: props, error } = await supabase
    .from('raw_props')
    .select('*')
    .is('edge_score', null);

  if (error) throw error;
  if (!props?.length) {
    console.log('No unscored props.');
    return;
  }

  let updated = 0, failed = 0;
  for (const prop of props) {
    try {
      const edge_score = calcEdgeScore(prop);
      const tier = edge_score >= 23 ? 'S'
                : edge_score >= 20 ? 'A'
                : edge_score >= 15 ? 'B'
                : edge_score >= 10 ? 'C'
                : 'D';
      const auto_approved = edge_score >= 20;

      const { error: upErr } = await supabase
        .from('raw_props')
        .update({ edge_score, tier, auto_approved })
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

function calcEdgeScore(prop: any): number {
  // TODO: Implement your real 25-point scoring logic here.
  // Example pseudo-logic:
  // let score = 0;
  // if (prop.over_odds > -120 && prop.over_odds < 120) score += 5;
  // if (prop.line_value_score && prop.line_value_score > 7) score += 5;
  // // ...more rules...
  // return Math.max(0, Math.min(score, 25));
  return 0; // placeholder!
}

main();
