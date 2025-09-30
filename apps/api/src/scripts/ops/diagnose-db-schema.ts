/**
 * Database Schema Diagnostics
 *
 * Checks unified_picks table structure, constraints, and RLS
 */

import { createSupabaseClient } from '../../utils/supabase';

async function diagnoseDbSchema() {
  console.log('🔍 DATABASE SCHEMA DIAGNOSTICS');
  console.log('='.repeat(60));

  try {
    const supabase = createSupabaseClient();
    if (!supabase) {
      console.log('❌ Supabase client not available');
      return;
    }

    // Check unified_picks table structure
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'unified_picks' })
      .select();

    if (columnsError) {
      console.log('⚠️  Could not fetch column info, using fallback method');
    }

    // Check constraints and indexes
    const { data: constraints, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, constraint_type')
      .eq('table_name', 'unified_picks')
      .eq('table_schema', 'public');

    if (constraintsError) {
      console.log('⚠️  Could not fetch constraints:', constraintsError.message);
    } else {
      console.log('\n📊 UNIFIED_PICKS CONSTRAINTS:');
      constraints?.forEach(c => {
        console.log(`  ${c.constraint_name}: ${c.constraint_type}`);
      });
    }

    // Check row counts by market
    const { data: marketCounts, error: marketError } = await supabase
      .from('unified_picks')
      .select('market')
      .gte('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (marketError) {
      console.log('⚠️  Could not fetch market counts:', marketError.message);
    } else {
      console.log('\n📊 RECENT PICKS BY MARKET (last 24h):');
      const counts = {};
      marketCounts?.forEach(row => {
        counts[row.market] = (counts[row.market] || 0) + 1;
      });
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([market, count]) => {
          console.log(`  ${market.padEnd(25)}: ${count}`);
        });
    }

    // Check for required columns
    const { data: sampleRow } = await supabase
      .from('unified_picks')
      .select('*')
      .limit(1)
      .single();

    if (sampleRow) {
      console.log('\n📊 UNIFIED_PICKS COLUMNS:');
      const requiredCols = [
        'id', 'user_id', 'pick_type', 'selection', 'stake', 'potential_payout',
        'source', 'external_game_id', 'external_prop_id', 'market', 'matchup',
        'game_date', 'line', 'odds', 'posted_at', 'created_at', 'metadata',
        'professional_score', 'tier', 'clv_tracking_id', 'kelly_fraction'
      ];

      requiredCols.forEach(col => {
        const hasCol = sampleRow.hasOwnProperty(col);
        const value = hasCol ? sampleRow[col] : 'MISSING';
        const type = hasCol ? typeof value : 'N/A';
        console.log(`  ${col.padEnd(20)}: ${hasCol ? '✅' : '❌'} (${type})`);
      });
    }

    console.log('\n✅ Database schema diagnostics complete!');

  } catch (error) {
    console.error('❌ Database diagnostics failed:', error.message);
  }
}

diagnoseDbSchema();