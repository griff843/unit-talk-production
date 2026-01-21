const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_DIRECT_URL || 'postgresql://postgres.cqfnsozknjzvyiziwicl:Adalise843!@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const createSmartTicketsSQL = `
CREATE TABLE IF NOT EXISTS public.smart_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bet_slip_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    capper_name TEXT NOT NULL,
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    pick_data JSONB NOT NULL DEFAULT '{}',
    form_data JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'processing', 'validated', 'published', 'rejected')),
    validation_errors JSONB DEFAULT '[]',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_tickets_bet_slip_id ON public.smart_tickets(bet_slip_id);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_user_id ON public.smart_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_capper_name ON public.smart_tickets(capper_name);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_status ON public.smart_tickets(status);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_submitted_at ON public.smart_tickets(submitted_at);
`;

const rlsSQL = `
ALTER TABLE public.smart_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_smart_tickets ON public.smart_tickets;
CREATE POLICY service_role_all_smart_tickets ON public.smart_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
`;

(async () => {
  try {
    console.log('=== APPLYING smart_tickets MIGRATION ===');
    console.log('Target: cqfnsozknjzvyiziwicl.supabase.co (STAGING)');
    console.log('Timestamp:', new Date().toISOString());
    console.log('');

    const client = await pool.connect();

    // Check if table already exists
    const checkResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'smart_tickets'"
    );

    if (checkResult.rows.length > 0) {
      console.log('smart_tickets table already exists. Verifying structure...');
    } else {
      console.log('Creating smart_tickets table...');
      await client.query(createSmartTicketsSQL);
      console.log('Table created.');

      console.log('Applying RLS policies...');
      await client.query(rlsSQL);
      console.log('RLS policies applied.');
    }

    // Verify table exists
    const verifyResult = await client.query(
      "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'smart_tickets'"
    );
    console.log('');
    console.log('Verification Result:');
    console.log(JSON.stringify(verifyResult.rows, null, 2));

    // Verify columns
    const columnsResult = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'smart_tickets' ORDER BY ordinal_position"
    );
    console.log('');
    console.log('Table Columns:');
    columnsResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    client.release();
    await pool.end();

    console.log('');
    console.log('=== MIGRATION COMPLETE ===');
  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
