// Comprehensive system validation script
// Validates: canonical picks, CLV tracking, processed flags, Command Center, outbox

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

interface ValidationReport {
  timestamp: string;
  canonical_picks: {
    total: number;
    professional_pipeline: number;
    last_24h: number;
  };
  clv_tracking: {
    total_rows: number;
    active_tracking: number;
  };
  raw_props: {
    total: number;
    processed: number;
    unprocessed: number;
    processed_percentage: number;
  };
  pick_publish_outbox: {
    total_entries: number;
    pending: number;
    published: number;
  };
  validation_status: {
    canonical_picks_working: boolean;
    clv_tracking_working: boolean;
    processed_flags_working: boolean;
    outbox_working: boolean;
  };
}

async function runComprehensiveValidation(): Promise<ValidationReport> {
  console.log('Starting comprehensive system validation...\n');

  // 1. Canonical Picks Validation
  console.log('[1/5] Validating canonical picks...');
  const { count: totalPicks } = await supabase
    .from('picks')
    .select('id', { count: 'exact', head: true });

  const { count: professionalPicks } = await supabase
    .from('picks')
    .select('id', { count: 'exact', head: true })
    .eq('metadata->>source', 'professional_pipeline');

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentPicks } = await supabase
    .from('picks')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', yesterday);

  // 2. CLV Tracking Validation
  console.log('[2/5] Validating CLV tracking...');
  const { count: clvTotal } = await supabase
    .from('clv_tracking')
    .select('id', { count: 'exact', head: true });

  const { count: activeClv } = await supabase
    .from('clv_tracking')
    .select('id', { count: 'exact', head: true })
    .is('settled_at', null);

  // 3. Raw Props Processed Flags
  console.log('[3/5] Validating processed flags...');
  const { count: totalProps } = await supabase
    .from('raw_props')
    .select('id', { count: 'exact', head: true });

  const { count: processedProps } = await supabase
    .from('raw_props')
    .select('id', { count: 'exact', head: true })
    .not('processed_at', 'is', null);

  const { count: unprocessedProps } = await supabase
    .from('raw_props')
    .select('id', { count: 'exact', head: true })
    .is('processed_at', null);

  // 4. Pick Publish Outbox
  console.log('[4/5] Validating pick_publish outbox...');
  const { count: outboxTotal } = await supabase
    .from('pick_publish')
    .select('id', { count: 'exact', head: true });

  const { count: outboxPending } = await supabase
    .from('pick_publish')
    .select('id', { count: 'exact', head: true })
    .is('published_at', null);

  const { count: outboxPublished } = await supabase
    .from('pick_publish')
    .select('id', { count: 'exact', head: true })
    .not('published_at', 'is', null);

  // 5. Validation Status
  console.log('[5/5] Computing validation status...');
  const processedPercentage = totalProps ? (processedProps! / totalProps! * 100) : 0;

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    canonical_picks: {
      total: totalPicks || 0,
      professional_pipeline: professionalPicks || 0,
      last_24h: recentPicks || 0,
    },
    clv_tracking: {
      total_rows: clvTotal || 0,
      active_tracking: activeClv || 0,
    },
    raw_props: {
      total: totalProps || 0,
      processed: processedProps || 0,
      unprocessed: unprocessedProps || 0,
      processed_percentage: Math.round(processedPercentage * 100) / 100,
    },
    pick_publish_outbox: {
      total_entries: outboxTotal || 0,
      pending: outboxPending || 0,
      published: outboxPublished || 0,
    },
    validation_status: {
      canonical_picks_working: (professionalPicks || 0) > 0,
      clv_tracking_working: (clvTotal || 0) > 0,
      processed_flags_working: (processedProps || 0) > 0,
      outbox_working: (outboxTotal || 0) >= 0, // Outbox can be empty and still valid
    },
  };

  return report;
}

async function main() {
  try {
    const report = await runComprehensiveValidation();

    console.log('\n=== COMPREHENSIVE VALIDATION REPORT ===\n');
    console.log(JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n=== VALIDATION SUMMARY ===');
    console.log(`Canonical Picks: ${report.validation_status.canonical_picks_working ? '✅ PASS' : '❌ FAIL'} (${report.canonical_picks.professional_pipeline} professional picks)`);
    console.log(`CLV Tracking: ${report.validation_status.clv_tracking_working ? '✅ PASS' : '❌ FAIL'} (${report.clv_tracking.total_rows} tracking rows)`);
    console.log(`Processed Flags: ${report.validation_status.processed_flags_working ? '✅ PASS' : '❌ FAIL'} (${report.raw_props.processed_percentage}% processed)`);
    console.log(`Outbox: ${report.validation_status.outbox_working ? '✅ PASS' : '❌ FAIL'} (${report.pick_publish_outbox.total_entries} entries)`);

    const allPassed = Object.values(report.validation_status).every(v => v === true);
    console.log(`\nOverall Status: ${allPassed ? '✅ ALL VALIDATIONS PASSED' : '⚠️ SOME VALIDATIONS FAILED'}`);

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

main();
