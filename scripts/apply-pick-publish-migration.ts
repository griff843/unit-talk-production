/**
 * Apply pick_publish schema migration using Supabase REST API
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cqfnsozknjzvyiziwicl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZm5zb3prbmp6dnlpeml3aWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5NDQxOSwiZXhwIjoyMDc1NDcwNDE5fQ.0fvfA63iHuhlsPNwsVjtQdzMjNivtPLFQZ4hCRX43LI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MIGRATION_SQL = `
-- Add worker_id column
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS worker_id TEXT DEFAULT NULL;
-- Add processing_started_at column
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ DEFAULT NULL;
-- Add error column
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS error TEXT DEFAULT NULL;
`;

async function main() {
  console.log('=== APPLYING PICK_PUBLISH MIGRATION ===\n');
  console.log('Attempting to add missing columns...\n');

  // Try using rpc to execute SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: MIGRATION_SQL
  });

  if (error) {
    console.log('RPC method not available:', error.message);
    console.log('\n=== MANUAL MIGRATION REQUIRED ===');
    console.log('Please run the following SQL in Supabase SQL Editor:');
    console.log('URL: https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql/new');
    console.log('\n--- SQL TO EXECUTE ---');
    console.log(MIGRATION_SQL);
    console.log('--- END SQL ---\n');

    // Check current state
    console.log('=== CURRENT SCHEMA STATE ===');
    const { data: sample, error: sampleError } = await supabase
      .from('pick_publish')
      .select('*')
      .limit(1);

    if (sample && sample.length > 0) {
      const cols = Object.keys(sample[0]);
      const hasWorker = cols.includes('worker_id');
      const hasProcessing = cols.includes('processing_started_at');
      const hasError = cols.includes('error');

      console.log('worker_id column:', hasWorker ? 'EXISTS' : 'MISSING');
      console.log('processing_started_at column:', hasProcessing ? 'EXISTS' : 'MISSING');
      console.log('error column:', hasError ? 'EXISTS' : 'MISSING');
    }
  } else {
    console.log('Migration applied successfully!');
    console.log('Result:', data);
  }
}

main().catch(console.error);
