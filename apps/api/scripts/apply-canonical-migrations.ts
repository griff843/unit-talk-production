#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars, no-console, max-lines-per-function, import/order, security/detect-non-literal-fs-filename */
import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';

import { Client } from 'pg';

async function getConnectionString(): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Extract project ref from Supabase URL
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

  // Supabase direct PostgreSQL connection
  // Format: postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres

  console.log('\n⚠️  IMPORTANT: Direct PostgreSQL connection required');
  console.log('Please provide your Supabase database password:');
  console.log(
    '(You can find this in Supabase Dashboard > Settings > Database > Connection string)\n'
  );

  // For automated execution, try to use DATABASE_URL env var if available
  if (process.env.DATABASE_URL) {
    console.log('✅ Using DATABASE_URL from environment');
    return process.env.DATABASE_URL;
  }

  throw new Error(
    'DATABASE_URL environment variable not found. Please set it to your Supabase direct database connection string.'
  );
}

async function executeSqlFile(client: Client, filePath: string, name: string): Promise<boolean> {
  console.log(`\n📄 Applying migration: ${name}...`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');

    await client.query(sql);

    console.log(`✅ Successfully applied ${name}`);
    return true;
  } catch (err: any) {
    console.log(`❌ Error applying ${name}:`, err.message);
    return false;
  }
}

async function applyMigrations() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   APPLYING V3 CANONICAL SCHEMA MIGRATIONS TO SUPABASE       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  let connectionString: string;
  try {
    connectionString = await getConnectionString();
  } catch (err: any) {
    console.log('❌', err.message);
    console.log('\nAlternative: Use Supabase Dashboard SQL Editor to manually run migrations:');
    console.log('1. Open: https://supabase.com/dashboard/project/[YOUR_PROJECT]/sql');
    console.log('2. Run: supabase/migrations/20251130_canonical_entities.sql');
    console.log('3. Run: supabase/migrations/20251201_raw_props_canonical_ids.sql');
    console.log('4. Run: ALTER TABLE raw_props ADD COLUMN auto_approved BOOLEAN DEFAULT false;\n');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('📡 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

    // Migration files in order
    const migrations = [
      { file: '20251130_canonical_entities.sql', name: 'Canonical Entities' },
      { file: '20251201_raw_props_canonical_ids.sql', name: 'Raw Props Canonical IDs' },
    ];

    // Apply each migration
    for (const migration of migrations) {
      const filePath = path.join(migrationsDir, migration.file);

      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Migration file not found: ${migration.file}`);
        continue;
      }

      const success = await executeSqlFile(client, filePath, migration.name);
      if (!success) {
        console.log(`\n❌ Migration failed: ${migration.name}`);
        console.log('Stopping migration process.');
        await client.end();
        process.exit(1);
      }
    }

    // Add auto_approved column manually (not in migrations)
    console.log('\n📄 Adding auto_approved column to raw_props...');
    const autoApprovedSql = `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'raw_props' AND column_name = 'auto_approved'
        ) THEN
          ALTER TABLE raw_props ADD COLUMN auto_approved BOOLEAN DEFAULT false;
          RAISE NOTICE 'Added auto_approved column';
        ELSE
          RAISE NOTICE 'auto_approved column already exists';
        END IF;
      END $$;

      NOTIFY pgrst, 'reload schema';
    `;

    await client.query(autoApprovedSql);
    console.log('✅ Successfully added auto_approved column');

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   MIGRATION APPLICATION COMPLETE                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('1. Verify schema: npx tsx apps/api/scripts/verify-supabase-schema.ts');
    console.log('2. Run Phase 1: npx tsx apps/api/scripts/live-fire-phase1-ingestion-simple.ts');
    console.log('3. Verification: npx tsx apps/api/scripts/live-fire-phase1-verification.ts\n');
  } catch (err: any) {
    console.log('\n❌ Error:', err.message);
    console.log('\nPlease use Supabase Dashboard SQL Editor instead:');
    console.log('1. Open: https://supabase.com/dashboard/project/[YOUR_PROJECT]/sql');
    console.log('2. Copy and run the SQL from:');
    console.log('   - supabase/migrations/20251130_canonical_entities.sql');
    console.log('   - supabase/migrations/20251201_raw_props_canonical_ids.sql');
    console.log(
      '3. Then run: ALTER TABLE raw_props ADD COLUMN auto_approved BOOLEAN DEFAULT false;\n'
    );
  } finally {
    await client.end();
  }
}

applyMigrations().catch(console.error);
