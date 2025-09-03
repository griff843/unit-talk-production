import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkSports() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data } = await supabase.from('players').select('sport').limit(1000);
  const sports = [...new Set(data?.map(p => p.sport))].sort();
  
  console.log('SPORTS IN DATABASE:', sports);
  console.log('SPORT COUNT:', sports.length);
}

checkSports();