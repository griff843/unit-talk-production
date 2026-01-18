import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public'
  }
});

async function applyMigration() {
  console.log('=== Applying CANARY Channel Migration ===\n');

  try {
    // Step 1: Drop existing constraint
    console.log('Step 1: Dropping existing constraint...');
    const { error: dropError } = await (supabase as any).rpc('exec', {
      sql: 'ALTER TABLE pick_publish DROP CONSTRAINT IF EXISTS pick_publish_channel_check;'
    });

    if (dropError) {
      console.log('Could not drop via RPC, trying alternative method...');
      console.log('Error:', dropError.message);
    } else {
      console.log('✅ Constraint dropped');
    }

    // Step 2: Add new constraint with CANARY
    console.log('\nStep 2: Adding new constraint with CANARY support...');
    const { error: addError } = await (supabase as any).rpc('exec', {
      sql: `ALTER TABLE pick_publish ADD CONSTRAINT pick_publish_channel_check CHECK (channel IN ('DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'));`
    });

    if (addError) {
      console.log('Could not add via RPC, trying alternative method...');
      console.log('Error:', addError.message);
    } else {
      console.log('✅ Constraint added');
    }

    console.log('\n⚠️ If migration failed, please apply manually via Supabase SQL Editor:');
    console.log(`
ALTER TABLE pick_publish
  DROP CONSTRAINT IF EXISTS pick_publish_channel_check;

ALTER TABLE pick_publish
  ADD CONSTRAINT pick_publish_channel_check
  CHECK (channel IN ('DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'));
`);

  } catch (error) {
    console.error('Migration failed:', error);
    console.log('\nPlease apply this SQL manually via Supabase SQL Editor:');
    console.log(`
ALTER TABLE pick_publish
  DROP CONSTRAINT IF EXISTS pick_publish_channel_check;

ALTER TABLE pick_publish
  ADD CONSTRAINT pick_publish_channel_check
  CHECK (channel IN ('DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'));
`);
  }
}

applyMigration().catch(console.error);
