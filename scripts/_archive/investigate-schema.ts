/**
 * Schema Investigation Script
 * Detailed investigation of unified_picks and publishing mechanism
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('Investigating schema...\n');

  // Get full unified_picks schema by selecting a row
  console.log('=== UNIFIED_PICKS FULL SCHEMA ===');
  const { data: pick, error: pickError } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1)
    .single();

  if (pickError && pickError.code !== 'PGRST116') {
    console.log('Error:', pickError.message);
  }

  if (pick) {
    console.log('\nColumn names and sample values:');
    Object.entries(pick).forEach(([key, value]) => {
      console.log(`  ${key}: ${typeof value} = ${JSON.stringify(value)?.substring(0, 80)}`);
    });
  }

  // Check for any pick_publish table
  console.log('\n=== PICK_PUBLISH TABLE CHECK ===');
  const { data: pickPublish, error: ppError } = await supabase
    .from('pick_publish')
    .select('*')
    .limit(1);

  if (ppError) {
    console.log('pick_publish table:', ppError.message);
  } else {
    console.log('pick_publish exists, sample columns:', pickPublish ? Object.keys(pickPublish[0] || {}).join(', ') : 'empty');
  }

  // Check for canonical_picks or similar
  console.log('\n=== OTHER PICK TABLES ===');
  const tableNames = ['canonical_picks', 'daily_picks', 'final_picks', 'approved_picks', 'published_picks'];
  for (const table of tableNames) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`✅ ${table} exists`);
      if (data && data.length > 0) {
        console.log('   Columns:', Object.keys(data[0]).join(', '));
      }
    } else if (error.code === 'PGRST116') {
      console.log(`✅ ${table} exists but is empty`);
    } else {
      console.log(`❌ ${table}: ${error.message}`);
    }
  }

  // Check users schema
  console.log('\n=== USERS FULL SCHEMA ===');
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single();

  if (user) {
    console.log('\nColumn names:');
    Object.entries(user).forEach(([key, value]) => {
      console.log(`  ${key}: ${typeof value} = ${JSON.stringify(value)?.substring(0, 80)}`);
    });
  }

  // Check events table for publishing events
  console.log('\n=== EVENTS TABLE ===');
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .limit(5);

  if (eventsError) {
    console.log('events table:', eventsError.message);
  } else {
    console.log(`events table has ${events?.length || 0} events`);
    if (events && events.length > 0) {
      console.log('Columns:', Object.keys(events[0]).join(', '));
      console.log('Event types:', [...new Set(events.map((e: any) => e.event_type))].join(', '));
    }
  }

  // Check workflow_stage values in unified_picks
  console.log('\n=== WORKFLOW STAGES IN USE ===');
  const { data: stages, error: stagesError } = await supabase
    .from('unified_picks')
    .select('workflow_stage, queue_status')
    .limit(100);

  if (!stagesError && stages) {
    const uniqueStages = [...new Set(stages.map((s: any) => s.workflow_stage))];
    const uniqueStatuses = [...new Set(stages.map((s: any) => s.queue_status))];
    console.log('Workflow stages:', uniqueStages.join(', ') || 'none found');
    console.log('Queue statuses:', uniqueStatuses.join(', ') || 'none found');
  }

  // Try to find Discord-related columns or tables
  console.log('\n=== DISCORD PUBLISHING MECHANISM ===');
  const { data: discordTable, error: discordError } = await supabase
    .from('discord_messages')
    .select('*')
    .limit(1);

  if (!discordError) {
    console.log('discord_messages table exists');
    if (discordTable && discordTable.length > 0) {
      console.log('Columns:', Object.keys(discordTable[0]).join(', '));
    }
  } else {
    console.log('discord_messages:', discordError.message);
  }

  // Check for shadow_picks or shadow-related
  const { data: shadow, error: shadowError } = await supabase
    .from('shadow_picks')
    .select('*')
    .limit(1);

  if (!shadowError) {
    console.log('shadow_picks exists');
  } else {
    console.log('shadow_picks:', shadowError.message);
  }
}

main().catch(console.error);
