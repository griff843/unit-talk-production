// Quick verification script for NBA ingestion progress
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function verify() {
  try {
    // Count picks from professional pipeline
    const { count: picksCount, error: picksError } = await supabase
      .from('picks')
      .select('id', { count: 'exact', head: true })
      .eq('metadata->>source', 'professional_pipeline');

    if (picksError) {
      console.error('Error counting picks:', picksError);
    }

    // Count CLV tracking rows
    const { count: clvCount, error: clvError } = await supabase
      .from('clv_tracking')
      .select('id', { count: 'exact', head: true });

    if (clvError) {
      console.error('Error counting CLV rows:', clvError);
    }

    // Count processed raw_props
    const { count: processedCount, error: processedError } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact', head: true })
      .not('processed_at', 'is', null);

    if (processedError) {
      console.error('Error counting processed props:', processedError);
    }

    // Count pick_publish entries
    const { count: outboxCount, error: outboxError } = await supabase
      .from('pick_publish')
      .select('id', { count: 'exact', head: true });

    if (outboxError) {
      console.error('Error counting outbox entries:', outboxError);
    }

    console.log(JSON.stringify({
      canonical_picks: picksCount || 0,
      clv_tracking_rows: clvCount || 0,
      processed_raw_props: processedCount || 0,
      outbox_entries: outboxCount || 0,
      timestamp: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verify().catch(console.error);
