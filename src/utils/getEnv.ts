// /utils/getEnv.ts

import type { EnvConfig } from '../types/config'

export function getEnv(): EnvConfig {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
    NOTION_API_KEY: process.env.NOTION_API_KEY || ''
    // Add more as needed
  }
}
