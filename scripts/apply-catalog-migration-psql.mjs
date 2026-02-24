/**
 * SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091: Apply view migration via pg
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env file
const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const envLines = envFile.split('\n');
for (const line of envLines) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
}

// Try pooler URL first, then direct URL
const DATABASE_URL = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL or SUPABASE_DB_URL_POOLER');
  process.exit(1);
}

console.log('Using connection:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

const { Client } = pg;

async function applyMigration() {
  console.log('=== SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091 ===');
  console.log('Applying catalog_players_v1 view migration via psql...\n');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Step 1: Check current view definition
    console.log('1. Current view definition (BEFORE):');
    const beforeResult = await client.query(`
      SELECT pg_get_viewdef('catalog_players_v1'::regclass, true) as viewdef
    `);
    const beforeDef = beforeResult.rows[0]?.viewdef || 'NOT FOUND';
    console.log('   ' + beforeDef.substring(0, 200) + '...');

    const usesLegacy = beforeDef.includes('FROM players') || beforeDef.includes('LEFT JOIN teams');
    console.log(`   Uses legacy tables: ${usesLegacy ? '⚠️ YES' : '✅ NO'}`);

    // Step 2: Apply the migration (DROP + CREATE due to column changes)
    console.log('\n2. Applying migration (DROP + CREATE)...');

    // First drop the existing view
    await client.query('DROP VIEW IF EXISTS catalog_players_v1 CASCADE');
    console.log('   Dropped existing view');

    const migrationSQL = `
      CREATE VIEW catalog_players_v1 AS
      SELECT
        p.id AS player_id,
        COALESCE(p.meta->'names'->>'display', p.name) AS player_name,
        p.sport,
        t.id AS team_id,
        t.name AS team_name,
        t.display_name AS team_abbr,
        COALESCE(pm.meta->>'position', p.meta->>'position') AS position,
        p.meta->>'photoURL' AS headshot_url,
        COALESCE(p.external_id, p.id::text) AS external_player_id,
        LOWER(COALESCE(p.meta->'names'->>'display', p.name)) || ' ' ||
          COALESCE(LOWER(t.name), '') || ' ' ||
          COALESCE(LOWER(t.display_name), '') AS search_text,
        '2.0.0'::TEXT AS contract_version,
        p.updated_at AS last_updated
      FROM participants p
      INNER JOIN participant_memberships pm
        ON pm.participant_id = p.id
        AND pm.valid_to IS NULL
      INNER JOIN participants t
        ON t.id = pm.team_id
        AND t.type = 'team'
      WHERE p.type = 'player'
        AND p.active = true;

      COMMENT ON VIEW catalog_players_v1 IS
        'Smart Form player catalog - sourced from participants + participant_memberships. Sprint: SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091. Breaking: team_id is now UUID.';
    `;

    await client.query(migrationSQL);
    console.log('   ✅ Migration applied successfully');

    // Step 3: Verify the change
    console.log('\n3. View definition (AFTER):');
    const afterResult = await client.query(`
      SELECT pg_get_viewdef('catalog_players_v1'::regclass, true) as viewdef
    `);
    const afterDef = afterResult.rows[0]?.viewdef || 'NOT FOUND';
    console.log('   ' + afterDef.substring(0, 300) + '...');

    const nowUsesParticipants = afterDef.includes('FROM participants') && afterDef.includes('participant_memberships');
    console.log(`   Uses participants: ${nowUsesParticipants ? '✅ YES' : '❌ NO'}`);

    // Save proof
    const proofPath = join(__dirname, '..', 'out', 'sprints', 'SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091', '2026-02-24', 'proofs', 'proof_viewdef_after.txt');
    const { writeFileSync, mkdirSync } = await import('fs');
    try {
      mkdirSync(dirname(proofPath), { recursive: true });
      writeFileSync(proofPath, `pg_get_viewdef('catalog_players_v1') AFTER migration:\n\n${afterDef}`);
      console.log(`   Proof saved to: proof_viewdef_after.txt`);
    } catch (e) {
      console.log('   (Could not save proof file)');
    }

    // Step 4: Test with Indiana Pacers UUID
    console.log('\n4. Testing Indiana Pacers UUID filter...');
    const IND_UUID = 'f0fdd6a5-ac21-4608-adce-d7a91721890d';
    const testResult = await client.query(`
      SELECT player_id, player_name, team_id, team_name, contract_version
      FROM catalog_players_v1
      WHERE team_id = $1
      LIMIT 15
    `, [IND_UUID]);

    console.log(`   Indiana Pacers players: ${testResult.rows.length}`);
    testResult.rows.slice(0, 5).forEach(p => {
      console.log(`     - ${p.player_name} (${p.team_name})`);
    });

    // Step 5: Verify team_id is UUID format
    console.log('\n5. Verifying team_id format...');
    const formatCheck = await client.query(`
      SELECT player_name, team_id,
             team_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' as is_uuid
      FROM catalog_players_v1
      LIMIT 5
    `);
    formatCheck.rows.forEach(p => {
      console.log(`     - ${p.player_name}: ${p.is_uuid ? '✅ UUID' : '❌ NOT UUID'} (${p.team_id})`);
    });

    console.log('\n=== Migration Complete ===');

  } finally {
    await client.end();
  }
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
