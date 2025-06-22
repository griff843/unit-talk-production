import { Client, GuildMember, Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { KeywordTrigger, EmojiTrigger, AutoDMTemplate, TriggerCondition } from '../types';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export class KeywordEmojiDMService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private keywordTriggers: Map<string, KeywordTrigger> = new Map();
  private emojiTriggers: Map<string, EmojiTrigger> = new Map();
  private dmTemplates: Map<string, AutoDMTemplate> = new Map();
  private userCooldowns: Map<string, Map<string, number>> = new Map();

  constructor(client: Client, supabaseService: SupabaseService, permissionsService: PermissionsService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.loadTriggers();
    this.loadTemplates();
  }

  /**
   * Load keyword and emoji triggers from database
   */
  async loadTriggers(): Promise<void> {
    try {
      // Load keyword triggers
      const { data: keywordTriggers } = await this.supabaseService.client
        .from('keyword_triggers')
        .select('*')
        .eq('is_active', true);

      if (keywordTriggers) {
        this.keywordTriggers.clear();
        keywordTriggers.forEach(trigger => {
          this.keywordTriggers.set(trigger.id, trigger as KeywordTrigger);
        });
      }

      // Load emoji triggers
      const { data: emojiTriggers } = await this.supabaseService.client
        .from('emoji_triggers')
        .select('*')
        .eq('is_active', true);

      if (emojiTriggers) {
        this.emojiTriggers.clear();
        emojiTriggers.forEach(trigger => {
          this.emojiTriggers.set(trigger.id, trigger as EmojiTrigger);
        });
      }

      logger.info(`Loaded ${keywordTriggers?.length || 0} keyword triggers and ${emojiTriggers?.length || 0} emoji triggers`);
    } catch (error) {
      logger.error('Failed to load triggers:', error);
    }
  }

  /**
   * Load DM templates from database
   */
  private async loadTemplates(): Promise<void> {
    try {
      const { data: templates } = await this.supabaseService.client
        .from('auto_dm_templates')
        .select('*')
        .eq('is_active', true);

      if (templates) {
        this.dmTemplates.clear();
        templates.forEach(template => {
          this.dmTemplates.set(template.id, template as AutoDMTemplate);
        });
        logger.info(`Loaded ${templates.length} DM templates`);
      }
    } catch (error) {
      logger.error('Failed to load DM templates:', error);
    }
  }

  /**
   * Process message for keyword triggers
   */
  async processMessageForKeywords(message: Message): Promise<void> {
    if (message.author.bot) return;

    try {
      const member = message.member;
      if (!member) return;

      const messageContent = message.content.toLowerCase();
      const userTier = this.permissionsService.getUserTier(member);

      for (const [triggerId, trigger] of this.keywordTriggers) {
        if (this.shouldProcessTrigger(trigger, userTier, member)) {
          const keywords = trigger.keywords.map(k => k.toLowerCase());
          const matchedKeyword = keywords.find(keyword => {
            if (trigger.matchType === 'exact') {
              return messageContent === keyword;
            } else if (trigger.matchType === 'partial') {
              return messageContent.includes(keyword);
            } else if (trigger.matchType === 'regex') {
              try {
                const regex = new RegExp(keyword, 'i');
                return regex.test(messageContent);
              } catch (error) {
                logger.error(`Invalid regex pattern: ${keyword}`, error);
                return false;
              }
            }
            return false;
          });

          if (matchedKeyword) {
            await this.handleKeywordTrigger(trigger, member, message, matchedKeyword);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process message for keywords:', error);
    }
  }

  /**
   * Process reaction for emoji triggers
   */
  async processReactionForEmojis(reaction: any, user: any): Promise<void> {
    if (user.bot) return;

    try {
      const guild = reaction.message.guild;
      if (!guild) return;

      const member = await guild.members.fetch(user.id);
      if (!member) return;

      const userTier = this.permissionsService.getUserTier(member);
      const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;

      for (const [triggerId, trigger] of this.emojiTriggers) {
        if (this.shouldProcessTrigger(trigger, userTier, member)) {
          if (trigger.emoji === emojiIdentifier) {
            await this.handleEmojiTrigger(trigger, member, reaction, emojiIdentifier);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process reaction for emojis:', error);
    }
  }

  /**
   * Handle keyword trigger activation
   */
  private async handleKeywordTrigger(
    trigger: KeywordTrigger, 
    member: GuildMember, 
    message: Message, 
    matchedKeyword: string
  ): Promise<void> {
    try {
      // Check cooldown
      if (this.isOnCooldown(member.id, trigger.id)) {
        logger.debug(`User ${member.id} is on cooldown for trigger ${trigger.id}`);
        return;
      }

      // Get template
      const template = this.dmTemplates.get(trigger.templateId);
      if (!template) {
        logger.error(`Template not found for trigger ${trigger.id}`);
        return;
      }

      // Process template variables
      const processedContent = this.processTemplateVariables(template.content, {
        username: member.displayName,
        keyword: matchedKeyword,
        channel: message.channel.toString(),
        tier: this.permissionsService.getUserTier(member),
        timestamp: new Date().toLocaleString()
      });

      // Create DM content
      const dmContent = this.createDMContent(template, processedContent, trigger);

      // Send DM
      await this.sendDMToUser(member.id, dmContent);

      // Set cooldown
      this.setCooldown(member.id, trigger.id, trigger.cooldownMinutes);

      // Log trigger activation
      await this.logTriggerActivation(trigger.id, member.id, 'keyword', matchedKeyword);

      logger.info(`Keyword trigger "${trigger.name}" activated for user ${member.displayName}`);
    } catch (error) {
      logger.error(`Failed to handle keyword trigger for ${member.id}:`, error);
    }
  }

  /**
   * Handle emoji trigger activation
   */
  private async handleEmojiTrigger(
    trigger: EmojiTrigger, 
    member: GuildMember, 
    reaction: any, 
    emojiIdentifier: string
  ): Promise<void> {
    try {
      // Check cooldown
      if (this.isOnCooldown(member.id, trigger.id)) {
        return;
      }

      // Get template
      const template = this.dmTemplates.get(trigger.templateId);
      if (!template) {
        logger.error(`Template not found for emoji trigger ${trigger.id}`);
        return;
      }

      // Process template variables
      const processedContent = this.processTemplateVariables(template.content, {
        username: member.displayName,
        emoji: emojiIdentifier,
        channel: reaction.message.channel.toString(),
        tier: this.permissionsService.getUserTier(member),
        timestamp: new Date().toLocaleString()
      });

      // Create DM content
      const dmContent = this.createDMContent(template, processedContent, trigger);

      // Send DM
      await this.sendDMToUser(member.id, dmContent);

      // Set cooldown
      this.setCooldown(member.id, trigger.id, trigger.cooldownMinutes);

      // Log trigger activation
      await this.logTriggerActivation(trigger.id, member.id, 'emoji', emojiIdentifier);

      logger.info(`Emoji trigger "${trigger.name}" activated for user ${member.displayName}`);
    } catch (error) {
      logger.error(`Failed to handle emoji trigger for ${member.id}:`, error);
    }
  }

  /**
   * Admin tool: Add new keyword trigger
   */
  async addKeywordTrigger(adminId: string, triggerData: Partial<KeywordTrigger>): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('keyword_triggers')
        .insert({
          name: triggerData.name,
          description: triggerData.description,
          keywords: triggerData.keywords,
          match_type: triggerData.matchType || 'contains',
          template_id: triggerData.templateId,
          conditions: triggerData.conditions || {},
          cooldown_minutes: triggerData.cooldownMinutes || 60,
          priority: triggerData.priority || 'medium',
          is_active: true,
          created_by: adminId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Add to memory
      this.keywordTriggers.set(data.id, data as KeywordTrigger);
      
      logger.info(`Admin ${adminId} added keyword trigger: ${triggerData.name}`);
      return true;
    } catch (error) {
      logger.error('Failed to add keyword trigger:', error);
      return false;
    }
  }

  /**
   * Admin tool: Add new emoji trigger
   */
  async addEmojiTrigger(adminId: string, triggerData: Partial<EmojiTrigger>): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('emoji_triggers')
        .insert({
          name: triggerData.name,
          description: triggerData.description,
          emoji: triggerData.emoji,
          template_id: triggerData.templateId,
          conditions: triggerData.conditions || {},
          cooldown_minutes: triggerData.cooldownMinutes || 60,
          priority: triggerData.priority || 'medium',
          is_active: true,
          created_by: adminId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Add to memory
      this.emojiTriggers.set(data.id, data as EmojiTrigger);

      logger.info(`Admin ${adminId} added emoji trigger: ${triggerData.name}`);
      return true;
    } catch (error) {
      logger.error('Failed to add emoji trigger:', error);
      return false;
    }
  }

  /**
   * Admin tool: Add new DM template
   */
  async addDMTemplate(adminId: string, templateData: Partial<AutoDMTemplate>): Promise<string | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('auto_dm_templates')
        .insert({
          name: templateData.name,
          description: templateData.description,
          subject: templateData.subject,
          content: templateData.content,
          embed_data: templateData.embedData,
          components_data: templateData.componentsData,
          variables: templateData.variables || [],
          is_active: true,
          created_by: adminId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Add to memory
      this.dmTemplates.set(data.id, data as AutoDMTemplate);
      
      logger.info(`Admin ${adminId} added DM template: ${templateData.name}`);
      return data.id;
    } catch (error) {
      logger.error('Failed to add DM template:', error);
      return null;
    }
  }

  /**
   * Admin tool: Update trigger status
   */
  async updateTriggerStatus(adminId: string, triggerId: string, isActive: boolean, triggerType: 'keyword' | 'emoji'): Promise<boolean> {
    try {
      const table = triggerType === 'keyword' ? 'keyword_triggers' : 'emoji_triggers';
      
      const { error } = await this.supabaseService.client
        .from(table)
        .update({ 
          is_active: isActive,
          updated_by: adminId,
          updated_at: new Date().toISOString()
        })
        .eq('id', triggerId);

      if (error) throw error;

      // Update memory
      if (triggerType === 'keyword') {
        const trigger = this.keywordTriggers.get(triggerId);
        if (trigger) {
          trigger.isActive = isActive;
        }
      } else {
        const trigger = this.emojiTriggers.get(triggerId);
        if (trigger) {
          trigger.isActive = isActive;
        }
      }

      logger.info(`Admin ${adminId} ${isActive ? 'activated' : 'deactivated'} ${triggerType} trigger ${triggerId}`);
      return true;
    } catch (error) {
      logger.error('Failed to update trigger status:', error);
      return false;
    }
  }

  /**
   * Admin tool: Get trigger statistics
   */
  async getTriggerStatistics(): Promise<any> {
    try {
      const { data: stats } = await this.supabaseService.client
        .from('trigger_activation_logs')
        .select('trigger_id, trigger_type, COUNT(*) as activation_count')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      const keywordStats = stats?.filter((s: any) => s.trigger_type === 'keyword') || [];
      const emojiStats = stats?.filter((s: any) => s.trigger_type === 'emoji') || [];

      return {
        totalKeywordTriggers: this.keywordTriggers.size,
        totalEmojiTriggers: this.emojiTriggers.size,
        totalTemplates: this.dmTemplates.size,
        activationsLast30Days: {
          keyword: keywordStats.reduce((sum: number, s: any) => sum + s.activation_count, 0),
          emoji: emojiStats.reduce((sum: number, s: any) => sum + s.activation_count, 0)
        },
        topKeywordTriggers: keywordStats.sort((a: any, b: any) => b.activation_count - a.activation_count).slice(0, 5),
        topEmojiTriggers: emojiStats.sort((a: any, b: any) => b.activation_count - a.activation_count).slice(0, 5)
      };
    } catch (error) {
      logger.error('Failed to get trigger statistics:', error);
      return null;
    }
  }

  /**
   * Admin tool: Bulk import triggers from JSON
   */
  async bulkImportTriggers(adminId: string, triggersData: any): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      // Import keyword triggers
      if (triggersData.keywordTriggers) {
        for (const trigger of triggersData.keywordTriggers) {
          const result = await this.addKeywordTrigger(adminId, trigger);
          if (result) success++;
          else failed++;
        }
      }

      // Import emoji triggers
      if (triggersData.emojiTriggers) {
        for (const trigger of triggersData.emojiTriggers) {
          const result = await this.addEmojiTrigger(adminId, trigger);
          if (result) success++;
          else failed++;
        }
      }

      // Import templates
      if (triggersData.templates) {
        for (const template of triggersData.templates) {
          const result = await this.addDMTemplate(adminId, template);
          if (result) success++;
          else failed++;
        }
      }

      logger.info(`Bulk import completed: ${success} success, ${failed} failed`);
      return { success, failed };
    } catch (error) {
      logger.error('Failed to bulk import triggers:', error);
      return { success, failed };
    }
  }

  // Helper methods
  private shouldProcessTrigger(trigger: any, userTier: string, member: GuildMember): boolean {
    if (!trigger.isActive) return false;

    // Check tier conditions
    if (trigger.conditions.allowedTiers && !trigger.conditions.allowedTiers.includes(userTier)) {
      return false;
    }

    // Check channel conditions
    if (trigger.conditions.allowedChannels && trigger.conditions.allowedChannels.length > 0) {
      // This would need to be implemented based on the message context
      return true; // Simplified for now
    }

    // Check time conditions
    if (trigger.conditions.timeRestrictions) {
      const now = new Date();
      const hour = now.getHours();
      if (trigger.conditions.timeRestrictions.startHour && hour < trigger.conditions.timeRestrictions.startHour) {
        return false;
      }
      if (trigger.conditions.timeRestrictions.endHour && hour > trigger.conditions.timeRestrictions.endHour) {
        return false;
      }
    }

    return true;
  }

  private isOnCooldown(userId: string, triggerId: string): boolean {
    const userCooldowns = this.userCooldowns.get(userId);
    if (!userCooldowns) return false;

    const cooldownEnd = userCooldowns.get(triggerId);
    if (!cooldownEnd) return false;

    return Date.now() < cooldownEnd;
  }

  private setCooldown(userId: string, triggerId: string, cooldownMinutes: number): void {
    if (!this.userCooldowns.has(userId)) {
      this.userCooldowns.set(userId, new Map());
    }

    const cooldownEnd = Date.now() + (cooldownMinutes * 60 * 1000);
    this.userCooldowns.get(userId)!.set(triggerId, cooldownEnd);
  }

  private processTemplateVariables(content: string, variables: Record<string, any>): string {
    let processedContent = content;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processedContent = processedContent.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return processedContent;
  }

  private createDMContent(template: AutoDMTemplate, processedContent: string, trigger: any): any {
    const content: any = {};

    if (processedContent) {
      content.content = processedContent;
    }

    if (template.embedData) {
      const embed = new EmbedBuilder(template.embedData);
      content.embeds = [embed];
    }

    if (template.componentsData) {
      // Process components data to create action rows
      content.components = template.componentsData;
    }

    return content;
  }

  private async sendDMToUser(userId: string, content: any): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      await user.send(content);
    } catch (error) {
      logger.error(`Failed to send DM to user ${userId}:`, error);
    }
  }

  private async logTriggerActivation(triggerId: string, userId: string, triggerType: string, triggerValue: string): Promise<void> {
    try {
      await this.supabaseService.client
        .from('trigger_activation_logs')
        .insert({
          trigger_id: triggerId,
          user_id: userId,
          trigger_type: triggerType,
          trigger_value: triggerValue,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to log trigger activation:', error);
    }
  }

  /**
   * Reload triggers and templates from database
   */
  async reloadConfiguration(): Promise<void> {
    await this.loadTriggers();
    await this.loadTemplates();
    logger.info('Reloaded keyword/emoji triggers and DM templates');
  }

  /**
   * Process reaction for emoji triggers
   */
  async processReaction(reaction: any, user: any): Promise<void> {
    try {
      const emoji = reaction.emoji.name || reaction.emoji.id;

      for (const [triggerId, trigger] of this.emojiTriggers) {
        if (trigger.emoji === emoji) {
          const member = reaction.message.guild?.members.cache.get(user.id);
          if (member && this.checkTriggerConditions(trigger.conditions, member)) {
            await this.sendAutoDM(member, trigger.templateId, {
              emoji: emoji,
              message: reaction.message.content,
              channel: reaction.message.channel.name
            });
            await this.logTriggerActivation(triggerId, user.id, 'emoji', emoji);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling emoji reaction:', error);
    }
  }

  /**
   * Check if trigger conditions are met
   */
  private checkTriggerConditions(conditions: any, member: any): boolean {
    // Add your condition checking logic here
    return true; // Placeholder implementation
  }

  /**
   * Send auto DM to user
   */
  private async sendAutoDM(member: any, templateId: string, context: any): Promise<void> {
    try {
      const template = this.dmTemplates.get(templateId);
      if (!template) return;

      const user = member.user;
      const processedContent = this.processTemplate(template.content, context);

      await user.send({
        content: processedContent,
        embeds: template.embeds || []
      });
    } catch (error) {
      logger.error('Error sending auto DM:', error);
    }
  }

  /**
   * Process template with context variables
   */
  private processTemplate(content: string, context: any): string {
    let processed = content;
    for (const [key, value] of Object.entries(context)) {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return processed;
  }
}