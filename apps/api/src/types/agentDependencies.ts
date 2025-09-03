import { SupabaseClient } from '@supabase/supabase-js';

import { FeedAgent } from '@/agents/FeedAgent';
import { AgentConfig } from '@/types/agent';
import { Logger } from '@/utils/logger';

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

export interface CampaignAgentDependencies {
  supabase: SupabaseClient;
  logger: Logger;
  config: AgentConfig;
}
