import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  // Check for Aaron Judge variants
  const { data: judges } = await sb
    .from('players')
    .select('full_name, team_abbr')
    .ilike('full_name', '%Judge%');
  console.log('Players with Judge:', JSON.stringify(judges, null, 2));

  // Check MLB team count
  const { data: mlbTeams } = await sb
    .from('teams')
    .select('name, abbr')
    .eq('sport', 'MLB');
  console.log('\nMLB teams count:', mlbTeams?.length);
  console.log('MLB teams:', mlbTeams?.map(t => `${t.name} (${t.abbr})`).join(', '));

  // Check NYY players
  const { data: nyyPlayers } = await sb
    .from('players')
    .select('full_name')
    .eq('team_abbr', 'NYY')
    .limit(10);
  console.log('\nNYY players sample:', nyyPlayers?.map(p => p.full_name).join(', '));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
