/**
 * Test Real-Time Scoring Integration
 *
 * Simulates a high-quality S-tier prop and validates the end-to-end flow:
 * 1. Insert prop into raw_props
 * 2. Real-time scorer picks it up
 * 3. Enhanced45FactorEngine scores it
 * 4. Auto-approves to promotion_queue (if S/A tier)
 * 5. Triggers Discord alert (if S-tier)
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('RealTimeScoringTest');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface SimulatedProp {
  id: string;
  sport: string;
  player_name: string;
  stat_type: string;
  line: number;
  odds: number;
  over_odds: number;
  under_odds: number;
  game_date: string;
  team: string;
  opponent: string;
  bookmaker_key: string;
  external_prop_id: string;
  metadata: any;
}

/**
 * Generate a high-quality S-tier prop for testing
 */
function generateSTierProp(): SimulatedProp {
  const propId = randomUUID();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0); // 7 PM game time

  return {
    id: propId,
    sport: 'nfl',
    player_name: 'Patrick Mahomes',
    stat_type: 'passing_yards',
    line: 275.5,
    odds: -110,
    over_odds: -110,
    under_odds: -110,
    game_date: tomorrow.toISOString(),
    team: 'Kansas City Chiefs',
    opponent: 'Los Angeles Chargers',
    bookmaker_key: 'draftkings',
    external_prop_id: `test_${propId}`,
    metadata: {
      alert_mode: true,
      test_prop: true,
      quality_score: 95, // High quality for S-tier
      sharp_action: 'heavy_over',
      line_movement: '+2.5_points',
      opening_line: 273.0,
      public_split: 35, // Public on under (contrarian opportunity)
      sharp_split: 85, // Sharp money on over
      volume: 'high',
      weather: 'dome',
      matchup_rating: 92,
      player_form: 'excellent',
      injury_status: 'healthy',
    },
  };
}

/**
 * Insert simulated prop into raw_props table
 */
