import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
// Use service_role key to bypass RLS policies
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLatestSubmission() {
  console.log('🔍 Checking for latest submission...\n');

  // Check bridge_outbox for recent submissions
  const { data: outboxData, error: outboxError } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('event_type', 'ticket_submitted')
    .gte('created_at', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
    .order('created_at', { ascending: false })
    .limit(3);

  if (outboxError) {
    console.error('❌ Error querying bridge_outbox:', outboxError);
  } else if (outboxData && outboxData.length > 0) {
    console.log(`✅ Found ${outboxData.length} recent submission(s) in bridge_outbox:\n`);
    outboxData.forEach((event: any, idx: number) => {
      console.log(`Submission #${idx + 1}:`);
      console.log('  ID:', event.id);
      console.log('  Event Type:', event.event_type);
      console.log('  Status:', event.status);
      console.log('  Created At:', event.created_at);
      console.log('  Full Data:', JSON.stringify(event, null, 2));
      console.log('---\n');
    });
  } else {
    console.log('⚠️ No recent submissions found in bridge_outbox (last 5 minutes)\n');
  }

  // Check smart_tickets table
  const { data: ticketsData, error: ticketsError } = await supabase
    .from('smart_tickets')
    .select('*')
    .gte('created_at', new Date(Date.now() - 300000).toISOString())
    .order('created_at', { ascending: false })
    .limit(3);

  if (ticketsError) {
    console.error('❌ Error querying smart_tickets:', ticketsError);
  } else if (ticketsData && ticketsData.length > 0) {
    console.log(`✅ Found ${ticketsData.length} recent ticket(s) in smart_tickets:\n`);
    ticketsData.forEach((ticket: any, idx: number) => {
      console.log(`Ticket #${idx + 1}:`);
      console.log('  Bet Slip ID:', ticket.bet_slip_id);
      console.log('  Capper ID:', ticket.capper_id);
      console.log('  Sport:', ticket.sport);
      console.log('  Status:', ticket.status);
      console.log('  Created At:', ticket.created_at);
      console.log('  Selections:', JSON.stringify(ticket.game_selections, null, 2));
      console.log('---\n');
    });
  } else {
    console.log('⚠️ No recent tickets found in smart_tickets (last 5 minutes)\n');
  }

  // Check unified_picks table
  const { data: picksData, error: picksError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('user_id', '0aca56c1-b9d9-4fde-b9e1-914d779e50ba') // Griff843's UUID
    .gte('created_at', new Date(Date.now() - 300000).toISOString())
    .order('created_at', { ascending: false })
    .limit(3);

  if (picksError) {
    console.error('❌ Error querying unified_picks:', picksError);
  } else if (picksData && picksData.length > 0) {
    console.log(`✅ Found ${picksData.length} recent pick(s) for Griff843 in unified_picks:\n`);
    picksData.forEach((pick: any, idx: number) => {
      console.log(`Pick #${idx + 1}:`);
      console.log('  ID:', pick.id);
      console.log('  User ID:', pick.user_id);
      console.log('  Sport:', pick.sport);
      console.log('  Status:', pick.status);
      console.log('  Created At:', pick.created_at);
      console.log('  Selection:', pick.selection);
      console.log('---\n');
    });
  } else {
    console.log('⚠️ No recent picks found for Griff843 in unified_picks (last 5 minutes)\n');
  }
}

verifyLatestSubmission().catch(console.error);
