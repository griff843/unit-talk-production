/* eslint-disable no-console, max-lines-per-function, complexity */
/**
 * Check Pick Status - Query unified_picks and pick_publish status
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cqfnsozknjzvyiziwicl.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZm5zb3prbmp6dnlpeml3aWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5NDQxOSwiZXhwIjoyMDc1NDcwNDE5fQ.0fvfA63iHuhlsPNwsVjtQdzMjNivtPLFQZ4hCRX43LI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Known trace_id from the E2E proof run
const TRACE_ID = 'b12fac3c-eaf3-4c8f-92a8-e0f20c957c25';

async function main() {
  console.log('=== CHECKING PICK STATUS ===\n');
  console.log('Trace ID:', TRACE_ID, '\n');

  // Check unified_picks
  console.log('1. unified_picks row:');
  const { data: pick, error: pickError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('trace_id', TRACE_ID)
    .single();

  if (pickError) {
    console.log('   ERROR:', pickError.message);
  } else if (pick) {
    console.log('   id:', pick.id);
    console.log('   form_source:', pick.form_source);
    console.log('   stake:', pick.stake);
    console.log('   user_id:', pick.user_id);
    console.log('   sport:', pick.sport);
    console.log('   status:', pick.status);
    console.log('   created_at:', pick.created_at);
  } else {
    console.log('   NOT FOUND');
  }

  // Check pick_publish
  console.log('\n2. pick_publish row:');
  if (pick) {
    const { data: pp, error: ppError } = await supabase
      .from('pick_publish')
      .select('*')
      .eq('pick_id', pick.id)
      .single();

    if (ppError) {
      console.log('   ERROR:', ppError.message);
    } else if (pp) {
      console.log('   id:', pp.id);
      console.log('   pick_id:', pp.pick_id);
      console.log('   status:', pp.status);
      console.log('   channel:', pp.channel);
      console.log('   discord_channel_id:', pp.discord_channel_id);
      console.log('   external_message_id:', pp.external_message_id || 'NOT YET SET');
      console.log('   attempts:', pp.attempts);
      console.log('   worker_id:', pp.worker_id || 'NOT CLAIMED');
      console.log('   created_at:', pp.created_at);
      console.log('   updated_at:', pp.updated_at);
      console.log('   metadata:', JSON.stringify(pp.metadata, null, 2));
    } else {
      console.log('   NOT FOUND');
    }
  }

  // Check if there are any pending pick_publish records
  console.log('\n3. All pending pick_publish records:');
  const { data: pending, error: pendingError } = await supabase
    .from('pick_publish')
    .select('id, pick_id, status, channel, discord_channel_id, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  if (pendingError) {
    console.log('   ERROR:', pendingError.message);
  } else if (pending && pending.length > 0) {
    console.log('   Found', pending.length, 'pending records:');
    for (const p of pending) {
      console.log('   - id:', p.id, ', pick_id:', p.pick_id, ', channel:', p.channel);
    }
  } else {
    console.log('   No pending records (all processed)');
  }

  // Check recent sent pick_publish records
  console.log('\n4. Recent sent pick_publish records:');
  const { data: sent, error: sentError } = await supabase
    .from('pick_publish')
    .select('id, pick_id, status, external_message_id, discord_channel_id, created_at')
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(5);

  if (sentError) {
    console.log('   ERROR:', sentError.message);
  } else if (sent && sent.length > 0) {
    console.log('   Found', sent.length, 'sent records:');
    for (const s of sent) {
      console.log('   - id:', s.id, ', external_message_id:', s.external_message_id);
      if (s.external_message_id) {
        const url =
          'https://discord.com/channels/1284478946171293736/' +
          s.discord_channel_id +
          '/' +
          s.external_message_id;
        console.log('     Discord URL:', url);
      }
    }
  } else {
    console.log('   No sent records found');
  }
}

main().catch(console.error);
