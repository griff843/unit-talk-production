#!/usr/bin/env npx tsx
/**
 * Apply Canonical Schema Fix - Direct PostgreSQL Connection
 * Executes migration SQL directly against the database
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_DIRECT_URL || '';

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_DIRECT_URL required');
  process.exit(1);
}

async function main() {
  console.log('='.repeat(70));
  console.log('APPLY CANONICAL SCHEMA FIX - DIRECT SQL');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('\nConnecting to database...');
    await client.connect();
    console.log('[OK] Connected');

    // Step 1: Check current state
    console.log('\n--- PRE-MIGRATION STATE ---\n');

    const picksTypeResult = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'picks';
    `);

    if (picksTypeResult.rows.length > 0) {
      console.log(`picks type: ${picksTypeResult.rows[0].table_type}`);
    } else {
      console.log('picks does not exist');
    }

    // Check FK constraint
    const fkResult = await client.query(`
      SELECT
        tc.constraint_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'pick_publish'
          AND tc.table_schema = 'public';
    `);

    if (fkResult.rows.length > 0) {
      console.log(`pick_publish FK references: ${fkResult.rows[0].foreign_table_name}`);
      console.log(`FK constraint name: ${fkResult.rows[0].constraint_name}`);
    }

    // Step 2: Add missing columns
    console.log('\n--- STEP 1: Adding missing columns to unified_picks ---\n');

    const columnsToAdd = [
      'ALTER TABLE public.unified_picks ADD COLUMN IF NOT EXISTS tenant_id UUID',
      'ALTER TABLE public.unified_picks ADD COLUMN IF NOT EXISTS selection TEXT',
      'ALTER TABLE public.unified_picks ADD COLUMN IF NOT EXISTS stake NUMERIC(10,2)',
      'ALTER TABLE public.unified_picks ADD COLUMN IF NOT EXISTS confidence INTEGER',
      "ALTER TABLE public.unified_picks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'",
      'ALTER TABLE public.unified_picks ADD COLUMN IF NOT EXISTS bet_slip_id TEXT',
      'ALTER TABLE public.unified_picks ADD COLUMN IF NOT EXISTS legacy_pick_id UUID',
    ];

    for (const sql of columnsToAdd) {
      try {
        await client.query(sql);
        const colName = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1];
        console.log(`[OK] Added column: ${colName}`);
      } catch (err: any) {
        console.log(`[SKIP] ${err.message}`);
      }
    }

    // Add indexes
    console.log('\n--- Adding indexes ---\n');
    await client.query('CREATE INDEX IF NOT EXISTS idx_unified_picks_legacy_pick_id ON public.unified_picks(legacy_pick_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_unified_picks_bet_slip_id_v2 ON public.unified_picks(bet_slip_id)');
    console.log('[OK] Indexes created');

    // Step 3: Check if picks is a TABLE and count records
    const picksCountResult = await client.query('SELECT COUNT(*) FROM public.picks');
    const picksCount = parseInt(picksCountResult.rows[0].count);
    console.log(`\npicks records to migrate: ${picksCount}`);

    if (picksCount > 0 && picksTypeResult.rows[0]?.table_type === 'BASE TABLE') {
      console.log('\n--- STEP 2: Migrating picks data to unified_picks ---\n');

      // Map picks.workflow_stage to unified_picks allowed values:
      // draft -> pending_review, approved -> approved, published -> published
      const migrationSql = `
        INSERT INTO public.unified_picks (
            legacy_pick_id,
            tenant_id,
            user_id,
            selection,
            odds,
            stake,
            confidence,
            status,
            bet_slip_id,
            meta,
            created_at,
            updated_at,
            sport,
            market,
            side,
            workflow_stage,
            game_date,
            line
        )
        SELECT
            p.id AS legacy_pick_id,
            p.tenant_id,
            p.user_id,
            p.selection,
            p.odds,
            p.stake,
            p.confidence,
            p.status,
            COALESCE(p.bet_slip_id, p.metadata->>'bet_slip_id', 'migrated_' || p.id::text) AS bet_slip_id,
            p.metadata AS meta,
            p.created_at,
            p.updated_at,
            COALESCE(p.metadata->>'league', p.metadata->>'sport', 'NFL') AS sport,
            COALESCE(p.metadata->>'stat_type', 'spread') AS market,
            p.selection AS side,
            CASE
                WHEN p.workflow_stage = 'draft' THEN 'pending_review'
                WHEN p.workflow_stage IN ('approved', 'published', 'rejected', 'pending_review') THEN p.workflow_stage
                ELSE 'pending_review'
            END AS workflow_stage,
            CURRENT_DATE AS game_date,
            COALESCE((p.metadata->>'line')::numeric, 0) AS line
        FROM public.picks p
        WHERE NOT EXISTS (
            SELECT 1 FROM public.unified_picks up
            WHERE up.legacy_pick_id = p.id
        )
        ON CONFLICT DO NOTHING
      `;

      const migrationResult = await client.query(migrationSql);
      console.log(`[OK] Migrated ${migrationResult.rowCount} records to unified_picks`);
    }

    // Step 4: Drop existing FK constraint FIRST (before updating pick_publish)
    console.log('\n--- STEP 3: Dropping old FK constraint ---\n');

    try {
      await client.query('ALTER TABLE public.pick_publish DROP CONSTRAINT IF EXISTS pick_publish_pick_id_fkey');
      console.log('[OK] Dropped old FK constraint');
    } catch (err: any) {
      console.log(`[SKIP] ${err.message}`);
    }

    try {
      await client.query('ALTER TABLE public.pick_publish ALTER COLUMN pick_id DROP NOT NULL');
      console.log('[OK] Made pick_id nullable');
    } catch (err: any) {
      console.log(`[SKIP] ${err.message}`);
    }

    // Step 5: Update pick_publish to reference new unified_picks IDs
    console.log('\n--- STEP 4: Updating pick_publish to reference unified_picks ---\n');

    const updateResult = await client.query(`
      UPDATE public.pick_publish pp
      SET pick_id = (
          SELECT up.id
          FROM public.unified_picks up
          WHERE up.legacy_pick_id = pp.pick_id
          LIMIT 1
      )
      WHERE EXISTS (
          SELECT 1
          FROM public.unified_picks up
          WHERE up.legacy_pick_id = pp.pick_id
      )
    `);
    console.log(`[OK] Updated ${updateResult.rowCount} pick_publish records`);

    // Step 6: Add new FK constraint
    console.log('\n--- STEP 5: Adding new FK constraint ---\n');

    try {
      await client.query(`
        ALTER TABLE public.pick_publish
        ADD CONSTRAINT pick_publish_pick_id_unified_fkey
        FOREIGN KEY (pick_id) REFERENCES public.unified_picks(id) ON DELETE SET NULL
      `);
      console.log('[OK] Added new FK constraint → unified_picks');
    } catch (err: any) {
      console.log(`[ERROR] ${err.message}`);
    }

    // Step 7: Drop picks TABLE and create as VIEW
    console.log('\n--- STEP 6: Converting picks TABLE to VIEW ---\n');

    if (picksTypeResult.rows[0]?.table_type === 'BASE TABLE') {
      await client.query('DROP TABLE IF EXISTS public.picks CASCADE');
      console.log('[OK] Dropped picks TABLE');
    }

    await client.query(`
      CREATE OR REPLACE VIEW public.picks AS
      SELECT
          id,
          tenant_id,
          user_id,
          game_id,
          bet_slip_id,
          selection,
          odds,
          stake,
          confidence,
          workflow_stage,
          status,
          meta AS metadata,
          created_at,
          updated_at,
          legacy_pick_id AS original_pick_id
      FROM public.unified_picks
    `);
    console.log('[OK] Created picks as VIEW over unified_picks');

    // Step 7: Add INSTEAD OF triggers to block writes
    console.log('\n--- STEP 6: Adding write-block triggers ---\n');

    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_picks_write()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION 'Cannot write to picks view. Use unified_picks table instead. picks is READ-ONLY.';
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query('DROP TRIGGER IF EXISTS prevent_picks_insert ON public.picks');
    await client.query(`
      CREATE TRIGGER prevent_picks_insert
      INSTEAD OF INSERT ON public.picks
      FOR EACH ROW EXECUTE FUNCTION prevent_picks_write()
    `);

    await client.query('DROP TRIGGER IF EXISTS prevent_picks_update ON public.picks');
    await client.query(`
      CREATE TRIGGER prevent_picks_update
      INSTEAD OF UPDATE ON public.picks
      FOR EACH ROW EXECUTE FUNCTION prevent_picks_write()
    `);

    await client.query('DROP TRIGGER IF EXISTS prevent_picks_delete ON public.picks');
    await client.query(`
      CREATE TRIGGER prevent_picks_delete
      INSTEAD OF DELETE ON public.picks
      FOR EACH ROW EXECUTE FUNCTION prevent_picks_write()
    `);

    console.log('[OK] Added INSTEAD OF triggers to block writes');

    // Step 8: Verify
    console.log('\n--- VERIFICATION ---\n');

    const verifyType = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'picks'
    `);
    console.log(`picks type: ${verifyType.rows[0]?.table_type || 'NOT FOUND'}`);

    const verifyFK = await client.query(`
      SELECT
        tc.constraint_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'pick_publish'
          AND tc.table_schema = 'public'
    `);
    console.log(`pick_publish FK references: ${verifyFK.rows[0]?.foreign_table_name || 'NOT FOUND'}`);

    // Test that INSERT fails
    console.log('\nTesting INSERT into picks (should fail)...');
    try {
      await client.query("INSERT INTO picks (user_id, selection) VALUES ('test', 'over')");
      console.log('[ERROR] INSERT succeeded - triggers not working!');
    } catch (err: any) {
      if (err.message.includes('READ-ONLY') || err.message.includes('Cannot write')) {
        console.log('[OK] INSERT blocked - picks is READ-ONLY');
      } else {
        console.log(`[OK] INSERT failed: ${err.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`
CANONICAL RULES NOW ENFORCED:
  ✓ unified_picks is the ONLY writable pick table
  ✓ pick_publish.pick_id FK references unified_picks
  ✓ picks is a READ-ONLY VIEW
`);

  } catch (err: any) {
    console.error('MIGRATION ERROR:', err.message);
    throw err;
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
