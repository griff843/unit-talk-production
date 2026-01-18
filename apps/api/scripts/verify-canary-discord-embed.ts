/**
 * CANARY Discord Embed Verification Script
 *
 * Fetches a real published CANARY record from the database,
 * reconstructs the PickView, and prints the exact Discord embed payload.
 *
 * Usage:
 *   npx tsx apps/api/scripts/verify-canary-discord-embed.ts
 *   npx tsx apps/api/scripts/verify-canary-discord-embed.ts --pick-publish-id=8fd4d573-e800-4166-a196-4e60b16caf8e
 */

import { createClient } from '@supabase/supabase-js';
import { buildPickView } from '../src/publish/pick-view';
import { formatPickEmbed } from '../src/publish/discord-sender';

// Load environment variables
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface VerificationResult {
  success: boolean;
  pickPublishRecord?: any;
  pickRecord?: any;
  pickView?: any;
  embedPayload?: any;
  errors?: string[];
  fieldChecklist?: {
    sport: boolean;
    league: boolean;
    matchup: boolean;
    betType: boolean;
    selection: boolean;
    line: boolean;
    odds: boolean;
    units: boolean;
    confidence: boolean;
  };
}

async function verifyCanaryEmbed(pickPublishId?: string): Promise<VerificationResult> {
  const errors: string[] = [];

  try {
    // Step 1: Fetch a published CANARY record
    console.log('📊 Step 1: Fetching CANARY pick_publish record...\n');

    let pickPublishQuery = supabase
      .from('pick_publish')
      .select('*')
      .eq('channel', 'CANARY')
      .eq('status', 'sent')
      .order('created_at', { ascending: false });

    if (pickPublishId) {
      pickPublishQuery = pickPublishQuery.eq('id', pickPublishId);
    }

    const { data: pickPublishRecords, error: publishError } = await pickPublishQuery.limit(1);

    if (publishError) {
      errors.push(`Failed to fetch pick_publish: ${publishError.message}`);
      return { success: false, errors };
    }

    if (!pickPublishRecords || pickPublishRecords.length === 0) {
      errors.push('No published CANARY records found');
      return { success: false, errors };
    }

    const pickPublishRecord = pickPublishRecords[0];

    console.log('✅ Found pick_publish record:');
    console.log(`   ID: ${pickPublishRecord.id}`);
    console.log(`   Pick ID: ${pickPublishRecord.pick_id}`);
    console.log(`   Channel: ${pickPublishRecord.channel}`);
    console.log(`   Status: ${pickPublishRecord.status}`);
    console.log(`   Discord Channel ID: ${pickPublishRecord.discord_channel_id}`);
    console.log(`   External Message ID: ${pickPublishRecord.external_message_id}`);
    console.log(`   Metadata: ${JSON.stringify(pickPublishRecord.metadata, null, 2)}`);
    console.log('');

    // Step 2: Fetch the corresponding pick record
    console.log('📊 Step 2: Fetching corresponding pick record...\n');

    const { data: pickRecord, error: pickError } = await supabase
      .from('picks')
      .select('*')
      .eq('id', pickPublishRecord.pick_id)
      .single();

    if (pickError) {
      errors.push(`Failed to fetch pick: ${pickError.message}`);
      // Continue anyway to test with just publish metadata
    }

    if (pickRecord) {
      console.log('✅ Found pick record:');
      console.log(`   ID: ${pickRecord.id}`);
      console.log(`   Selection: ${pickRecord.selection}`);
      console.log(`   Odds: ${pickRecord.odds}`);
      console.log(`   Confidence: ${pickRecord.confidence}`);
      console.log(`   Stake: ${pickRecord.stake}`);
      console.log(`   Metadata: ${JSON.stringify(pickRecord.metadata, null, 2)}`);
      console.log('');
    } else {
      console.log('⚠️  No pick record found (using only pick_publish metadata)');
      console.log('');
    }

    // Step 3: Build PickView
    console.log('📊 Step 3: Building normalized PickView...\n');

    const pickView = buildPickView(pickRecord || { id: pickPublishRecord.pick_id }, pickPublishRecord);

    console.log('✅ PickView constructed:');
    console.log(JSON.stringify(pickView, null, 2));
    console.log('');

    // Step 4: Generate Discord embed
    console.log('📊 Step 4: Generating Discord embed payload...\n');

    const embed = formatPickEmbed(pickView);

    console.log('✅ Discord Embed:');
    console.log(JSON.stringify(embed, null, 2));
    console.log('');

    // Step 5: Field checklist
    console.log('📊 Step 5: Field presence checklist...\n');

    const fieldChecklist = {
      sport: !!pickView.sport,
      league: !!pickView.league,
      matchup: !!pickView.matchup,
      betType: !!pickView.betType,
      selection: !!pickView.selection,
      line: pickView.line !== undefined && pickView.line !== null,
      odds: !!pickView.odds,
      units: !!pickView.stake || !!pickView.units,
      confidence: !!pickView.confidence,
    };

    console.log('Field Checklist:');
    console.log(`   ✅ Sport/League: ${fieldChecklist.sport ? '✓' : '✗'} (${pickView.sport || 'N/A'})`);
    console.log(`   ✅ Matchup: ${fieldChecklist.matchup ? '✓' : '✗'} (${pickView.matchup || 'N/A'})`);
    console.log(`   ✅ Bet Type: ${fieldChecklist.betType ? '✓' : '✗'} (${pickView.betType || 'N/A'})`);
    console.log(`   ✅ Selection: ${fieldChecklist.selection ? '✓' : '✗'} (${pickView.selection || 'N/A'})`);
    console.log(`   ✅ Line: ${fieldChecklist.line ? '✓' : '✗'} (${pickView.line ?? 'N/A'})`);
    console.log(`   ✅ Odds: ${fieldChecklist.odds ? '✓' : '✗'} (${pickView.odds || 'N/A'})`);
    console.log(`   ✅ Units: ${fieldChecklist.units ? '✓' : '✗'} (${pickView.stake || pickView.units || 'N/A'})`);
    console.log(`   ✅ Confidence: ${fieldChecklist.confidence ? '✓' : '✗'} (${pickView.confidence || 'N/A'})`);
    console.log('');

    // Step 6: Embed field extraction
    console.log('📊 Step 6: Embed field verification...\n');

    const embedFields = embed.fields || [];
    console.log(`Total embed fields: ${embedFields.length}`);
    console.log('Fields in embed:');
    embedFields.forEach((field) => {
      console.log(`   - ${field.name}: ${field.value}`);
    });
    console.log('');

    // Final verification
    const allCriticalFieldsPresent =
      fieldChecklist.sport &&
      fieldChecklist.selection &&
      fieldChecklist.odds &&
      fieldChecklist.confidence;

    if (allCriticalFieldsPresent) {
      console.log('✅ ✅ ✅ VERIFICATION SUCCESSFUL ✅ ✅ ✅');
      console.log('All critical fields are present in the embed!');
    } else {
      console.log('❌ ❌ ❌ VERIFICATION FAILED ❌ ❌ ❌');
      console.log('Some critical fields are missing!');
      errors.push('Critical fields missing from embed');
    }

    return {
      success: allCriticalFieldsPresent && errors.length === 0,
      pickPublishRecord,
      pickRecord,
      pickView,
      embedPayload: embed,
      errors: errors.length > 0 ? errors : undefined,
      fieldChecklist,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Unexpected error: ${errorMessage}`);
    console.error('❌ Verification failed with error:', errorMessage);
    return { success: false, errors };
  }
}

// CLI execution
async function main() {
  console.log('🚀 CANARY Discord Embed Verification Script\n');
  console.log('='.repeat(80));
  console.log('');

  const args = process.argv.slice(2);
  const pickPublishIdArg = args.find((arg) => arg.startsWith('--pick-publish-id='));
  const pickPublishId = pickPublishIdArg?.split('=')[1];

  if (pickPublishId) {
    console.log(`🎯 Using specific pick_publish ID: ${pickPublishId}\n`);
  } else {
    console.log('🎯 Fetching most recent CANARY record\n');
  }

  const result = await verifyCanaryEmbed(pickPublishId);

  console.log('');
  console.log('='.repeat(80));
  console.log('');
  console.log('📋 VERIFICATION SUMMARY\n');
  console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);

  if (result.errors && result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((err) => console.log(`  - ${err}`));
  }

  if (result.fieldChecklist) {
    const passedFields = Object.values(result.fieldChecklist).filter(Boolean).length;
    const totalFields = Object.keys(result.fieldChecklist).length;
    console.log(`\nField Coverage: ${passedFields}/${totalFields} fields present`);
  }

  console.log('');

  process.exit(result.success ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { verifyCanaryEmbed };
