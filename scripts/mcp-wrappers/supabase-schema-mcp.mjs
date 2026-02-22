#!/usr/bin/env node
/**
 * Supabase Schema MCP Wrapper
 * Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A
 *
 * Provides MCP-style interface to Supabase schema:
 * - introspectSchema()
 * - generateTypes()
 * - diffSchemaVsTypes()
 * - getRpcSignatures()
 * - getSchemaHash()
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SUPABASE_DIR = path.join(ROOT, 'supabase');
const TYPES_DIR = path.join(ROOT, 'packages', 'shared', 'types');

/**
 * Get Supabase project configuration
 */
function getSupabaseConfig() {
  const configPath = path.join(SUPABASE_DIR, 'config.toml');
  if (!existsSync(configPath)) {
    return { exists: false };
  }

  const content = readFileSync(configPath, 'utf8');
  const projectId = content.match(/project_id\s*=\s*"([^"]+)"/)?.[1];

  return {
    exists: true,
    projectId,
    configPath,
  };
}

/**
 * Get all migration files
 */
function getMigrationFiles() {
  const migrationsDir = path.join(SUPABASE_DIR, 'migrations');
  if (!existsSync(migrationsDir)) {
    return [];
  }

  return readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({
      name: f,
      path: path.join(migrationsDir, f),
      timestamp: f.split('_')[0],
    }));
}

/**
 * Introspect schema from migrations
 */
export function introspectSchema() {
  const migrations = getMigrationFiles();
  const tables = new Set();
  const functions = new Set();
  const triggers = new Set();
  const indexes = new Set();
  const types = new Set();

  for (const migration of migrations) {
    const content = readFileSync(migration.path, 'utf8');

    // Extract table names
    const tableMatches = content.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?(\w+)/gi);
    for (const match of tableMatches) {
      tables.add(match[1]);
    }

    // Extract function names
    const funcMatches = content.matchAll(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+(?:public\.)?(\w+)/gi);
    for (const match of funcMatches) {
      functions.add(match[1]);
    }

    // Extract trigger names
    const triggerMatches = content.matchAll(/CREATE\s+TRIGGER\s+(\w+)/gi);
    for (const match of triggerMatches) {
      triggers.add(match[1]);
    }

    // Extract index names
    const indexMatches = content.matchAll(/CREATE(?:\s+UNIQUE)?\s+INDEX(?:\s+IF NOT EXISTS)?\s+(\w+)/gi);
    for (const match of indexMatches) {
      indexes.add(match[1]);
    }

    // Extract type names
    const typeMatches = content.matchAll(/CREATE\s+TYPE\s+(?:public\.)?(\w+)/gi);
    for (const match of typeMatches) {
      types.add(match[1]);
    }
  }

  return {
    success: true,
    tables: Array.from(tables).sort(),
    functions: Array.from(functions).sort(),
    triggers: Array.from(triggers).sort(),
    indexes: Array.from(indexes).sort(),
    types: Array.from(types).sort(),
    migrationCount: migrations.length,
    latestMigration: migrations[migrations.length - 1]?.name || null,
  };
}

/**
 * Generate schema hash for drift detection
 */
export function getSchemaHash() {
  const migrations = getMigrationFiles();
  if (migrations.length === 0) {
    return { success: false, error: 'No migrations found' };
  }

  // Hash all migration content
  const hash = createHash('sha256');
  for (const migration of migrations) {
    const content = readFileSync(migration.path, 'utf8');
    hash.update(content);
  }

  const schemaHash = hash.digest('hex').substring(0, 16);

  return {
    success: true,
    hash: schemaHash,
    migrationCount: migrations.length,
    latestMigration: migrations[migrations.length - 1]?.name,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Get RPC function signatures
 */
export function getRpcSignatures() {
  const migrations = getMigrationFiles();
  const rpcs = [];

  for (const migration of migrations) {
    const content = readFileSync(migration.path, 'utf8');

    // Match function definitions with parameters and return types
    const funcRegex = /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+(?:public\.)?(\w+)\s*\(([^)]*)\)\s*RETURNS\s+([^\s]+(?:\s+TABLE\s*\([^)]+\))?)/gi;

    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const [, name, params, returns] = match;

      // Parse parameters
      const paramList = params.trim()
        ? params.split(',').map(p => {
            const trimmed = p.trim();
            const parts = trimmed.split(/\s+/);
            return {
              name: parts[0]?.replace(/^p_/, ''),
              type: parts.slice(1).join(' ').toUpperCase(),
            };
          })
        : [];

      rpcs.push({
        name,
        parameters: paramList,
        returns: returns.trim().toUpperCase(),
        source: migration.name,
      });
    }
  }

  return {
    success: true,
    rpcs: rpcs,
    count: rpcs.length,
  };
}

