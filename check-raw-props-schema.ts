import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRawPropsSchema() {
  console.log('🔍 Checking raw_props table schema...');
  
  try {
    // Try to get the table structure by attempting to select with limit 0
    const { data, error } = await supabase
      .from('raw_props')
      .select('*')
      .limit(0);
    
    if (error) {
      console.error('❌ Error accessing raw_props table:', error);
      return;
    }
    
    console.log('✅ raw_props table exists');
    
    // Try to insert a minimal test record to see what fields are required
    const testId = randomUUID();
    const testRecord = {
      id: testId,
      player_name: 'Test Player',
      stat_type: 'Test Stat',
      line: 1.5,
      created_at: new Date().toISOString()
    };
    
    console.log('🧪 Testing minimal insert to understand required fields...');
    const { error: insertError } = await supabase
      .from('raw_props')
      .insert(testRecord);
    
    if (insertError) {
      console.log('❌ Insert error (this helps us understand the schema):', insertError);
      
      // Try with additional common fields
      console.log('🧪 Trying with more fields...');
      const extendedRecord = {
        ...testRecord,
        scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        provider: 'Test',
        sport: 'Test Sport',
        league: 'Test League'
      };
      
      const { error: extendedError } = await supabase
        .from('raw_props')
        .insert(extendedRecord);
        
      if (extendedError) {
        console.log('❌ Extended insert error:', extendedError);
      } else {
        console.log('✅ Extended insert successful');
        // Clean up the test record
        await supabase.from('raw_props').delete().eq('id', testId);
      }
    } else {
      console.log('✅ Minimal insert successful');
      // Clean up the test record
      await supabase.from('raw_props').delete().eq('id', testId);
    }
    
  } catch (error) {
    console.error('❌ Exception:', error);
  }
}

checkRawPropsSchema();