const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('📋 RAW_PROPS TABLE SCHEMA CHECK');
  console.log('='.repeat(60));

  // Get one recent row to see all columns
  const { data, error } = await supabase
    .from('raw_props')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  if (data) {
    console.log('\n📊 Available Columns:');
    const columns = Object.keys(data);
    columns.forEach((col, idx) => {
      const val = data[col];
      console.log(`  ${idx + 1}. ${col}: ${typeof val} = ${val}`);
    });

    console.log('\n📝 Scoring-related columns:');
    const scoringCols = columns.filter(c =>
      c.includes('score') ||
      c.includes('tier') ||
      c.includes('edge') ||
      c.includes('confidence') ||
      c.includes('professional')
    );
    if (scoringCols.length > 0) {
      scoringCols.forEach(col => console.log(`  ✓ ${col}`));
    } else {
      console.log('  ⚠️ NO SCORING COLUMNS FOUND');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Schema check complete');
  console.log('='.repeat(60));
})();
