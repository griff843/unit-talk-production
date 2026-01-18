const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_DIRECT_URL,
  max: 1,
});

async function applyChanges() {
  const client = await pool.connect();
  try {
    console.log('Applying core schema changes...\n');
    
    // 1. Enable RLS on unified_picks
    console.log('1. Enabling RLS on unified_picks...');
    await client.query('ALTER TABLE unified_picks ENABLE ROW LEVEL SECURITY;');
    console.log('   ✓ RLS enabled\n');
    
    // 2. Drop existing policies
    console.log('2. Dropping existing policies...');
    const { rows: policies } = await client.query(`
      SELECT policyname FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'unified_picks'
    `);
    for (const policy of policies) {
      await client.query(`DROP POLICY IF EXISTS "${policy.policyname}" ON unified_picks`);
      console.log(`   ✓ Dropped policy: ${policy.policyname}`);
    }
    if (policies.length === 0) console.log('   No existing policies found\n');
    
    // 3. Create read-only policies
    console.log('3. Creating read-only policies...');
    await client.query(`
      CREATE POLICY "unified_picks: Allow SELECT for all"
        ON unified_picks FOR SELECT USING (true);
    `);
    console.log('   ✓ SELECT policy created');
    
    await client.query(`
      CREATE POLICY "unified_picks: Deny INSERT"
        ON unified_picks FOR INSERT WITH CHECK (false);
    `);
    console.log('   ✓ INSERT policy created (deny all)');
    
    await client.query(`
      CREATE POLICY "unified_picks: Deny UPDATE"
        ON unified_picks FOR UPDATE USING (false);
    `);
    console.log('   ✓ UPDATE policy created (deny all)');
    
    await client.query(`
      CREATE POLICY "unified_picks: Deny DELETE"
        ON unified_picks FOR DELETE USING (false);
    `);
    console.log('   ✓ DELETE policy created (deny all)\n');
    
    // 4. Add deprecation comment
    console.log('4. Adding deprecation notice...');
    await client.query(`
      COMMENT ON TABLE unified_picks IS 'DEPRECATED - READ ONLY. Use canonical "picks" table for all operations. Charter v3.0 mandates canonical-first architecture.';
    `);
    console.log('   ✓ Deprecation notice added\n');
    
    // 5. Add scoring columns to picks if not exist
    console.log('5. Adding scoring columns to picks table...');
    try {
      await client.query(`
        ALTER TABLE picks 
        ADD COLUMN IF NOT EXISTS self_score DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS self_score_notes TEXT,
        ADD COLUMN IF NOT EXISTS self_scored_at TIMESTAMPTZ;
      `);
      console.log('   ✓ Self-score columns added\n');
    } catch (e) {
      console.log('   Note: Columns may already exist\n');
    }
    
    // 6. Trigger PostgREST reload
    console.log('6. Triggering PostgREST reload...');
    await client.query(`SELECT pg_notify('pgrst', 'reload schema');`);
    console.log('   ✓ PostgREST reload triggered\n');
    
    console.log('✅ Core schema changes applied successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyChanges();
