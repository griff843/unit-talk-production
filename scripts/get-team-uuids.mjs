import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env file manually
const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const envLines = envFile.split('\n');
for (const line of envLines) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cqfnsozknjzvyiziwicl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getTeamUuids() {
  const teamNames = [
    'Indiana Pacers',
    'Boston Celtics',
    'Los Angeles Lakers',
    'Golden State Warriors'
  ];

  console.log('=== NBA Team UUIDs ===');

  for (const name of teamNames) {
    const { data, error } = await sb
      .from('participants')
      .select('id, name, display_name')
      .eq('type', 'team')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (error) {
      console.log(`${name}: ERROR - ${error.message}`);
    } else {
      console.log(`${name}: ${data.id} (${data.display_name})`);
    }
  }
}

getTeamUuids().catch(console.error);
