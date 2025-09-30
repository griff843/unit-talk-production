#!/usr/bin/env node

import { supabaseClient } from './src/services/supabaseClient';

async function checkSGOData() {
  console.log('🔍 Checking SGO data in database...');

  try {
    // Check SGO props count
    const { data: sgoData, error: sgoError, count: sgoCount } = await supabaseClient
      .from('raw_props')
      .select('player_name, stat_type, line, source, created_at', { count: 'exact' })
      .eq('source', 'sgo')
      .order('created_at', { ascending: false })
      .limit(10);

    if (sgoError) {
      console.error('❌ SGO query error:', sgoError);
      return;
    }

    console.log(`📊 Total SGO props in database: ${sgoCount}`);

    if (sgoData && sgoData.length > 0) {
      console.log('📋 Recent SGO props:');
      sgoData.forEach((prop, i) => {
        console.log(`${i + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line}`);
      });
    } else {
      console.log('📋 No SGO props found in recent data');
    }

    // Check all sources for comparison
    const { data: allProps, error: allError, count: totalCount } = await supabaseClient
      .from('raw_props')
      .select('source', { count: 'exact' })
      .not('source', 'is', null);

    if (!allError) {
      console.log(`📈 Total props in database: ${totalCount}`);

      // Group by source
      const { data: sourceGroups } = await supabaseClient
        .from('raw_props')
        .select('source')
        .not('source', 'is', null);

      if (sourceGroups) {
        const sourceCounts: Record<string, number> = {};
        sourceGroups.forEach(row => {
          sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
        });
        console.log('📊 Props by source:', sourceCounts);
      }
    }

    // Verify our SGO backfill specifically
    const { data: recentSGO, error: recentError } = await supabaseClient
      .from('raw_props')
      .select('*')
      .eq('source', 'sgo')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('created_at', { ascending: false })
      .limit(3);

    if (!recentError && recentSGO?.length) {
      console.log('✅ Recent SGO backfill data confirmed:');
      recentSGO.forEach((prop, i) => {
        console.log(`   ${i + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error checking SGO data:', error.message);
  }
}

if (require.main === module) {
  checkSGOData().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}