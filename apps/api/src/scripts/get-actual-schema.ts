import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcxMTQ2NjYsImV4cCI6MjA0MjY5MDY2Nn0.4kR7smJxLw6vZwKLZaewoaNOstr1JcdxLE-Ydt3LWjE'
);

async function getActualSchema() {
  console.log('🔍 Querying actual Supabase schema...\n');

  // Get unified_picks columns
  const { data: unifiedPicksColumns, error: upError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'unified_picks'
      ORDER BY ordinal_position;
    `
  });

  if (!upError && unifiedPicksColumns) {
    console.log('✅ unified_picks columns:');
    console.log(JSON.stringify(unifiedPicksColumns, null, 2));
  }

  // Get raw_props columns
  const { data: rawPropsColumns, error: rpError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'raw_props'
      ORDER BY ordinal_position;
    `
  });

  if (!rpError && rawPropsColumns) {
    console.log('\n✅ raw_props columns:');
    console.log(JSON.stringify(rawPropsColumns, null, 2));
  }

  // Get promotion_queue columns
  const { data: promoColumns, error: pqError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'promotion_queue'
      ORDER BY ordinal_position;
    `
  });

  if (!pqError && promoColumns) {
    console.log('\n✅ promotion_queue columns:');
    console.log(JSON.stringify(promoColumns, null, 2));
  }

  // Get games columns
  const { data: gamesColumns, error: gError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'games'
      ORDER BY ordinal_position;
    `
  });

  if (!gError && gamesColumns) {
    console.log('\n✅ games columns:');
    console.log(JSON.stringify(gamesColumns, null, 2));
  }
}

getActualSchema().catch(console.error);
