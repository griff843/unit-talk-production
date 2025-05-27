import { supabase } from '../../services/supabaseClient';
import { applyScoringLogic } from '../GradingAgent/scoring/applyScoringLogic';
import { logger } from '../../services/logging';

export async function promoteToDailyPicks() {
  // 1. Fetch eligible raw_props
  const { data: rawProps, error } = await supabase
    .from('raw_props')
    .select('*')
    .eq('promoted', false)
    .eq('is_valid', true);

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
      // 4. Insert into daily_picks
      const { error: insertErr } = await supabase
        .from('daily_picks')
        .insert([scored]);
      if (insertErr) {
        logger.error(insertErr, `Insert to daily_picks failed for prop_id=${prop.id}`);
        continue;
      }
      promotedCount++;

      // 5. Mark as promoted in raw_props
      await supabase
        .from('raw_props')
        .update({ promoted: true, promoted_at: new Date().toISOString() })
        .eq('id', prop.id);
      logger.info({ id: prop.id, player: prop.player_name, tier: scored.tier }, 'Promoted to daily_picks');
    } else {
      logger.info({ id: prop.id, player: prop.player_name, tier: scored.tier }, 'Not promoted (Tier C)');
    }
  }

  logger.info(`Promotion complete: ${promotedCount} props promoted to daily_picks.`);
}
