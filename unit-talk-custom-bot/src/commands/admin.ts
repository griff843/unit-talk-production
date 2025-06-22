import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  PermissionFlagsBits,
  GuildMember
} from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { DMService } from '../services/dmService';
import { ThreadService } from '../services/threadService';
import { PermissionUtils } from '../utils/permissions';
import { AdminDashboardData, UserTier, DMTrigger } from '../types';
import { logger } from '../utils/logger';

export const adminCommand = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin dashboard and management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('dashboard')
        .setDescription('Admin dashboard commands')
        .addSubcommand(subcommand =>
          subcommand
            .setName('overview')
            .setDescription('Show admin dashboard overview')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('users')
            .setDescription('User management dashboard')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('system')
            .setDescription('System health and monitoring')
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('users')
        .setDescription('User management commands')
        .addSubcommand(subcommand =>
          subcommand
            .setName('upgrade')
            .setDescription('Upgrade user tier')
            .addUserOption(option =>
              option
                .setName('user')
                .setDescription('User to upgrade')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('tier')
                .setDescription('New tier')
                .setRequired(true)
                .addChoices(
                  { name: 'Member', value: 'member' },
                  { name: 'VIP', value: 'vip' },
                  { name: 'VIP+', value: 'vip_plus' }
                )
            )
            .addStringOption(option =>
              option
                .setName('duration')
                .setDescription('Duration (e.g., 30d, 1y, permanent)')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('info')
            .setDescription('Get detailed user information')
            .addUserOption(option =>
              option
                .setName('user')
                .setDescription('User to get info for')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('stats')
            .setDescription('Get user betting statistics')
            .addUserOption(option =>
              option
                .setName('user')
                .setDescription('User to get stats for')
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('dm')
        .setDescription('DM system management')
        .addSubcommand(subcommand =>
          subcommand
            .setName('triggers')
            .setDescription('Manage DM triggers')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('send')
            .setDescription('Send manual DM to user or tier')
            .addStringOption(option =>
              option
                .setName('target')
                .setDescription('Target (user ID or tier)')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('message')
                .setDescription('Message to send')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('analytics')
            .setDescription('View DM analytics')
            .addIntegerOption(option =>
              option
                .setName('days')
                .setDescription('Number of days to analyze')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(90)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('threads')
        .setDescription('Thread management')
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List active threads')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription('Create game thread')
            .addStringOption(option =>
              option
                .setName('game_id')
                .setDescription('Game ID')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('teams')
                .setDescription('Teams playing')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('sport')
                .setDescription('Sport')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('game_time')
                .setDescription('Game time')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('archive')
            .setDescription('Archive old threads')
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('system')
        .setDescription('System management')
        .addSubcommand(subcommand =>
          subcommand
            .setName('reload')
            .setDescription('Reload system configurations')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('maintenance')
            .setDescription('Toggle maintenance mode')
            .addBooleanOption(option =>
              option
                .setName('enabled')
                .setDescription('Enable maintenance mode')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('backup')
            .setDescription('Create system backup')
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    // Check admin permissions
    if (!PermissionUtils.hasPermission(member, 'isAdmin')) {
      await interaction.reply({
        content: '❌ You need administrator permissions to use this command.',
        ephemeral: true
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (group) {
        case 'dashboard':
          await handleDashboardCommands(interaction, subcommand);
          break;
        case 'users':
          await handleUserCommands(interaction, subcommand);
          break;
        case 'dm':
          await handleDMCommands(interaction, subcommand);
          break;
        case 'threads':
          await handleThreadCommands(interaction, subcommand);
          break;
        case 'system':
          await handleSystemCommands(interaction, subcommand);
          break;
      }
    } catch (error) {
      logger.error('Admin command error:', error);
      await interaction.reply({
        content: '❌ An error occurred while executing the command.',
        ephemeral: true
      });
    }
  }
};

async function handleDashboardCommands(interaction: ChatInputCommandInteraction, subcommand: string) {
  const supabaseService = new SupabaseService();

  switch (subcommand) {
    case 'overview':
      await interaction.deferReply({ ephemeral: true });
      const dashboardData = await getDashboardData(supabaseService);
      const overviewEmbed = createOverviewEmbed(dashboardData);
      
      await interaction.editReply({
        embeds: [overviewEmbed],
        components: [createDashboardButtons()]
      });
      break;

    case 'users':
      await interaction.deferReply({ ephemeral: true });
      const userStats = await getUserDashboardData(supabaseService);
      const userEmbed = createUserDashboardEmbed(userStats);
      
      await interaction.editReply({
        embeds: [userEmbed],
        components: [createUserManagementButtons()]
      });
      break;

    case 'system':
      await interaction.deferReply({ ephemeral: true });
      const systemHealth = await getSystemHealth(supabaseService);
      const systemEmbed = createSystemHealthEmbed(systemHealth);
      
      await interaction.editReply({
        embeds: [systemEmbed],
        components: [createSystemButtons()]
      });
      break;
  }
}

async function handleUserCommands(interaction: ChatInputCommandInteraction, subcommand: string) {
  const supabaseService = new SupabaseService();

  switch (subcommand) {
    case 'upgrade':
      const user = interaction.options.getUser('user', true);
      const tier = interaction.options.getString('tier', true) as UserTier;
      const duration = interaction.options.getString('duration') || 'permanent';

      await interaction.deferReply({ ephemeral: true });
      
      try {
        await upgradeUserTier(supabaseService, user.id, tier, duration);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ User Upgraded')
          .setDescription(`Successfully upgraded ${user.username} to ${PermissionUtils.getTierName(tier)}`)
          .addFields(
            { name: 'User', value: `<@${user.id}>`, inline: true },
            { name: 'New Tier', value: PermissionUtils.getTierName(tier), inline: true },
            { name: 'Duration', value: duration, inline: true }
          )
          .setColor(parseInt(PermissionUtils.getTierColor(tier).replace('#', ''), 16))
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        
        // Log the action
        logger.info(`Admin ${interaction.user.id} upgraded user ${user.id} to ${tier}`);
        
      } catch (error) {
        await interaction.editReply({
          content: `❌ Failed to upgrade user: ${error}`
        });
      }
      break;

    case 'info':
      const targetUser = interaction.options.getUser('user', true);
      await interaction.deferReply({ ephemeral: true });
      
      const userInfo = await getUserInfo(supabaseService, targetUser.id);
      const infoEmbed = createUserInfoEmbed(targetUser, userInfo);
      
      await interaction.editReply({
        embeds: [infoEmbed],
        components: [createUserActionButtons(targetUser.id)]
      });
      break;

    case 'stats':
      const statsUser = interaction.options.getUser('user', true);
      await interaction.deferReply({ ephemeral: true });
      
      const userStats = await getUserStats(supabaseService, statsUser.id);
      const statsEmbed = createUserStatsEmbed(statsUser, userStats);
      
      await interaction.editReply({ embeds: [statsEmbed] });
      break;
  }
}

async function handleDMCommands(interaction: ChatInputCommandInteraction, subcommand: string) {
  const dmService = new DMService({} as any, new SupabaseService());

  switch (subcommand) {
    case 'triggers':
      await interaction.deferReply({ ephemeral: true });
      const triggers = await getDMTriggers();
      const triggersEmbed = createTriggersEmbed(triggers);
      
      await interaction.editReply({
        embeds: [triggersEmbed],
        components: [createTriggerButtons()]
      });
      break;

    case 'send':
      const target = interaction.options.getString('target', true);
      const message = interaction.options.getString('message', true);
      
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const result = await sendManualDM(target, message);
        await interaction.editReply({
          content: `✅ DM sent successfully to ${result.count} users.`
        });
      } catch (error) {
        await interaction.editReply({
          content: `❌ Failed to send DM: ${error}`
        });
      }
      break;

    case 'analytics':
      const days = interaction.options.getInteger('days') || 30;
      await interaction.deferReply({ ephemeral: true });
      
      const analytics = await dmService.getDMAnalytics(days);
      const analyticsEmbed = createDMAnalyticsEmbed(analytics, days);
      
      await interaction.editReply({ embeds: [analyticsEmbed] });
      break;
  }
}

async function handleThreadCommands(interaction: ChatInputCommandInteraction, subcommand: string) {
  const threadService = new ThreadService({} as any, new SupabaseService());

  switch (subcommand) {
    case 'list':
      await interaction.deferReply({ ephemeral: true });
      const activeThreads = await threadService.getActiveThreads();
      const threadsEmbed = createActiveThreadsEmbed(activeThreads);
      
      await interaction.editReply({ embeds: [threadsEmbed] });
      break;

    case 'create':
      const gameId = interaction.options.getString('game_id', true);
      const teams = interaction.options.getString('teams', true);
      const sport = interaction.options.getString('sport', true);
      const gameTime = interaction.options.getString('game_time', true);
      
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const thread = await threadService.createGameThread({
          gameId,
          teams,
          sport,
          gameTime
        });
        
        if (thread) {
          await interaction.editReply({
            content: `✅ Created game thread: ${thread.name}\n<#${thread.id}>`
          });
        } else {
          await interaction.editReply({
            content: '❌ Failed to create thread.'
          });
        }
      } catch (error) {
        await interaction.editReply({
          content: `❌ Error creating thread: ${error}`
        });
      }
      break;

    case 'archive':
      await interaction.deferReply({ ephemeral: true });
      
      try {
        await threadService.archiveOldThreads();
        await interaction.editReply({
          content: '✅ Old threads archived successfully.'
        });
      } catch (error) {
        await interaction.editReply({
          content: `❌ Error archiving threads: ${error}`
        });
      }
      break;
  }
}

async function handleSystemCommands(interaction: ChatInputCommandInteraction, subcommand: string) {
  switch (subcommand) {
    case 'reload':
      await interaction.deferReply({ ephemeral: true });
      
      try {
        // Reload configurations
        await reloadSystemConfigurations();
        
        await interaction.editReply({
          content: '✅ System configurations reloaded successfully.'
        });
      } catch (error) {
        await interaction.editReply({
          content: `❌ Error reloading configurations: ${error}`
        });
      }
      break;

    case 'maintenance':
      const enabled = interaction.options.getBoolean('enabled', true);
      await interaction.deferReply({ ephemeral: true });
      
      try {
        await toggleMaintenanceMode(enabled);
        
        await interaction.editReply({
          content: `✅ Maintenance mode ${enabled ? 'enabled' : 'disabled'}.`
        });
      } catch (error) {
        await interaction.editReply({
          content: `❌ Error toggling maintenance mode: ${error}`
        });
      }
      break;

    case 'backup':
      await interaction.deferReply({ ephemeral: true });
      
      try {
        const backupId = await createSystemBackup();
        
        await interaction.editReply({
          content: `✅ System backup created successfully.\nBackup ID: ${backupId}`
        });
      } catch (error) {
        await interaction.editReply({
          content: `❌ Error creating backup: ${error}`
        });
      }
      break;
  }
}

// Helper functions for dashboard data
async function getDashboardData(supabaseService: SupabaseService): Promise<AdminDashboardData> {
  const [userStats, engagementStats, systemHealth, recentActivity] = await Promise.all([
    getUserStatsOverview(supabaseService),
    getEngagementStats(supabaseService),
    getSystemHealthData(supabaseService),
    getRecentActivity(supabaseService)
  ]);

  return {
    userStats,
    pickStats: {
      totalPicks: 0,
      winningPicks: 0,
      losingPicks: 0,
      pendingPicks: 0,
      winRate: 0,
      averageOdds: 0,
      averageUnits: 0,
      profitLoss: 0
    },
    systemStats: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      status: 'healthy',
      cpuUsage: 0
    },
    engagementStats,
    systemHealth,
    recentActivity
  };
}

async function getUserStatsOverview(supabaseService: SupabaseService) {
  const { data: users } = await supabaseService.client
    .from('user_profiles')
    .select('tier, created_at, last_active');

  const total = users?.length || 0;
  const byTier = {
    member: users?.filter(u => u.tier === 'member').length || 0,
    vip: users?.filter(u => u.tier === 'vip').length || 0,
    vip_plus: users?.filter(u => u.tier === 'vip_plus').length || 0,
    staff: users?.filter(u => u.tier === 'staff').length || 0,
    admin: users?.filter(u => u.tier === 'admin').length || 0,
    owner: users?.filter(u => u.tier === 'owner').length || 0
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const activeToday = users?.filter(u => 
    u.last_active && new Date(u.last_active) >= today
  ).length || 0;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newThisWeek = users?.filter(u => 
    new Date(u.created_at) >= weekAgo
  ).length || 0;

  return {
    totalUsers: total,
    byTier,
    activeUsers: activeToday,
    newUsers: newThisWeek,
    vipUsers: byTier.vip + byTier.vip_plus
  };
}

async function getEngagementStats(supabaseService: SupabaseService) {
  // This would query your engagement tracking tables
  return {
    totalMessages: 1250,
    totalReactions: 890,
    activeThreads: 15,
    dailyActiveUsers: 45
  };
}

async function getSystemHealthData(supabaseService: SupabaseService) {
  return {
    uptime: 99.8,
    memoryUsage: 75.2,
    errorRate: 0.02
  };
}

async function getRecentActivity(supabaseService: SupabaseService) {
  const { data: activities } = await supabaseService.client
    .from('activity_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10);

  return activities || [];
}

// Embed creators
function createOverviewEmbed(data: AdminDashboardData): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📊 Admin Dashboard Overview')
    .addFields(
      {
        name: '👥 Users',
        value: `Total: ${data.userStats.totalUsers}\n` +
               `VIP+: ${data.userStats.byTier?.vip_plus || 0}\n` +
               `VIP: ${data.userStats.byTier?.vip || 0}\n` +
               `Member: ${data.userStats.byTier?.member || 0}`,
        inline: true
      },
      {
        name: '📈 Engagement',
        value: `Messages: ${data.engagementStats.totalMessages}\n` +
               `Reactions: ${data.engagementStats.totalReactions}\n` +
               `Active Threads: ${data.engagementStats.activeThreads}\n` +
               `Daily Active: ${data.engagementStats.dailyActiveUsers}`,
        inline: true
      },
      {
        name: '🔧 System Health',
        value: `Uptime: ${data.systemHealth.uptime}%\n` +
               `Memory: ${data.systemHealth.memoryUsage}%\n` +
               `Error Rate: ${data.systemHealth.errorRate}%`,
        inline: true
      }
    )
    .setColor(0x0099FF)
    .setTimestamp();
}

function createDashboardButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('refresh_dashboard')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('export_data')
        .setLabel('Export Data')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('system_logs')
        .setLabel('View Logs')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
    );
}

// Additional helper functions would be implemented here...
// (getUserInfo, upgradeUserTier, createUserInfoEmbed, etc.)

async function upgradeUserTier(supabaseService: SupabaseService, userId: string, tier: UserTier, duration: string): Promise<void> {
  let expiresAt = null;
  
  if (duration !== 'permanent') {
    const match = duration.match(/(\d+)([dmy])/);
    if (match) {
      const amount = parseInt(match[1]!);
      const unit = match[2];
      const now = new Date();
      
      switch (unit) {
        case 'd':
          expiresAt = new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
          break;
        case 'm':
          expiresAt = new Date(now.setMonth(now.getMonth() + amount));
          break;
        case 'y':
          expiresAt = new Date(now.setFullYear(now.getFullYear() + amount));
          break;
      }
    }
  }

  await supabaseService.client
    .from('user_profiles')
    .upsert({
      discord_id: userId,
      tier: tier,
      tier_expires_at: expiresAt?.toISOString(),
      updated_at: new Date().toISOString()
    });
}

async function getUserInfo(supabaseService: SupabaseService, userId: string): Promise<any> {
  const { data: user } = await supabaseService.client
    .from('user_profiles')
    .select('*')
    .eq('discord_id', userId)
    .single();

  return user;
}

function createUserInfoEmbed(user: any, userInfo: any): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`👤 User Information: ${user.username}`)
    .addFields(
      { name: 'Discord ID', value: user.id, inline: true },
      { name: 'Current Tier', value: PermissionUtils.getTierName(userInfo?.tier || 'member'), inline: true },
      { name: 'Joined', value: userInfo?.created_at ? new Date(userInfo.created_at).toLocaleDateString() : 'Unknown', inline: true },
      { name: 'Last Active', value: userInfo?.last_active ? new Date(userInfo.last_active).toLocaleDateString() : 'Never', inline: true },
      { name: 'Total Messages', value: userInfo?.total_messages?.toString() || '0', inline: true },
      { name: 'Activity Score', value: userInfo?.activity_score?.toString() || '0', inline: true }
    )
    .setColor(parseInt(PermissionUtils.getTierColor(userInfo?.tier || 'member').replace('#', ''), 16))
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}

function createUserActionButtons(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`user_upgrade_${userId}`)
        .setLabel('Upgrade Tier')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⬆️'),
      new ButtonBuilder()
        .setCustomId(`user_stats_${userId}`)
        .setLabel('View Stats')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId(`user_dm_${userId}`)
        .setLabel('Send DM')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬')
    );
}

// Placeholder implementations for remaining functions
async function getUserDashboardData(supabaseService: SupabaseService): Promise<any> { return {}; }
async function getSystemHealth(supabaseService: SupabaseService): Promise<any> { return {}; }
async function getDMTriggers(): Promise<DMTrigger[]> { return []; }
async function sendManualDM(target: string, message: string): Promise<{ count: number }> { return { count: 1 }; }
async function reloadSystemConfigurations(): Promise<void> { }
async function toggleMaintenanceMode(enabled: boolean): Promise<void> { }
async function createSystemBackup(): Promise<string> { return 'backup_' + Date.now(); }
async function getUserStats(supabaseService: SupabaseService, userId: string): Promise<any> { return {}; }

function createUserDashboardEmbed(data: any): EmbedBuilder { return new EmbedBuilder(); }
function createSystemHealthEmbed(data: any): EmbedBuilder { return new EmbedBuilder(); }
function createUserManagementButtons(): ActionRowBuilder<ButtonBuilder> { return new ActionRowBuilder(); }
function createSystemButtons(): ActionRowBuilder<ButtonBuilder> { return new ActionRowBuilder(); }
function createTriggersEmbed(triggers: DMTrigger[]): EmbedBuilder { return new EmbedBuilder(); }
function createTriggerButtons(): ActionRowBuilder<ButtonBuilder> { return new ActionRowBuilder(); }
function createDMAnalyticsEmbed(analytics: any, days: number): EmbedBuilder { return new EmbedBuilder(); }
function createActiveThreadsEmbed(threads: any[]): EmbedBuilder { return new EmbedBuilder(); }
function createUserStatsEmbed(user: any, stats: any): EmbedBuilder { return new EmbedBuilder(); }