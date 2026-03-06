import * as dotenv from 'dotenv';

import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  // Check existing provider_offers rows
  const { data, error } = await supabase
    .from('provider_offers')
    .select(
      'id, event_id, market_id, market_type_id, participant_id, provider, snapshot_at, is_opening, is_closing, provider_event_id'
    )
    .limit(5);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('=== Sample provider_offers rows ===');
  for (const row of data ?? []) {
    console.log(JSON.stringify(row, null, 2));
  }

  // Check if event_id values reference some table
  if (data && data.length > 0) {
    const eventId = data[0].event_id;
    console.log('\n=== Checking event_id:', eventId, '===');

    // Check events table
    const { data: evt } = await supabase.from('events').select('*').eq('id', eventId).single();
    console.log('In events table:', evt ? 'YES' : 'NO');

    // Check provider_event_map
    const { data: pem } = await supabase
      .from('provider_event_map')
      .select('*')
      .eq('canonical_event_id', eventId)
      .limit(1)
      .single();
    console.log('In provider_event_map:', pem ? JSON.stringify(pem) : 'NO');
  }
}
run().catch(e => console.error(e));
