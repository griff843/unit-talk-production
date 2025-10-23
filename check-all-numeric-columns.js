const { Client } = require('pg');

(async () => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
  const poolerUrl = `postgresql://postgres.${projectRef}:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  const client = new Client({
    connectionString: poolerUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const result = await client.query(`
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_name = 'raw_props'
      AND column_name IN ('professional_score', 'kelly_fraction')
    ORDER BY column_name;
  `);

  console.log('NUMERIC COLUMN DETAILS:');
  console.log('='.repeat(60));
  result.rows.forEach(row => {
    console.log(`${row.column_name}: ${row.data_type} (precision: ${row.numeric_precision}, scale: ${row.numeric_scale})`);
  });
  console.log('='.repeat(60));

  await client.end();
})();
