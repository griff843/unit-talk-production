#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllSchemas() {
  const tables = ['raw_props', 'unified_picks', 'final_picks'];

  for (const table of tables) {
    console.log(`\n🔍 Checking ${table} table schema...`);

    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        console.log(`✅ Available columns in ${table}:`);
        Object.keys(data[0]).forEach(column => {
          console.log(`   - ${column}`);
        });
      } else {
        console.log(`⚠️  No data in ${table} table`);

        // Try to get schema from information_schema
        console.log(`   Attempting to get schema from system tables...`);
      }
    } catch (error) {
      console.error(`❌ Error checking ${table} schema:`, error.message);
    }
  }
}

checkAllSchemas();
