const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function comprehensiveSchemaAnalysis() {
  console.log('🏗️ COMPREHENSIVE DATABASE SCHEMA ANALYSIS');
  console.log('==========================================\n');

  try {
    // 1. Discover all tables
    console.log('1️⃣ DISCOVERING ALL TABLES...');

    const commonTables = [
      'games',
      'raw_props',
      'users',
      'picks',
      'agents',
      'players',
      'user_profiles',
      'unified_picks',
      'daily_picks',
      'analytics',
      'notifications',
      'security_events',
      'game_results',
      'teams',
      'onboarding_config',
      'discord_guilds',
      'api_keys',
      'system_logs',
    ];

    const existingTables = [];

    for (const tableName of commonTables) {
      try {
        const { data, error } = await supabase.from(tableName).select('*').limit(1);

        if (!error) {
          existingTables.push({
            name: tableName,
            hasData: data && data.length > 0,
            columns: data && data.length > 0 ? Object.keys(data[0]) : [],
          });
        }
      } catch (e) {
        // Table doesn't exist
      }
    }

    console.log(`Found ${existingTables.length} tables:`);
    existingTables.forEach(table => {
      console.log(
        `  ✅ ${table.name} (${table.hasData ? 'has data' : 'empty'}) - ${table.columns.length} columns`
      );
    });

    // 2. Analyze core relationships
    console.log('\n2️⃣ ANALYZING CORE RELATIONSHIPS...');

    // Check games table structure
    const gamesTable = existingTables.find(t => t.name === 'games');
    const propsTable = existingTables.find(t => t.name === 'raw_props');

    if (gamesTable && propsTable) {
      console.log('\n📊 GAMES TABLE ANALYSIS:');
      console.log(`   Columns: ${gamesTable.columns.join(', ')}`);

      // Check for foreign key fields
      const hasForeignKeys = gamesTable.columns.some(col => col.includes('_id') && col !== 'id');
      console.log(`   Foreign key fields: ${hasForeignKeys ? 'Yes' : 'No'}`);

      console.log('\n🎲 RAW_PROPS TABLE ANALYSIS:');
      console.log(`   Columns: ${propsTable.columns.join(', ')}`);

      // Check relationship fields
      const hasGameId = propsTable.columns.includes('game_id');
      const hasPlayerId = propsTable.columns.includes('player_id');
      const hasExternalGameId = propsTable.columns.includes('external_game_id');

      console.log(`   Has game_id: ${hasGameId ? '✅' : '❌'}`);
      console.log(`   Has player_id: ${hasPlayerId ? '✅' : '❌'}`);
      console.log(`   Has external_game_id: ${hasExternalGameId ? '✅' : '❌'}`);

      // Check data quality
      if (hasGameId) {
        const { data: linkedProps } = await supabase
          .from('raw_props')
          .select('id', { count: 'exact' })
          .not('game_id', 'is', null);

        const { data: totalProps } = await supabase
          .from('raw_props')
          .select('id', { count: 'exact' });

        const linkPercentage =
          totalProps?.length > 0
            ? Math.round(((linkedProps?.length || 0) / totalProps.length) * 100)
            : 0;

        console.log(
          `   Game linking: ${linkPercentage}% (${linkedProps?.length || 0}/${totalProps?.length || 0})`
        );
      }
    }

    // 3. Schema consistency analysis
    console.log('\n3️⃣ SCHEMA CONSISTENCY ANALYSIS...');

    const schemaIssues = [];

    // Check for duplicate table definitions
    const tableDefinitions = {
      users: 0,
      user_profiles: 0,
      games: 0,
      raw_props: 0,
    };

    existingTables.forEach(table => {
      if (tableDefinitions.hasOwnProperty(table.name)) {
        tableDefinitions[table.name]++;
      }
    });

    Object.entries(tableDefinitions).forEach(([table, count]) => {
      if (count > 1) {
        schemaIssues.push(`Duplicate table definition: ${table} (${count} instances)`);
      } else if (count === 0) {
        schemaIssues.push(`Missing core table: ${table}`);
      }
    });

    // Check for naming inconsistencies
    const namingPatterns = {
      timestamps: ['created_at', 'updated_at'],
      ids: ['id'],
      foreign_keys: ['_id'],
    };

    existingTables.forEach(table => {
      // Check timestamp consistency
      const hasCreatedAt = table.columns.includes('created_at');
      const hasUpdatedAt = table.columns.includes('updated_at');

      if (hasCreatedAt !== hasUpdatedAt) {
        schemaIssues.push(
          `Inconsistent timestamps in ${table.name}: created_at=${hasCreatedAt}, updated_at=${hasUpdatedAt}`
        );
      }

      // Check ID field
      if (!table.columns.includes('id')) {
        schemaIssues.push(`Missing primary key 'id' in ${table.name}`);
      }
    });

    if (schemaIssues.length > 0) {
      console.log('❌ SCHEMA ISSUES FOUND:');
      schemaIssues.forEach(issue => console.log(`   • ${issue}`));
    } else {
      console.log('✅ No major schema consistency issues found');
    }

    // 4. Data integrity analysis
    console.log('\n4️⃣ DATA INTEGRITY ANALYSIS...');

    const integrityIssues = [];

    // Check for orphaned records
    if (gamesTable && propsTable) {
      // Check for props with invalid game_ids
      const { data: orphanedProps } = await supabase
        .from('raw_props')
        .select('id, game_id')
        .not('game_id', 'is', null);

      if (orphanedProps && orphanedProps.length > 0) {
        const gameIds = orphanedProps.map(p => p.game_id);
        const uniqueGameIds = [...new Set(gameIds)];

        const { data: existingGames } = await supabase
          .from('games')
          .select('id')
          .in('id', uniqueGameIds);

        const existingGameIds = existingGames?.map(g => g.id) || [];
        const orphanedGameIds = uniqueGameIds.filter(id => !existingGameIds.includes(id));

        if (orphanedGameIds.length > 0) {
          integrityIssues.push(`${orphanedGameIds.length} props reference non-existent games`);
        }
      }
    }

    if (integrityIssues.length > 0) {
      console.log('❌ DATA INTEGRITY ISSUES:');
      integrityIssues.forEach(issue => console.log(`   • ${issue}`));
    } else {
      console.log('✅ No major data integrity issues found');
    }

    // 5. SaaS/Enterprise readiness assessment
    console.log('\n5️⃣ SAAS/ENTERPRISE READINESS ASSESSMENT...');

    const enterpriseFeatures = {
      'Multi-tenancy': false,
      'Audit trails': false,
      'Soft deletes': false,
      'Row-level security': false,
      'Proper indexing': false,
      'Foreign key constraints': false,
      'Data validation': false,
      'Backup strategy': false,
    };

    // Check for multi-tenancy patterns
    const hasTenantFields = existingTables.some(table =>
      table.columns.some(col => col.includes('tenant') || col.includes('organization'))
    );
    enterpriseFeatures['Multi-tenancy'] = hasTenantFields;

    // Check for audit trails
    const hasAuditFields = existingTables.some(
      table => table.columns.includes('created_by') || table.columns.includes('updated_by')
    );
    enterpriseFeatures['Audit trails'] = hasAuditFields;

    // Check for soft deletes
    const hasSoftDeletes = existingTables.some(
      table => table.columns.includes('deleted_at') || table.columns.includes('is_deleted')
    );
    enterpriseFeatures['Soft deletes'] = hasSoftDeletes;

    console.log('Enterprise Features Assessment:');
    Object.entries(enterpriseFeatures).forEach(([feature, implemented]) => {
      console.log(`   ${implemented ? '✅' : '❌'} ${feature}`);
    });

    // 6. Final recommendations
    console.log('\n6️⃣ RECOMMENDATIONS FOR PRODUCTION READINESS...');

    const recommendations = [];

    if (schemaIssues.length > 0) {
      recommendations.push('🔧 Fix schema consistency issues');
    }

    if (integrityIssues.length > 0) {
      recommendations.push('🔗 Implement proper foreign key constraints');
    }

    if (!enterpriseFeatures['Multi-tenancy']) {
      recommendations.push('🏢 Add multi-tenancy support for SaaS scaling');
    }

    if (!enterpriseFeatures['Audit trails']) {
      recommendations.push('📝 Implement audit trails for compliance');
    }

    if (!enterpriseFeatures['Row-level security']) {
      recommendations.push('🔒 Enable row-level security in Supabase');
    }

    recommendations.push('📊 Create comprehensive database migration system');
    recommendations.push('🔍 Implement database monitoring and alerting');
    recommendations.push('📋 Document all table relationships and constraints');

    console.log('Priority Actions:');
    recommendations.forEach((rec, i) => console.log(`   ${i + 1}. ${rec}`));

    // 7. Overall grade
    const totalChecks = Object.keys(enterpriseFeatures).length + 2; // +2 for schema and integrity
    const passedChecks =
      Object.values(enterpriseFeatures).filter(Boolean).length +
      (schemaIssues.length === 0 ? 1 : 0) +
      (integrityIssues.length === 0 ? 1 : 0);

    const grade = Math.round((passedChecks / totalChecks) * 100);

    console.log(`\n🎯 OVERALL ENTERPRISE READINESS: ${grade}%`);

    if (grade >= 80) {
      console.log('✅ EXCELLENT: Ready for Fortune 100 deployment');
    } else if (grade >= 60) {
      console.log('⚠️ GOOD: Needs improvements for enterprise scale');
    } else if (grade >= 40) {
      console.log('🔧 FAIR: Significant work needed for production');
    } else {
      console.log('❌ POOR: Major restructuring required');
    }
  } catch (error) {
    console.error('💥 Analysis failed:', error);
  }
}

comprehensiveSchemaAnalysis();
