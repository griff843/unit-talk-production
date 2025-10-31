#!/usr/bin/env node
/* eslint-disable no-console, max-lines-per-function, complexity, security/detect-object-injection */
/**
 * Seed Test User - Phase 15 Orchestration
 * Creates test user with configurable ID and role (idempotent & safe to re-run)
 *
 * Usage:
 *   node seed-test-user.js [--id UUID] [--role ROLE] [--email EMAIL] [--json]
 *
 * Options:
 *   --id UUID       User ID (default: 00000000-0000-0000-0000-000000000001)
 *   --role ROLE     User role (default: test)
 *   --email EMAIL   User email (optional)
 *   --json          Output JSON only (no logs)
 *
 * Exit codes:
 *   0 - Success (user created or already exists)
 *   1 - Failure (validation error, database error, etc.)
 *
 * @date 2025-10-31
 * @charter docs/PRODUCTION_CHARTER.md v3.0
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  id: '00000000-0000-0000-0000-000000000001',
  role: 'test',
  email: null,
  json: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id' && args[i + 1]) {
    flags.id = args[i + 1];
    i++;
  } else if (args[i] === '--role' && args[i + 1]) {
    flags.role = args[i + 1];
    i++;
  } else if (args[i] === '--email' && args[i + 1]) {
    flags.email = args[i + 1];
    i++;
  } else if (args[i] === '--json') {
    flags.json = true;
  }
}

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

// Logging helper (respects --json flag)
function log(level, message, data = {}) {
  if (flags.json) return;
  const prefix =
    level === 'error' ? '❌' : level === 'warn' ? '⚠️ ' : level === 'success' ? '✅' : 'ℹ️ ';
  console.log(`${prefix} [Seed] ${message}`, Object.keys(data).length > 0 ? data : '');
}

// Validate UUID format
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Output JSON result
function outputResult(result) {
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function seedTestUser() {
  const startTime = Date.now();

  // Validate inputs
  if (!isValidUUID(flags.id)) {
    const error = {
      success: false,
      error: 'invalid_user_id',
      message: 'User ID must be a valid UUID',
    };
    outputResult(error);
    log('error', 'Invalid user ID format', { id: flags.id });
    process.exit(1);
  }

  if (!isValidUUID(DEFAULT_TENANT_ID)) {
    const error = {
      success: false,
      error: 'invalid_tenant_id',
      message: 'Tenant ID must be a valid UUID',
    };
    outputResult(error);
    log('error', 'Invalid tenant ID format', { tenantId: DEFAULT_TENANT_ID });
    process.exit(1);
  }

  log('info', 'Starting user seed operation', {
    userId: flags.id,
    tenantId: DEFAULT_TENANT_ID,
    role: flags.role,
  });

  // Try Supabase client first (if available)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Check if user exists
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('id, username, role, tier, status')
        .eq('id', flags.id)
        .maybeSingle();

      if (checkError && !checkError.message.includes('does not exist')) {
        throw checkError;
      }

      if (existing) {
        const duration = Date.now() - startTime;
        const result = {
          success: true,
          user: {
            id: existing.id,
            username: existing.username,
            role: existing.role,
            tier: existing.tier,
            status: existing.status,
            exists: true,
            created: false,
          },
          method: 'supabase_client',
          durationMs: duration,
        };
        outputResult(result);
        log('success', 'User already exists (idempotent)', { id: existing.id });
        process.exit(0);
      }

      // Create new user (idempotent via ON CONFLICT in database)
      const userData = {
        id: flags.id,
        tenant_id: DEFAULT_TENANT_ID,
        username: flags.email || `test-user-${flags.role}`,
        role: flags.role,
        tier: 'free',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      if (flags.email) {
        userData.email = flags.email;
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          tier: newUser.tier,
          status: newUser.status,
          exists: false,
          created: true,
        },
        method: 'supabase_client',
        durationMs: duration,
      };
      outputResult(result);
      log('success', 'User created successfully', { id: newUser.id });
      process.exit(0);
    } catch (supabaseError) {
      log('warn', 'Supabase client failed, falling back to direct SQL', {
        error: supabaseError.message,
      });
      // Fall through to direct SQL
    }
  }

  // Fallback to direct SQL (Charter compliant - respects DATABASE_DIRECT_URL)
  const connectionString = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    const error = {
      success: false,
      error: 'no_database_connection',
      message: 'Neither SUPABASE_URL nor DATABASE_DIRECT_URL configured',
    };
    outputResult(error);
    log('error', 'No database connection available');
    process.exit(1);
  }

  let pool = null;
  try {
    pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: true },
    });

    // Idempotent insert with ON CONFLICT
    const result = await pool.query(
      `
      INSERT INTO users (id, tenant_id, username, role, tier, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        tier = EXCLUDED.tier,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id, username, role, tier, status, created_at, updated_at
    `,
      [
        flags.id,
        DEFAULT_TENANT_ID,
        flags.email || `test-user-${flags.role}`,
        flags.role,
        'free',
        'active',
      ]
    );

    const user = result.rows[0];
    const duration = Date.now() - startTime;
    const wasCreated = user.created_at.getTime() === user.updated_at.getTime();

    const output = {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tier: user.tier,
        status: user.status,
        exists: !wasCreated,
        created: wasCreated,
      },
      method: 'direct_sql',
      durationMs: duration,
    };

    outputResult(output);
    log('success', wasCreated ? 'User created via direct SQL' : 'User updated (idempotent)', {
      id: user.id,
    });
    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    const output = {
      success: false,
      error: error.code || 'database_error',
      message: error.message,
      durationMs: duration,
    };
    outputResult(output);
    log('error', 'Database operation failed', { error: error.message });
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run seeder
seedTestUser().catch(error => {
  const output = {
    success: false,
    error: 'fatal_error',
    message: error.message,
    stack: error.stack,
  };
  outputResult(output);
  log('error', 'Fatal error during seed operation', { error: error.message });
  process.exit(1);
});
