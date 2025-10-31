/**
 * Seed Test User - Phase 13 Cutover
 * Creates test user with ID 00000000-0000-0000-0000-000000000001
 * 
 * @date 2025-10-31
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

async function seedTestUser() {
  console.log('[Seed Test User] Starting...');
  console.log(`[Seed Test User] User ID: ${TEST_USER_ID}`);
  console.log(`[Seed Test User] Tenant ID: ${DEFAULT_TENANT_ID}`);

  try {
    // Check if user exists
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', TEST_USER_ID)
      .maybeSingle();

    if (checkError) {
      console.error('[Seed Test User] Error checking user:', checkError);
      throw checkError;
    }

    if (existing) {
      console.log('[Seed Test User] User already exists:', existing);
      return existing;
    }

    // Create test user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: TEST_USER_ID,
        tenant_id: DEFAULT_TENANT_ID,
        username: 'test_user_phase13',
        discord_id: '000000000000000001',
        tier: 'vip',  // Valid tier per actual production constraint (lowercase)
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Seed Test User] Error creating user:', insertError);
      throw insertError;
    }

    console.log('[Seed Test User] ✅ User created successfully:', newUser);
    return newUser;

  } catch (error) {
    console.error('[Seed Test User] ❌ Failed:', error);
    process.exit(1);
  }
}

seedTestUser()
  .then(() => {
    console.log('[Seed Test User] Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Seed Test User] Fatal error:', error);
    process.exit(1);
  });

