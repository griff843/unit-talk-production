import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearOldPicks() {
  console.log('🗑️  Clearing old picks from database...\n');

  // Delete picks before Sept 30, 2025
  const { error, count } = await supabase
    .from('unified_picks')
    .delete()
    .lt('created_at', '2025-09-30');

  if (error) {
    console.error('❌ Error deleting old picks:', error);
    process.exit(1);
  }

  console.log(`✅ Deleted ${count || 0} old picks`);

  // Verify current count
  const { count: remaining } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Remaining picks in database: ${remaining || 0}`);
}

clearOldPicks().catch(console.error);
