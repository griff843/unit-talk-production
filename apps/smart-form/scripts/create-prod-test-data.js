/**
 * PHASE 5 - Create PROD Test Tenant and User
 *
 * This script creates isolated test data in PROD for smoke pack validation.
 * It does NOT touch any real production data.
 *
 * Environment: PROD (cqfnsozknjzvyiziwicl)
 */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

// PROD Supabase credentials - MUST be configured via env vars
const PROD_URL = process.env.PROD_SUPABASE_URL || 'https://cqfnsozknjzvyiziwicl.supabase.co';
const PROD_SERVICE_KEY = process.env.PROD_SUPABASE_SERVICE_KEY;

if (!PROD_SERVICE_KEY) {
  console.error('❌ ERROR: PROD_SUPABASE_SERVICE_KEY environment variable is required');
  console.error('   Set it to your PROD service role key and re-run this script');
  process.exit(1);
}

const supabase = createClient(PROD_URL, PROD_SERVICE_KEY);

async function createProdTestData() {
  console.log('🚀 PHASE 5 - Creating PROD Test Data');
  console.log('📍 Environment: PROD (cqfnsozknjzvyiziwicl)');
  console.log('⚠️  Shadow Mode: No real data will be modified');
  console.log('');

  // Step 1: Create test tenant
  const tenantId = randomUUID();
  console.log(`1️⃣ Creating PROD test tenant: ${tenantId}`);

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      id: tenantId,
      name: 'Unit Talk PROD TEST',
      slug: 'unit-talk-prod-test',
      tier: 'vip',
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (tenantError) {
    console.error('❌ Failed to create tenant:', tenantError);
    process.exit(1);
  }

  console.log('✅ Tenant created:', {
    id: tenant.id,
    name: tenant.name,
    tier: tenant.tier,
    status: tenant.status,
  });
  console.log('');

  // Step 2: Create test user
  const userId = randomUUID();
  console.log(`2️⃣ Creating PROD test user: ${userId}`);

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      id: userId,
      tenant_id: tenantId,
      username: 'ProdTestUser',
      discord_id: 'prod-test-discord-999999',
      tier: 'vip',
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (userError) {
    console.error('❌ Failed to create user:', userError);
    // Rollback tenant
    await supabase.from('tenants').delete().eq('id', tenantId);
    process.exit(1);
  }

  console.log('✅ User created:', {
    id: user.id,
    username: user.username,
    tenant_id: user.tenant_id,
    tier: user.tier,
    is_active: user.is_active,
  });
  console.log('');

  // Step 3: Verification
  console.log('3️⃣ Verifying PROD test data...');

  const { data: verifyTenant } = await supabase
    .from('tenants')
    .select('id, name, tier, status')
    .eq('id', tenantId)
    .single();

  const { data: verifyUser } = await supabase
    .from('users')
    .select('id, username, tenant_id, tier, is_active')
    .eq('id', userId)
    .single();

  console.log('✅ Verification complete:');
  console.log('   Tenant:', verifyTenant);
  console.log('   User:', verifyUser);
  console.log('');

  // Step 4: Output environment variables for smoke pack
  console.log('4️⃣ Environment Configuration for Smoke Pack:');
  console.log('');
  console.log('Add these to apps/smart-form/.env for PROD testing:');
  console.log('');
  console.log(`NEXT_PUBLIC_SUPABASE_URL=${PROD_URL}`);
  console.log(`TENANT_ID=${tenantId}`);
  console.log(`TEST_USER_ID=${userId}`);
  console.log('');

  // Step 5: Return test data for verification
  return {
    tenant: {
      id: tenantId,
      name: 'Unit Talk PROD TEST',
      tier: 'vip',
      status: 'active',
    },
    user: {
      id: userId,
      username: 'ProdTestUser',
      tenant_id: tenantId,
      tier: 'vip',
      is_active: true,
    },
  };
}

// Execute and handle results
createProdTestData()
  .then((data) => {
    console.log('');
    console.log('🎉 PROD TEST DATA CREATION COMPLETE');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Update apps/smart-form/.env with PROD credentials above');
    console.log('2. Verify schema parity (7 Smart Form tables exist in PROD)');
    console.log('3. Run smoke pack: npm run test:smoke-pack');
    console.log('4. Verify ONLY test tenant/user were touched in PROD');
    console.log('');
    console.log('🔐 Test Data Created:');
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ FATAL ERROR:', error);
    console.error('');
    console.error('PROD test data creation failed. DO NOT PROCEED with smoke pack.');
    process.exit(1);
  });
