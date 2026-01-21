#!/usr/bin/env npx tsx
/**
 * Submit Canary Pick - Daily Proof Run
 *
 * Creates a canary pick with trace_id to verify the full pipeline:
 * Smart Form → unified_picks → pick_publish → Discord
 *
 * Usage:
 *   npx tsx scripts/canary/submit-canary-pick.ts --trace-id=<id> --output=<file>
 *
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CanaryResult {
  success: boolean;
  trace_id: string;
  bet_slip_id: string;
  pick_id?: string;
  pick_publish_id?: string;
  timestamp: string;
  error?: string;
}

async function submitCanaryPick(): Promise<CanaryResult> {
  // Parse arguments
  const traceIdArg = process.argv.find(a => a.startsWith('--trace-id='));
  const outputArg = process.argv.find(a => a.startsWith('--output='));

  const traceId = traceIdArg?.split('=')[1] || `canary-${Date.now()}-${randomUUID().substring(0, 8)}`;
  const outputFile = outputArg?.split('=')[1];
  const betSlipId = `canary-${traceId}`;

  console.log('='.repeat(60));
  console.log('CANARY PICK SUBMISSION');
  console.log('='.repeat(60));
  console.log(`Trace ID: ${traceId}`);
  console.log(`Bet Slip ID: ${betSlipId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const result: CanaryResult = {
    success: false,
    trace_id: traceId,
    bet_slip_id: betSlipId,
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: Get or create canary user
    console.log('\n[1] Getting canary user...');
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', 'canary_bot')
      .single();

    if (userError || !user) {
      console.log('    Creating canary_bot user...');
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          username: 'canary_bot',
          email: 'canary@unit-talk.io',
          tier: 'admin',
          status: 'active',
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create canary user: ${createError.message}`);
      }
      user = newUser;
    }

    console.log(`    User: ${user.username} (${user.id})`);

    // Step 2: Get a test game
    console.log('\n[2] Getting test game...');
    let { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, home_team, away_team, league')
      .eq('status', 'scheduled')
      .limit(1)
      .single();

    if (gameError || !game) {
      // Create a test game if none exists
      console.log('    Creating test game...');
      const { data: newGame, error: createGameError } = await supabase
        .from('games')
        .insert({
          league: 'NBA',
          sport: 'NBA',
          home_team: 'Canary Home',
          away_team: 'Canary Away',
          game_date: new Date().toISOString().split('T')[0],
          status: 'scheduled',
        })
        .select()
        .single();

      if (createGameError) {
        throw new Error(`Failed to create test game: ${createGameError.message}`);
      }
      game = newGame;
    }

    console.log(`    Game: ${game.home_team} vs ${game.away_team} (${game.league})`);

    // Step 3: Create unified_pick with trace_id (I2 invariant)
    console.log('\n[3] Creating unified_pick with trace_id...');
    const { data: pick, error: pickError } = await supabase
      .from('unified_picks')
      .insert({
        user_id: user.id,
        game_id: game.id,
        bet_slip_id: betSlipId,
        pick_type: 'spread',
        selection: 'Canary Pick - Auto Test',
        odds: -110,
        status: 'pending',
        confidence_score: 0.85,
        // I2 & I5 invariants: form_source and trace_id
        form_source: 'canary_proof',
        trace_id: traceId,
        metadata: {
          canary: true,
          proof_run: true,
          created_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (pickError || !pick) {
      throw new Error(`Failed to create pick: ${pickError?.message}`);
    }

    console.log(`    Pick ID: ${pick.id}`);
    result.pick_id = pick.id;

    // Step 4: Create pick_publish record (I3 invariant - outbox lifecycle)
    console.log('\n[4] Creating pick_publish record...');
    const CANARY_CHANNEL_ID = process.env.DISCORD_CANARY_CHANNEL_ID || '1296531122234327100';

    const { data: publish, error: publishError } = await supabase
      .from('pick_publish')
      .insert({
        pick_id: pick.id,
        bet_slip_id: betSlipId,
        channel_id: CANARY_CHANNEL_ID,
        status: 'pending',
        embed_data: {
          title: 'Canary Proof Pick',
          description: `Automated proof run - ${traceId}`,
        },
        // I5 invariant: trace_id in metadata
        metadata: {
          trace_id: traceId,
          correlation_id: traceId,
          form_source: 'canary_proof',
          canary: true,
        },
      })
      .select()
      .single();

    if (publishError || !publish) {
      throw new Error(`Failed to create pick_publish: ${publishError?.message}`);
    }

    console.log(`    Publish ID: ${publish.id}`);
    result.pick_publish_id = publish.id;

    // Step 5: Create bridge_outbox event
    console.log('\n[5] Creating bridge_outbox event...');
    const { error: outboxError } = await supabase.from('bridge_outbox').insert({
      event_type: 'canary_proof_pick',
      event_payload: {
        bet_slip_id: betSlipId,
        pick_id: pick.id,
        trace_id: traceId,
        canary: true,
      },
      bet_slip_id: betSlipId,
      correlation_id: traceId,
      status: 'pending',
    });

    if (outboxError) {
      console.log(`    Warning: bridge_outbox insert failed: ${outboxError.message}`);
    } else {
      console.log('    Bridge outbox event created');
    }

    // Success
    result.success = true;
    console.log('\n' + '='.repeat(60));
    console.log('CANARY SUBMISSION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Trace ID: ${traceId}`);
    console.log(`Bet Slip ID: ${betSlipId}`);
    console.log(`Pick ID: ${pick.id}`);
    console.log(`Publish ID: ${publish.id}`);
    console.log('='.repeat(60));

  } catch (error: any) {
    result.error = error.message;
    console.error('\n❌ CANARY SUBMISSION FAILED');
    console.error(error.message);
  }

  // Write output file
  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\nResults written to: ${outputFile}`);
  }

  if (!result.success) {
    process.exit(1);
  }

  return result;
}

submitCanaryPick().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
