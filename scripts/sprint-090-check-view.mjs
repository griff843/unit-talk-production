/**
 * Check catalog_players_v1 view structure
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

    // Check view structure
    console.log('--- CATALOG_PLAYERS_V1 COLUMNS ---');
    const viewCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'catalog_players_v1' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    viewCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    // Sample data with team_id
    console.log('\n--- SAMPLE DATA WITH TEAM_ID ---');
    const sample = await client.query(`
      SELECT player_id, player_name, sport, team_id, team_abbr
      FROM catalog_players_v1
      WHERE team_id IS NOT NULL
      LIMIT 5
    `);
    sample.rows.forEach(r => {
      console.log(`  ${r.player_name} (${r.sport}): team_id=${r.team_id}, abbr=${r.team_abbr}`);
    });

    // Count with team_id
    console.log('\n--- COVERAGE IN VIEW ---');
    const coverage = await client.query(`
      SELECT
        sport,
        COUNT(*) as total,
        COUNT(team_id) as has_team
      FROM catalog_players_v1
      GROUP BY sport
      ORDER BY total DESC
    `);
    coverage.rows.forEach(r => {
      const pct = ((r.has_team / r.total) * 100).toFixed(1);
      console.log(`  ${r.sport}: ${r.has_team}/${r.total} (${pct}%)`);
    });

    // Check view definition
    console.log('\n--- VIEW DEFINITION ---');
    const viewDef = await client.query(`
      SELECT pg_get_viewdef('catalog_players_v1'::regclass, true)
    `);
    console.log(viewDef.rows[0].pg_get_viewdef);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
