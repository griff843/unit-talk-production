/**
 * Database State Check Script
 * Checks the current state of users, unified_picks, and related tables
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('Checking database state...\n');

  // Check users table
  console.log('=== USERS TABLE ===');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .limit(10);

  if (usersError) {
    console.log('Error querying users:', usersError.message);
  } else {
    console.log(`Found ${users?.length || 0} users:`);
    users?.forEach((u: any) => {
      console.log(`  - ${u.username} (${u.id}) - tier: ${u.tier}, active: ${u.active}`);
    });
  }

  // Check if table exists and its columns
  console.log('\n=== USERS TABLE SCHEMA ===');
  const { data: usersSchema, error: schemaError } = await supabase.rpc('get_table_info', { table_name: 'users' });
  if (schemaError) {
    // Try a different approach - just query one row
    const { data: sampleUser, error: sampleError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('Cannot get schema info:', sampleError.message);
    } else if (sampleUser && sampleUser.length > 0) {
      console.log('Columns found:', Object.keys(sampleUser[0]).join(', '));
    } else {
      console.log('Table appears empty or inaccessible');
    }
  } else {
    console.log('Schema:', usersSchema);
  }

  // Check unified_picks table
  console.log('\n=== UNIFIED_PICKS TABLE ===');
  const { data: picks, error: picksError } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(5);

  if (picksError) {
    console.log('Error querying unified_picks:', picksError.message);
  } else {
    console.log(`Found ${picks?.length || 0} picks:`);
    if (picks && picks.length > 0) {
      console.log('Sample pick columns:', Object.keys(picks[0]).join(', '));
    }
  }

  // Check smart_tickets table
  console.log('\n=== SMART_TICKETS TABLE ===');
  const { data: tickets, error: ticketsError } = await supabase
    .from('smart_tickets')
    .select('*')
    .limit(5);

  if (ticketsError) {
    console.log('Error querying smart_tickets:', ticketsError.message);
  } else {
    console.log(`Found ${tickets?.length || 0} tickets`);
    if (tickets && tickets.length > 0) {
      console.log('Sample ticket columns:', Object.keys(tickets[0]).join(', '));
    }
  }

  // Check bridge_outbox table
  console.log('\n=== BRIDGE_OUTBOX TABLE ===');
  const { data: outbox, error: outboxError } = await supabase
    .from('bridge_outbox')
    .select('*')
    .limit(5);

  if (outboxError) {
    console.log('Error querying bridge_outbox:', outboxError.message);
  } else {
    console.log(`Found ${outbox?.length || 0} outbox events`);
    if (outbox && outbox.length > 0) {
      console.log('Sample outbox columns:', Object.keys(outbox[0]).join(', '));
    }
  }

  // Try to list all tables
  console.log('\n=== ALL TABLES ===');
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .limit(50);

  if (tablesError) {
    console.log('Cannot list tables directly. Trying RPC...');

    // Alternative: try common tables
    const commonTables = ['users', 'unified_picks', 'smart_tickets', 'bridge_outbox', 'raw_props', 'games', 'players', 'capper_profiles'];
    for (const tableName of commonTables) {
      const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (!error) {
        console.log(`  ✅ ${tableName}: ${count} rows`);
      } else {
        console.log(`  ❌ ${tableName}: ${error.message}`);
      }
    }
  } else {
    console.log('Tables:', tables?.map((t: any) => t.table_name).join(', '));
  }
}

main().catch(console.error);
