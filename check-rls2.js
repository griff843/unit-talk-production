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

  const result = await client.query("SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'raw_props' ORDER BY policyname;");

  console.log('RLS POLICIES ON raw_props:');
  console.log('='.repeat(80));
  if (result.rows.length === 0) {
    console.log('No RLS policies found');
  } else {
    result.rows.forEach(policy => {
      console.log("Policy: " + policy.policyname);
      console.log("  Command: " + policy.cmd);
      console.log("  Roles: " + JSON.stringify(policy.roles));
      console.log('');
    });
  }
  console.log('='.repeat(80));

  await client.end();
})();
