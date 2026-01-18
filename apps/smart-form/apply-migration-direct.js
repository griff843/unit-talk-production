/**
 * Apply migration directly via PostgreSQL connection
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

// Construct PostgreSQL connection string
// Supabase format: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
const connectionString = `postgresql://postgres.${projectRef}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function applyMigration() {
  console.log('🔧 Connecting to Supabase PostgreSQL...');
  console.log(`   Project: ${projectRef}`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'MIGRATION_READY.sql');
    console.log(`\n📄 Reading migration: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`   Migration size: ${(sql.length / 1024).toFixed(2)} KB`);

    // Execute migration
    console.log('\n🚀 Executing migration...');
    await client.query(sql);
    console.log('✅ Migration executed successfully');

    // Verify key tables exist
    console.log('\n🔍 Verifying tables...');
    const tables = ['tenants', 'users', 'picks', 'smart_form_submissions', 'rate_limit_tracking'];

    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )`,
        [table]
      );

      if (result.rows[0].exists) {
        // Get row count
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ✅ Table '${table}' exists (${countResult.rows[0].count} rows)`);
      } else {
        console.log(`   ❌ Table '${table}' NOT FOUND`);
      }
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error:', error.message);

    if (error.position) {
      console.error(`Position: ${error.position}`);
    }

    if (error.detail) {
      console.error(`Detail: ${error.detail}`);
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
