import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Sample pick record:');
  console.log(JSON.stringify(data, null, 2));

  if (data && data.length > 0) {
    console.log('\nColumn names:');
    console.log(Object.keys(data[0]).join(', '));
  }
}

checkSchema();
