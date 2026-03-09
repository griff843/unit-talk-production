import { createClient } from '@supabase/supabase-js';

// DEPRECATED: Zero importers. Use services/supabaseClient.ts instead.
// SPRINT-REPO-TRUTH-LOCK-002
export const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);
