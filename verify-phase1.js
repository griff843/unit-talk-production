const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/smart-form/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyPhase1() {
  console.log('🔍 VERIFYING PHASE 1: SAAS FOUNDATION');
  console.log('====================================');
  console.log('⏰ Started at:', new Date().toLocaleString());
  console.log('');

  try {
    // Check if core tables exist
    const tablesToCheck = ['users', 'unified_picks', 'parlay_tickets'];
    const tableStatus = {};

    for (const tableName of tablesToCheck) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          tableStatus[tableName] = {
            exists: true,
            rowCount: count || 0,
            status: '✅ Created successfully',
          };
          console.log(`✅ ${tableName}: Created (${count || 0} rows)`);
        } else {
          tableStatus[tableName] = {
            exists: false,
            error: error.message,
            status: '❌ Not found',
          };
          console.log(`❌ ${tableName}: ${error.message}`);
        }
      } catch (e) {
        tableStatus[tableName] = {
          exists: false,
          error: e.message,
          status: '❌ Error checking',
        };
        console.log(`❌ ${tableName}: ${e.message}`);
      }
    }

    // Check if views exist
    console.log('');
    console.log('🔍 Checking compatibility views...');

    try {
      const { data, error } = await supabase
        .from('cappers')
        .select('*', { count: 'exact', head: true });

      if (!error) {
        console.log('✅ cappers view: Created successfully');
      } else {
        console.log('❌ cappers view:', error.message);
      }
    } catch (e) {
      console.log('❌ cappers view:', e.message);
    }

    // Summary
    console.log('');
    console.log('📊 PHASE 1 VERIFICATION SUMMARY');
    console.log('===============================');

    const successCount = Object.values(tableStatus).filter(t => t.exists).length;
    const totalCount = tablesToCheck.length;

    if (successCount === totalCount) {
      console.log('🎉 PHASE 1 SUCCESSFUL!');
      console.log('✅ All core tables created');
      console.log('✅ Foundation ready for data migration');
      console.log('');
      console.log('🚀 READY FOR PHASE 2: DATA MIGRATION');
      return { success: true, tablesCreated: successCount };
    } else {
      console.log('⚠️ PHASE 1 INCOMPLETE');
      console.log(`❌ ${totalCount - successCount} tables missing`);
      console.log('');
      console.log('🔧 Please run the SQL script in Supabase SQL Editor');
      return {
        success: false,
        tablesCreated: successCount,
        tablesMissing: totalCount - successCount,
      };
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return { success: false, error: error.message };
  }
}

verifyPhase1().catch(console.error);