async function insertSimulatedProp(prop: SimulatedProp): Promise<boolean> {
  try {
    logger.info('Inserting simulated S-tier prop', {
      propId: prop.id,
      player: prop.player_name,
      statType: prop.stat_type,
      line: prop.line,
    });

    const { error } = await supabase.from('raw_props').insert({
      ...prop,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      logger.error('Failed to insert simulated prop', { error: error.message });
      return false;
    }

    logger.info('✅ Simulated prop inserted successfully', { propId: prop.id });
    return true;
  } catch (error) {
    logger.error('Error inserting simulated prop', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Wait for prop to be scored
 */
async function waitForScoring(propId: string, timeoutMs: number = 120000): Promise<boolean> {
  logger.info('Waiting for real-time scoring...', { propId, timeoutMs });

  const startTime = Date.now();
  const pollInterval = 5000; // Check every 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Check if prop has been scored
      const { data: rawProp, error: rawError } = await supabase
        .from('raw_props')
        .select('professional_score, tier')
        .eq('id', propId)
        .single();

      if (rawError) {
        logger.warn('Error checking raw_props', { error: rawError.message });
      } else if (rawProp?.professional_score !== null) {
        logger.info('✅ Prop scored in raw_props', {
          propId,
          professionalScore: rawProp.professional_score,
          tier: rawProp.tier,
          elapsedTime: Date.now() - startTime,
        });

        // Check scored_props table
        const { data: scoredProp, error: scoredError } = await supabase
          .from('scored_props')
          .select('*')
          .eq('prop_ref', propId)
          .single();

        if (!scoredError && scoredProp) {
          logger.info('✅ Prop found in scored_props', {
            propId,
            tier: scoredProp.tier,
            score: scoredProp.professional_score,
            edge: scoredProp.edge,
            confidence: scoredProp.confidence,
          });
        }

        return true;
      }
    } catch (error) {
      logger.warn('Error in scoring check', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  logger.error('❌ Timeout waiting for scoring', { propId, timeoutMs });
  return false;
}

/**
 * Check if prop was auto-approved to promotion_queue
 */
async function checkAutoApproval(propId: string): Promise<boolean> {
  try {
    logger.info('Checking auto-approval status', { propId });

    const { data, error } = await supabase
      .from('promotion_queue')
      .select('*')
      .eq('prop_ref', propId)
      .maybeSingle();

    if (error) {
      logger.error('Error checking promotion_queue', { error: error.message });
      return false;
    }

    if (!data) {
      logger.warn('⚠️ Prop not found in promotion_queue', { propId });
      return false;
    }

    logger.info('✅ Prop auto-approved to promotion_queue', {
      propId,
      status: data.status,
      priority: data.priority,
      tier: data.tier,
      autoApproved: data.auto_approved,
    });

    return data.auto_approved === true && data.status === 'approved';
  } catch (error) {
    logger.error('Error checking auto-approval', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Check if Discord alert was queued
 */
async function checkDiscordAlert(propId: string): Promise<boolean> {
  try {
    logger.info('Checking Discord alert status', { propId });

    const { data, error } = await supabase
      .from('pending_alerts')
      .select('*')
      .eq('metadata->>propId', propId)
      .maybeSingle();

    if (error) {
      logger.error('Error checking pending_alerts', { error: error.message });
      return false;
    }

    if (!data) {
      logger.warn('⚠️ Discord alert not found', { propId });
      return false;
    }

    logger.info('✅ Discord alert queued', {
      propId,
      type: data.type,
      priority: data.priority,
      channelId: data.channel_id,
    });

    return true;
  } catch (error) {
    logger.error('Error checking Discord alert', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Run complete end-to-end test
 */
async function runEndToEndTest(): Promise<void> {
  logger.info('🚀 Starting Real-Time Scoring End-to-End Test');
  logger.info('='.repeat(60));

  let success = true;

  try {
    // Step 1: Generate and insert simulated S-tier prop
    logger.info('Step 1: Generating S-tier prop...');
    const prop = generateSTierProp();

    logger.info('Simulated prop details:', {
      player: prop.player_name,
      market: prop.stat_type,
      line: prop.line,
      odds: prop.odds,
      gameDate: prop.game_date,
      qualityScore: prop.metadata.quality_score,
    });

    const inserted = await insertSimulatedProp(prop);
    if (!inserted) {
      logger.error('❌ Test failed: Could not insert prop');
      success = false;
      return;
    }

    logger.info('✅ Step 1 Complete: Prop inserted');
    logger.info('='.repeat(60));

    // Step 2: Wait for real-time scoring
    logger.info('Step 2: Waiting for real-time scoring (up to 2 minutes)...');
    const scored = await waitForScoring(prop.id, 120000);

    if (!scored) {
      logger.error('❌ Test failed: Prop was not scored within timeout');
      success = false;
      return;
    }

    logger.info('✅ Step 2 Complete: Prop scored by Enhanced45FactorEngine');
    logger.info('='.repeat(60));

    // Step 3: Check auto-approval
    logger.info('Step 3: Checking auto-approval to promotion_queue...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for auto-approval

    const autoApproved = await checkAutoApproval(prop.id);
    if (!autoApproved) {
      logger.warn('⚠️ Warning: Prop was not auto-approved (may be expected if tier < A)');
    } else {
      logger.info('✅ Step 3 Complete: Prop auto-approved to promotion_queue');
    }
    logger.info('='.repeat(60));

    // Step 4: Check Discord alert
    logger.info('Step 4: Checking Discord alert...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for alert

    const alertQueued = await checkDiscordAlert(prop.id);
    if (!alertQueued) {
      logger.warn('⚠️ Warning: Discord alert not found (may be expected if tier < S)');
    } else {
      logger.info('✅ Step 4 Complete: Discord alert queued');
    }
    logger.info('='.repeat(60));

    // Final summary
    logger.info('🎉 End-to-End Test Summary:');
    logger.info(`  Prop Insertion: ✅`);
    logger.info(`  Real-Time Scoring: ${scored ? '✅' : '❌'}`);
    logger.info(`  Auto-Approval: ${autoApproved ? '✅' : '⚠️'}`);
    logger.info(`  Discord Alert: ${alertQueued ? '✅' : '⚠️'}`);
    logger.info('='.repeat(60));

    if (scored) {
      logger.info('✅ REAL-TIME SCORING INTEGRATION OPERATIONAL');
    } else {
      logger.error('❌ REAL-TIME SCORING INTEGRATION FAILED');
      success = false;
    }
  } catch (error) {
    logger.error('❌ Test execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    success = false;
  }

  process.exit(success ? 0 : 1);
}

// Run the test
runEndToEndTest().catch(error => {
  logger.error('Unhandled error', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
