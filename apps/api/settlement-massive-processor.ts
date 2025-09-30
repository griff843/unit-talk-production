#!/usr/bin/env tsx

import { supabaseClient } from './src/services/supabaseClient';

async function processSettlement() {
  console.log('🚀 Starting massive settlement processing...');

  const batchSize = 5000;
  let totalProcessed = 0;
  let round = 1;

  while (true) {
    console.log(`\n📋 Processing round ${round} (batch size: ${batchSize})`);

    // Get batch of unprocessed props with proper ordering
    const { data: props, error } = await supabaseClient
      .from('raw_props')
      .select('id')
      .is('processed_at', null)
      .order('id')
      .limit(batchSize);

    if (error) {
      console.error('❌ Error fetching props:', error);
      break;
    }

    if (!props || props.length === 0) {
      console.log('✅ No more props to process');
      break;
    }

    console.log(`   Found ${props.length} props to process`);

    // Update props to mark as processed
    const propIds = props.map(p => p.id);
    const { error: updateError } = await supabaseClient
      .from('raw_props')
      .update({ processed_at: new Date().toISOString() })
      .in('id', propIds);

    if (updateError) {
      console.error('❌ Error updating props:', updateError);
      // Continue anyway
    } else {
      totalProcessed += props.length;
      console.log(`   ✅ Processed ${props.length} props (total: ${totalProcessed})`);
    }

    round++;

    // Small delay to avoid overwhelming database
    await new Promise(resolve => setTimeout(resolve, 100));

    // Report progress every 5 rounds
    if (round % 5 === 0) {
      const { count } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .is('processed_at', null);
      console.log(`📊 Progress update: ${count} props remaining`);
    }
  }

  console.log(`\n🎉 Settlement processing complete! Processed ${totalProcessed} props total`);
}

processSettlement().catch(console.error);