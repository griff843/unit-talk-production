#!/usr/bin/env node
/**
 * Discover FK constraints on tickets.user_id
 * SPRINT-CANONICAL-V3-SMARTFORM-075 Verification Step 0
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('=== STEP 0: DISCOVER tickets.user_id FK CONSTRAINTS ===\n');

  // Check FK constraints on tickets.user_id
  const fkResult = await client.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'tickets'
      AND kcu.column_name = 'user_id'
  `);

  console.log('Foreign Key on tickets.user_id:');
  if (fkResult.rows.length === 0) {
    console.log('  NO FK CONSTRAINT FOUND - user_id is unconstrained');
  } else {
    fkResult.rows.forEach(r => {
      console.log(`  Constraint: ${r.constraint_name}`);
      console.log(`  References: ${r.foreign_table_schema}.${r.foreign_table_name}(${r.foreign_column_name})`);
    });
  }

  // Check what user tables exist
  console.log('\n--- Checking available user tables ---');

  // Check auth.users (Supabase auth)
  try {
    const authUsers = await client.query(`
      SELECT COUNT(*) as cnt FROM auth.users LIMIT 1
    `);
    console.log(`auth.users: EXISTS (${authUsers.rows[0].cnt} rows)`);
  } catch (e) {
    console.log(`auth.users: NOT ACCESSIBLE (${e.message.split('\n')[0]})`);
  }

  // Check public.users
  try {
    const publicUsers = await client.query(`
      SELECT COUNT(*) as cnt FROM public.users LIMIT 1
    `);
    console.log(`public.users: EXISTS (${publicUsers.rows[0].cnt} rows)`);
  } catch (e) {
    console.log(`public.users: NOT FOUND`);
  }

  // Check public.profiles
  try {
    const profiles = await client.query(`
      SELECT COUNT(*) as cnt FROM public.profiles LIMIT 1
    `);
    console.log(`public.profiles: EXISTS (${profiles.rows[0].cnt} rows)`);
  } catch (e) {
    console.log(`public.profiles: NOT FOUND`);
  }

  // Try to get a valid user_id
  console.log('\n--- Finding valid user_id for testing ---');

  // Strategy: If FK exists, get from target table. If not, check existing tickets or generate.
  let validUserId = null;

  if (fkResult.rows.length > 0) {
    const fk = fkResult.rows[0];
    try {
      const userRow = await client.query(`
        SELECT ${fk.foreign_column_name} as user_id
        FROM ${fk.foreign_table_schema}.${fk.foreign_table_name}
        LIMIT 1
      `);
      if (userRow.rows.length > 0) {
        validUserId = userRow.rows[0].user_id;
        console.log(`Found user from FK target: ${validUserId}`);
      }
    } catch (e) {
      console.log(`Could not query FK target: ${e.message}`);
    }
  }

  // Fallback: check existing tickets
  if (!validUserId) {
    const existingTicket = await client.query(`
      SELECT user_id FROM tickets LIMIT 1
    `);
    if (existingTicket.rows.length > 0) {
      validUserId = existingTicket.rows[0].user_id;
      console.log(`Found user from existing ticket: ${validUserId}`);
    }
  }

  // Fallback: try auth.users
  if (!validUserId) {
    try {
      const authUser = await client.query(`SELECT id FROM auth.users LIMIT 1`);
      if (authUser.rows.length > 0) {
        validUserId = authUser.rows[0].id;
        console.log(`Found user from auth.users: ${validUserId}`);
      }
    } catch (e) {
      // Not accessible
    }
  }

  // Final fallback: generate UUID (only if no FK)
  if (!validUserId && fkResult.rows.length === 0) {
    validUserId = '00000000-0000-0000-0000-000000000001';
    console.log(`No FK constraint - using generated UUID: ${validUserId}`);
  }

  console.log(`\nVALID USER_ID FOR TESTING: ${validUserId || 'NONE FOUND'}`);

  // Check provider_offers
  console.log('\n--- Finding valid provider_offer for testing ---');
  const offerResult = await client.query(`
    SELECT id, event_id, market_type_id, participant_id, provider, line,
           over_odds, under_odds, home_odds, away_odds
    FROM provider_offers
    LIMIT 1
  `);

  if (offerResult.rows.length > 0) {
    const offer = offerResult.rows[0];
    console.log('Found provider_offer:');
    console.log(`  id: ${offer.id}`);
    console.log(`  event_id: ${offer.event_id}`);
    console.log(`  market_type_id: ${offer.market_type_id}`);
    console.log(`  participant_id: ${offer.participant_id}`);
    console.log(`  provider: ${offer.provider}`);
    console.log(`  line: ${offer.line}`);
    console.log(`  over_odds: ${offer.over_odds}`);
  } else {
    console.log('NO PROVIDER_OFFERS FOUND - will need to create test data');
  }

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
