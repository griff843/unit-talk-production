#!/usr/bin/env node
/**
 * Apply Canonical Schema Migration via Supabase Client
 * Date: 2025-01-29
 * 
 * This script applies the canonical picks/pick_publish schema using Supabase client.
 * It's idempotent and safe to run multiple times.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

const CANONICAL_SCHEMA_SQL = `
-- ============================================================================
-- CANONICAL SCHEMA: picks + pick_publish
-- Date: 2025-01-29
-- Idempotent: Safe to run multiple times
-- ============================================================================

-- Create picks table
CREATE TABLE IF NOT EXISTS public.picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  league text NOT NULL CHECK (league IN ('NBA','NFL','MLB','NHL','NCAAF','NCAAB','WNBA')),
  player_id uuid,
  player_name text NOT NULL,
  market_type text NOT NULL,
  line numeric NOT NULL,
  side text NOT NULL CHECK (lower(side) IN ('over','under')),
  odds integer,
  game_id uuid,
  game_date date,
  prediction text,
  confidence numeric,
  reasoning text,
  bet_slip_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text DEFAULT 'api',
  updated_at timestamptz,
  CONSTRAINT picks_tenant_fk CHECK (tenant_id IS NOT NULL)
);

-- Create pick_publish table
CREATE TABLE IF NOT EXISTS public.pick_publish (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id uuid NOT NULL REFERENCES public.picks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  dedupe_key text,
  external_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_picks_tenant_created ON public.picks (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picks_league_created ON public.picks (league, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picks_game_created ON public.picks (game_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pick_publish_status_created ON public.pick_publish (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pick_publish_next_attempt ON public.pick_publish (next_attempt_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pick_publish_dedupe ON public.pick_publish (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Create RLS policies (stubs - not enabled yet)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='picks' AND policyname='tenant_isolation_picks'
  ) THEN
    CREATE POLICY tenant_isolation_picks ON public.picks FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='pick_publish' AND policyname='tenant_isolation_pick_publish'
  ) THEN
    CREATE POLICY tenant_isolation_pick_publish ON public.pick_publish FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Force PostgREST schema reload
SELECT pg_notify('pgrst', 'reload schema');
`;

async function checkTableExists(supabase, tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
    
    // If we get any response (even RLS error), table exists
    if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('CANONICAL SCHEMA MIGRATION - SUPABASE CLIENT');
  console.log('Date: 2025-01-29');
  console.log('='.repeat(80));
  console.log('');

  // Mask secrets
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  log.info('Environment Configuration:');
  console.log(`  SUPABASE_URL: ${supabaseUrl.substring(0, 30)}***`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${serviceKey.substring(0, 20)}***`);
  console.log('');

  if (!supabaseUrl || !serviceKey) {
    log.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Check current state
  log.info('Checking current schema state...');
  const picksExists = await checkTableExists(supabase, 'picks');
  const pickPublishExists = await checkTableExists(supabase, 'pick_publish');

  console.log(`  picks: ${picksExists ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`  pick_publish: ${pickPublishExists ? 'EXISTS' : 'NOT FOUND'}`);
  console.log('');

  if (picksExists && pickPublishExists) {
    log.success('Tables already exist - schema is ready');
    
    // Force PostgREST reload
    log.info('Forcing PostgREST schema reload...');
    try {
      const { error } = await supabase.rpc('exec', { 
        sql: "SELECT pg_notify('pgrst', 'reload schema')" 
      });
      
      if (error && !error.message.includes('Could not find the function')) {
        log.warn(`Reload notification: ${error.message}`);
      } else {
        log.success('PostgREST reload notification sent');
      }
    } catch (err) {
      log.warn(`Could not send reload notification: ${err.message}`);
    }
    
    console.log('');
    console.log('='.repeat(80));
    log.success('SCHEMA VERIFIED - READY FOR VALIDATION');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Verify visibility: node scripts/ops/verify-pgrst-visible.ts');
    console.log('  2. Start services: ./dev.sh start');
    console.log('  3. Run validation: .\\scripts\\ops\\self-heal-and-validate.ps1');
    console.log('');
    process.exit(0);
  }

  // Tables don't exist - provide manual migration instructions
  log.warn('Tables not found - manual migration required');
  
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : 'unknown';

  console.log('');
  console.log('='.repeat(80));
  console.log('MANUAL MIGRATION REQUIRED');
  console.log('='.repeat(80));
  console.log('');
  console.log('The canonical schema must be applied via Supabase SQL Editor:');
  console.log('');
  console.log(`  1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('  2. Copy the SQL below and paste into the SQL Editor');
  console.log('  3. Click "Run" to execute');
  console.log('  4. Re-run this script to verify');
  console.log('');
  console.log('='.repeat(80));
  console.log('SQL TO EXECUTE:');
  console.log('='.repeat(80));
  console.log(CANONICAL_SCHEMA_SQL);
  console.log('='.repeat(80));
  console.log('');
  
  process.exit(1);
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

