// src/agents/BaseAgent/loadDeps.ts

import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { BaseAgentDependencies } from './types';
import { env } from '../../config/env';

export async function loadBaseAgentDependencies(): Promise<BaseAgentDependencies> {
  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const logger = new Logger('BaseAgent');
  const errorHandler = new ErrorHandler('BaseAgent', supabase);

  return {
    supabase,
    logger,
    errorHandler,
  };
}