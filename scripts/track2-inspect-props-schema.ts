import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function inspectPropsSchema() {
  console.log('=== Track 2: Inspecting props table schema ===\n');

  // Query information_schema to see what columns exist in props table
  const { data: columns, error: columnsError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'props')
    .order('ordinal_position');

  if (columnsError) {
    console.error('ERROR querying props schema:', columnsError);

    // Try alternative: query a single row from props to see what columns exist
    console.log('\nTrying alternative: querying props table directly...');
    const { data: sample, error: sampleError } = await supabase
      .from('props')
      .select('*')
      .limit(1)
      .single();

    if (sampleError) {
      console.error('ERROR querying props:', sampleError);
    } else if (sample) {
      console.log('✅ props table columns (from sample row):');
      Object.keys(sample).forEach(col => {
        console.log(`  - ${col}: ${typeof sample[col]}`);
      });
    }

    return;
  }

  console.log('✅ props table schema:');
  console.log(JSON.stringify(columns, null, 2));
  console.log('');

  // Check if home_team and away_team exist
  const hasHomeTeam = columns?.some(c => c.column_name === 'home_team');
  const hasAwayTeam = columns?.some(c => c.column_name === 'away_team');

  console.log('Column existence check:');
  console.log(`  - home_team: ${hasHomeTeam ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`  - away_team: ${hasAwayTeam ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log('');

  // Check for props_1 view
  console.log('Checking for props_1 view...');
  const { data: views, error: viewsError } = await supabase.rpc('pg_get_viewdef', {
    view_oid: 'props_1'
  });

  if (viewsError) {
    console.log('  ℹ️ props_1 is not a view (or does not exist)');
    console.log(`  Error: ${viewsError.message}`);
  } else {
    console.log('✅ props_1 view definition:');
    console.log(views);
  }
}

inspectPropsSchema().catch(console.error);
