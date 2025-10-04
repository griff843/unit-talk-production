/**
 * Database Schema Push to Supabase Cloud
 *
 * Applies pending migrations to Supabase Cloud database
 */

import { execSync } from 'child_process';
import { getDbConfig } from '../config/db';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE SCHEMA PUSH - SUPABASE CLOUD');
  console.log('='.repeat(80) + '\n');

  try {
    // Get and validate config
    const config = getDbConfig();
    console.log('✅ Configuration validated');
    console.log(`   Target: ${new URL(config.supabaseUrl).hostname}\n`);

    // Check for DATABASE_URL
    if (!config.databaseUrl) {
      console.log('⚠️  No DATABASE_URL configured');
      console.log('   Using Supabase REST API only (no direct postgres migrations)\n');
      console.log('   To enable Postgres migrations:');
      console.log('   1. Get connection string from Supabase dashboard');
      console.log('   2. Add to .env: DATABASE_URL=postgresql://...');
      console.log('   3. Ensure it ends with ?sslmode=require\n');
      process.exit(0);
    }

    console.log('✅ DATABASE_URL configured');
    console.log('   Running migrations...\n');

    // Run Drizzle push
    console.log('-'.repeat(80));
    execSync('npx drizzle-kit push:pg', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: config.databaseUrl
      }
    });
    console.log('-'.repeat(80));

    console.log('\n✅ Schema push completed successfully');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Schema push failed:', error);
    console.log('='.repeat(80) + '\n');
    process.exit(1);
  }
}

main();
