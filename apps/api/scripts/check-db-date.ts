import pg from 'pg';

async function checkDbDate() {
  const client = new pg.Client('postgresql://postgres:postgres@host.docker.internal:5432/unit_talk_dev');

  try {
    await client.connect();
    console.log('✓ Connected to database');

    const res = await client.query(`
      SELECT
        CURRENT_DATE AS db_today,
        CURRENT_TIMESTAMP AS db_timestamp,
        TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS db_today_formatted
    `);

    console.log('\n=== DATABASE DATE CHECK ===');
    console.log(JSON.stringify(res.rows[0], null, 2));
    console.log('===========================\n');

    return res.rows[0];
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

checkDbDate().catch(console.error);
