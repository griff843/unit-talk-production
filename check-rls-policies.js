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
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'raw_props'
    ORDER BY policyname;
  `);

  console.log('RLS POLICIES ON raw_props:');
  console.log('='.repeat(80));
  result.rows.forEach(policy => {
    console.log(`Policy: ${policy.policyname}`);
    console.log(`  Command: ${policy.cmd}`);
    console.log(`  Roles: ${policy.roles}`);
    console.log(`  Permissive: ${policy.permissive}`);
    console.log(`  Using (qual): ${policy.qual || 'N/A'}`);
    console.log(`  With check: ${policy.with_check || 'N/A'}`);
    console.log('');
  });
  console.log('='.repeat(80));

  await client.end();
})();
