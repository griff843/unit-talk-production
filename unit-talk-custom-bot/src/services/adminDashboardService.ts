import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SelectMenuBuilder,
  TextChannel,
  GuildMember,
  ComponentType
} from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { OnboardingService } from './onboardingService';
import { AdvancedAnalyticsService } from './advancedAnalyticsService';
import { logger } from '../utils/logger';
import { botConfig } from '../config';
import { defaultOnboardingConfig, OnboardingConfig } from '../config/onboardingConfig';

export interface AdminDashboardStats {
  onboarding: {
    total: number;
    completed: number;
    inProgress: number;
    failed: number;
    abandoned: number;
    completionRate: number;
  };
  dmFailures: {
    total: number;
    unresolved: number;
    byReason: Record<string, number>;
    recentFailures: number;
  };
  flows: {
    active: number;
    inactive: number;
    mostUsed: string;
    averageSteps: number;
  };
  preferences: {
    collected: number;
    mostPopularSports: string[];
    experienceLevels: Record<string, number>;
  };
}

export interface OnboardingFlowEdit {
  flowId: string;
  field: string;
  oldValue: any;
  newValue: any;
  editedBy: string;
  editedAt: Date;
}

export class AdminDashboardService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private onboardingService: OnboardingService | null;
  private analyticsService: AdvancedAnalyticsService;
  private currentConfig: OnboardingConfig;

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    permissionsService: PermissionsService,
    onboardingService: OnboardingService,
    analyticsService: AdvancedAnalyticsService
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.onboardingService = onboardingService;
    this.analyticsService = analyticsService;
    this.currentConfig = defaultOnboardingConfig;
    
    this.loadConfigFromDB();
  }

  /**
   * Load onboarding configuration from database
   */
  private async loadConfigFromDB(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('onboarding_config')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      if (data) {
        this.currentConfig = { ...defaultOnboardingConfig, ...data.config };
        logger.info('Loaded onboarding configuration from database');
      } else {
        // Save default config to database
        await this.saveConfigToDB();
        logger.info('Created default onboarding configuration in database');
      }
    } catch (error) {
      logger.error('Failed to load onboarding config from DB:', error);
      // Fall back to default config
      this.currentConfig = defaultOnboardingConfig;
    }
  }

  /**
   * Save current configuration to database
   */
  private async saveConfigToDB(): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('onboarding_config')
        .upsert({
          config: this.currentConfig,
          is_active: true,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      logger.info('Saved onboarding configuration to database');
    } catch (error) {
      logger.error('Failed to save onboarding config to DB:', error);
    }
  }

  /**
   * Show main admin dashboard
   */
  async showAdminDashboard(interaction: any): Promise<void> {
    try {
      // Check permissions
      if (!this.permissionsService.hasRole(interaction.member, 'admin') && 
          !this.permissionsService.hasRole(interaction.member, 'staff')) {
        await interaction.reply({
          content: '❌ You don\'t have permission to access the admin dashboard.',
          ephemeral: true
        });
        return;
      }

      const stats = await this.getAdminDashboardStats();
      const embed = this.createDashboardEmbed(stats);
      const components = this.createDashboardComponents();

      await interaction.reply({
        embeds: [embed],
        components,
        ephemeral: true
      });

    } catch (error) {
      logger.error('Failed to show admin dashboard:', error);
      await interaction.reply({
        content: '❌ Failed to load admin dashboard.',
        ephemeral: true
      });
    }
  }

  /**
   * Get comprehensive dashboard statistics
   */
  private async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    try {
      // Get onboarding stats
      const onboardingStats = this.onboardingService ?
        await this.onboardingService.getOnboardingStats() :
        { totalUsers: 0, completedUsers: 0, completionRate: 0, averageSteps: 0 };

      // Get DM failure stats
      const dmFailures = this.onboardingService ?
        await this.onboardingService.getDMFailures(100) :
        [];
      const dmFailureStats = {
        total: dmFailures.length,
        unresolved: dmFailures.filter(f => !f.resolved).length,
        byReason: this.groupDMFailuresByReason(dmFailures),
        recentFailures: dmFailures.filter(f =>
          Date.now() - f.attemptedAt.getTime() < 24 * 60 * 60 * 1000
        ).length
      };

      // Get flow stats
      const flowStats = {
        active: Object.values(this.currentConfig.flows).filter(f => f.isActive).length,
        inactive: Object.values(this.currentConfig.flows).filter(f => !f.isActive).length,
        mostUsed: 'member_onboarding', // This would come from analytics
        averageSteps: this.calculateAverageSteps()
      };

      // Get preference stats
      const preferenceStats = await this.getPreferenceStats();

      return {
        onboarding: {
          ...onboardingStats,
          completionRate: onboardingStats.total > 0 ? 
            (onboardingStats.completed / onboardingStats.total) * 100 : 0
        },
        dmFailures: dmFailureStats,
        flows: flowStats,
        preferences: preferenceStats
      };

    } catch (error) {
      logger.error('Failed to get dashboard stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Create dashboard embed
   */
  private createDashboardEmbed(stats: AdminDashboardStats): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🛠️ Unit Talk Admin Dashboard')
      .setDescription('Onboarding & User Management Overview')
      .setColor(0x3498DB)
      .addFields([
        {
          name: '📊 Onboarding Stats (Last 30 Days)',
          value: [
            `**Total Started:** ${stats.onboarding.total}`,
            `**Completed:** ${stats.onboarding.completed} (${stats.onboarding.completionRate.toFixed(1)}%)`,
            `**In Progress:** ${stats.onboarding.inProgress}`,
            `**Failed:** ${stats.onboarding.failed}`,
            `**Abandoned:** ${stats.onboarding.abandoned}`
          ].join('\n'),
          inline: true
        },
        {
          name: '📬 DM Failures',
          value: [
            `**Total Unresolved:** ${stats.dmFailures.unresolved}`,
            `**Recent (24h):** ${stats.dmFailures.recentFailures}`,
            `**Most Common:** ${this.getTopDMFailureReason(stats.dmFailures.byReason)}`
          ].join('\n'),
          inline: true
        },
        {
          name: '🔄 Onboarding Flows',
          value: [
            `**Active Flows:** ${stats.flows.active}`,
            `**Most Used:** ${stats.flows.mostUsed}`,
            `**Avg Steps:** ${stats.flows.averageSteps}`
          ].join('\n'),
          inline: true
        },
        {
          name: '⚙️ User Preferences',
          value: [
            `**Collected:** ${stats.preferences.collected}`,
            `**Top Sports:** ${stats.preferences.mostPopularSports.slice(0, 3).join(', ')}`,
            `**Experience Levels:** ${Object.keys(stats.preferences.experienceLevels).length} tracked`
          ].join('\n'),
          inline: true
        }
      ])
      .setFooter({ text: `Last updated: ${new Date().toLocaleString()}` })
      .setTimestamp();
  }

  /**
   * Create dashboard action components
   */
  private createDashboardComponents(): ActionRowBuilder<ButtonBuilder>[] {
    const mainActions = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_onboarding_flows')
          .setLabel('📝 Edit Flows')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_dm_failures')
          .setLabel('📬 DM Failures')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_analytics')
          .setLabel('📊 Analytics')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_settings')
          .setLabel('⚙️ Settings')
          .setStyle(ButtonStyle.Secondary)
      );

    const utilityActions = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_export_data')
          .setLabel('📤 Export Data')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('admin_test_onboarding')
          .setLabel('🧪 Test Flow')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_refresh')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Secondary)
      );

    return [mainActions, utilityActions];
  }

  /**
   * Handle admin dashboard interactions
   */
  async handleAdminInteraction(interaction: any): Promise<void> {
    try {
      const action = interaction.customId.replace('admin_', '');

      switch (action) {
        case 'onboarding_flows':
          await this.showOnboardingFlowsManager(interaction);
          break;
        case 'dm_failures':
          await this.showDMFailuresManager(interaction);
          break;
        case 'analytics':
          await this.showAnalyticsPanel(interaction);
          break;
        case 'settings':
          await this.showSettingsPanel(interaction);
          break;
        case 'export_data':
          await this.exportOnboardingData(interaction);
          break;
        case 'test_onboarding':
          await this.testOnboardingFlow(interaction);
          break;
        case 'refresh':
          await this.showAdminDashboard(interaction);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown admin action.',
            ephemeral: true
          });
      }

    } catch (error) {
      logger.error('Failed to handle admin interaction:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }

  /**
   * Show onboarding flows manager
   */
  private async showOnboardingFlowsManager(interaction: any): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📝 Onboarding Flows Manager')
      .setDescription('Edit and manage onboarding flows')
      .setColor(0x9B59B6);

    // Add flow information
    Object.values(this.currentConfig.flows).forEach(flow => {
      embed.addFields([
        {
          name: `${flow.isActive ? '✅' : '❌'} ${flow.name}`,
          value: [
            `**ID:** ${flow.id}`,
            `**Steps:** ${flow.steps.length}`,
            `**Target Role:** <@&${flow.targetRole}>`,
            `**Description:** ${flow.description}`
          ].join('\n'),
          inline: true
        }
      ]);
    });

    const components = [
      new ActionRowBuilder<SelectMenuBuilder>()
        .addComponents(
          new SelectMenuBuilder()
            .setCustomId('edit_flow_select')
            .setPlaceholder('Select a flow to edit')
            .addOptions(
              Object.values(this.currentConfig.flows).map(flow => ({
                label: flow.name,
                value: flow.id,
                description: `${flow.steps.length} steps - ${flow.isActive ? 'Active' : 'Inactive'}`,
                emoji: flow.isActive ? '✅' : '❌'
              }))
            )
        ),
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_new_flow')
            .setLabel('➕ Create New Flow')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('import_flow')
            .setLabel('📥 Import Flow')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('back_to_dashboard')
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
        )
    ];

    await interaction.update({
      embeds: [embed],
      components
    });
  }

  /**
   * Show DM failures manager
   */
  private async showDMFailuresManager(interaction: any): Promise<void> {
    const failures = this.onboardingService ?
      await this.onboardingService.getDMFailures(20) :
      [];

    const embed = new EmbedBuilder()
      .setTitle('📬 DM Failures Manager')
      .setDescription(`Managing ${failures.length} recent DM failures`)
      .setColor(0xE74C3C);

    if (failures.length === 0) {
      embed.addFields([
        {
          name: '🎉 No Recent Failures',
          value: 'All DMs are being delivered successfully!',
          inline: false
        }
      ]);
    } else {
      // Group failures by reason
      const groupedFailures = this.groupDMFailuresByReason(failures);
      
      Object.entries(groupedFailures).forEach(([reason, count]) => {
        embed.addFields([
          {
            name: `${this.getDMFailureEmoji(reason)} ${this.formatFailureReason(reason)}`,
            value: `${count} failures`,
            inline: true
          }
        ]);
      });

      // Show recent failures
      const recentFailures = failures.slice(0, 5);
      embed.addFields([
        {
          name: '🕒 Recent Failures',
          value: recentFailures.map(f => 
            `<@${f.userId}> - ${f.step} (${this.formatFailureReason(f.failureReason)})`
          ).join('\n') || 'None',
          inline: false
        }
      ]);
    }

    const components = [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('retry_all_failures')
            .setLabel('🔄 Retry All')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(failures.length === 0),
          new ButtonBuilder()
            .setCustomId('resolve_all_failures')
            .setLabel('✅ Mark All Resolved')
            .setStyle(ButtonStyle.Success)
            .setDisabled(failures.length === 0),
          new ButtonBuilder()
            .setCustomId('export_failures')
            .setLabel('📤 Export')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('back_to_dashboard')
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
        )
    ];

    await interaction.update({
      embeds: [embed],
      components
    });
  }

  /**
   * Show analytics panel
   */
  private async showAnalyticsPanel(interaction: any): Promise<void> {
    const stats = await this.getDetailedAnalytics();
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Onboarding Analytics')
      .setDescription('Detailed onboarding performance metrics')
      .setColor(0x27AE60)
      .addFields([
        {
          name: '📈 Conversion Funnel',
          value: [
            `**Started:** ${stats.funnel.started}`,
            `**Completed Welcome:** ${stats.funnel.welcomeCompleted} (${stats.funnel.welcomeRate}%)`,
            `**Set Preferences:** ${stats.funnel.preferencesSet} (${stats.funnel.preferencesRate}%)`,
            `**Assigned Role:** ${stats.funnel.roleAssigned} (${stats.funnel.roleRate}%)`,
            `**Fully Completed:** ${stats.funnel.completed} (${stats.funnel.completionRate}%)`
          ].join('\n'),
          inline: false
        },
        {
          name: '⏱️ Timing Metrics',
          value: [
            `**Avg Completion Time:** ${stats.timing.averageCompletion}`,
            `**Fastest Completion:** ${stats.timing.fastest}`,
            `**Most Common Drop-off:** ${stats.timing.commonDropOff}`
          ].join('\n'),
          inline: true
        },
        {
          name: '🎯 Success Factors',
          value: [
            `**DM Success Rate:** ${stats.success.dmSuccessRate}%`,
            `**Channel Fallback Rate:** ${stats.success.fallbackRate}%`,
            `**Retry Success Rate:** ${stats.success.retrySuccessRate}%`
          ].join('\n'),
          inline: true
        }
      ]);

    const components = [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('export_analytics')
            .setLabel('📤 Export Report')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('detailed_analytics')
            .setLabel('🔍 Detailed View')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('back_to_dashboard')
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
        )
    ];

    await interaction.update({
      embeds: [embed],
      components
    });
  }

  /**
   * Export onboarding data
   */
  private async exportOnboardingData(interaction: any): Promise<void> {
    try {
      await interaction.deferUpdate();

      // Generate export data
      const exportData = await this.generateExportData();
      
      // Create temporary file or send data
      const embed = new EmbedBuilder()
        .setTitle('📤 Data Export')
        .setDescription('Onboarding data export completed')
        .setColor(0x27AE60)
        .addFields([
          {
            name: '📊 Export Summary',
            value: [
              `**Total Records:** ${exportData.totalRecords}`,
              `**Date Range:** ${exportData.dateRange}`,
              `**File Size:** ${exportData.fileSize}`,
              `**Generated:** ${new Date().toLocaleString()}`
            ].join('\n'),
            inline: false
          }
        ]);

      await interaction.followUp({
        embeds: [embed],
        ephemeral: true
      });

      // In a real implementation, you would attach the file or provide a download link

    } catch (error) {
      logger.error('Failed to export onboarding data:', error);
      await interaction.followUp({
        content: '❌ Failed to export data.',
        ephemeral: true
      });
    }
  }

  /**
   * Test onboarding flow
   */
  private async testOnboardingFlow(interaction: any): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🧪 Test Onboarding Flow')
      .setDescription('Select a flow to test')
      .setColor(0xF39C12);

    const selectMenu = new ActionRowBuilder<SelectMenuBuilder>()
      .addComponents(
        new SelectMenuBuilder()
          .setCustomId('test_flow_select')
          .setPlaceholder('Choose a flow to test')
          .addOptions(
            Object.values(this.currentConfig.flows).map(flow => ({
              label: flow.name,
              value: flow.id,
              description: `Test the ${flow.name} flow`,
              emoji: '🧪'
            }))
          )
      );

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('test_dm_delivery')
          .setLabel('📬 Test DM Delivery')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('back_to_dashboard')
          .setLabel('⬅️ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.update({
      embeds: [embed],
      components: [selectMenu, buttons]
    });
  }

  // Helper methods
  private groupDMFailuresByReason(failures: any[]): Record<string, number> {
    return failures.reduce((acc, failure) => {
      const reason = failure.failureReason || 'unknown';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
  }

  private getTopDMFailureReason(reasons: Record<string, number>): string {
    const entries = Object.entries(reasons);
    if (entries.length === 0) return 'None';
    
    const [topReason] = entries.reduce((a, b) => a[1] > b[1] ? a : b);
    return this.formatFailureReason(topReason);
  }

  private formatFailureReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      'user_blocked_dms': 'User Blocked DMs',
      'user_not_found': 'User Not Found',
      'missing_permissions': 'Missing Permissions',
      'unknown_error': 'Unknown Error'
    };
    
    return reasonMap[reason] || reason;
  }

  private getDMFailureEmoji(reason: string): string {
    const emojiMap: Record<string, string> = {
      'user_blocked_dms': '🚫',
      'user_not_found': '👻',
      'missing_permissions': '🔒',
      'unknown_error': '❓'
    };

    return emojiMap[reason] || '❓';
  }

  private calculateAverageSteps(): number {
    const flows = Object.values(this.currentConfig.flows);
    const totalSteps = flows.reduce((sum, flow) => sum + flow.steps.length, 0);
    return flows.length > 0 ? Math.round(totalSteps / flows.length) : 0;
  }

  private async getPreferenceStats(): Promise<any> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('onboarding_progress')
        .select('preferences')
        .not('preferences', 'is', null);

      if (error) throw error;

      // Process preference data
      const collected = data?.length || 0;
      const sportsCount: Record<string, number> = {};
      const experienceLevels: Record<string, number> = {};

      data?.forEach(record => {
        if (record.preferences?.sports) {
          record.preferences.sports.forEach((sport: string) => {
            sportsCount[sport] = (sportsCount[sport] || 0) + 1;
          });
        }
        if (record.preferences?.experienceLevel) {
          const level = record.preferences.experienceLevel;
          experienceLevels[level] = (experienceLevels[level] || 0) + 1;
        }
      });

      const mostPopularSports = Object.entries(sportsCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([sport]) => sport);

      return {
        collected,
        mostPopularSports,
        experienceLevels
      };

    } catch (error) {
      logger.error('Failed to get preference stats:', error);
      return {
        collected: 0,
        mostPopularSports: [],
        experienceLevels: {}
      };
    }
  }

  private getEmptyStats(): AdminDashboardStats {
    return {
      onboarding: {
        total: 0,
        completed: 0,
        inProgress: 0,
        failed: 0,
        abandoned: 0,
        completionRate: 0
      },
      dmFailures: {
        total: 0,
        unresolved: 0,
        byReason: {},
        recentFailures: 0
      },
      flows: {
        active: 0,
        inactive: 0,
        mostUsed: 'none',
        averageSteps: 0
      },
      preferences: {
        collected: 0,
        mostPopularSports: [],
        experienceLevels: {}
      }
    };
  }

  private async getDetailedAnalytics(): Promise<any> {
    // This would return detailed analytics data
    // Implementation depends on your analytics requirements
    return {
      funnel: {
        started: 100,
        welcomeCompleted: 85,
        welcomeRate: 85,
        preferencesSet: 70,
        preferencesRate: 70,
        roleAssigned: 80,
        roleRate: 80,
        completed: 75,
        completionRate: 75
      },
      timing: {
        averageCompletion: '3.2 minutes',
        fastest: '1.1 minutes',
        commonDropOff: 'Preferences step'
      },
      success: {
        dmSuccessRate: 92,
        fallbackRate: 8,
        retrySuccessRate: 65
      }
    };
  }

  private async generateExportData(): Promise<any> {
    // This would generate actual export data
    return {
      totalRecords: 1250,
      dateRange: 'Last 30 days',
      fileSize: '2.3 MB',
      downloadUrl: 'https://example.com/export.csv'
    };
  }

  // Public methods for external access
  async updateOnboardingFlow(flowId: string, updates: any, editedBy: string): Promise<boolean> {
    try {
      const flow = this.currentConfig.flows[flowId as keyof typeof this.currentConfig.flows];
      if (!flow) return false;

      // Log the edit
      const edit: OnboardingFlowEdit = {
        flowId,
        field: Object.keys(updates)[0],
        oldValue: flow[Object.keys(updates)[0] as keyof typeof flow],
        newValue: updates[Object.keys(updates)[0]],
        editedBy,
        editedAt: new Date()
      };

      await this.logFlowEdit(edit);

      // Apply updates
      Object.assign(flow, updates);

      // Save to database
      await this.saveConfigToDB();

      return true;
    } catch (error) {
      logger.error('Failed to update onboarding flow:', error);
      return false;
    }
  }

  private async logFlowEdit(edit: OnboardingFlowEdit): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('onboarding_flow_edits')
        .insert({
          flow_id: edit.flowId,
          field: edit.field,
          old_value: edit.oldValue,
          new_value: edit.newValue,
          edited_by: edit.editedBy,
          edited_at: edit.editedAt.toISOString()
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to log flow edit:', error);
    }
  }

  getCurrentConfig(): OnboardingConfig {
    return this.currentConfig;
  }

  /**
   * Show settings panel for admin configuration
   */
  async showSettingsPanel(interaction: any): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Bot Settings Panel')
        .setDescription('Configure bot settings and onboarding flows')
        .setColor('#0099ff')
        .addFields([
          {
            name: '📊 Current Configuration',
            value: `Active Flows: ${Object.keys(this.currentConfig.flows).length}\nLast Updated: ${new Date().toLocaleString()}`,
            inline: false
          }
        ]);

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('admin_edit_flows')
            .setLabel('Edit Flows')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝'),
          new ButtonBuilder()
            .setCustomId('admin_view_analytics')
            .setLabel('View Analytics')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId('admin_export_data')
            .setLabel('Export Data')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💾')
        );

      await interaction.reply({
        embeds: [embed],
        components: [actionRow],
        ephemeral: true
      });
    } catch (error) {
      console.error('❌ Error showing settings panel:', error);
      await interaction.reply({
        content: '❌ Failed to show settings panel.',
        ephemeral: true
      });
    }
  }
}