/**
 * Check for generated types file
 */
function getGeneratedTypesPath() {
  const possiblePaths = [
    path.join(ROOT, 'packages', 'shared', 'types', 'supabase.ts'),
    path.join(ROOT, 'packages', 'shared', 'types', 'database.types.ts'),
    path.join(ROOT, 'supabase', 'types.ts'),
    path.join(ROOT, 'src', 'types', 'supabase.ts'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Generate types from Supabase
 */
export function generateTypes() {
  const config = getSupabaseConfig();
  if (!config.exists) {
    return { success: false, error: 'Supabase config not found' };
  }

  try {
    const result = execSync('npx supabase gen types typescript --local', {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, types: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Diff schema vs generated types
 */
export function diffSchemaVsTypes() {
  const typesPath = getGeneratedTypesPath();
  if (!typesPath) {
    return {
      success: true,
      hasDrift: null,
      reason: 'No generated types file found',
      recommendation: 'Run: npx supabase gen types typescript --local',
    };
  }

  const schema = introspectSchema();
  const typesContent = readFileSync(typesPath, 'utf8');

  // Extract table names from types file
  const typeTableMatches = typesContent.matchAll(/(\w+):\s*{\s*Row:/g);
  const typeTables = new Set();
  for (const match of typeTableMatches) {
    typeTables.add(match[1].toLowerCase());
  }

  // Compare
  const schemaTables = new Set(schema.tables.map(t => t.toLowerCase()));

  const inSchemaNotTypes = [...schemaTables].filter(t => !typeTables.has(t));
  const inTypesNotSchema = [...typeTables].filter(t => !schemaTables.has(t));

  const hasDrift = inSchemaNotTypes.length > 0 || inTypesNotSchema.length > 0;

  // Get types file mod time
  const typesModTime = statSync(typesPath).mtime;
  const latestMigration = getMigrationFiles().pop();
  const migrationModTime = latestMigration ? statSync(latestMigration.path).mtime : null;

  const typesStale = migrationModTime && migrationModTime > typesModTime;

  return {
    success: true,
    hasDrift,
    typesStale,
    typesPath,
    typesLastModified: typesModTime.toISOString(),
    latestMigration: latestMigration?.name,
    inSchemaNotTypes,
    inTypesNotSchema,
    recommendation: hasDrift || typesStale
      ? 'Run: npx supabase gen types typescript --local'
      : null,
  };
}

/**
 * Get full schema summary
 */
export function summary() {
  const config = getSupabaseConfig();
  const schema = introspectSchema();
  const hash = getSchemaHash();
  const drift = diffSchemaVsTypes();
  const rpcs = getRpcSignatures();

  return {
    success: true,
    config,
    schema: {
      tables: schema.tables.length,
      functions: schema.functions.length,
      triggers: schema.triggers.length,
      indexes: schema.indexes.length,
      types: schema.types.length,
    },
    hash: hash.hash,
    drift: {
      hasDrift: drift.hasDrift,
      typesStale: drift.typesStale,
    },
    rpcs: rpcs.count,
    latestMigration: schema.latestMigration,
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('supabase-schema-mcp.mjs')) {
  const command = process.argv[2] || 'summary';

  let result;
  switch (command) {
    case 'introspect':
      result = introspectSchema();
      break;
    case 'hash':
      result = getSchemaHash();
      break;
    case 'rpcs':
      result = getRpcSignatures();
      break;
    case 'diff':
      result = diffSchemaVsTypes();
      break;
    case 'generate':
      result = generateTypes();
      break;
    case 'summary':
    default:
      result = summary();
  }

  console.log(JSON.stringify(result, null, 2));
}
