/**
 * PHASE 3: Seed minimum required data in STAGING
 *
 * Purpose: Ensure STAGING environment has:
 * 1. Required TENANT_ID from .env
 * 2. At least one test user for API validation
 *
 * Outputs all SQL and verification for proof bundle
 */

const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://csbiuvcpbhttcenmqcqx.supabase.co';
const STAGING_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYml1dmNwYmh0dGNlbm1xY3F4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUwMTk2MywiZXhwIjoyMDg0MDc3OTYzfQ.aAQoQqhmDNbWWjV_mF1Nt6aVXwzSB-lBcQgNF0u40ck';
const REQUIRED_TENANT_ID = '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

async function seedStagingData() {
  console.log('🔧 PHASE 3: Seeding STAGING Data\n');
  console.log('=' .repeat(70));
  console.log(`Project: csbiuvcpbhttcenmqcqx (STAGING)`);
  console.log(`Required Tenant: ${REQUIRED_TENANT_ID}\n`);

  const supabase = createClient(STAGING_URL, STAGING_SERVICE_KEY);

  // ===== STEP 1: Verify/Insert Tenant =====
  console.log('\n📋 STEP 1: Verify Tenant Exists');
  console.log('-'.repeat(70));

  const { data: existingTenant, error: tenantCheckError } = await supabase
    .from('tenants')
    .select('id, name, created_at')
    .eq('id', REQUIRED_TENANT_ID)
    .maybeSingle();

  if (tenantCheckError) {
    console.log(`❌ Error checking tenant: ${tenantCheckError.message}`);
    console.log(`   Code: ${tenantCheckError.code}`);
    process.exit(1);
  }

  console.log(`\n📊 SQL Query Executed:`);
  console.log(`   SELECT id, name, created_at`);
  console.log(`   FROM tenants`);
  console.log(`   WHERE id = '${REQUIRED_TENANT_ID}';`);

  if (existingTenant) {
    console.log(`\n✅ Tenant already exists:`);
    console.log(`   ID: ${existingTenant.id}`);
    console.log(`   Name: ${existingTenant.name}`);
    console.log(`   Created: ${existingTenant.created_at}`);
  } else {
    console.log(`\n⚠️  Tenant NOT found - inserting...`);

    const { data: newTenant, error: insertError } = await supabase
      .from('tenants')
      .insert({
        id: REQUIRED_TENANT_ID,
        name: 'Unit Talk STAGING',
        slug: 'unit-talk-staging',
        domain: 'staging.unittalk.com',
        status: 'active',
        tier: 'enterprise',
        settings: {
          environment: 'staging',
          version: '3.0.0',
          created_by: 'seed_script',
          branding: {
            logo_url: '/logo.png',
            primary_color: '#3B82F6'
          },
          features: {
            temporal_workflows: true,
            discord_integration: true,
            professional_grading: true
          }
        },
        features: {},
        limits: {
          max_users: 1000,
          max_storage_gb: 10,
          max_picks_per_day: 100
        },
        metadata: {}
      })
      .select('id, name, slug, created_at')
      .single();

    if (insertError) {
      console.log(`❌ Error inserting tenant: ${insertError.message}`);
      console.log(`   Code: ${insertError.code}`);
      process.exit(1);
    }

    console.log(`\n📊 SQL Insert Executed:`);
    console.log(`   INSERT INTO tenants (id, name, slug, domain, status, tier, settings, features, limits, metadata)`);
    console.log(`   VALUES (`);
    console.log(`     '${REQUIRED_TENANT_ID}',`);
    console.log(`     'Unit Talk STAGING',`);
    console.log(`     'unit-talk-staging',`);
    console.log(`     'staging.unittalk.com',`);
    console.log(`     'active',`);
    console.log(`     'enterprise',`);
    console.log(`     '{"environment":"staging","version":"3.0.0",...}'::jsonb,`);
    console.log(`     '{}'::jsonb,`);
    console.log(`     '{"max_users":1000,"max_storage_gb":10,"max_picks_per_day":100}'::jsonb,`);
    console.log(`     '{}'::jsonb`);
    console.log(`   )`);
    console.log(`   RETURNING id, name, slug, created_at;`);

    console.log(`\n✅ Tenant created successfully:`);
    console.log(`   ID: ${newTenant.id}`);
    console.log(`   Name: ${newTenant.name}`);
    console.log(`   Slug: ${newTenant.slug}`);
    console.log(`   Created: ${newTenant.created_at}`);
  }

  // ===== STEP 2: Verify/Insert Test User =====
  console.log('\n\n📋 STEP 2: Verify Test User Exists');
  console.log('-'.repeat(70));

  const { data: existingUser, error: userCheckError } = await supabase
    .from('users')
    .select('id, username, discord_id, tier, status, tenant_id, created_at')
    .eq('tenant_id', REQUIRED_TENANT_ID)
    .limit(1)
    .maybeSingle();

  if (userCheckError) {
    console.log(`❌ Error checking user: ${userCheckError.message}`);
    console.log(`   Code: ${userCheckError.code}`);
    process.exit(1);
  }

  console.log(`\n📊 SQL Query Executed:`);
  console.log(`   SELECT id, username, discord_id, tier, status, tenant_id, created_at`);
  console.log(`   FROM users`);
  console.log(`   WHERE tenant_id = '${REQUIRED_TENANT_ID}'`);
  console.log(`   LIMIT 1;`);

  if (existingUser) {
    console.log(`\n✅ Test user already exists:`);
    console.log(`   ID: ${existingUser.id}`);
    console.log(`   Username: ${existingUser.username}`);
    console.log(`   Discord ID: ${existingUser.discord_id}`);
    console.log(`   Tier: ${existingUser.tier || 'N/A'}`);
    console.log(`   Status: ${existingUser.status || 'N/A'}`);
    console.log(`   Tenant ID: ${existingUser.tenant_id}`);
    console.log(`   Created: ${existingUser.created_at}`);
  } else {
    console.log(`\n⚠️  No test user found - creating...`);

    const { data: newUser, error: userInsertError } = await supabase
      .from('users')
      .insert({
        tenant_id: REQUIRED_TENANT_ID,
        username: 'staging_test_user',
        discord_id: '999999999999999999', // Fake Discord ID for testing
        tier: 'VIP', // Case-sensitive: 'Free', 'Premium', 'VIP', 'VIP+', 'Black Label'
        status: 'active',
        metadata: {
          purpose: 'smoke_pack_testing',
          created_by: 'seed_script',
          environment: 'staging'
        }
      })
      .select('id, username, discord_id, tier, status, tenant_id, created_at')
      .single();

    if (userInsertError) {
      console.log(`❌ Error inserting user: ${userInsertError.message}`);
      console.log(`   Code: ${userInsertError.code}`);
      process.exit(1);
    }

    console.log(`\n📊 SQL Insert Executed:`);
    console.log(`   INSERT INTO users (tenant_id, username, discord_id, tier, status, metadata)`);
    console.log(`   VALUES (`);
    console.log(`     '${REQUIRED_TENANT_ID}',`);
    console.log(`     'staging_test_user',`);
    console.log(`     '999999999999999999',`);
    console.log(`     'VIP',`);
    console.log(`     'active',`);
    console.log(`     '{"purpose":"smoke_pack_testing","created_by":"seed_script","environment":"staging"}'::jsonb`);
    console.log(`   )`);
    console.log(`   RETURNING id, username, discord_id, tier, status, tenant_id, created_at;`);

    console.log(`\n✅ Test user created successfully:`);
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Discord ID: ${newUser.discord_id}`);
    console.log(`   Tier: ${newUser.tier}`);
    console.log(`   Status: ${newUser.status}`);
    console.log(`   Tenant ID: ${newUser.tenant_id}`);
    console.log(`   Created: ${newUser.created_at}`);
  }

  // ===== STEP 3: Final Verification =====
  console.log('\n\n📋 STEP 3: Final Data Verification');
  console.log('-'.repeat(70));

  const { data: finalTenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', REQUIRED_TENANT_ID)
    .single();

  const { data: finalUsers, count: userCount } = await supabase
    .from('users')
    .select('id, username', { count: 'exact' })
    .eq('tenant_id', REQUIRED_TENANT_ID);

  console.log(`\n📊 SQL Verification Queries:`);
  console.log(`   SELECT id, name FROM tenants WHERE id = '${REQUIRED_TENANT_ID}';`);
  console.log(`   SELECT id, username FROM users WHERE tenant_id = '${REQUIRED_TENANT_ID}';`);

  console.log(`\n✅ STAGING Data Ready:`);
  console.log(`   Tenant: ${finalTenant.name} (${finalTenant.id})`);
  console.log(`   Users: ${userCount} user(s)`);
  if (finalUsers && finalUsers.length > 0) {
    finalUsers.forEach(u => {
      console.log(`     - ${u.username} (${u.id})`);
    });
  }

  // ===== Summary =====
  console.log('\n\n' + '='.repeat(70));
  console.log('🎯 PHASE 3 COMPLETION SUMMARY\n');
  console.log('✅ Required tenant exists and verified');
  console.log('✅ Test user(s) available for API validation');
  console.log('✅ All SQL statements captured for proof bundle');
  console.log('\n📌 Next Steps:');
  console.log('   PHASE 4: Run Smart Form smoke pack against STAGING');
  console.log('   Command: npx playwright test tests/smoke-pack.spec.ts\n');
  console.log('='.repeat(70));
}

seedStagingData();
