require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Checking pick_publish FK constraint...\n');

  // Get a pick_publish record and check if pick_id exists in picks vs unified_picks
  const { data: publishRecord, error: pubError } = await supabase
    .from('pick_publish')
    .select('id, pick_id')
    .limit(5);

  if (pubError) {
    console.log('Error:', pubError.message);
    return;
  }

  console.log('Sample pick_publish records:');
  for (const rec of publishRecord || []) {
    console.log(`\npick_publish.id: ${rec.id}`);
    console.log(`pick_publish.pick_id: ${rec.pick_id}`);

    // Check if this pick_id exists in picks TABLE
    const { data: inPicks, error: picksErr } = await supabase
      .from('picks')
      .select('id')
      .eq('id', rec.pick_id)
      .maybeSingle();

    // Check if this pick_id exists in unified_picks TABLE
    const { data: inUnified, error: unifiedErr } = await supabase
      .from('unified_picks')
      .select('id')
      .eq('id', rec.pick_id)
      .maybeSingle();

    console.log(`  → Exists in picks: ${inPicks ? 'YES' : 'NO'} ${picksErr ? '(error: ' + picksErr.message + ')' : ''}`);
    console.log(`  → Exists in unified_picks: ${inUnified ? 'YES' : 'NO'} ${unifiedErr ? '(error: ' + unifiedErr.message + ')' : ''}`);
  }

  // Also check our recent E2E test record
  console.log('\n--- Recent E2E test records ---');
  const { data: recentPublish, error: recentErr } = await supabase
    .from('pick_publish')
    .select('id, pick_id, status, external_message_id, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (recentErr) {
    console.log('Error:', recentErr.message);
  } else {
    for (const rec of recentPublish || []) {
      console.log(`\nRecent pick_publish: ${rec.id}`);
      console.log(`  pick_id: ${rec.pick_id}`);
      console.log(`  status: ${rec.status}`);
      console.log(`  external_message_id: ${rec.external_message_id}`);
      console.log(`  created_at: ${rec.created_at}`);

      const { data: inPicks } = await supabase
        .from('picks')
        .select('id')
        .eq('id', rec.pick_id)
        .maybeSingle();

      const { data: inUnified } = await supabase
        .from('unified_picks')
        .select('id')
        .eq('id', rec.pick_id)
        .maybeSingle();

      console.log(`  → Exists in picks: ${inPicks ? 'YES' : 'NO'}`);
      console.log(`  → Exists in unified_picks: ${inUnified ? 'YES' : 'NO'}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('The FK constraint can be inferred from which table the pick_id values exist in.');
  console.log('If pick_id values exist in picks but NOT in unified_picks, FK references picks.');
  console.log('If pick_id values exist in unified_picks but NOT in picks, FK references unified_picks.');
}

main().catch(console.error);
