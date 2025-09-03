#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking raw_props table schema...');

  try {
    // Get a sample record to see the actual schema
    const { data, error } = await supabase.from('raw_props').select('*').limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      console.log('\n✅ Available columns in raw_props:');
      Object.keys(data[0]).forEach(column => {
        console.log(`   - ${column}: ${typeof data[0][column]}`);
      });
    } else {
      console.log('\n⚠️  No data in raw_props table');
    }
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  }
}

checkSchema();
