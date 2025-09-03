"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.validateProductionApiKeys = validateProductionApiKeys;
exports.getEnvironmentOverrides = getEnvironmentOverrides;
const zod_1 = require("zod");
if (typeof window === 'undefined' && typeof process !== 'undefined') {
    const dotenv = require('dotenv');
    const path = require('path');
    dotenv.config({ path: path.join(process.cwd(), '.env') });
    dotenv.config({ path: path.join(process.cwd(), '.env.local') });
}
const EnvironmentSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    DEBUG_MODE: zod_1.z.string().default('false').transform(val => val === 'true'),
    API_PORT: zod_1.z.string().default('3000').transform(Number),
    DISCORD_BOT_PORT: zod_1.z.string().default('3001').transform(Number),
    DASHBOARD_PORT: zod_1.z.string().default('3002').transform(Number),
    SMART_FORM_PORT: zod_1.z.string().default('3003').transform(Number),
    COMMAND_CENTER_PORT: zod_1.z.string().default('3015').transform(Number),
    SUPABASE_URL: zod_1.z.string().url('Invalid Supabase URL'),
    SUPABASE_ANON_KEY: zod_1.z.string().min(1, 'Supabase anon key is required'),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().min(1, 'Supabase service role key is required'),
    NEXT_PUBLIC_SUPABASE_URL: zod_1.z.string().url('Invalid public Supabase URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: zod_1.z.string().min(1, 'Public Supabase anon key is required'),
    OPTIMAL_API_KEY: zod_1.z.string().min(1, 'Optimal API key is required for production'),
    ODDS_API_KEY: zod_1.z.string().min(1, 'Odds API key is required for production'),
    DISCORD_BOT_TOKEN: zod_1.z.string().min(1, 'Discord bot token is required'),
    DISCORD_TOKEN: zod_1.z.string().min(1, 'Discord token is required'),
    DISCORD_CLIENT_ID: zod_1.z.string().min(1, 'Discord client ID is required'),
    DISCORD_GUILD_ID: zod_1.z.string().min(1, 'Discord guild ID is required'),
    ADMIN_ROLE_IDS: zod_1.z.string().default(''),
    MODERATOR_ROLE_IDS: zod_1.z.string().default(''),
    BOT_ROLE_IDS: zod_1.z.string().default(''),
    STAFF_ROLE_IDS: zod_1.z.string().default(''),
    OWNER_ROLE_IDS: zod_1.z.string().default(''),
    VIP_ROLE_IDS: zod_1.z.string().default(''),
    VIP_PLUS_ROLE_IDS: zod_1.z.string().default(''),
    CAPPER_ROLE_IDS: zod_1.z.string().default(''),
    TRIAL_ROLE_IDS: zod_1.z.string().default(''),
    ANNOUNCEMENTS_CHANNEL_ID: zod_1.z.string().default(''),
    GENERAL_CHANNEL_ID: zod_1.z.string().default(''),
    WELCOME_CHANNEL_ID: zod_1.z.string().default(''),
    FREE_PICKS_CHANNEL_ID: zod_1.z.string().default(''),
    VIP_PICKS_CHANNEL_ID: zod_1.z.string().default(''),
    VIP_PLUS_PICKS_CHANNEL_ID: zod_1.z.string().default(''),
    VIP_GENERAL_CHANNEL_ID: zod_1.z.string().default(''),
    VIP_STRATEGY_ROOM_CHANNEL_ID: zod_1.z.string().default(''),
    VIP_PLUS_GENERAL_CHANNEL_ID: zod_1.z.string().default(''),
    VIP_PLUS_STRATEGY_ROOM_CHANNEL_ID: zod_1.z.string().default(''),
    VIP_PLUS_EXCLUSIVE_INSIGHTS_CHANNEL_ID: zod_1.z.string().default(''),
    VIP_PLUS_TRADER_INSIGHTS_CHANNEL_ID: zod_1.z.string().default(''),
    SUPPORT_CHANNEL_ID: zod_1.z.string().default(''),
    THREADS_CHANNEL_ID: zod_1.z.string().default(''),
    SPORTS_TALK_CHANNEL_ID: zod_1.z.string().default(''),
    ADMIN_CHANNEL_ID: zod_1.z.string().default(''),
    BOT_LOGS_CHANNEL_ID: zod_1.z.string().default(''),
    TEMPORAL_ADDRESS: zod_1.z.string().default('localhost:7233'),
    TEMPORAL_SERVER_URL: zod_1.z.string().default('unit-talk-temporal:7233'),
    TEMPORAL_NAMESPACE: zod_1.z.string().default('default'),
    TEMPORAL_TASK_QUEUE: zod_1.z.string().default('unit-talk-dev'),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    CACHE_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    JWT_SECRET: zod_1.z.string().min(32, 'JWT secret must be at least 32 characters'),
    ENCRYPTION_KEY: zod_1.z.string().length(32, 'Encryption key must be exactly 32 characters'),
    NEXTAUTH_SECRET: zod_1.z.string().min(1, 'NextAuth secret is required'),
    NEXT_PUBLIC_APP_URL: zod_1.z.string().url('Invalid app URL'),
    NEXTAUTH_URL: zod_1.z.string().url('Invalid NextAuth URL'),
    NEXT_PUBLIC_PLATFORM_API_URL: zod_1.z.string().url('Invalid platform API URL'),
    UNIT_TALK_PRODUCTION_URL: zod_1.z.string().url('Invalid production URL'),
    NEXT_PUBLIC_ANALYTICS_API_URL: zod_1.z.string().url('Invalid analytics API URL'),
    AGENTS_BASE_URL: zod_1.z.string().url('Invalid agents base URL'),
    AGENTS_API_KEY: zod_1.z.string().min(1, 'Agents API key is required'),
    SYNC_API_KEY: zod_1.z.string().min(1, 'Sync API key is required'),
    AUTO_GRADING_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    DM_NOTIFICATIONS_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    ANALYTICS_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    THREAD_MANAGEMENT_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    CAPPER_TRACKING_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    FORUM_MANAGEMENT_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    CAPPER_THREAD_AUTO_CREATE: zod_1.z.string().default('true').transform(val => val === 'true'),
    CAPPER_QA_THREADS_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    CAPPER_PERFORMANCE_TRACKING: zod_1.z.string().default('true').transform(val => val === 'true'),
    CAPPER_DAILY_PICK_AGGREGATION: zod_1.z.string().default('true').transform(val => val === 'true'),
    XP_SYSTEM_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    LEADERBOARD_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    ENGAGEMENT_TRACKING_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    MILESTONE_CELEBRATIONS_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    STREAK_TRACKING_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    ACHIEVEMENT_SYSTEM_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    VIP_CONVERSION_TRACKING: zod_1.z.string().default('true').transform(val => val === 'true'),
    TRIAL_USAGE_TRACKING: zod_1.z.string().default('true').transform(val => val === 'true'),
    UPGRADE_FUNNEL_ANALYTICS: zod_1.z.string().default('true').transform(val => val === 'true'),
    AUTO_VIP_PROMOTION_MESSAGES: zod_1.z.string().default('false').transform(val => val === 'true'),
    WELCOME_SYSTEM_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    NEW_MEMBER_GUIDE_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    AUTO_ROLE_SUGGESTIONS: zod_1.z.string().default('true').transform(val => val === 'true'),
    XP_MULTIPLIER_GENERAL: zod_1.z.string().default('1.5').transform(Number),
    XP_MULTIPLIER_VIP: zod_1.z.string().default('2.0').transform(Number),
    XP_MULTIPLIER_VIP_PLUS: zod_1.z.string().default('2.5').transform(Number),
    XP_GENERAL_CHANNELS: zod_1.z.string().default(''),
    XP_VIP_CHANNELS: zod_1.z.string().default(''),
    XP_VIP_PLUS_CHANNELS: zod_1.z.string().default(''),
    MAX_PICKS_PER_DAY: zod_1.z.string().default('10').transform(Number),
    MAX_UNITS_PER_PICK: zod_1.z.string().default('10').transform(Number),
    MIN_UNITS_PER_PICK: zod_1.z.string().default('1').transform(Number),
    PICK_CATEGORIES: zod_1.z.string().default('NFL,NBA,MLB,NHL,Soccer,Tennis,UFC,Boxing,College Football,College Basketball'),
    AUTO_GRADE_DELAY_HOURS: zod_1.z.string().default('2').transform(Number),
    GRADE_CONFIRMATION_REQUIRED: zod_1.z.string().default('true').transform(val => val === 'true'),
    MANUAL_GRADE_OVERRIDE: zod_1.z.string().default('true').transform(val => val === 'true'),
    RATE_LIMIT_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    AUTO_BACKUP_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    HOT_RELOAD: zod_1.z.string().default('false').transform(val => val === 'true'),
    SECURITY_HEADERS_ENABLED: zod_1.z.string().default('true').transform(val => val === 'true'),
    THREAD_AUTO_ARCHIVE_MINUTES: zod_1.z.string().default('1440').transform(Number),
    FORUM_AUTO_CLEANUP_DAYS: zod_1.z.string().default('30').transform(Number),
    CAPPER_THREAD_AUTO_ARCHIVE_HOURS: zod_1.z.string().default('168').transform(Number),
    DATA_RETENTION_DAYS: zod_1.z.string().default('365').transform(Number),
    BACKUP_FREQUENCY_HOURS: zod_1.z.string().default('24').transform(Number),
    MAX_DMS_PER_HOUR: zod_1.z.string().default('5').transform(Number),
    MAX_THREADS_PER_DAY: zod_1.z.string().default('20').transform(Number),
    NOTION_TOKEN: zod_1.z.string().optional(),
    DISCORD_ALERT_WEBHOOK: zod_1.z.string().url().optional(),
    ALERTS_CHANNEL_ID: zod_1.z.string().optional(),
});
class EnvironmentConfig {
    config;
    isValidated = false;
    constructor() {
        this.config = {};
        this.loadConfiguration();
    }
    loadConfiguration() {
        try {
            if (typeof process === 'undefined' || !process.env) {
                console.warn('⚠️ Running in browser environment - limited configuration available');
                this.config = this.getBrowserConfig();
                this.isValidated = true;
                return;
            }
            const rawConfig = process.env;
            this.config = EnvironmentSchema.parse(rawConfig);
            this.isValidated = true;
            console.log(`✅ Environment configuration loaded successfully for ${this.config.NODE_ENV}`);
        }
        catch (error) {
            console.error('❌ Environment configuration validation failed:');
            if (error instanceof zod_1.z.ZodError) {
                error.issues.forEach((err) => {
                    console.error(`  - ${err.path.join('.')}: ${err.message}`);
                });
            }
            else {
                console.error(error);
            }
            throw new Error('Failed to load environment configuration');
        }
    }
    getBrowserConfig() {
        const browserEnv = {
            NODE_ENV: 'production',
            LOG_LEVEL: 'info',
            DEBUG_MODE: 'false',
            API_PORT: '3000',
            DISCORD_BOT_PORT: '3001',
            DASHBOARD_PORT: '3002',
            SMART_FORM_PORT: '3003',
            COMMAND_CENTER_PORT: '3015',
            SUPABASE_URL: globalThis.NEXT_PUBLIC_SUPABASE_URL || '',
            SUPABASE_ANON_KEY: globalThis.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            SUPABASE_SERVICE_ROLE_KEY: '',
            NEXT_PUBLIC_SUPABASE_URL: globalThis.NEXT_PUBLIC_SUPABASE_URL || '',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: globalThis.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            OPTIMAL_API_KEY: '',
            ODDS_API_KEY: '',
            DISCORD_BOT_TOKEN: '',
            DISCORD_TOKEN: '',
            DISCORD_CLIENT_ID: '',
            DISCORD_GUILD_ID: '',
            ADMIN_ROLE_IDS: '',
            MODERATOR_ROLE_IDS: '',
            BOT_ROLE_IDS: '',
            STAFF_ROLE_IDS: '',
            OWNER_ROLE_IDS: '',
            VIP_ROLE_IDS: '',
            VIP_PLUS_ROLE_IDS: '',
            CAPPER_ROLE_IDS: '',
            TRIAL_ROLE_IDS: '',
            ANNOUNCEMENTS_CHANNEL_ID: '',
            GENERAL_CHANNEL_ID: '',
            WELCOME_CHANNEL_ID: '',
            FREE_PICKS_CHANNEL_ID: '',
            VIP_PICKS_CHANNEL_ID: '',
            VIP_PLUS_PICKS_CHANNEL_ID: '',
            VIP_GENERAL_CHANNEL_ID: '',
            VIP_STRATEGY_ROOM_CHANNEL_ID: '',
            VIP_PLUS_GENERAL_CHANNEL_ID: '',
            VIP_PLUS_STRATEGY_ROOM_CHANNEL_ID: '',
            VIP_PLUS_EXCLUSIVE_INSIGHTS_CHANNEL_ID: '',
            VIP_PLUS_TRADER_INSIGHTS_CHANNEL_ID: '',
            SUPPORT_CHANNEL_ID: '',
            THREADS_CHANNEL_ID: '',
            SPORTS_TALK_CHANNEL_ID: '',
            ADMIN_CHANNEL_ID: '',
            BOT_LOGS_CHANNEL_ID: '',
            TEMPORAL_ADDRESS: 'localhost:7233',
            TEMPORAL_SERVER_URL: 'unit-talk-temporal:7233',
            TEMPORAL_NAMESPACE: 'default',
            TEMPORAL_TASK_QUEUE: 'unit-talk-dev',
            REDIS_URL: 'redis://localhost:6379',
            CACHE_ENABLED: 'true',
            JWT_SECRET: 'browser-environment-placeholder-32chars',
            ENCRYPTION_KEY: 'browser-environment-placeholder32',
            NEXTAUTH_SECRET: 'browser-environment-placeholder',
            NEXT_PUBLIC_APP_URL: globalThis.NEXT_PUBLIC_APP_URL || 'http://localhost:3015',
            NEXTAUTH_URL: globalThis.NEXT_PUBLIC_APP_URL || 'http://localhost:3015',
            NEXT_PUBLIC_PLATFORM_API_URL: globalThis.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:3000',
            UNIT_TALK_PRODUCTION_URL: globalThis.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:3000',
            NEXT_PUBLIC_ANALYTICS_API_URL: globalThis.NEXT_PUBLIC_ANALYTICS_API_URL || 'http://localhost:3005',
            AGENTS_BASE_URL: 'http://localhost:3001',
            AGENTS_API_KEY: '',
            SYNC_API_KEY: '',
            AUTO_GRADING_ENABLED: 'true',
            DM_NOTIFICATIONS_ENABLED: 'true',
            ANALYTICS_ENABLED: 'true',
            THREAD_MANAGEMENT_ENABLED: 'true',
            CAPPER_TRACKING_ENABLED: 'true',
            FORUM_MANAGEMENT_ENABLED: 'true',
            CAPPER_THREAD_AUTO_CREATE: 'true',
            CAPPER_QA_THREADS_ENABLED: 'true',
            CAPPER_PERFORMANCE_TRACKING: 'true',
            CAPPER_DAILY_PICK_AGGREGATION: 'true',
            XP_SYSTEM_ENABLED: 'true',
            LEADERBOARD_ENABLED: 'true',
            ENGAGEMENT_TRACKING_ENABLED: 'true',
            MILESTONE_CELEBRATIONS_ENABLED: 'true',
            STREAK_TRACKING_ENABLED: 'true',
            ACHIEVEMENT_SYSTEM_ENABLED: 'true',
            VIP_CONVERSION_TRACKING: 'true',
            TRIAL_USAGE_TRACKING: 'true',
            UPGRADE_FUNNEL_ANALYTICS: 'true',
            AUTO_VIP_PROMOTION_MESSAGES: 'false',
            WELCOME_SYSTEM_ENABLED: 'true',
            NEW_MEMBER_GUIDE_ENABLED: 'true',
            AUTO_ROLE_SUGGESTIONS: 'true',
            XP_MULTIPLIER_GENERAL: '1.5',
            XP_MULTIPLIER_VIP: '2.0',
            XP_MULTIPLIER_VIP_PLUS: '2.5',
            XP_GENERAL_CHANNELS: '',
            XP_VIP_CHANNELS: '',
            XP_VIP_PLUS_CHANNELS: '',
            MAX_PICKS_PER_DAY: '10',
            MAX_UNITS_PER_PICK: '10',
            MIN_UNITS_PER_PICK: '1',
            PICK_CATEGORIES: 'NFL,NBA,MLB,NHL,Soccer,Tennis,UFC,Boxing,College Football,College Basketball',
            AUTO_GRADE_DELAY_HOURS: '2',
            GRADE_CONFIRMATION_REQUIRED: 'true',
            MANUAL_GRADE_OVERRIDE: 'true',
            RATE_LIMIT_ENABLED: 'true',
            AUTO_BACKUP_ENABLED: 'true',
            HOT_RELOAD: 'false',
            SECURITY_HEADERS_ENABLED: 'true',
            THREAD_AUTO_ARCHIVE_MINUTES: '1440',
            FORUM_AUTO_CLEANUP_DAYS: '30',
            CAPPER_THREAD_AUTO_ARCHIVE_HOURS: '168',
            DATA_RETENTION_DAYS: '365',
            BACKUP_FREQUENCY_HOURS: '24',
            MAX_DMS_PER_HOUR: '5',
            MAX_THREADS_PER_DAY: '20',
            NOTION_TOKEN: '',
            DISCORD_ALERT_WEBHOOK: '',
            ALERTS_CHANNEL_ID: '',
        };
        return browserEnv;
    }
    get all() {
        if (!this.isValidated) {
            throw new Error('Configuration not validated. Cannot access configuration.');
        }
        return this.config;
    }
    get database() {
        return {
            supabaseUrl: this.config.SUPABASE_URL,
            supabaseAnonKey: this.config.SUPABASE_ANON_KEY,
            supabaseServiceRoleKey: this.config.SUPABASE_SERVICE_ROLE_KEY,
            publicSupabaseUrl: this.config.NEXT_PUBLIC_SUPABASE_URL,
            publicSupabaseAnonKey: this.config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        };
    }
    get apiKeys() {
        return {
            optimal: this.config.OPTIMAL_API_KEY,
            odds: this.config.ODDS_API_KEY,
            agents: this.config.AGENTS_API_KEY,
            sync: this.config.SYNC_API_KEY,
        };
    }
    get discord() {
        return {
            botToken: this.config.DISCORD_BOT_TOKEN,
            token: this.config.DISCORD_TOKEN,
            clientId: this.config.DISCORD_CLIENT_ID,
            guildId: this.config.DISCORD_GUILD_ID,
            roles: {
                admin: this.config.ADMIN_ROLE_IDS.split(',').filter(Boolean),
                moderator: this.config.MODERATOR_ROLE_IDS.split(',').filter(Boolean),
                bot: this.config.BOT_ROLE_IDS.split(',').filter(Boolean),
                staff: this.config.STAFF_ROLE_IDS.split(',').filter(Boolean),
                owner: this.config.OWNER_ROLE_IDS.split(',').filter(Boolean),
                vip: this.config.VIP_ROLE_IDS.split(',').filter(Boolean),
                vipPlus: this.config.VIP_PLUS_ROLE_IDS.split(',').filter(Boolean),
                capper: this.config.CAPPER_ROLE_IDS.split(',').filter(Boolean),
                trial: this.config.TRIAL_ROLE_IDS.split(',').filter(Boolean),
            },
            channels: {
                announcements: this.config.ANNOUNCEMENTS_CHANNEL_ID,
                general: this.config.GENERAL_CHANNEL_ID,
                welcome: this.config.WELCOME_CHANNEL_ID,
                freePicks: this.config.FREE_PICKS_CHANNEL_ID,
                vipPicks: this.config.VIP_PICKS_CHANNEL_ID,
                vipPlusPicks: this.config.VIP_PLUS_PICKS_CHANNEL_ID,
                vipGeneral: this.config.VIP_GENERAL_CHANNEL_ID,
                vipStrategyRoom: this.config.VIP_STRATEGY_ROOM_CHANNEL_ID,
                vipPlusGeneral: this.config.VIP_PLUS_GENERAL_CHANNEL_ID,
                vipPlusStrategyRoom: this.config.VIP_PLUS_STRATEGY_ROOM_CHANNEL_ID,
                vipPlusExclusiveInsights: this.config.VIP_PLUS_EXCLUSIVE_INSIGHTS_CHANNEL_ID,
                vipPlusTraderInsights: this.config.VIP_PLUS_TRADER_INSIGHTS_CHANNEL_ID,
                support: this.config.SUPPORT_CHANNEL_ID,
                threads: this.config.THREADS_CHANNEL_ID,
                sportsTalk: this.config.SPORTS_TALK_CHANNEL_ID,
                admin: this.config.ADMIN_CHANNEL_ID,
                botLogs: this.config.BOT_LOGS_CHANNEL_ID,
            },
        };
    }
    get urls() {
        return {
            app: this.config.NEXT_PUBLIC_APP_URL,
            platformApi: this.config.NEXT_PUBLIC_PLATFORM_API_URL,
            production: this.config.UNIT_TALK_PRODUCTION_URL,
            analytics: this.config.NEXT_PUBLIC_ANALYTICS_API_URL,
            agents: this.config.AGENTS_BASE_URL,
            nextAuth: this.config.NEXTAUTH_URL,
        };
    }
    get security() {
        return {
            jwtSecret: this.config.JWT_SECRET,
            encryptionKey: this.config.ENCRYPTION_KEY,
            nextAuthSecret: this.config.NEXTAUTH_SECRET,
        };
    }
    get temporal() {
        return {
            address: this.config.TEMPORAL_ADDRESS,
            serverUrl: this.config.TEMPORAL_SERVER_URL,
            namespace: this.config.TEMPORAL_NAMESPACE,
            taskQueue: this.config.TEMPORAL_TASK_QUEUE,
        };
    }
    get features() {
        return {
            autoGradingEnabled: this.config.AUTO_GRADING_ENABLED,
            dmNotificationsEnabled: this.config.DM_NOTIFICATIONS_ENABLED,
            analyticsEnabled: this.config.ANALYTICS_ENABLED,
            threadManagementEnabled: this.config.THREAD_MANAGEMENT_ENABLED,
            capperTrackingEnabled: this.config.CAPPER_TRACKING_ENABLED,
            forumManagementEnabled: this.config.FORUM_MANAGEMENT_ENABLED,
            capperThreadAutoCreate: this.config.CAPPER_THREAD_AUTO_CREATE,
            capperQaThreadsEnabled: this.config.CAPPER_QA_THREADS_ENABLED,
            capperPerformanceTracking: this.config.CAPPER_PERFORMANCE_TRACKING,
            capperDailyPickAggregation: this.config.CAPPER_DAILY_PICK_AGGREGATION,
            xpSystemEnabled: this.config.XP_SYSTEM_ENABLED,
            leaderboardEnabled: this.config.LEADERBOARD_ENABLED,
            engagementTrackingEnabled: this.config.ENGAGEMENT_TRACKING_ENABLED,
            milestoneCelebrationsEnabled: this.config.MILESTONE_CELEBRATIONS_ENABLED,
            streakTrackingEnabled: this.config.STREAK_TRACKING_ENABLED,
            achievementSystemEnabled: this.config.ACHIEVEMENT_SYSTEM_ENABLED,
            vipConversionTracking: this.config.VIP_CONVERSION_TRACKING,
            trialUsageTracking: this.config.TRIAL_USAGE_TRACKING,
            upgradeFunnelAnalytics: this.config.UPGRADE_FUNNEL_ANALYTICS,
            autoVipPromotionMessages: this.config.AUTO_VIP_PROMOTION_MESSAGES,
            welcomeSystemEnabled: this.config.WELCOME_SYSTEM_ENABLED,
            newMemberGuideEnabled: this.config.NEW_MEMBER_GUIDE_ENABLED,
            autoRoleSuggestions: this.config.AUTO_ROLE_SUGGESTIONS,
        };
    }
    get xpSystem() {
        return {
            multipliers: {
                general: this.config.XP_MULTIPLIER_GENERAL,
                vip: this.config.XP_MULTIPLIER_VIP,
                vipPlus: this.config.XP_MULTIPLIER_VIP_PLUS,
            },
            channels: {
                general: this.config.XP_GENERAL_CHANNELS.split(',').filter(Boolean),
                vip: this.config.XP_VIP_CHANNELS.split(',').filter(Boolean),
                vipPlus: this.config.XP_VIP_PLUS_CHANNELS.split(',').filter(Boolean),
            },
        };
    }
    get pickManagement() {
        return {
            limits: {
                maxPicksPerDay: this.config.MAX_PICKS_PER_DAY,
                maxUnitsPerPick: this.config.MAX_UNITS_PER_PICK,
                minUnitsPerPick: this.config.MIN_UNITS_PER_PICK,
            },
            categories: this.config.PICK_CATEGORIES.split(',').map(cat => cat.trim()),
            grading: {
                autoGradeDelayHours: this.config.AUTO_GRADE_DELAY_HOURS,
                gradeConfirmationRequired: this.config.GRADE_CONFIRMATION_REQUIRED,
                manualGradeOverride: this.config.MANUAL_GRADE_OVERRIDE,
            },
        };
    }
    get performance() {
        return {
            rateLimitEnabled: this.config.RATE_LIMIT_ENABLED,
            autoBackupEnabled: this.config.AUTO_BACKUP_ENABLED,
            hotReload: this.config.HOT_RELOAD,
            securityHeadersEnabled: this.config.SECURITY_HEADERS_ENABLED,
            cacheEnabled: this.config.CACHE_ENABLED,
            redis: {
                url: this.config.REDIS_URL,
            },
            limits: {
                threadAutoArchiveMinutes: this.config.THREAD_AUTO_ARCHIVE_MINUTES,
                forumAutoCleanupDays: this.config.FORUM_AUTO_CLEANUP_DAYS,
                capperThreadAutoArchiveHours: this.config.CAPPER_THREAD_AUTO_ARCHIVE_HOURS,
                dataRetentionDays: this.config.DATA_RETENTION_DAYS,
                backupFrequencyHours: this.config.BACKUP_FREQUENCY_HOURS,
                maxDmsPerHour: this.config.MAX_DMS_PER_HOUR,
                maxThreadsPerDay: this.config.MAX_THREADS_PER_DAY,
            },
        };
    }
    get ports() {
        return {
            api: this.config.API_PORT,
            discordBot: this.config.DISCORD_BOT_PORT,
            dashboard: this.config.DASHBOARD_PORT,
            smartForm: this.config.SMART_FORM_PORT,
            commandCenter: this.config.COMMAND_CENTER_PORT,
        };
    }
    get isProduction() {
        return this.config.NODE_ENV === 'production';
    }
    get isDevelopment() {
        return this.config.NODE_ENV === 'development';
    }
    get isStaging() {
        return this.config.NODE_ENV === 'staging';
    }
    get environment() {
        return this.config.NODE_ENV;
    }
    get logLevel() {
        return this.config.LOG_LEVEL;
    }
    get debugMode() {
        return this.config.DEBUG_MODE;
    }
}
exports.env = new EnvironmentConfig();
exports.default = exports.env;
function validateProductionApiKeys() {
    if (exports.env.isProduction) {
        const requiredKeys = ['optimal', 'odds'];
        const missing = requiredKeys.filter(key => !exports.env.apiKeys[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required API keys for production: ${missing.join(', ')}`);
        }
        console.log('✅ All required production API keys are present');
    }
}
function getEnvironmentOverrides(environment) {
    switch (environment) {
        case 'development':
            return {
                LOG_LEVEL: 'debug',
                DEBUG_MODE: true,
                HOT_RELOAD: true,
                RATE_LIMIT_ENABLED: false,
                SECURITY_HEADERS_ENABLED: false,
            };
        case 'staging':
            return {
                LOG_LEVEL: 'info',
                DEBUG_MODE: false,
                HOT_RELOAD: false,
                RATE_LIMIT_ENABLED: true,
                SECURITY_HEADERS_ENABLED: true,
            };
        case 'production':
            return {
                LOG_LEVEL: 'info',
                DEBUG_MODE: false,
                HOT_RELOAD: false,
                RATE_LIMIT_ENABLED: true,
                SECURITY_HEADERS_ENABLED: true,
            };
        default:
            return {};
    }
}
//# sourceMappingURL=environment.js.map