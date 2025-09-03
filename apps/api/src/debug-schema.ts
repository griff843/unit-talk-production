import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseKey = process.env['SUPABASE_KEY']!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking raw_props table schema...\n');
  
  try {
    // Get table schema information
    const { data, error } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying raw_props:', error);
      return;
    }
    
    console.log('✅ Successfully connected to raw_props table');
    console.log('📊 Current row count:', data?.length || 0);
    
    // Try to insert a minimal test record to see what fails
    console.log('\n🧪 Testing minimal insert...');
    
    const testProp = {
      player_name: 'Test Player',
      stat_type: 'points',
      line: 25.5,
      sport: 'NBA',
      provider: 'test',
      scraped_at: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('raw_props')
      .insert(testProp)
      .select();
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      console.log('📋 Error details:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      });
    } else {
      console.log('✅ Test insert successful:', insertData);
      
      // Clean up test record
      if (insertData && insertData[0]) {
        await supabase
          .from('raw_props')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Cleaned up test record');
      }
    }
    
  } catch (error) {
    console.error('❌ Exception:', error);
  }
}

checkDatabaseSchema().then(() => {
  console.log('\n✅ Schema check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Schema check failed:', error);
  process.exit(1);
});