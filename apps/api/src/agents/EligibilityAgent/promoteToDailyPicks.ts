import { logger } from '../../services/logging';
import { requireSupabase } from '../../utils/supabaseUtils';
import { applyScoringLogic } from '../ScoringAgent/scoring/applyScoringLogic';

export async function promoteToDailyPicks() {

  // 1. Fetch eligible raw_props
  const supabaseClient = requireSupabase();
  const { data: rawProps, error } = await supabaseClient
    .from('raw_props')
    .select('*')
    .eq('promoted_to_picks', false)
    .eq('is_valid', true)
    .limit(100); // Start with small batch

  if (error) {
    logger.error(error, 'Error fetching raw_props');
    throw error;
  }

  if (!rawProps || rawProps.length === 0) {
    logger.info('No eligible raw_props found for promotion.');
    return;
  }

  let promotedCount = 0;

  for (const prop of rawProps) {
    // 2. Score the prop
    const scored = applyScoringLogic(prop);

    // 3. Decide if it qualifies (e.g. S, A, B only; skip C)
    if (['S', 'A', 'B'].includes(scored.tier)) {
      // 4. Insert into unified_picks (replaces daily_picks)
      const { error: insertErr } = await supabaseClient
        .from('unified_picks')
        .insert([scored]);
      if (insertErr) {
        logger.error(insertErr, `Insert to daily_picks failed for prop_id=${prop.id}`);
        continue;
      }
      promotedCount++;

      // 5. Mark as promoted in raw_props
      await supabaseClient
        .from('raw_props')
        .update({ promoted_to_picks: true, promoted_at: new Date().toISOString() })
        .eq('id', prop.id);
      logger.info({ id: prop.id, player: prop.player_name, tier: scored.tier }, 'Promoted to unified_picks');
    } else {
      logger.info({ id: prop.id, player: prop.player_name, tier: scored.tier }, 'Not promoted (Tier C)');
    }
  }

  logger.info(`Promotion complete: ${promotedCount} props promoted to unified_picks.`);
}
