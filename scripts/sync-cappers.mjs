/**
 * SPRINT-SMARTFORM-CANONICAL-ENTITIES-089
 * Sync cappers from canonical users table
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
    console.log('Connected to database');

    // Step 1: Add columns if missing
    console.log('\n1. Adding columns...');
    await client.query(`
      ALTER TABLE cappers ADD COLUMN IF NOT EXISTS external_id UUID;
      ALTER TABLE cappers ADD COLUMN IF NOT EXISTS username TEXT;
    `);
    console.log('   Columns added');

    // Step 2: Clear existing cappers
    console.log('\n2. Clearing existing cappers...');
    await client.query('TRUNCATE TABLE cappers');
    console.log('   Cleared');

    // Step 3: Add unique constraint
    console.log('\n3. Adding unique constraint...');
    try {
      await client.query(`
        ALTER TABLE cappers ADD CONSTRAINT cappers_external_id_unique UNIQUE (external_id)
      `);
      console.log('   Constraint added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   Constraint already exists');
      } else {
        throw e;
      }
    }

    // Step 4: Insert real cappers from users table
    console.log('\n4. Inserting real cappers from users table...');
    const insertResult = await client.query(`
      INSERT INTO cappers (id, display_name, username, external_id, is_active, created_at, updated_at)
      SELECT
        gen_random_uuid(),
        u.username,
        u.username,
        u.id,
        true,
        NOW(),
        NOW()
      FROM users u
      WHERE u.active = true
        AND u.username IS NOT NULL
        AND u.username NOT LIKE 'test_%'
        AND u.username NOT LIKE 'e2e_%'
        AND u.username NOT LIKE 'phase%'
        AND u.username NOT LIKE 'automation_%'
      RETURNING display_name
    `);
    console.log(`   Inserted ${insertResult.rowCount} cappers:`);
    insertResult.rows.forEach(r => console.log(`     - ${r.display_name}`));

    // Step 5: Drop and recreate function
    console.log('\n5. Updating get_active_cappers function...');
    await client.query('DROP FUNCTION IF EXISTS get_active_cappers()');
    await client.query(`
      CREATE FUNCTION get_active_cappers()
      RETURNS TABLE (
        id UUID,
        display_name TEXT,
        username TEXT,
        external_id UUID
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT c.id, c.display_name, c.username, c.external_id
        FROM cappers c
        WHERE c.is_active = true
        ORDER BY c.display_name;
      END;
      $$ LANGUAGE plpgsql STABLE
    `);
    await client.query('GRANT EXECUTE ON FUNCTION get_active_cappers() TO authenticated, anon, service_role');
    console.log('   Function updated');

    // Step 6: Verify
    console.log('\n6. Verifying...');
    const verifyResult = await client.query('SELECT * FROM get_active_cappers()');
    console.log(`   get_active_cappers() returns ${verifyResult.rowCount} cappers`);
    verifyResult.rows.forEach(r => console.log(`     - ${r.display_name} (ext: ${r.external_id?.slice(0, 8)}...)`));

    console.log('\n✅ Cappers synced successfully!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
