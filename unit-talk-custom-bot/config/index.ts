import { BotConfig } from '../src/types';

export const botConfig: BotConfig = {
  prefix: '!',
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    guildId: process.env.DISCORD_GUILD_ID || ''
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  roles: {
    member: process.env.MEMBER_ROLE_ID || '',
    admin: process.env.ADMIN_ROLE_ID || '',
    moderator: process.env.MODERATOR_ROLE_ID || '',
    vip: process.env.VIP_ROLE_ID || '',
    vipPlus: process.env.VIP_PLUS_ROLE_ID || '',
    staff: process.env.STAFF_ROLE_ID || '',
    owner: process.env.OWNER_ROLE_ID || ''
  },
  channels: {
    general: process.env.GENERAL_CHANNEL_ID || '',
    picks: process.env.PICKS_CHANNEL_ID || '',
    vip: process.env.VIP_CHANNEL_ID || '',
    vipPlus: process.env.VIP_PLUS_CHANNEL_ID || '',
    admin: process.env.ADMIN_CHANNEL_ID || '',
    logs: process.env.LOGS_CHANNEL_ID || '',
    announcements: process.env.ANNOUNCEMENTS_CHANNEL_ID || '',
    freePicks: process.env.FREE_PICKS_CHANNEL_ID || '',
    vipPicks: process.env.VIP_PICKS_CHANNEL_ID || '',
    vipGeneral: process.env.VIP_GENERAL_CHANNEL_ID || '',
    vipPlusPicks: process.env.VIP_PLUS_PICKS_CHANNEL_ID || '',
    vipPlusGeneral: process.env.VIP_PLUS_GENERAL_CHANNEL_ID || '',
    threads: process.env.THREADS_CHANNEL_ID || ''
  },
  features: {
    vipNotifications: process.env.VIP_NOTIFICATIONS === 'true',
    autoThreads: process.env.AUTO_THREADS === 'true',
    keywordDMs: process.env.KEYWORD_DMS === 'true',
    aiGrading: process.env.AI_GRADING === 'true',
    analytics: process.env.ANALYTICS === 'true',
    autoGrading: process.env.AUTO_GRADING === 'true'
  },
  cooldowns: {
    picks: parseInt(process.env.PICK_COOLDOWN_MINUTES || '60') * 60 * 1000,
    commands: parseInt(process.env.COMMAND_COOLDOWN_SECONDS || '5') * 1000,
    dms: parseInt(process.env.DM_COOLDOWN_MINUTES || '10') * 60 * 1000
  },
  limits: {
    maxPicksPerDay: parseInt(process.env.MAX_PICKS_PER_DAY || '5'),
    maxDMsPerHour: parseInt(process.env.MAX_DMS_PER_HOUR || '5'),
    maxThreadsPerDay: parseInt(process.env.MAX_THREADS_PER_DAY || '20'),
    maxUnitsPerPick: parseInt(process.env.MAX_UNITS_PER_PICK || '10'),
    threadAutoArchiveMinutes: parseInt(process.env.THREAD_AUTO_ARCHIVE_MINUTES || '1440')
  },
  agents: {
    enabled: process.env.ENABLE_AGENTS === 'true',
    endpoints: {
      grading: process.env.GRADING_AGENT_ENDPOINT || 'http://localhost:3001',
      analytics: process.env.ANALYTICS_AGENT_ENDPOINT || 'http://localhost:3002'
    },
    baseUrl: process.env.AGENTS_BASE_URL || 'http://localhost:3000',
    apiKey: process.env.AGENTS_API_KEY || ''
  }
};