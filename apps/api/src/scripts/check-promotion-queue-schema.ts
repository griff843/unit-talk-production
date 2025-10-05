import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  const { data } = await supabase.from('promotion_queue').select('*').limit(1);
  if (data && data[0]) {
    console.log('promotion_queue columns:', Object.keys(data[0]));
  } else {
    console.log('promotion_queue is empty or does not exist');
  }
}

checkSchema();
