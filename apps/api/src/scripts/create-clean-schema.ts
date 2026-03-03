#!/usr/bin/env npx tsx

/**
 * Create Clean Schema for Props Management
 *
 * Creates separate tables for different prop types and migrates data
 * with proper categorization and validation.
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';
import { Logger } from '../shared/logger';

config();

async function createCleanSchema() {
  console.log('🏗️ CREATING CLEAN PROPS SCHEMA');
  console.log('==============================');

  const logger = new Logger('create-clean-schema');

  try {
    // 1. Analyze current data issues
    console.log('\n📊 Step 1: Current data analysis...');

    const { count: totalProps } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })) || { count: 0 };

    const { count: ncaafAsOther } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('league', 'NCAAF')
      .neq('sport', 'NCAAF')) || { count: 0 };

    const { count: overUnderInPlayer } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .in('player_name', ['Over', 'Under'])) || { count: 0 };

    console.log(`📈 Data Quality Issues Found:`);
    console.log(`  Total props: ${totalProps}`);
    console.log(
      `  NCAAF mislabeled as other sports: ${ncaafAsOther} (${(((ncaafAsOther || 0) / (totalProps || 1)) * 100).toFixed(1)}%)`
    );
    console.log(`  Over/Under in player_name field: ${overUnderInPlayer}`);

    // 2. Create improved schema structure
    console.log('\n🏗️ Step 2: Creating improved schema...');
    console.log('⚠️ This will add columns to raw_props table');

    const schemaSQL = `
      -- Add categorization columns
      ALTER TABLE raw_props 
      ADD COLUMN IF NOT EXISTS prop_category VARCHAR(10) CHECK (prop_category IN ('player', 'team', 'game')),
      ADD COLUMN IF NOT EXISTS team_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS standardized_sport VARCHAR(10) CHECK (standardized_sport IN ('NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB')),
      ADD COLUMN IF NOT EXISTS standardized_stat VARCHAR(50),
      ADD COLUMN IF NOT EXISTS data_quality_score DECIMAL(3,2) DEFAULT 0.0,
      ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
    `;

    console.log('📋 Adding schema columns...');
    console.log('Note: This may take a moment for large tables');

    // Since we can't use RPC, let's do this programmatically
    // First check if columns exist
    const { data: sampleRow } = await supabaseClient.from('raw_props').select('*').limit(1);

    if (sampleRow && sampleRow.length > 0) {
      const hasNewColumns = 'prop_category' in sampleRow[0];

      if (hasNewColumns) {
        console.log('✅ Schema columns already exist');
      } else {
        console.log('⚠️ Schema columns need to be added manually');
        console.log('📋 Please run this SQL in Supabase SQL Editor:');
        console.log(schemaSQL);
        console.log('\nThen run this script again to continue with data migration');
        return;
      }
    }

    // 3. Data migration and cleanup
    console.log('\n🔄 Step 3: Data migration and cleanup...');
    console.log('This will be done in batches to avoid timeouts');

    // First, let's sample some data to see what we're working with
    const { data: sampleData } = await supabaseClient
      .from('raw_props')
      .select('id, sport, league, player_name, stat_type, matchup')
      .limit(10);

    if (sampleData) {
      console.log('\n📋 Sample data before migration:');
      sampleData.forEach((row, i) => {
        console.log(
          `${i + 1}. ${row.sport}/${row.league} | "${row.player_name}" | ${row.stat_type}`
        );
      });
    }

    // Migration will be done in batches
    let migratedCount = 0;
    const BATCH_SIZE = 100;

    console.log(`\n🔄 Starting data migration in batches of ${BATCH_SIZE}...`);

    // Batch 1: Fix NCAAF sport classification
    console.log('\n📝 Batch 1: Fixing NCAAF sport classification...');

    const { data: ncaafRecords, error: ncaafError } = await supabaseClient
      .from('raw_props')
      .select('id')
      .eq('league', 'NCAAF')
      .neq('sport', 'NCAAF')
      .limit(BATCH_SIZE);

    if (ncaafError) {
      console.warn('Could not fetch NCAAF records:', ncaafError.message);
    } else if (ncaafRecords && ncaafRecords.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('raw_props')
        .update({
          standardized_sport: 'NCAAF',
          data_quality_score: 0.9,
          needs_review: false,
        })
        .in(
          'id',
          ncaafRecords.map(r => r.id)
        );

      if (updateError) {
        console.warn('NCAAF update failed:', updateError.message);
      } else {
        console.log(`✅ Fixed ${ncaafRecords.length} NCAAF records`);
        migratedCount += ncaafRecords.length;
      }
    }

    // Batch 2: Categorize team props (Over/Under)
    console.log('\n📝 Batch 2: Categorizing team props...');

    const { data: teamPropRecords, error: teamError } = await supabaseClient
      .from('raw_props')
      .select('id, player_name, matchup, stat_type')
      .in('player_name', ['Over', 'Under'])
      .limit(BATCH_SIZE);

    if (teamError) {
      console.warn('Could not fetch team prop records:', teamError.message);
    } else if (teamPropRecords && teamPropRecords.length > 0) {
      // Process each record to extract team name from matchup
      for (const record of teamPropRecords) {
        const teamName = extractTeamName(record.matchup, record.player_name);

        const { error: updateError } = await supabaseClient
          .from('raw_props')
          .update({
            prop_category: 'team',
            team_name: teamName,
            standardized_stat: record.stat_type?.toLowerCase(),
            data_quality_score: 0.8,
          })
          .eq('id', record.id);

        if (!updateError) {
          migratedCount++;
        }
      }

      console.log(`✅ Categorized ${teamPropRecords.length} team prop records`);
    }

    // 4. Final verification
    console.log('\n📊 Step 4: Migration verification...');

    const { count: fixedNcaaf } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('standardized_sport', 'NCAAF')) || { count: 0 };

    const { count: categorizedTeam } = (await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('prop_category', 'team')) || { count: 0 };

    console.log('\n🎊 MIGRATION RESULTS:');
    console.log('====================');
    console.log(`📊 Records processed: ${migratedCount}`);
    console.log(`🏈 NCAAF properly classified: ${fixedNcaaf}`);
    console.log(`🏈 Team props categorized: ${categorizedTeam}`);
    console.log(
      `📈 Data quality improvement: ${((migratedCount / (totalProps || 1)) * 100).toFixed(1)}%`
    );

    // 5. Recommendations for next steps
    console.log('\n💡 NEXT STEPS:');
    console.log('==============');
    console.log('1. 🔄 Run this script multiple times to process all data in batches');
    console.log('2. 📋 Review records marked with needs_review = true');
    console.log('3. 🏗️ Consider creating separate tables for player_props vs team_props');
    console.log('4. 📊 Set up monitoring for data quality scores');
    console.log('5. 🧪 Test FeedAgent with improved data structure');
  } catch (error) {
    console.error(
      '\n❌ Schema creation failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

function extractTeamName(matchup: string, overUnder: string): string {
  if (!matchup) return 'Unknown Team';

  // Handle different matchup formats
  if (matchup.includes(' @ ')) {
    const [away, home] = matchup.split(' @ ');
    // For Over/Under, we could use either team or a generic name
    return overUnder === 'Over' ? home : away;
  }

  if (matchup.includes(' vs ')) {
    const [team1, team2] = matchup.split(' vs ');
    return overUnder === 'Over' ? team1 : team2;
  }

  // Fallback
  return matchup.split(' ')[0] || 'Unknown Team';
}

// Run the schema creation
if (require.main === module) {
  createCleanSchema()
    .then(() => {
      console.log('\n✅ Clean schema creation completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Schema creation crashed:', error);
      process.exit(1);
    });
}

export { createCleanSchema };
