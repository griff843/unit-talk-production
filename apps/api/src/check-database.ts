import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

async function checkDatabase() {
  console.log('🔍 Checking database for Optimal props...\n');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!
    );

    // Check total count
    const { count, error: countError } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error getting count:', countError);
      return;
    }

    console.log(`📊 Total props in database: ${count}`);

    // Check for Optimal props specifically
    const { data: optimalProps, error: optimalError } = await supabase
      .from('raw_props')
      .select('*')
      .eq('provider', 'Optimal')
      .order('created_at', { ascending: false })
      .limit(10);

    if (optimalError) {
      console.error('❌ Error getting Optimal props:', optimalError);
      return;
    }

    console.log(`🎯 Optimal props found: ${optimalProps?.length || 0}`);

    if (optimalProps && optimalProps.length > 0) {
      console.log('\n📋 Recent Optimal props:');
      optimalProps.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport}) - ${prop.created_at}`);
      });
    } else {
      console.log('⚠️ No Optimal props found in database');
    }

    // Check for any props from today
    const today = new Date().toISOString().split('T')[0];
    const { data: todayProps, error: todayError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (todayError) {
      console.error('❌ Error getting today props:', todayError);
      return;
    }

    console.log(`\n📅 Props from today: ${todayProps?.length || 0}`);
    if (todayProps && todayProps.length > 0) {
      todayProps.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.player_name} - ${prop.provider} - ${prop.created_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

// Run the check
checkDatabase();