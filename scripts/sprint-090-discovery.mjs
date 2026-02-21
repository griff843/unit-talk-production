/**
 * SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090 - Phase 0 Discovery
 * Inspect schemas and detect duplicates WITHOUT assumptions
 */
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL_POOLER,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('='.repeat(80));
    console.log('SPRINT-090 PHASE 0 DISCOVERY');
    console.log('='.repeat(80));

    // A) Detect duplicates in teams by sport+abbr
    console.log('\n' + '='.repeat(80));
    console.log('A) DUPLICATE TEAMS BY SPORT+ABBR');
    console.log('='.repeat(80));
    const duplicateTeams = await client.query(`
      SELECT sport, abbr, COUNT(*) cnt, ARRAY_AGG(id) ids
      FROM teams
      GROUP BY sport, abbr
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 50
    `);
    console.log(`Found ${duplicateTeams.rowCount} duplicate sport+abbr groups:`);
    duplicateTeams.rows.forEach(r => {
      console.log(`  ${r.sport} ${r.abbr}: ${r.cnt} duplicates -> ${JSON.stringify(r.ids)}`);
    });

    // B) Inspect schemas
    console.log('\n' + '='.repeat(80));
    console.log('B) SCHEMA INSPECTION');
    console.log('='.repeat(80));

    // B1) teams columns
    console.log('\n--- TEAMS TABLE COLUMNS ---');
    const teamsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'teams' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    teamsSchema.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
    });

    // B2) players columns
    console.log('\n--- PLAYERS TABLE COLUMNS ---');
    const playersSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'players' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    playersSchema.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
    });

    // B3) participants columns
    console.log('\n--- PARTICIPANTS TABLE COLUMNS ---');
    const participantsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'participants' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    if (participantsSchema.rowCount === 0) {
      console.log('  TABLE NOT FOUND or no columns');
    } else {
      participantsSchema.rows.forEach(r => {
        console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
      });
    }

    // B4) participant_memberships columns
    console.log('\n--- PARTICIPANT_MEMBERSHIPS TABLE COLUMNS ---');
    const membershipsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'participant_memberships' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    if (membershipsSchema.rowCount === 0) {
      console.log('  TABLE NOT FOUND or no columns');
    } else {
      membershipsSchema.rows.forEach(r => {
        console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
      });
    }

    // C) Sample data to understand relationships
    console.log('\n' + '='.repeat(80));
    console.log('C) SAMPLE DATA & RELATIONSHIPS');
    console.log('='.repeat(80));

    // C1) Sample players with team_id populated
    console.log('\n--- SAMPLE PLAYERS WITH TEAM_ID ---');
    const playersWithTeam = await client.query(`
      SELECT id, full_name, sport, team_id, team_abbr, provider_player_id, search_key
      FROM players
      WHERE team_id IS NOT NULL
      LIMIT 10
    `);
    playersWithTeam.rows.forEach(r => {
      console.log(`  ${r.full_name} (${r.sport}): team_id=${r.team_id}, abbr=${r.team_abbr}, provider=${r.provider_player_id}`);
    });

    // C2) Sample players WITHOUT team_id
    console.log('\n--- SAMPLE PLAYERS WITHOUT TEAM_ID ---');
    const playersNoTeam = await client.query(`
      SELECT id, full_name, sport, team_id, team_abbr, provider_player_id, search_key
      FROM players
      WHERE team_id IS NULL
      LIMIT 10
    `);
    playersNoTeam.rows.forEach(r => {
      console.log(`  ${r.full_name} (${r.sport}): team_id=${r.team_id}, abbr=${r.team_abbr}, provider=${r.provider_player_id}`);
    });

    // C3) Sample participants
    console.log('\n--- SAMPLE PARTICIPANTS ---');
    const sampleParticipants = await client.query(`
      SELECT * FROM participants LIMIT 5
    `);
    if (sampleParticipants.rowCount > 0) {
      console.log('  Columns:', Object.keys(sampleParticipants.rows[0]).join(', '));
      sampleParticipants.rows.forEach(r => {
        console.log(`  ${JSON.stringify(r)}`);
      });
    } else {
      console.log('  No participants found');
    }

    // C4) Sample participant_memberships
    console.log('\n--- SAMPLE PARTICIPANT_MEMBERSHIPS ---');
    const sampleMemberships = await client.query(`
      SELECT * FROM participant_memberships LIMIT 5
    `);
    if (sampleMemberships.rowCount > 0) {
      console.log('  Columns:', Object.keys(sampleMemberships.rows[0]).join(', '));
      sampleMemberships.rows.forEach(r => {
        console.log(`  ${JSON.stringify(r)}`);
      });
    } else {
      console.log('  No memberships found');
    }

    // D) Coverage statistics
    console.log('\n' + '='.repeat(80));
    console.log('D) COVERAGE STATISTICS');
    console.log('='.repeat(80));

    const coverage = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(team_id) as with_team,
        COUNT(*) - COUNT(team_id) as without_team
      FROM players
    `);
    console.log(`Players Total: ${coverage.rows[0].total}`);
    console.log(`Players with team_id: ${coverage.rows[0].with_team}`);
    console.log(`Players without team_id: ${coverage.rows[0].without_team}`);

    // Coverage by sport
    console.log('\n--- BY SPORT ---');
    const bySport = await client.query(`
      SELECT
        sport,
        COUNT(*) as total,
        COUNT(team_id) as with_team,
        COUNT(*) - COUNT(team_id) as without_team
      FROM players
      GROUP BY sport
      ORDER BY total DESC
    `);
    bySport.rows.forEach(r => {
      console.log(`  ${r.sport}: ${r.with_team}/${r.total} mapped (${r.without_team} missing)`);
    });

    // E) Check for provider_player_id in participants that could match players
    console.log('\n' + '='.repeat(80));
    console.log('E) POTENTIAL MAPPING KEYS');
    console.log('='.repeat(80));

    // Check if participants has provider_player_id or similar
    const participantKeys = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'participants' AND table_schema = 'public'
      AND column_name LIKE '%player%' OR column_name LIKE '%provider%' OR column_name = 'external_id'
    `);
    console.log('Participant columns that might link to players:');
    participantKeys.rows.forEach(r => console.log(`  - ${r.column_name}`));

    // Check membership structure
    const membershipKeys = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'participant_memberships' AND table_schema = 'public'
      AND (column_name LIKE '%team%' OR column_name LIKE '%participant%' OR column_name LIKE '%id%')
    `);
    console.log('Membership columns for team mapping:');
    membershipKeys.rows.forEach(r => console.log(`  - ${r.column_name}`));

    // F) Find Bo Nix specifically
    console.log('\n' + '='.repeat(80));
    console.log('F) BO NIX LOOKUP');
    console.log('='.repeat(80));
    const boNix = await client.query(`
      SELECT id, full_name, sport, team_id, team_abbr, provider_player_id, search_key
      FROM players
      WHERE LOWER(full_name) LIKE '%bo nix%' OR LOWER(search_key) LIKE '%bo nix%'
    `);
    if (boNix.rowCount > 0) {
      boNix.rows.forEach(r => {
        console.log(`  Found: ${r.full_name} (${r.sport})`);
        console.log(`    team_id: ${r.team_id}`);
        console.log(`    team_abbr: ${r.team_abbr}`);
        console.log(`    provider_player_id: ${r.provider_player_id}`);
        console.log(`    search_key: ${r.search_key}`);
      });
    } else {
      console.log('  Bo Nix not found in players table');
    }

    // G) Check view_participants_for_event if exists
    console.log('\n' + '='.repeat(80));
    console.log('G) VIEW_PARTICIPANTS_FOR_EVENT');
    console.log('='.repeat(80));
    const viewSchema = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'view_participants_for_event' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    if (viewSchema.rowCount > 0) {
      viewSchema.rows.forEach(r => {
        console.log(`  ${r.column_name}: ${r.data_type}`);
      });
      // Sample data
      const viewSample = await client.query(`
        SELECT * FROM view_participants_for_event LIMIT 5
      `);
      console.log('\n  Sample data:');
      viewSample.rows.forEach(r => {
        console.log(`    ${JSON.stringify(r)}`);
      });
    } else {
      console.log('  View not found');
    }

    // H) Check if there's a direct players->teams join possible
    console.log('\n' + '='.repeat(80));
    console.log('H) DIRECT PLAYERS->TEAMS JOIN TEST');
    console.log('='.repeat(80));
    const joinTest = await client.query(`
      SELECT p.id as player_id, p.full_name, p.team_id, p.team_abbr, p.sport,
             t.id as teams_id, t.name as team_name, t.abbr as teams_abbr
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.team_id IS NOT NULL
      LIMIT 10
    `);
    joinTest.rows.forEach(r => {
      const match = r.teams_id ? 'MATCH' : 'NO MATCH';
      console.log(`  ${r.full_name}: team_id=${r.team_id} -> ${match} (${r.team_name || 'N/A'})`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('DISCOVERY COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
