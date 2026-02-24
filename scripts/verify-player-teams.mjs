/**
 * Verify NBA Player Team Assignments
 * SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090
 * SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091: Updated to use UUID team_ids
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env file
try {
  const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  const envLines = envFile.split('\n');
  for (const line of envLines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  }
} catch (e) {
  // .env not found, use existing env
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cqfnsozknjzvyiziwicl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Team UUIDs (from participants table)
const TEAM_UUIDS = {
  INDIANA_PACERS: 'f0fdd6a5-ac21-4608-adce-d7a91721890d',
  GOLDEN_STATE_WARRIORS: '63d0c5a6-8df9-43fe-a6dd-648704b12771',
  BOSTON_CELTICS: 'fed6eb21-5632-46aa-9606-38755b7db445',
  LOS_ANGELES_LAKERS: '95830c8b-e08a-493b-aa83-1b9cbe092593',
  ATLANTA_HAWKS: null, // Query to get if needed
};

async function verify() {
  console.log('=== NBA Player Team Assignment Verification ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Using UUID team_ids (participants table)');
  console.log();

  // Sample Indiana Pacers players
  const { data: pacers, error: e1 } = await supabase
    .from('catalog_players_v1')
    .select('player_name, team_id, team_name, sport')
    .eq('sport', 'NBA')
    .eq('team_id', TEAM_UUIDS.INDIANA_PACERS)
    .limit(15);

  console.log('=== Indiana Pacers Players ===');
  if (e1) {
    console.log('Error:', e1.message);
  } else {
    pacers.forEach(p => {
      console.log(`  ${p.player_name} -> ${p.team_name} (${p.team_id})`);
    });
    console.log(`Total: ${pacers.length} players`);
  }
  console.log();

  // Sample Golden State Warriors players
  const { data: warriors, error: e2 } = await supabase
    .from('catalog_players_v1')
    .select('player_name, team_id, team_name, sport')
    .eq('sport', 'NBA')
    .eq('team_id', TEAM_UUIDS.GOLDEN_STATE_WARRIORS)
    .limit(15);

  console.log('=== Golden State Warriors Players ===');
  if (e2) {
    console.log('Error:', e2.message);
  } else {
    warriors.forEach(p => {
      console.log(`  ${p.player_name} -> ${p.team_name} (${p.team_id})`);
    });
    console.log(`Total: ${warriors.length} players`);
  }
  console.log();

  // Verify specific players that were known to be wrong
  console.log('=== Spot Check (previously wrong assignments) ===');

  const checkPlayers = [
    { name: 'Jonathan Kuminga', expectedTeam: 'Golden State Warriors' },
    { name: 'CJ McCollum', expectedTeam: 'New Orleans Pelicans' },
    { name: 'LaMelo Ball', expectedTeam: 'Charlotte Hornets' },
    { name: 'Stephen Curry', expectedTeam: 'Golden State Warriors' },
    { name: 'Tyrese Haliburton', expectedTeam: 'Indiana Pacers' },
    { name: 'LeBron James', expectedTeam: 'Los Angeles Lakers' },
  ];

  for (const { name, expectedTeam } of checkPlayers) {
    const { data } = await supabase
      .from('catalog_players_v1')
      .select('player_name, team_id, team_name, sport')
      .eq('sport', 'NBA')
      .ilike('player_name', `%${name}%`)
      .single();

    if (data) {
      const match = data.team_name === expectedTeam ? 'CORRECT' : 'WRONG';
      console.log(`  ${data.player_name} -> ${data.team_name} [${match}]`);
    } else {
      console.log(`  ${name} -> NOT FOUND`);
    }
  }
  console.log();

  // Count NBA players per team (top 10)
  console.log('=== NBA Players Per Team (top 10) ===');
  const { data: counts } = await supabase
    .from('catalog_players_v1')
    .select('team_name')
    .eq('sport', 'NBA');

  if (counts) {
    const teamCounts = {};
    counts.forEach(p => {
      teamCounts[p.team_name] = (teamCounts[p.team_name] || 0) + 1;
    });
    Object.entries(teamCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([team, count]) => {
        console.log(`  ${team}: ${count} players`);
      });
  }

  console.log();
  console.log('=== Verification Complete ===');
}

verify().catch(console.error);
