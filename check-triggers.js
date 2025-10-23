const { Client } = require('pg');

(async () => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
  const poolerUrl = "postgresql://postgres." + projectRef + ":Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

  const client = new Client({
    connectionString: poolerUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  // Check for triggers
  const triggers = await client.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'raw_props'
  `);

  console.log('TRIGGERS ON raw_props:');
  console.log('='.repeat(80));
  if (triggers.rows.length === 0) {
    console.log('No triggers found');
  } else {
    triggers.rows.forEach(t => {
      console.log(`Trigger: ${t.trigger_name}`);
      console.log(`  Event: ${t.event_manipulation}`);
      console.log(`  Statement: ${t.action_statement}`);
      console.log('');
    });
  }
  console.log('='.repeat(80));

  await client.end();
})();
