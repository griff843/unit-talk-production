/* eslint-disable no-console */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check(): Promise<void> {
  // Count players
  const { count: playerCount } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'player');
  console.log('Total players:', playerCount);

  // Count teams
  const { count: teamCount } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'team');
  console.log('Total teams:', teamCount);

  // Count memberships
  const { count: membershipCount } = await supabase
    .from('participant_memberships')
    .select('*', { count: 'exact', head: true });
  console.log('Total memberships:', membershipCount);

  // Count provider_offers
  const { count: offerCount } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true });
  console.log('Total provider_offers:', offerCount);

  // Count events
  const { count: eventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
  console.log('Total events:', eventCount);

  // Players by sport
  const { data: sports } = await supabase.from('participants').select('sport').eq('type', 'player');

  if (sports) {
    const sportCounts: Record<string, number> = {};
    for (const p of sports) {
      sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1;
    }
    console.log('Players by sport:', sportCounts);
  }

  // Sample players with/without memberships
  const { data: playersWithTeam } = await supabase
    .from('participant_memberships')
    .select('participant_id')
    .is('valid_to', null)
    .limit(5);
  console.log(
    '\nSample player IDs with current membership:',
    playersWithTeam?.map(p => p.participant_id).slice(0, 3)
  );
}

check().catch(console.error);
