#!/usr/bin/env node
/**
 * Seed Test User via Supabase Client (Service Role)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const userId = '00000000-0000-0000-0000-000000000001';
const tenantId = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

async function seedUser() {
  const startTime = Date.now();
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log(JSON.stringify({
      success: false,
      error: 'missing_credentials',
      message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found',
    }, null, 2));
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (...args) => {
        // Disable SSL verification for testing
        return fetch(...args);
      },
    },
  });

  try {
    // First, check if the tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError) {
      console.log(JSON.stringify({
        success: false,
        error: 'tenant_query_error',
        message: tenantError.message,
        details: tenantError,
      }, null, 2));
      process.exit(1);
    }

    console.log('Tenant check:', tenant ? tenant : 'Not found');

    // Check if user already exists
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id, username, tier, capper_tier, is_active, discord_id')
      .eq('id', userId)
      .maybeSingle();

    if (checkError) {
      console.log(JSON.stringify({
        success: false,
        error: 'user_check_error',
        message: checkError.message,
        details: checkError,
      }, null, 2));
      process.exit(1);
    }

    if (existing) {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({
        success: true,
        user: {
          id: existing.id,
          username: existing.username,
          tier: existing.tier,
          capper_tier: existing.capper_tier,
          is_active: existing.is_active,
          discord_id: existing.discord_id,
          exists: true,
          created: false,
        },
        method: 'supabase_client_service_role',
        durationMs: duration,
      }, null, 2));
      process.exit(0);
    }

    // Create new user
    const userData = {
      id: userId,
      tenant_id: tenantId,
      username: 'test-user-rpc',
      discord_id: 'test_rpc_validation',
      tier: 'free',
      capper_tier: 'bronze',
      is_active: true,
      meta: {},
    };

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (insertError) {
      console.log(JSON.stringify({
        success: false,
        error: 'user_insert_error',
        message: insertError.message,
        details: insertError,
      }, null, 2));
      process.exit(1);
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        tier: newUser.tier,
        capper_tier: newUser.capper_tier,
        is_active: newUser.is_active,
        discord_id: newUser.discord_id,
        exists: false,
        created: true,
      },
      method: 'supabase_client_service_role',
      durationMs: duration,
    }, null, 2));

    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      success: false,
      error: 'fatal_error',
      message: error.message,
      stack: error.stack,
      durationMs: duration,
    }, null, 2));
    process.exit(1);
  }
}

seedUser();
