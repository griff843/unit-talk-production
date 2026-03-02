/**
 * Check data alignment between provider_offers and ticket_legs
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DATA ALIGNMENT CHECK');
  console.log('═══════════════════════════════════════════════════════════════');

  // Check provider_offers count
  const { count: offersCount } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true });
  console.log('\nprovider_offers count:', offersCount);

  // Sample provider_offers event_ids
  const { data: offers } = await supabase
    .from('provider_offers')
    .select('event_id, provider')
    .limit(5);
  console.log('\nSample provider_offers:');
  offers?.forEach((o: { event_id: string; provider: string }) => {
    console.log(`  event_id: ${o.event_id?.substring(0, 12)}... provider: ${o.provider}`);
  });

  // Sample ticket_legs event_ids
  const { data: legs } = await supabase
    .from('ticket_legs')
    .select('id, event_id')
    .not('event_id', 'is', null)
    .limit(5);
  console.log('\nSample ticket_legs:');
  legs?.forEach((l: { id: string; event_id: string }) => {
    console.log(`  id: ${l.id?.substring(0, 8)}... event_id: ${l.event_id?.substring(0, 12)}...`);
  });

  // Check scored_legs with uncertainty
  const { data: scored } = await supabase
    .from('scored_legs')
    .select('leg_id, uncertainty_final')
    .not('uncertainty_final', 'is', null)
    .limit(10);
  console.log('\nscored_legs with uncertainty_final (existing before replay):');
  scored?.forEach((s: { leg_id: string; uncertainty_final: number }) => {
    console.log(
      `  leg_id: ${s.leg_id?.substring(0, 8)}... uncertainty: ${s.uncertainty_final?.toFixed(4)} (${(s.uncertainty_final * 100).toFixed(1)}%)`
    );
  });

  // Check if provider_offers event_id matches any ticket_legs
  if (offers && offers.length > 0) {
    const eventId = offers[0].event_id;
    const { data: matchingLegs } = await supabase
      .from('ticket_legs')
      .select('id')
      .eq('event_id', eventId)
      .limit(1);
    console.log(`\nMatch check: provider_offers event_id ${eventId?.substring(0, 12)}...`);
    console.log(`  Matching ticket_legs: ${matchingLegs?.length || 0}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

check().catch(console.error);
