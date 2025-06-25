import { BotConfig } from '../types/index';

const getFirstRoleId = (envVar: string | undefined, defaultValue: string): string => {
  if (!envVar) return defaultValue;
  return envVar.split(',')[0].trim();
};

export const botConfig: BotConfig = {
  prefix: '!',
  channels: {
    general: process.env.GENERAL_CHANNEL_ID || '1234567890123456789',
    picks: process.env.PICKS_CHANNEL_ID || '1234567890123456789',
    vip: process.env.VIP_CHANNEL_ID || '1234567890123456789',
    vipPlus: process.env.VIP_PLUS_CHANNEL_ID || '1234567890123456789',
    admin: process.env.ADMIN_CHANNEL_ID || '1234567890123456789',
    logs: process.env.LOGS_CHANNEL_ID || '1234567890123456789',
    announcements: process.env.ANNOUNCEMENTS_CHANNEL_ID || '1234567890123456789',
    freePicks: process.env.FREE_PICKS_CHANNEL_ID || '1234567890123456789',
    vipPicks: process.env.VIP_PICKS_CHANNEL_ID || '1234567890123456789',
    vipGeneral: process.env.VIP_GENERAL_CHANNEL_ID || '1234567890123456789',
    vipPlusPicks: process.env.VIP_PLUS_PICKS_CHANNEL_ID || '1234567890123456789',
    vipPlusGeneral: process.env.VIP_PLUS_GENERAL_CHANNEL_ID || '1234567890123456789',
    threads: process.env.THREADS_CHANNEL_ID || '1234567890123456789'
  },
  roles: {
    member: process.env.MEMBER_ROLE_ID || '1234567890123456789',
    vip: getFirstRoleId(process.env.VIP_ROLE_IDS, '1234567890123456789'),
    vipPlus: getFirstRoleId(process.env.VIP_PLUS_ROLE_IDS, '1234567890123456789'),
    staff: process.env.STAFF_ROLE_ID || '1234567890123456789',
    admin: getFirstRoleId(process.env.ADMIN_ROLE_IDS, '1234567890123456789'),
    owner: process.env.OWNER_ROLE_ID || '1234567890123456789',
    moderator: getFirstRoleId(process.env.MODERATOR_ROLE_IDS, '1234567890123456789')
  },
  features: {
    vipNotifications: process.env.ENABLE_VIP_NOTIFICATIONS === 'true',
    autoThreads: process.env.ENABLE_AUTO_THREADS === 'true',
    keywordDMs: process.env.ENABLE_KEYWORD_DMS === 'true',
    aiGrading: process.env.ENABLE_AI_GRADING === 'true',
    analytics: process.env.ENABLE_ANALYTICS === 'true',
    autoGrading: process.env.ENABLE_AUTO_GRADING === 'true'
  },
  cooldowns: {
    picks: parseInt(process.env.PICK_COOLDOWN_MINUTES || '60') * 60 * 1000, // Convert to milliseconds
    commands: parseInt(process.env.COMMAND_COOLDOWN_SECONDS || '5') * 1000,
    dms: parseInt(process.env.DM_COOLDOWN_MINUTES || '10') * 60 * 1000
  },
  limits: {
    maxPicksPerDay: parseInt(process.env.MAX_PICKS_PER_DAY || '10'),
    maxDMsPerHour: parseInt(process.env.MAX_DMS_PER_HOUR || '5'),
    maxThreadsPerDay: parseInt(process.env.MAX_THREADS_PER_DAY || '20'),
    maxUnitsPerPick: parseInt(process.env.MAX_UNITS_PER_PICK || '10'),
    threadAutoArchiveMinutes: parseInt(process.env.THREAD_AUTO_ARCHIVE_MINUTES || '1440')
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    guildId: process.env.DISCORD_GUILD_ID || ''
  },
  agents: {
    enabled: process.env.ENABLE_AGENTS === 'true',
    endpoints: {
      grading: process.env.GRADING_AGENT_ENDPOINT || 'http://localhost:3001',
      analytics: process.env.ANALYTICS_AGENT_ENDPOINT || 'http://localhost:3002'
    },
    baseUrl: process.env['AGENTS_BASE_URL'] || 'http://localhost:3000',
    apiKey: process.env['AGENTS_API_KEY'] || ''
  }
};

export default botConfig;