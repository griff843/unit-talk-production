import pg from 'pg';

async function main() {
  const c = new pg.Client('postgresql://postgres:postgres@host.docker.internal:5432/unit_talk_dev');
  await c.connect();
  
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='games' ORDER BY ordinal_position");
  console.log('games columns:', r.rows.map(x => x.column_name).join(', '));
  
  const r2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='raw_props' ORDER BY ordinal_position LIMIT 20");
  console.log('raw_props columns (first 20):', r2.rows.map(x => x.column_name).join(', '));
  
  await c.end();
}

main();
