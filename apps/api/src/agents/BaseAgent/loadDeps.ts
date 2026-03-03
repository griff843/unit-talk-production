// src/agents/BaseAgent/loadDeps.ts

import { createClient } from '@supabase/supabase-js';

import { env } from '../../config/env';
import { ErrorHandler } from '../../utils/errorHandling';
import { makeLogger } from '../../utils/logger';

import { BaseAgentDependencies } from './types';

export async function loadBaseAgentDependencies(): Promise<BaseAgentDependencies> {
  const supabaseUrl = env.supabase.url;
  const supabaseServiceRoleKey = env.supabase.serviceRoleKey;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const logger = makeLogger('BaseAgent');
  const errorHandler = new ErrorHandler('BaseAgent', supabase);

  return {
    supabase,
    logger,
    errorHandler,
  };
}
