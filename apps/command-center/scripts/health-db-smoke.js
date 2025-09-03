/* Minimal DB health smoke using @supabase/supabase-js directly.
 * Safe/read-only: selects count from agent_health if env is provided.
 */
const { createClient } = require('@supabase/supabase-js');

(async () => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.log('HEALTH_DB_SMOKE: NO_ENV (skipping, not a failure)');
      process.exit(0);
      return;
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const start = Date.now();
    const { data, error } = await supabase.from('agent_health').select('count').limit(1);
    const ms = Date.now() - start;

    if (error) {
      console.log('HEALTH_DB_SMOKE_STATUS: ERROR');
      console.log('HEALTH_DB_SMOKE_TIME_MS:', ms);
      console.log('HEALTH_DB_SMOKE_ERROR:', error.message);
      process.exit(1);
    } else {
      console.log('HEALTH_DB_SMOKE_STATUS: OK');
      console.log('HEALTH_DB_SMOKE_TIME_MS:', ms);
      process.exit(0);
    }
  } catch (err) {
    console.error('HEALTH_DB_SMOKE_ERROR:', err);
    process.exit(2);
  }
})();

