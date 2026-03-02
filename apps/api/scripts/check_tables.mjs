#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Checking tables...\n');

  // Check markets
  const { data: markets, error: mErr } = await supabase.from('markets').select('*').limit(2);
  console.log('markets:', mErr ? `Error: ${mErr.message}` : markets);

  // Check provider_offers
  const { data: offers, error: oErr } = await supabase.from('provider_offers').select('*').limit(2);
  console.log('\nprovider_offers:', oErr ? `Error: ${oErr.message}` : offers);

  // Check events
  const { data: events, error: eErr } = await supabase.from('events').select('*').limit(2);
  console.log('\nevents:', eErr ? `Error: ${eErr.message}` : (events?.length > 0 ? Object.keys(events[0]) : events));

  // Check canonical_events (might be different name)
  const { data: ce, error: ceErr } = await supabase.from('canonical_events').select('*').limit(2);
  console.log('\ncanonical_events:', ceErr ? `Error: ${ceErr.message}` : ce);

  // Check ticket_legs
  const { data: legs, error: lErr } = await supabase.from('ticket_legs').select('event_id').limit(5);
  console.log('\nticket_legs (event_id):', lErr ? `Error: ${lErr.message}` : legs);

  // Check if there's a games table
  const { data: games, error: gErr } = await supabase.from('games').select('*').limit(2);
  console.log('\ngames:', gErr ? `Error: ${gErr.message}` : games);
}

main().catch(console.error);
