import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PICK_ID = 'c77aba85-b082-4490-b91d-c10b0fd06e0f';

async function approvePick() {
  console.log(`Approving pick ${PICK_ID}...`);

  const { data, error } = await supabase
    .from('picks')
    .update({
      status: 'approved',
      workflow_stage: 'published'
    })
    .eq('id', PICK_ID)
    .select();

  if (error) {
    console.error('Error approving pick:', error);
    process.exit(1);
  }

  console.log('✅ Pick approved successfully:');
  console.log(JSON.stringify(data, null, 2));
}

approvePick();
