import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('=== Investigating pick_publish FK relationship ===\n');

  // Check canonical_picks
  console.log('1. Checking canonical_picks table...');
  const { data: canonical, error: canonicalError } = await supabase
    .from('canonical_picks')
    .select('id')
    .limit(3);

  if (canonicalError) {
    console.log('   canonical_picks:', canonicalError.message);
  } else {
    console.log('   canonical_picks exists, sample IDs:', canonical?.map(c => c.id).slice(0, 3));
  }

  // Check existing pick_publish entries
  console.log('\n2. Checking existing pick_publish entries...');
  const { data: existing, error: existingError } = await supabase
    .from('pick_publish')
    .select('pick_id')
    .limit(5);

  if (existingError) {
    console.log('   Error:', existingError.message);
  } else if (existing && existing.length > 0) {
    console.log('   Existing pick_ids:', existing.map(e => e.pick_id));

    // Check where these IDs exist
    for (const entry of existing.slice(0, 2)) {
      const { data: inUnified } = await supabase
        .from('unified_picks')
        .select('id')
        .eq('id', entry.pick_id)
        .single();

      const { data: inCanonical } = await supabase
        .from('canonical_picks')
        .select('id')
        .eq('id', entry.pick_id)
        .single();

      console.log(`   ${entry.pick_id}:`);
      console.log(`      in unified_picks: ${!!inUnified}`);
      console.log(`      in canonical_picks: ${!!inCanonical}`);
    }
  } else {
    console.log('   No existing entries in pick_publish');
  }

  // Test insert with canonical_picks ID
  if (canonical && canonical.length > 0) {
    console.log('\n3. Testing insert with canonical_picks ID...');
    const testData = {
      pick_id: canonical[0].id,
      tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
      channel: 'CANARY',
      status: 'pending',
      attempts: 0,
      max_attempts: 1,
      dedupe_key: 'test_fk_' + Date.now(),
    };

    const { error: insertError } = await supabase
      .from('pick_publish')
      .insert(testData);

    if (!insertError) {
      console.log('   ✅ canonical_picks ID works!');
      await supabase.from('pick_publish').delete().eq('dedupe_key', testData.dedupe_key);
    } else {
      console.log('   ❌ Failed:', insertError.message);
    }
  }

  console.log('\n=== CONCLUSION ===');
  console.log('pick_publish.pick_id likely references canonical_picks, NOT unified_picks');
  console.log('We need to either:');
  console.log('  1. Insert the pick into canonical_picks first, OR');
  console.log('  2. Skip pick_publish and rely on bridge_outbox for publishing');
}

main().catch(console.error);
