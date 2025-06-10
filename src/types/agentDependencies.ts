import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/utils/logger';
import { AgentConfig } from '@/types/agent';
import { FeedAgent } from '@/agents/FeedAgent';

export interface IngestionAgentDependencies {
  supabase: SupabaseClient;
  logger: Logger;
  config: AgentConfig;
  feedAgent: FeedAgent;
}

export interface FeedAgentDependencies {
  supabase: SupabaseClient;
  logger: Logger;
  config: AgentConfig;
}

export interface PromoAgentDependencies {
  supabase: SupabaseClient;
  logger: Logger;
  config: AgentConfig;
}
