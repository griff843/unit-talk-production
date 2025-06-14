import { supabase } from '../services/supabaseClient';

async function main() {
  const { data: props, error } = await supabase
    .from('raw_props')
    .select('*')
    .eq('auto_approved', true)
    .eq('promoted', false);

  if (error) throw error;
  if (!props?.length) {
    console.log('No new props to promote.');
    return;
  }

  let promoted = 0, failed = 0;
  for (const prop of props) {
    try {
      // Carefully map only fields present in daily_props
      const insertData = { ...prop, promoted_at: new Date().toISOString() };

      const { error: insErr } = await supabase
        .from('daily_props')
        .insert(insertData);

      if (insErr) {
        failed++;
        console.error(`[PromoAgent][FAIL] Insert id=${prop.id} - ${insErr.message}`);
        continue;
      }

      const { error: upErr } = await supabase
        .from('raw_props')
        .update({ promoted: true, promoted_at: new Date().toISOString() })
        .eq('id', prop.id);

      if (upErr) {
        failed++;
        console.error(`[PromoAgent][FAIL] Update id=${prop.id} - ${upErr.message}`);
        continue;
      }

      promoted++;
    } catch (e) {
      failed++;
      console.error(`[PromoAgent][EXCEPTION] id=${prop.id} - ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`[PromoAgent] ${promoted} promoted, ${failed} failed`);
}

main();
