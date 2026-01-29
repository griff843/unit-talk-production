import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';
import { applyScoringLogic } from '../GradingAgent/scoring/applyScoringLogic';

const REQUIRED_PROMOTION_FIELDS = ['player_name', 'sport', 'stat_type', 'line', 'odds'] as const;

function validatePromotionFields(prop: any): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_PROMOTION_FIELDS.filter(
    // eslint-disable-next-line security/detect-object-injection
    f => prop[f] === undefined || prop[f] === null || prop[f] === ''
  );
  return { valid: missing.length === 0, missing };
}

/** P-03: Flag-first claim + insert for a single qualifying prop */
async function claimAndInsert(prop: any, scored: any): Promise<boolean> {
  const { data: claimed, error: claimErr } = await supabase
    .from('raw_props')
    .update({ promoted: true, promoted_at: new Date().toISOString() })
    .eq('id', prop.id)
    .eq('promoted', false)
    .select('id');

  if (claimErr || !claimed || claimed.length === 0) {
    logger.info({ id: prop.id }, 'Prop already claimed or claim failed — skipping (idempotent)');
    return false;
  }

  const { error: insertErr } = await supabase.from('daily_picks').insert([scored]);
  if (insertErr) {
    logger.error(insertErr, `Insert to daily_picks failed for prop_id=${prop.id}`);
    return false;
  }

  logger.info(
    { id: prop.id, player: prop.player_name, tier: scored.tier },
    'Promoted to daily_picks'
  );
  return true;
}

export async function promoteToDailyPicks() {
  // 1. Fetch eligible raw_props (deterministic order by id — P-01)
  const { data: rawProps, error } = await supabase
    .from('raw_props')
    .select('*')
    .eq('promoted', false)
    .eq('is_valid', true)
    .order('id', { ascending: true });

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
    // P-05: Validate required fields before scoring
    const validation = validatePromotionFields(prop);
    if (!validation.valid) {
      logger.warn(
        { id: prop.id, player: prop.player_name, missing: validation.missing },
        'Skipped promotion: missing required fields'
      );
      continue;
    }

    const scored = applyScoringLogic(prop);

    if (['S', 'A', 'B'].includes(scored.tier)) {
      const ok = await claimAndInsert(prop, scored);
      if (ok) promotedCount++;
    } else {
      logger.info(
        { id: prop.id, player: prop.player_name, tier: scored.tier },
        'Not promoted (Tier C)'
      );
    }
  }

  logger.info(`Promotion complete: ${promotedCount} props promoted to daily_picks.`);
}
