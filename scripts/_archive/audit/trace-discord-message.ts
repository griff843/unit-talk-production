/* eslint-disable no-console */
/**
 * Trace Discord Message Source
 * Query pick_publish by external_message_id and join unified_picks
 * to prove the actual source of a Discord message
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Discord message ID from the "ROLLS ROYCE READINESS" report
const DISCORD_MESSAGE_ID = '1463512822381019321';

// Smart Form MINIMUM required fields per SYSTEM_CONTRACT
const SMART_FORM_REQUIRED_FIELDS = [
  'id',
  'user_id',
  'sport',
  'selection',
  'odds',
  'units',        // CRITICAL: must have units
  'status',
  'trace_id',
  'bet_slip_id',
  'source',       // Should be 'smart_form' or similar
];

// Additional fields that indicate proper Smart Form submission
const SMART_FORM_EXPECTED_FIELDS = [
  'capper_id',    // or user_id mapping to capper
  'confidence',
  'line',
  'market',
  'pick_type',
  'game_date',
];

async function traceDiscordMessage() {
  console.log('=== TRACING DISCORD MESSAGE SOURCE ===\n');
  console.log(`Discord Message ID: ${DISCORD_MESSAGE_ID}\n`);

  // Step 1: Query pick_publish by external_message_id
  console.log('Step 1: Query pick_publish by external_message_id...');
  const { data: pickPublish, error: ppError } = await supabase
    .from('pick_publish')
    .select('*')
    .eq('external_message_id', DISCORD_MESSAGE_ID)
    .single();

  if (ppError || !pickPublish) {
    console.error('ERROR: Could not find pick_publish record for message ID:', DISCORD_MESSAGE_ID);
    console.error('Error:', ppError?.message);
    process.exit(1);
  }

  console.log('\n=== pick_publish RECORD ===');
  console.log(JSON.stringify(pickPublish, null, 2));

  // Step 2: Query unified_picks by pick_id
  console.log('\nStep 2: Query unified_picks by pick_id...');
  const { data: unifiedPick, error: upError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('id', pickPublish.pick_id)
    .single();

  if (upError || !unifiedPick) {
    console.error('ERROR: Could not find unified_picks record for pick_id:', pickPublish.pick_id);
    console.error('Error:', upError?.message);
    process.exit(1);
  }

  console.log('\n=== unified_picks RECORD ===');
  console.log(JSON.stringify(unifiedPick, null, 2));

  // Step 3: Validate Smart Form required fields
  console.log('\n=== SMART FORM REQUIRED FIELDS VALIDATION ===\n');

  const missingRequired: string[] = [];
  const presentRequired: string[] = [];

  for (const field of SMART_FORM_REQUIRED_FIELDS) {
    const value = unifiedPick[field];
    if (value === null || value === undefined || value === '') {
      missingRequired.push(field);
      console.log(`❌ MISSING: ${field} = ${value}`);
    } else {
      presentRequired.push(field);
      console.log(`✓ PRESENT: ${field} = ${JSON.stringify(value)}`);
    }
  }

  console.log('\n=== SMART FORM EXPECTED FIELDS (ADDITIONAL) ===\n');

  const missingExpected: string[] = [];
  const presentExpected: string[] = [];

  for (const field of SMART_FORM_EXPECTED_FIELDS) {
    const value = unifiedPick[field];
    if (value === null || value === undefined || value === '') {
      missingExpected.push(field);
      console.log(`⚠ MISSING: ${field} = ${value}`);
    } else {
      presentExpected.push(field);
      console.log(`✓ PRESENT: ${field} = ${JSON.stringify(value)}`);
    }
  }

  // Step 4: Check source/form_source field
  console.log('\n=== SOURCE ANALYSIS ===\n');

  const source = unifiedPick.source || unifiedPick.form_source || unifiedPick.meta?.source || unifiedPick.meta?.form_source;
  console.log(`source field: ${unifiedPick.source}`);
  console.log(`form_source field: ${unifiedPick.form_source}`);
  console.log(`meta.source: ${unifiedPick.meta?.source}`);
  console.log(`meta.form_source: ${unifiedPick.meta?.form_source}`);
  console.log(`Detected source: ${source}`);

  // Step 5: Check trace_id consistency
  console.log('\n=== TRACE_ID CONSISTENCY ===\n');

  const upTraceId = unifiedPick.trace_id;
  const ppMetadataTraceId = pickPublish.metadata?.trace_id;
  const ppMetadataCorrelationId = pickPublish.metadata?.correlation_id;

  console.log(`unified_picks.trace_id: ${upTraceId}`);
  console.log(`pick_publish.metadata.trace_id: ${ppMetadataTraceId}`);
  console.log(`pick_publish.metadata.correlation_id: ${ppMetadataCorrelationId}`);

  const traceIdMatch = upTraceId === ppMetadataTraceId || upTraceId === ppMetadataCorrelationId;
  console.log(`Trace ID Match: ${traceIdMatch ? 'YES' : 'NO'}`);

  // Step 6: Final Verdict
  console.log('\n=== FINAL VERDICT ===\n');

  const isRealSmartFormSubmission =
    missingRequired.length === 0 &&
    (source === 'smart_form' || source === 'smart-form') &&
    unifiedPick.units !== null &&
    unifiedPick.units !== undefined;

  if (missingRequired.length > 0) {
    console.log('❌ SMART FORM E2E GATE: FAILED');
    console.log(`   Reason: Missing ${missingRequired.length} required fields: ${missingRequired.join(', ')}`);
  } else if (!source || (source !== 'smart_form' && source !== 'smart-form')) {
    console.log('❌ SMART FORM E2E GATE: FAILED');
    console.log(`   Reason: source is "${source}", not "smart_form"`);
  } else if (unifiedPick.units === null || unifiedPick.units === undefined) {
    console.log('❌ SMART FORM E2E GATE: FAILED');
    console.log(`   Reason: units field is missing or null`);
  } else {
    console.log('✓ SMART FORM E2E GATE: PASS');
  }

  console.log('\n=== SOURCE DETERMINATION ===');
  if (unifiedPick.meta?.test === true) {
    console.log('⚠ This pick was created by a TEST SCRIPT, not Smart Form UI');
    console.log('   Evidence: meta.test = true');
  }
  if (source === 'stage3_e2e_test' || source === 'stage2_e2e_test') {
    console.log('⚠ This pick was created by a STAGE TEST SCRIPT, not Smart Form UI');
    console.log(`   Evidence: source = "${source}"`);
  }

  return {
    pickPublish,
    unifiedPick,
    missingRequired,
    missingExpected,
    source,
    traceIdMatch,
    isRealSmartFormSubmission,
  };
}

traceDiscordMessage().catch(console.error);
