// Simplified Pipeline Demo for Local PostgreSQL
// Demonstrates: raw_props → picks → clv_tracking → pick_publish

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/unit_talk_dev',
});

// Known IDs from setup
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

interface PipelineStats {
  rawPropsProcessed: number;
  picksCreated: number;
  clvTrackingCreated: number;
  pickPublishCreated: number;
  processingTimeMs: number;
}

async function runPipelineDemo(): Promise<PipelineStats> {
  console.log('=== LOCAL DB PIPELINE DEMONSTRATION ===\n');

  const startTime = Date.now();
  const client = await pool.connect();

  try {
    // Step 1: Get sample raw_props (limit to 10 for demo)
    console.log('[1/4] Fetching raw props...');
    const rawPropsResult = await client.query(`
      SELECT id, prop_type, line, over_odds, under_odds, created_at
      FROM raw_props
      WHERE id NOT IN (
        SELECT (metadata->>'raw_prop_id')::uuid
        FROM picks
        WHERE metadata->>'raw_prop_id' IS NOT NULL
      )
      LIMIT 10
    `);

    const rawProps = rawPropsResult.rows;
    console.log(`✅ Found ${rawProps.length} unprocessed props\n`);

    if (rawProps.length === 0) {
      console.log('⚠️  All props already processed');
      return {
        rawPropsProcessed: 0,
        picksCreated: 0,
        clvTrackingCreated: 0,
        pickPublishCreated: 0,
        processingTimeMs: Date.now() - startTime
      };
    }

    await client.query('BEGIN');

    let picksCreated = 0;
    let clvCreated = 0;
    let publishCreated = 0;

    for (const rawProp of rawProps) {
      // Step 2: Create pick from raw_prop
      console.log(`[2/4] Creating pick from prop ${rawProp.prop_type}...`);

      const pickResult = await client.query(`
        INSERT INTO picks (
          id,
          tenant_id,
          user_id,
          prop_id,
          selection,
          odds,
          stake,
          confidence,
          workflow_stage,
          status,
          professional_score,
          grading_status,
          bet_slip_id,
          idempotency_key,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          $1::uuid,
          $2::uuid,
          NULL,
          $3::text,
          $4::integer,
          1.0,
          8,
          'approved',
          'pending',
          4.5,
          'completed',
          'demo-' || gen_random_uuid()::text,
          'idem-' || gen_random_uuid()::text,
          jsonb_build_object('raw_prop_id', $5::text, 'prop_type', $6::text),
          NOW(),
          NOW()
        )
        RETURNING id
      `, [
        TENANT_ID,
        USER_ID,
        rawProp.over_odds > rawProp.under_odds ? 'OVER' : 'UNDER',
        Math.max(rawProp.over_odds, rawProp.under_odds),
        rawProp.id,
        rawProp.prop_type
      ]);

      const pickId = pickResult.rows[0].id;
      picksCreated++;
      console.log(`  ✅ Pick created: ${pickId}`);

      // Step 3: Create CLV tracking entry
      console.log(`[3/4] Creating CLV tracking for pick ${pickId}...`);

      await client.query(`
        INSERT INTO clv_tracking (
          id,
          tenant_id,
          pick_id,
          submitted_at,
          submitted_line,
          submitted_odds,
          closing_line,
          closing_odds,
          clv_percentage,
          beat_closing_line,
          created_at
        ) VALUES (
          gen_random_uuid(),
          $1::uuid,
          $2::uuid,
          NOW(),
          $3::numeric,
          $4::integer,
          $3::numeric + 0.5,
          $4::integer - 5,
          2.5,
          true,
          NOW()
        )
      `, [
        TENANT_ID,
        pickId,
        rawProp.line || 0,
        Math.max(rawProp.over_odds, rawProp.under_odds)
      ]);

      clvCreated++;
      console.log(`  ✅ CLV tracking created`);

      // Step 4: Create pick_publish outbox entry
      console.log(`[4/4] Creating pick_publish outbox entry...`);

      await client.query(`
        INSERT INTO pick_publish (
          id,
          pick_id,
          tenant_id,
          status,
          channel,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          $1::uuid,
          $2::uuid,
          'pending',
          'DISCORD',
          jsonb_build_object(
            'prop_type', $3::text,
            'selection', $4::text,
            'odds', $5::integer,
            'confidence', 8
          ),
          NOW(),
          NOW()
        )
      `, [
        pickId,
        TENANT_ID,
        rawProp.prop_type,
        rawProp.over_odds > rawProp.under_odds ? 'OVER' : 'UNDER',
        Math.max(rawProp.over_odds, rawProp.under_odds)
      ]);

      publishCreated++;
      console.log(`  ✅ Pick publish created\n`);
    }

    await client.query('COMMIT');

    const processingTime = Date.now() - startTime;

    console.log('=== PIPELINE SUMMARY ===\n');
    console.log(`Raw Props Processed: ${rawProps.length}`);
    console.log(`Picks Created: ${picksCreated}`);
    console.log(`CLV Tracking Entries: ${clvCreated}`);
    console.log(`Pick Publish Entries: ${publishCreated}`);
    console.log(`Processing Time: ${processingTime}ms\n`);

    // Verify counts
    console.log('=== DATABASE VERIFICATION ===\n');

    const picksCount = await client.query('SELECT COUNT(*) FROM picks');
    const clvCount = await client.query('SELECT COUNT(*) FROM clv_tracking');
    const publishCount = await client.query('SELECT COUNT(*) FROM pick_publish');

    console.log(`Total Picks in DB: ${picksCount.rows[0].count}`);
    console.log(`Total CLV Tracking: ${clvCount.rows[0].count}`);
    console.log(`Total Pick Publish: ${publishCount.rows[0].count}\n`);

    return {
      rawPropsProcessed: rawProps.length,
      picksCreated,
      clvTrackingCreated: clvCreated,
      pickPublishCreated: publishCreated,
      processingTimeMs: processingTime
    };

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Pipeline failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const stats = await runPipelineDemo();

    if (stats.picksCreated > 0) {
      console.log('✅ PIPELINE DEMONSTRATION SUCCESSFUL');
      console.log('\n📊 Data Flow Verified:');
      console.log('   raw_props → picks → clv_tracking → pick_publish');
      process.exit(0);
    } else {
      console.log('⚠️  No new picks created (all props already processed)');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ PIPELINE DEMONSTRATION FAILED');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
