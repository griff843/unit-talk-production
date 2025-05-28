// /types/config.ts

export interface EnvConfig {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  DISCORD_BOT_TOKEN: string
  NOTION_API_KEY: string
  [key: string]: string | undefined
}

export interface AgentEnv {
  [key: string]: string | boolean | number | undefined
}
