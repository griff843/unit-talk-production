/**
 * Supabase Client for Cloud E2E Mode
 *
 * Uses service role key to bypass RLS for server-side writes
 * Only used when NODE_ENV=production or E2E=1
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
});
