declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
      TEMPORAL_TASK_QUEUE: string;
      SUPABASE_URL: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      OPENAI_API_KEY?: string;
      ANTHROPIC_API_KEY?: string;
      DISCORD_ALERT_WEBHOOK?: string;
      RETOOL_ALERT_WEBHOOK?: string;
      MICRO_RECAP_COOLDOWN?: string;
      METRICS_ENABLED?: string;
      HEALTH_CHECK_INTERVAL?: string;
    }
  }
}

export {};
