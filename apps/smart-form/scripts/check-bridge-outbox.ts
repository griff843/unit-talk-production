import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseServer } from '../lib/supabase';
import type { Database } from '../types/supabase';

async function checkBridgeOutboxTable() {
  console.log('🔍 Checking bridge_outbox table existence...');
  console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('🔍 Service Role Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const supabase = supabaseServer();

    // Try to query the bridge_outbox table
    const { data, error } = await supabase
      .from('bridge_outbox')
      .select('count')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ bridge_outbox table does NOT exist');
        console.log('📝 Error details:', error.message);
        console.log('🔧 You need to create the bridge_outbox table in your Supabase database');
        console.log('');
        console.log('📋 Required SQL to create the table:');
        console.log(`
CREATE TABLE bridge_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  unique_key VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Create indexes for performance
CREATE INDEX idx_bridge_outbox_status ON bridge_outbox(status);
CREATE INDEX idx_bridge_outbox_created_at ON bridge_outbox(created_at);
CREATE INDEX idx_bridge_outbox_unique_key ON bridge_outbox(unique_key);
        `);
        return false;
      } else {
        console.log('❌ Error querying bridge_outbox table:', error.message);
        console.log('📝 Error code:', error.code);
        return false;
      }
    }

    console.log('✅ bridge_outbox table EXISTS!');

    // Get record count
    const { count, error: countError } = await supabase
      .from('bridge_outbox')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log('⚠️ Could not get record count:', countError.message);
    } else {
      console.log(`📊 Bridge outbox contains ${count || 0} records`);
    }

    // Get table schema info
    console.log('🔍 Checking table structure...');
    const { data: schemaData, error: schemaError } = await supabase
      .from('bridge_outbox')
      .select('*')
      .limit(1);

    if (schemaError) {
      console.log('⚠️ Could not verify table structure:', schemaError.message);
    } else {
      console.log('✅ Table structure verified - ready for use');

      // Show sample record structure if any records exist
      if (schemaData && schemaData.length > 0) {
        console.log('📋 Sample record structure:');
        console.log(JSON.stringify(schemaData[0], null, 2));
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testInsertOperation() {
  console.log('\n🧪 Testing insert operation...');

  try {
    const supabase = supabaseServer();

    const testInsert = {
      event_type: 'test_event',
      payload: { test: true, timestamp: new Date().toISOString() } as any,
      unique_key: `test-${Date.now()}`,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('bridge_outbox')
      .insert(testInsert as any)
      .select()
      .single();

    if (error) {
      console.log('❌ Insert test failed:', error.message);
      return false;
    }

    console.log('✅ Insert test successful!');
    console.log('📝 Inserted record ID:', (data as any)?.id);

    // Clean up test record
    const { error: deleteError } = await supabase
      .from('bridge_outbox')
      .delete()
      .eq('id', (data as any)?.id);

    if (deleteError) {
      console.log('⚠️ Could not clean up test record:', deleteError.message);
    } else {
      console.log('🧹 Test record cleaned up');
    }

    return true;

  } catch (error) {
    console.error('❌ Insert test error:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Bridge Outbox Table Checker');
  console.log('================================\n');

  const tableExists = await checkBridgeOutboxTable();

  if (tableExists) {
    await testInsertOperation();
    console.log('\n✅ bridge_outbox table is ready for use!');
  } else {
    console.log('\n❌ bridge_outbox table needs to be created.');
    process.exit(1);
  }
}

main().catch(console.error);