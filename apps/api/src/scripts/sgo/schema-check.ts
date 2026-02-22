/* eslint-disable no-console */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check(): Promise<void> {
  // Get sample event
  const { data: events, error } = await supabase.from('events').select('*').limit(1);

  if (error) {
    console.log('Events table error:', error.message);
  } else if (events && events.length > 0) {
    console.log('Events table columns:', Object.keys(events[0]));
    console.log('\nSample event:', JSON.stringify(events[0], null, 2));
  } else {
    console.log('Events table is empty');
  }

  // Check if canonical_events exists
  const { data: canonicalEvents, error: ce } = await supabase
    .from('canonical_events')
    .select('*')
    .limit(1);

  if (ce) {
    console.log('\ncanonical_events error:', ce.message);
  } else if (canonicalEvents && canonicalEvents.length > 0) {
    console.log('\ncanonical_events columns:', Object.keys(canonicalEvents[0]));
  } else {
    console.log('\ncanonical_events is empty or does not exist');
  }
}

check().catch(console.error);
