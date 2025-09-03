#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSmartTicketsSchema() {
  console.log('🔍 Checking smart_tickets table schema...');

  try {
    const { data, error } = await supabase.from('smart_tickets').select('*').limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      console.log('\n✅ Available columns in smart_tickets:');
      Object.keys(data[0]).forEach(column => {
        console.log(`   - ${column}`);
      });
    } else {
      console.log('\n⚠️  No data in smart_tickets table');

      // Try to insert a minimal record to see what's required
      console.log('\n🧪 Testing minimal record insertion...');
      const minimalRecord = {
        bet_slip_id: 'test-' + Date.now(),
        capper: 'Test',
        ticket_type: 'single',
        sport: 'NBA',
        status: 'submitted',
      };

      const { data: insertData, error: insertError } = await supabase
        .from('smart_tickets')
        .insert([minimalRecord])
        .select()
        .single();

      if (insertError) {
        console.log('❌ Insert failed:', insertError.message);
      } else {
        console.log('✅ Minimal record inserted successfully');
        console.log('Available columns:');
        Object.keys(insertData).forEach(column => {
          console.log(`   - ${column}`);
        });

        // Clean up test record
        await supabase.from('smart_tickets').delete().eq('bet_slip_id', minimalRecord.bet_slip_id);
      }
    }
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  }
}

checkSmartTicketsSchema();
