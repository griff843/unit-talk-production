#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

const sql = `
SELECT 
  current_database() as database,
  current_user as "user",
  to_regclass('public.picks') as picks_table,
  to_regclass('public.pick_publish') as pick_publish_table
`;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_DIRECT_URL
  });

  try {
    await client.connect();
    const result = await client.query(sql);
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

