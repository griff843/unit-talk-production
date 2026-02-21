#!/usr/bin/env node
/**
 * Apply a migration file to Supabase database
 * Usage: node scripts/apply-migration.mjs <migration-file>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load .env file
config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/apply-migration.mjs <migration-file>');
  process.exit(1);
}

console.log('Applying migration:', migrationFile);
console.log('Supabase URL:', supabaseUrl);

const sql = readFileSync(migrationFile, 'utf-8');

// Split SQL into statements (simple split on semicolon followed by newline)
// This is a simplified approach - for complex migrations, use psql
const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

console.log(`Found ${statements.length} SQL statements`);

// Use fetch to call the Supabase SQL endpoint directly
const response = await fetch(`${supabaseUrl}/rest/v1/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (!response.ok) {
  console.error('Migration failed:', response.status, await response.text());
  process.exit(1);
}

console.log('Migration applied successfully');
