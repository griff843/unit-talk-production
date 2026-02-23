/**
 * Explore Database Structure
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function exploreDatabase() {
  console.log('🔍 EXPLORING DATABASE STRUCTURE');
  console.log('='.repeat(40));

  // Check what tables exist
  // SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Removed daily_picks
  const tablesToCheck = [
    'unified_picks',
    'raw_props',
    'users',
    'grading_results',
    'picks',
    'bridge_outbox',
  ];

  for (const table of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: Does not exist (${error.message})`);
      } else {
        console.log(`✅ ${table}: Exists (${count} records)`);

        // Get sample to see schema
        const { data } = await supabase.from(table).select('*').limit(1);

        if (data && data.length > 0) {
          console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
        } else {
          // Try empty select to see column names
          try {
            const { error: selectError } = await supabase.from(table).select('*').limit(0);

            if (!selectError) {
              console.log(`   Table exists but is empty`);
            }
          } catch (e) {
            // Silent - just means we can't determine schema
          }
        }
      }
    } catch (e: any) {
      console.log(`❌ ${table}: Error accessing (${e.message})`);
    }
  }

  // Special check for unified_picks - try to understand its schema
  console.log('\n🔬 DEEP DIVE: unified_picks table');
  try {
    // Try inserting with just ID to see what's required
    const { error } = await supabase
      .from('unified_picks')
      .insert({ id: 'test-schema-check' })
      .select();

    if (error) {
      console.log(`Schema error: ${error.message}`);
      console.log(`Details: ${JSON.stringify(error.details)}`);
    }
  } catch (e: any) {
    console.log(`Insert test error: ${e.message}`);
  }

  console.log('\n📋 DATABASE EXPLORATION COMPLETE');
}

exploreDatabase()
  .then(() => process.exit(0))
  .catch(console.error);
