import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getValidUserTenant() {
  const { data: pick, error } = await supabase
    .from('picks')
    .select('user_id, tenant_id')
    .eq('id', 'f20495c2-ddde-4d65-97c5-a1c874e5aab0')
    .single();

  if (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }

  console.log('user_id:', pick.user_id);
  console.log('tenant_id:', pick.tenant_id);
}

getValidUserTenant();
