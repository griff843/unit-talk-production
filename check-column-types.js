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
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'raw_props'
      AND column_name IN ('professional_score', 'tier', 'edge_score', 'confidence_score', 'kelly_fraction')
    ORDER BY column_name;
  `);

  console.log('📋 SCORING COLUMN TYPES:');
  console.log('='.repeat(60));
  result.rows.forEach(row => {
    console.log(`${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
  });
  console.log('='.repeat(60));

  await client.end();
})();
