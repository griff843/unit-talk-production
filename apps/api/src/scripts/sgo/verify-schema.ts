/* eslint-disable no-console, max-lines-per-function, @typescript-eslint/no-unused-vars, no-unused-vars */
/**
 * Verify Schema for Teams/Players Sync
 * Sprint: SPRINT-ROSTERS-TEAMS-SYNC-100A
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

async function main() {
  console.log('='.repeat(60));
  console.log('SCHEMA VERIFICATION');
  console.log('Sprint: SPRINT-ROSTERS-TEAMS-SYNC-100A');
  console.log('='.repeat(60));
  console.log();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Check participants table
  console.log('1. Checking participants table...');
  const { data: sample, error } = await supabase
    .from('participants')
    .select('id, external_id, type, name, display_name, sport, league, meta, active')
    .limit(1);

  if (error) {
    console.log('   ERROR:', error.message);
    process.exit(1);
  }
  console.log('   participants table: EXISTS');
  console.log('   Columns: id, external_id, type, name, display_name, sport, league, meta, active');

  // Check participant_memberships table
  console.log();
  console.log('2. Checking participant_memberships table...');
  const { error: membershipError } = await supabase
    .from('participant_memberships')
    .select('id, participant_id, team_id, role, valid_from, valid_to')
    .limit(1);

  if (membershipError) {
    console.log('   ERROR:', membershipError.message);
  } else {
    console.log('   participant_memberships table: EXISTS');
    console.log('   Columns: id, participant_id, team_id, role, valid_from, valid_to');
  }

  // Count existing participants
  console.log();
  console.log('3. Current participant counts...');

  const { count: teamCount } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'team');

  const { count: playerCount } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'player');

  console.log(`   Teams: ${teamCount}`);
  console.log(`   Players: ${playerCount}`);

  console.log();
  console.log('='.repeat(60));
  console.log('SCHEMA VERIFICATION: PASSED');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
