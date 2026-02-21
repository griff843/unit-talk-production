import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== USERS TABLE ===\n');

  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('*')
    .limit(30);

  if (usersErr) {
    console.log('Users error:', usersErr.message);
  } else if (users && users.length > 0) {
    console.log('Columns:', Object.keys(users[0]).join(', '));
    console.log('\nUsers:');
    users.forEach(u => {
      const name = u.display_name || u.username || u.discord_id || u.id?.slice(0, 8);
      console.log(`  ${name} | capper: ${u.is_capper} | active: ${u.active}`);
    });
  }

  console.log('\n=== DISTINCT CAPPERS FROM UNIFIED_PICKS ===');
  const { data: picks } = await supabase
    .from('unified_picks')
    .select('capper_name, capper_id')
    .not('capper_name', 'is', null)
    .limit(500);

  const uniqueCappers = new Map();
  if (picks) {
    for (const p of picks) {
      if (p.capper_name && !uniqueCappers.has(p.capper_name)) {
        uniqueCappers.set(p.capper_name, p.capper_id);
      }
    }
  }
  console.log('Unique cappers from picks:', uniqueCappers.size);
  for (const [name, id] of uniqueCappers) {
    console.log(`  ${name} | id: ${id || 'none'}`);
  }

  console.log('\n=== DISTINCT CAPPERS FROM SMART_TICKETS ===');
  const { data: tickets } = await supabase
    .from('smart_tickets')
    .select('capper_name, capper_id')
    .not('capper_name', 'is', null)
    .limit(500);

  const ticketCappers = new Map();
  if (tickets) {
    for (const t of tickets) {
      if (t.capper_name && !ticketCappers.has(t.capper_name)) {
        ticketCappers.set(t.capper_name, t.capper_id);
      }
    }
  }
  console.log('Unique cappers from tickets:', ticketCappers.size);
  for (const [name, id] of ticketCappers) {
    console.log(`  ${name} | id: ${id || 'none'}`);
  }
}

main();
