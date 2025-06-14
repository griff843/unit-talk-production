// src/agents/BaseAgent/loadDeps.ts

import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';
import { BaseAgentDependencies } from './types';

export async function loadBaseAgentDependencies(): Promise<BaseAgentDependencies> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const logger = new Logger('BaseAgent');

  return {
    supabase,
    logger,
    // errorHandler is optional for now
  };
}