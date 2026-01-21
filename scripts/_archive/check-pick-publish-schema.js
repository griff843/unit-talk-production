require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Checking pick_publish schema...');

  const { data, error } = await supabase
    .from('pick_publish')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (data && data[0]) {
    console.log('Columns:', Object.keys(data[0]).join(', '));
    console.log('Sample row:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('Table empty');
  }
}

main().catch(console.error);
