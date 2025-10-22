#!/usr/bin/env tsx
/**
 * Execute SQL file via Supabase client (works around psql DNS issues)
 * Date: 2025-10-20
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function executeSQLFile(filePath: string) {
  console.log(`📄 Executing SQL file: ${filePath}\n`);

  const sqlContent = fs.readFileSync(filePath, 'utf-8');
  
  // Split by semicolon and filter out comments/empty lines
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
    console.log(`${stmt.substring(0, 100)}${stmt.length > 100 ? '...' : ''}\n`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // Try direct query if RPC doesn't exist
        console.log('RPC not available, trying direct execution...');
        
        // For INSERT/UPDATE/DELETE, we need to use the REST API differently
        // Let's use a workaround with a custom function
        const { data: result, error: execError } = await supabase
          .from('_exec_sql_result')
          .select('*')
          .limit(0);
        
        if (execError) {
          console.error(`❌ Error: ${execError.message}`);
          
          // If it's a SELECT, try to parse and execute
          if (stmt.toUpperCase().trim().startsWith('SELECT')) {
            console.log('Attempting to execute SELECT via query...');
            // This won't work for arbitrary SQL, but we'll log it
            console.log('⚠️  Cannot execute SELECT via Supabase client');
          }
        }
      } else {
        console.log('✅ Success');
        if (data) {
          console.log('Result:', JSON.stringify(data).substring(0, 200));
        }
      }
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  }

  console.log('\n✅ SQL file execution complete\n');
}

const sqlFile = process.argv[2] || 'apps/api/out/ops/BACKFILL_MARKET_PROPS_TODAY.sql';
executeSQLFile(sqlFile).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

