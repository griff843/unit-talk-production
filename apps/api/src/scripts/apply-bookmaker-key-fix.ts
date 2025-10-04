/**
 * Apply bookmaker_key column fix directly to Supabase
 */

import { supabase } from '../lib/db/supabaseClient';

const SQL = `
-- Add bookmaker_key column if it doesn't exist
ALTER TABLE public.unified_picks
ADD COLUMN IF NOT EXISTS bookmaker_key TEXT;

-- Backfill from metadata if it exists there
UPDATE public.unified_picks
SET bookmaker_key = (metadata->>'bookmaker_key')::text
WHERE bookmaker_key IS NULL AND metadata->>'bookmaker_key' IS NOT NULL;

-- Set default for rows that still don't have it
UPDATE public.unified_picks
SET bookmaker_key = 'unknown'
WHERE bookmaker_key IS NULL;

-- Make it NOT NULL now that we've backfilled
ALTER TABLE public.unified_picks
ALTER COLUMN bookmaker_key SET NOT NULL;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS ix_unified_picks_bookmaker
ON public.unified_picks (bookmaker_key);
`;

(async () => {
  console.log('Applying bookmaker_key fix...');

  // Execute via RPC since we can't run DDL directly through Supabase JS
  // We'll use a workaround via Supabase's SQL editor endpoint or similar
  console.log('SQL to run:');
  console.log(SQL);
  console.log('\nPlease run this SQL in Supabase dashboard > SQL Editor');
  console.log('Or use: supabase db push with a properly configured migration');
})();
