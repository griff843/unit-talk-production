import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';

const env = getEnv();

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
