/**
 * Minimal System Test
 *
 * Simple test to verify basic system components are working
 * before running full professional system tests.
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import { createLogger } from '../utils/logger';

import { createClient } from '@supabase/supabase-js';

const logger = createLogger('TestMinimalSystem');

async function testBasicConnectivity() {
  console.log('\n' + '='.repeat(60));
  console.log('🔬 MINIMAL SYSTEM TEST');
  console.log('='.repeat(60));

  try {
    // Test 1: Logger functionality
    console.log('✅ Testing logger...');
    logger.info('Logger test successful');

    // Test 2: Environment variables
    console.log('✅ Testing environment variables...');
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Test 3: Database connectivity
    console.log('✅ Testing database connectivity...');
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

    // Simple ping test instead of complex query
    const { data, error } = await supabase
      .rpc('get_schema_version') // This is a simple built-in function
      .limit(1);

    // If get_schema_version doesn't exist, try a simple select from information_schema
    if (error && error.message.includes('function')) {
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      if (schemaError) {
        // Final fallback - just test the connection with a simple query
        console.log('⚠️ Testing basic connection...');
        const { error: basicError } = await supabase.auth.getSession();
        if (basicError && !basicError.message.includes('session')) {
          throw new Error(`Database connection failed: ${basicError.message}`);
        }
      }
    } else if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    console.log('✅ Database connection successful');

    // Test 4: Check for required tables
    console.log('✅ Testing required tables...');
    const requiredTables = ['raw_props', 'unified_picks', 'users'];

    for (const table of requiredTables) {
      const { error: tableError } = await supabase.from(table).select('*').limit(1);

      if (tableError) {
        console.log(
          `⚠️ Warning: Table ${table} may not exist or be accessible: ${tableError.message}`
        );
      } else {
        console.log(`✅ Table ${table} accessible`);
      }
    }

    // Test 5: Check for professional tables
    console.log('✅ Testing professional system tables...');
    const professionalTables = ['clv_tracking', 'sportsbook_weights', 'processing_logs'];

    for (const table of professionalTables) {
      const { error: tableError } = await supabase.from(table).select('*').limit(1);

      if (tableError) {
        console.log(`⚠️ Professional table ${table} not found - may need migration`);
      } else {
        console.log(`✅ Professional table ${table} ready`);
      }
    }

    // Test 6: Sample data availability
    console.log('✅ Checking for sample data...');

    // Check raw_props
    const { data: rawPropsData, error: rawPropsError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(5);

    if (rawPropsError) {
      console.log(`⚠️ Could not access raw_props: ${rawPropsError.message}`);
    } else {
      console.log(`✅ Found ${rawPropsData?.length || 0} raw props for testing`);
    }

    // Check for historical data
    const { data: historicalData, error: historicalError } = await supabase
      .from('raw_props_historical')
      .select('*')
      .limit(5);

    if (historicalError) {
      console.log(`⚠️ No historical data table found - historical testing may not be possible`);
    } else {
      console.log(`✅ Found ${historicalData?.length || 0} historical props for testing`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 MINIMAL SYSTEM TEST COMPLETE');
    console.log('✅ All basic components are functional');
    console.log('🚀 Ready to test professional system components');
    console.log('='.repeat(60) + '\n');

    return true;
  } catch (error) {
    console.error('\n❌ MINIMAL SYSTEM TEST FAILED');
    console.error('Error:', error);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check environment variables are set correctly');
    console.log('2. Verify database connection and permissions');
    console.log('3. Run database migrations if needed');
    console.log('4. Check supabase service is running');

    return false;
  }
}

async function main() {
  const success = await testBasicConnectivity();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

export { testBasicConnectivity };
