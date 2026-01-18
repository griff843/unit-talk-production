// Verify Existing Raw Props Data
// Since live API is quota-limited, check existing data for validation

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  console.log('=== EXISTING RAW_PROPS VERIFICATION ===\n');

  try {
    // Total count
    console.log('[1/5] Checking total raw_props count...');
    const { count: totalCount, error: countError } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count query failed:', countError);
      process.exit(1);
    }

    console.log(`Total raw_props in database: ${totalCount || 0}`);

    // Recent props (last 24 hours)
    console.log('\n[2/5] Checking props from last 24 hours...');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: recentCount, error: recentError } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    if (recentError) {
      console.error('❌ Recent props query failed:', recentError);
    } else {
      console.log(`Props from last 24h: ${recentCount || 0}`);
    }

    // Props by league
    console.log('\n[3/5] Counting props by league...');
    const { data: allProps, error: allPropsError } = await supabase
      .from('raw_props')
      .select('sport, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (allPropsError) {
      console.error('❌ League query failed:', allPropsError);
    } else if (allProps) {
      const leagueCounts: Record<string, number> = {};
      allProps.forEach(prop => {
        leagueCounts[prop.sport] = (leagueCounts[prop.sport] || 0) + 1;
      });

      console.log('\nProps by league (last 1000):');
      Object.entries(leagueCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([league, count]) => {
          console.log(`  ${league}: ${count}`);
        });
    }

    // Check for unprocessed props
    console.log('\n[4/5] Checking unprocessed props...');
    const { count: unprocessedCount, error: unprocessedError } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .is('processed_at', null);

    if (unprocessedError) {
      console.error('❌ Unprocessed query failed:', unprocessedError);
    } else {
      console.log(`Unprocessed props: ${unprocessedCount || 0}`);
    }

    // Sample recent props
    console.log('\n[5/5] Sample recent props...');
    const { data: sampleProps, error: sampleError } = await supabase
      .from('raw_props')
      .select('id, sport, player_name, stat_type, line, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (sampleError) {
      console.error('❌ Sample query failed:', sampleError);
    } else if (sampleProps && sampleProps.length > 0) {
      console.log('\nMost recent props:');
      sampleProps.forEach((prop, i) => {
        const status = prop.processed_at ? '✓ processed' : '○ unprocessed';
        console.log(`  ${i + 1}. [${status}] ${prop.player_name || 'Team'} ${prop.stat_type} ${prop.line} (${prop.sport})`);
        console.log(`     Created: ${prop.created_at}`);
      });
    }

    // Final assessment
    console.log('\n=== VERIFICATION COMPLETE ===');

    if ((totalCount || 0) === 0) {
      console.log('\n❌ NO DATA: raw_props table is EMPTY');
      console.log('   BLOCKER: Cannot validate processing pipeline without data');
      process.exit(1);
    } else if ((unprocessedCount || 0) > 0) {
      console.log('\n✅ DATA AVAILABLE for testing:');
      console.log(`   Total props: ${totalCount}`);
      console.log(`   Unprocessed props: ${unprocessedCount}`);
      console.log(`   Can proceed with Section B (Professional Processing)`);
      process.exit(0);
    } else {
      console.log('\n⚠️  ALL PROPS PROCESSED:');
      console.log(`   Total props: ${totalCount}`);
      console.log(`   Unprocessed: 0`);
      console.log(`   Need fresh data for full validation`);
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

main();
