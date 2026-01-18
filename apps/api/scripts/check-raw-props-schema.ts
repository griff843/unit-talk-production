// Check raw_props table schema
import pg from 'pg';

async function main() {
  const db = new pg.Client('postgresql://postgres:postgres@localhost:5432/unit_talk_dev');

  try {
    await db.connect();
    console.log('✅ Connected to local PostgreSQL\n');

    // Get table columns
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'raw_props'
      ORDER BY ordinal_position
    `);

    console.log('📋 raw_props table schema:\n');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Also show a sample row if any exist
    const sampleResult = await db.query(`
      SELECT * FROM raw_props LIMIT 1
    `);

    if (sampleResult.rows.length > 0) {
      console.log('\n📊 Sample row columns:');
      console.log(Object.keys(sampleResult.rows[0]).join(', '));
    } else {
      console.log('\n  (No rows in table)');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

main();
