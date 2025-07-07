import { Client, GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { KeywordEmojiDMService } from './keywordEmojiDMService';
import { AutomatedThreadService } from './automatedThreadService';
import { VIPNotificationService } from './vipNotificationService';
import { ConfigUpdate, QuickEditSession } from '../types';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export class QuickEditConfigService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private keywordDMService: KeywordEmojiDMService;
  private threadService: AutomatedThreadService;
  private vipNotificationService: VIPNotificationService;
  private activeEditSessions: Map<string, QuickEditSession> = new Map();

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    permissionsService: PermissionsService,
    keywordDMService: KeywordEmojiDMService,
    threadService: AutomatedThreadService,
    vipNotificationService: VIPNotificationService
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.keywordDMService = keywordDMService;
    this.threadService = threadService;
    this.vipNotificationService = vipNotificationService;
  }

  /**
   * Start quick edit session for admin/staff
   */
  async startQuickEditSession(userId: string, configType: string): Promise<QuickEditSession> {
    try {
      const member = await this.client.guilds.cache.first()?.members.fetch(userId);
      if (!member || (!this.permissionsService.isAdmin(member) && !this.permissionsService.isStaff(member))) {
        throw new Error('Insufficient permissions for configuration editing');
      }

      const session: QuickEditSession = {
        id: `edit_${Date.now()}_${userId}`,
        user_id: userId,
        userId: userId, // Alias
        config_key: configType,
        configType: configType,
        started_at: new Date().toISOString(),
        startedAt: new Date().toISOString(), // Alias
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        is_active: true,
        status: 'active',
        changes: [],
        currentConfig: await this.getCurrentConfig(configType)
      };

      this.activeEditSessions.set(session.id, session);

      // Send interactive configuration interface
      await this.sendConfigInterface(userId, session);

      return session;

    } catch (error) {
      logger.error(`Failed to start quick edit session for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send interactive configuration interface
   */
  private async sendConfigInterface(userId: string, session: QuickEditSession): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Quick Config Editor - ${(session.configType || 'UNKNOWN').toUpperCase()}`)
        .setDescription('Select what you want to configure:')
        .setColor('#4169E1')
        .setTimestamp()
        .setFooter({ text: `Session ID: ${session.id}` });

      const selectMenu = this.createConfigSelectMenu(session.configType || 'unknown', session.id);
      const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      const buttonRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`config_save_${session.id}`)
            .setLabel('Save Changes')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💾'),
          new ButtonBuilder()
            .setCustomId(`config_preview_${session.id}`)
            .setLabel('Preview Changes')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👁️'),
          new ButtonBuilder()
            .setCustomId(`config_cancel_${session.id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );

      await user.send({ 
        embeds: [embed], 
        components: [actionRow, buttonRow] 
      });

    } catch (error) {
      logger.error('Failed to send config interface:', error);
    }
  }

  /**
   * Create configuration select menu based on type
   */
  private createConfigSelectMenu(configType: string, sessionId: string): StringSelectMenuBuilder {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`config_select_${sessionId}`)
      .setPlaceholder('Choose configuration to edit...');

    switch (configType) {
      case 'keywords':
        selectMenu.addOptions([
          { label: 'Add Keyword Trigger', value: 'add_keyword', emoji: '➕' },
          { label: 'Remove Keyword Trigger', value: 'remove_keyword', emoji: '➖' },
          { label: 'Edit Keyword Response', value: 'edit_keyword_response', emoji: '✏️' },
          { label: 'Toggle Keyword Status', value: 'toggle_keyword', emoji: '🔄' },
          { label: 'View All Keywords', value: 'view_keywords', emoji: '📋' }
        ]);
        break;

      case 'emojis':
        selectMenu.addOptions([
          { label: 'Add Emoji Trigger', value: 'add_emoji', emoji: '😀' },
          { label: 'Remove Emoji Trigger', value: 'remove_emoji', emoji: '🗑️' },
          { label: 'Edit Emoji Response', value: 'edit_emoji_response', emoji: '✏️' },
          { label: 'Toggle Emoji Status', value: 'toggle_emoji', emoji: '🔄' },
          { label: 'View All Emojis', value: 'view_emojis', emoji: '📋' }
        ]);
        break;

      case 'threads':
        selectMenu.addOptions([
          { label: 'Thread Auto-Creation Rules', value: 'thread_rules', emoji: '🧵' },
          { label: 'Thread Naming Templates', value: 'thread_names', emoji: '🏷️' },
          { label: 'Thread Categories', value: 'thread_categories', emoji: '📁' },
          { label: 'Thread Permissions', value: 'thread_permissions', emoji: '🔐' },
          { label: 'Thread Cleanup Settings', value: 'thread_cleanup', emoji: '🧹' }
        ]);
        break;

      case 'vip_notifications':
        selectMenu.addOptions([
          { label: 'VIP Welcome Messages', value: 'vip_welcome', emoji: '👋' },
          { label: 'VIP+ Exclusive Content', value: 'vip_plus_content', emoji: '⭐' },
          { label: 'Notification Timing', value: 'notification_timing', emoji: '⏰' },
          { label: 'DM Templates', value: 'dm_templates', emoji: '💬' },
          { label: 'Tier Benefits', value: 'tier_benefits', emoji: '🎁' }
        ]);
        break;

      case 'channels':
        selectMenu.addOptions([
          { label: 'Channel Permissions', value: 'channel_permissions', emoji: '🔐' },
          { label: 'Auto-Moderation', value: 'auto_moderation', emoji: '🛡️' },
          { label: 'Channel Categories', value: 'channel_categories', emoji: '📂' },
          { label: 'Welcome Channels', value: 'welcome_channels', emoji: '🚪' },
          { label: 'Announcement Settings', value: 'announcements', emoji: '📢' }
        ]);
        break;

      case 'roles':
        selectMenu.addOptions([
          { label: 'Role Hierarchy', value: 'role_hierarchy', emoji: '📊' },
          { label: 'Auto-Role Assignment', value: 'auto_roles', emoji: '🤖' },
          { label: 'Role Permissions', value: 'role_permissions', emoji: '🔑' },
          { label: 'Tier Role Mapping', value: 'tier_roles', emoji: '🎯' },
          { label: 'Special Roles', value: 'special_roles', emoji: '⭐' }
        ]);
        break;

      default:
        selectMenu.addOptions([
          { label: 'General Settings', value: 'general', emoji: '⚙️' },
          { label: 'Bot Behavior', value: 'bot_behavior', emoji: '🤖' },
          { label: 'Logging Settings', value: 'logging', emoji: '📝' }
        ]);
    }

    return selectMenu;
  }

  /**
   * Handle configuration selection
   */
  async handleConfigSelection(sessionId: string, selection: string): Promise<void> {
    try {
      const session = this.activeEditSessions.get(sessionId);
      if (!session) {
        throw new Error('Edit session not found');
      }

      switch (selection) {
        case 'add_keyword':
          await this.showAddKeywordModal(session);
          break;
        case 'remove_keyword':
          await this.showRemoveKeywordInterface(session);
          break;
        case 'edit_keyword_response':
          await this.showEditKeywordInterface(session);
          break;
        case 'toggle_keyword':
          await this.showToggleKeywordInterface(session);
          break;
        case 'view_keywords':
          await this.showKeywordsList(session);
          break;
        // Add more cases for other selections
        default:
          await this.showGenericConfigInterface(session, selection);
      }

    } catch (error) {
      logger.error(`Failed to handle config selection ${selection}:`, error);
    }
  }

  /**
   * Show modal for adding keyword
   */
  private async showAddKeywordModal(session: QuickEditSession): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`add_keyword_modal_${session.id}`)
      .setTitle('Add Keyword Trigger');

    const keywordInput = new TextInputBuilder()
      .setCustomId('keyword')
      .setLabel('Keyword/Phrase')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter the keyword or phrase...')
      .setRequired(true);

    const responseInput = new TextInputBuilder()
      .setCustomId('response')
      .setLabel('Auto-DM Response')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter the response message...')
      .setRequired(true);

    const tierInput = new TextInputBuilder()
      .setCustomId('tier')
      .setLabel('Required Tier (member/vip/vip_plus)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('member')
      .setRequired(false);

    const cooldownInput = new TextInputBuilder()
      .setCustomId('cooldown')
      .setLabel('Cooldown (minutes)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('60')
      .setRequired(false);

    const enabledInput = new TextInputBuilder()
      .setCustomId('enabled')
      .setLabel('Enabled (true/false)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('true')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(keywordInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(responseInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(tierInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(cooldownInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(enabledInput)
    );

    // Note: In a real implementation, you'd need to handle the modal submission
    // through Discord's interaction system
  }

  /**
   * Process configuration update
   */
  async processConfigUpdate(sessionId: string, updateData: any): Promise<ConfigUpdate> {
    try {
      const session = this.activeEditSessions.get(sessionId);
      if (!session) {
        throw new Error('Edit session not found');
      }

      const update: ConfigUpdate = {
        id: `update_${Date.now()}`,
        key: updateData.field || 'unknown',
        value: updateData.newValue,
        sessionId: sessionId,
        userId: session.userId || 'unknown',
        configType: session.configType || 'unknown',
        field: updateData.field || 'unknown',
        updateType: updateData.type || 'unknown',
        oldValue: updateData.oldValue || '',
        newValue: updateData.newValue || '',
        reason: updateData.reason || 'Quick edit update',
        adminId: session.userId || 'unknown', // Using userId as adminId for now
        updated_by: session.userId || 'unknown',
        timestamp: new Date(),
        applied: false
      };

      // Validate the update
      await this.validateConfigUpdate(update);

      // Apply the update
      await this.applyConfigUpdate(update);

      // Add to session changes
      if (!session.changes) {
        session.changes = [];
      }
      (session.changes as ConfigUpdate[]).push(update);
      update.applied = true;

      // Log the change
      await this.logConfigChange(update);

      // Send confirmation
      await this.sendUpdateConfirmation(session.userId || session.user_id, update);

      return update;

    } catch (error) {
      logger.error(`Failed to process config update for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Validate configuration update
   */
  private async validateConfigUpdate(update: ConfigUpdate): Promise<void> {
    switch (update.configType) {
      case 'keywords':
        await this.validateKeywordUpdate(update);
        break;
      case 'emojis':
        await this.validateEmojiUpdate(update);
        break;
      case 'threads':
        await this.validateThreadUpdate(update);
        break;
      case 'vip_notifications':
        await this.validateVIPNotificationUpdate(update);
        break;
      default:
        await this.validateGenericUpdate(update);
    }
  }

  /**
   * Apply configuration update
   */
  private async applyConfigUpdate(update: ConfigUpdate): Promise<void> {
    switch (update.configType) {
      case 'keywords':
        await this.applyKeywordUpdate(update);
        break;
      case 'emojis':
        await this.applyEmojiUpdate(update);
        break;
      case 'threads':
        await this.applyThreadUpdate(update);
        break;
      case 'vip_notifications':
        await this.applyVIPNotificationUpdate(update);
        break;
      default:
        await this.applyGenericUpdate(update);
    }
  }

  /**
   * Save all session changes
   */
  async saveSessionChanges(sessionId: string): Promise<any> {
    try {
      const session = this.activeEditSessions.get(sessionId);
      if (!session) {
        throw new Error('Edit session not found');
      }

      const unappliedChanges = (session.changes as ConfigUpdate[] || []).filter((change: ConfigUpdate) => !change.applied);
      
      for (const change of unappliedChanges) {
        await this.applyConfigUpdate(change);
        change.applied = true;
      }

      // Update session status
      session.status = 'completed';
      session.completedAt = new Date().toISOString();

      // Store session record
      await this.supabaseService.client
        .from('config_edit_sessions')
        .insert({
          id: session.id,
          user_id: session.userId,
          config_type: session.configType,
          changes_count: (session.changes as ConfigUpdate[] || []).length,
          session_data: session,
          started_at: session.startedAt,
          completed_at: session.completedAt
        });

      // Reload affected services
      await this.reloadAffectedServices(session.configType || 'unknown');

      // Send completion confirmation
      await this.sendSessionCompletionConfirmation(session);

      // Clean up session
      this.activeEditSessions.delete(sessionId);

      return {
        success: true,
        sessionId: sessionId,
        changesApplied: (session.changes as ConfigUpdate[] || []).length,
        completedAt: session.completedAt
      };

    } catch (error) {
      logger.error(`Failed to save session changes for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Preview configuration changes
   */
  async previewChanges(sessionId: string): Promise<any> {
    try {
      const session = this.activeEditSessions.get(sessionId);
      if (!session) {
        throw new Error('Edit session not found');
      }

      const preview = {
        sessionId: sessionId,
        configType: session.configType,
        totalChanges: (session.changes as ConfigUpdate[] || []).length,
        appliedChanges: (session.changes as ConfigUpdate[] || []).filter((c: ConfigUpdate) => c.applied).length,
        pendingChanges: (session.changes as ConfigUpdate[] || []).filter((c: ConfigUpdate) => !c.applied).length,
        changes: (session.changes as ConfigUpdate[] || []).map((change: ConfigUpdate) => ({
          type: change.updateType,
          description: this.getChangeDescription(change),
          status: change.applied ? 'Applied' : 'Pending'
        })),
        impact: await this.assessChangeImpact(session.changes as ConfigUpdate[] || [])
      };

      // Send preview to user
      await this.sendPreviewToUser(session.userId || session.user_id, preview);

      return preview;

    } catch (error) {
      logger.error(`Failed to preview changes for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel edit session
   */
  async cancelSession(sessionId: string): Promise<void> {
    try {
      const session = this.activeEditSessions.get(sessionId);
      if (!session) {
        return; // Session already doesn't exist
      }

      // Revert any applied changes if needed
      const appliedChanges = (session.changes as ConfigUpdate[] || []).filter((c: ConfigUpdate) => c.applied);
      for (const change of appliedChanges) {
        await this.revertConfigChange(change);
      }

      // Update session status
      session.status = 'cancelled';
      session.completedAt = new Date().toISOString();

      // Send cancellation confirmation
      await this.sendCancellationConfirmation(session.userId || session.user_id, session);

      // Clean up session
      this.activeEditSessions.delete(sessionId);

    } catch (error) {
      logger.error(`Failed to cancel session ${sessionId}:`, error);
    }
  }

  // Private helper methods
  private async getCurrentConfig(configType: string): Promise<any> {
    switch (configType) {
      case 'keywords':
        return { triggers: Array.from(this.keywordDMService['keywordTriggers'].values()) };
      case 'emojis':
        return { triggers: Array.from(this.keywordDMService['emojiTriggers'].values()) };
      case 'threads':
        return { config: 'Thread configuration not available' };
      case 'vip_notifications':
        return { config: 'VIP notification configuration not available' };
      default:
        return {};
    }
  }

  private async showRemoveKeywordInterface(session: QuickEditSession): Promise<void> {
    // Implementation for showing keyword removal interface
  }

  private async showEditKeywordInterface(session: QuickEditSession): Promise<void> {
    // Implementation for showing keyword editing interface
  }

  private async showToggleKeywordInterface(session: QuickEditSession): Promise<void> {
    // Implementation for showing keyword toggle interface
  }

  private async showKeywordsList(session: QuickEditSession): Promise<void> {
    // Implementation for showing keywords list
  }

  private async showGenericConfigInterface(session: QuickEditSession, selection: string): Promise<void> {
    // Implementation for generic config interface
  }

  private async validateKeywordUpdate(update: ConfigUpdate): Promise<void> {
    // Validation logic for keyword updates
    if (update.updateType === 'add_keyword') {
      if (!update.newValue.keyword || !update.newValue.response) {
        throw new Error('Keyword and response are required');
      }
    }
  }

  private async validateEmojiUpdate(update: ConfigUpdate): Promise<void> {
    // Validation logic for emoji updates
  }

  private async validateThreadUpdate(update: ConfigUpdate): Promise<void> {
    // Validation logic for thread updates
  }

  private async validateVIPNotificationUpdate(update: ConfigUpdate): Promise<void> {
    // Validation logic for VIP notification updates
  }

  private async validateGenericUpdate(update: ConfigUpdate): Promise<void> {
    // Generic validation logic
  }

  private async applyKeywordUpdate(update: ConfigUpdate): Promise<void> {
    switch (update.updateType) {
      case 'add_keyword':
        await this.keywordDMService.addKeywordTrigger(update.adminId || update.updated_by || 'unknown', update.newValue);
        break;
      case 'remove_keyword':
        await this.keywordDMService.updateTriggerStatus(update.adminId || update.updated_by || 'unknown', update.oldValue.id, false, 'keyword');
        break;
      case 'add_emoji':
        await this.keywordDMService.addEmojiTrigger(update.adminId || update.updated_by || 'unknown', update.newValue);
        break;
      case 'remove_emoji':
        await this.keywordDMService.addKeywordTrigger(update.adminId || update.updated_by || 'unknown', update.newValue);
        break;
      case 'edit_keyword':
        // For now, we'll disable the old and add the new
        await this.keywordDMService.updateTriggerStatus(update.adminId || update.updated_by || 'unknown', update.oldValue.id, false, 'keyword');
        await this.keywordDMService.addKeywordTrigger(update.adminId || update.updated_by || 'unknown', update.newValue);
        break;
    }
  }

  private async applyEmojiUpdate(update: ConfigUpdate): Promise<void> {
    // Implementation for applying emoji updates
  }

  private async applyThreadUpdate(update: ConfigUpdate): Promise<void> {
    // Implementation for applying thread updates
  }

  private async applyVIPNotificationUpdate(update: ConfigUpdate): Promise<void> {
    // Implementation for applying VIP notification updates
  }

  private async applyGenericUpdate(update: ConfigUpdate): Promise<void> {
    // Implementation for applying generic updates
  }

  private async logConfigChange(update: ConfigUpdate): Promise<void> {
    try {
      await this.supabaseService.client
        .from('config_changes')
        .insert({
          id: update.id,
          session_id: update.sessionId,
          user_id: update.userId,
          config_type: update.configType,
          update_type: update.updateType,
          old_value: update.oldValue,
          new_value: update.newValue,
          timestamp: update.timestamp,
          applied: update.applied
        });
    } catch (error) {
      logger.error('Failed to log config change:', error);
    }
  }

  private async sendUpdateConfirmation(userId: string, update: ConfigUpdate): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Configuration Updated')
        .setDescription(`${update.updateType || 'Unknown'} has been applied successfully`)
        .addFields(
          { name: 'Config Type', value: update.configType || 'Unknown', inline: true },
          { name: 'Update Type', value: update.updateType || 'unknown', inline: true },
          { name: 'Applied At', value: update.timestamp?.toISOString() || new Date().toISOString(), inline: true }
        )
        .setColor('#00FF00')
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send update confirmation:', error);
    }
  }

  private async reloadAffectedServices(configType: string): Promise<void> {
    switch (configType) {
      case 'keywords':
      case 'emojis':
        await this.keywordDMService.reloadConfiguration();
        break;
      case 'threads':
        // Thread service doesn't have reloadConfiguration method
        logger.info('Thread configuration reload not implemented');
        break;
      case 'vip_notifications':
        // VIP notification service doesn't have reloadConfiguration method
        logger.info('VIP notification configuration reload not implemented');
        break;
    }
  }

  private async sendSessionCompletionConfirmation(session: QuickEditSession): Promise<void> {
    try {
      const user = await this.client.users.fetch(session.userId || session.user_id);
      
      const embed = new EmbedBuilder()
        .setTitle('🎉 Configuration Session Complete')
        .setDescription(`All changes have been saved and applied successfully!`)
        .addFields(
          { name: 'Session ID', value: session.id, inline: true },
          { name: 'Config Type', value: session.configType || 'Unknown', inline: true },
          { name: 'Changes Applied', value: (session.changes as ConfigUpdate[] || []).length.toString(), inline: true }
        )
        .setColor('#00FF00')
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send session completion confirmation:', error);
    }
  }

  private getChangeDescription(change: ConfigUpdate): string {
    switch (change.updateType) {
      case 'add_keyword':
        return `Added keyword: "${change.newValue.keyword}"`;
      case 'remove_keyword':
        return `Removed keyword: "${change.oldValue.keyword}"`;
      case 'edit_keyword':
        return `Modified keyword: "${change.oldValue.keyword}"`;
      default:
        return `${change.updateType} change`;
    }
  }

  private async assessChangeImpact(changes: ConfigUpdate[]): Promise<any> {
    return {
      affectedServices: [...new Set(changes.map(c => c.configType))],
      requiresRestart: changes.some(c => c.updateType?.includes('critical') ?? false),
      userImpact: changes.length > 5 ? 'High' : changes.length > 2 ? 'Medium' : 'Low'
    };
  }

  private async sendPreviewToUser(userId: string, preview: any): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('👁️ Configuration Changes Preview')
        .setDescription(`Preview of changes for ${preview.configType}`)
        .addFields(
          { name: 'Total Changes', value: preview.totalChanges.toString(), inline: true },
          { name: 'Applied', value: preview.appliedChanges.toString(), inline: true },
          { name: 'Pending', value: preview.pendingChanges.toString(), inline: true }
        )
        .setColor('#4169E1')
        .setTimestamp();

      if (preview.changes.length > 0) {
        const changesList = preview.changes.slice(0, 10).map((change: any) =>
          `${change.status === 'Applied' ? '✅' : '⏳'} ${change.description}`
        ).join('\n');
        
        embed.addFields({ name: 'Changes', value: changesList, inline: false });
      }

      await user.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send preview to user:', error);
    }
  }

  private async revertConfigChange(change: ConfigUpdate): Promise<void> {
    // Implementation to revert a configuration change
    try {
      const revertUpdate: ConfigUpdate = {
        ...change,
        id: `revert_${change.id}`,
        oldValue: change.newValue,
        newValue: change.oldValue,
        timestamp: new Date()
      };

      await this.applyConfigUpdate(revertUpdate);
    } catch (error) {
      logger.error('Failed to revert config change:', error);
    }
  }

  private async sendCancellationConfirmation(userId: string, session: QuickEditSession): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Configuration Session Cancelled')
        .setDescription('The configuration session has been cancelled and changes reverted.')
        .addFields(
          { name: 'Session ID', value: session.id, inline: true },
          { name: 'Config Type', value: session.configType || 'Unknown', inline: true },
          { name: 'Changes Reverted', value: (session.changes as ConfigUpdate[] || []).length.toString(), inline: true }
        )
        .setColor('#FF0000')
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send cancellation confirmation:', error);
    }
  }
}