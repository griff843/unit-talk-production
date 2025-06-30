import { 
  Client, 
  ForumChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ThreadChannel,
  ChannelType
} from 'discord.js';
import { logger } from '../utils/logger';

export interface FAQItem {
  title: string;
  icon: string;
  description: string;
  button_label?: string | null;
  button_url?: string | null;
}

export class FAQService {
  private client: Client;
  private readonly FAQ_FORUM_ID = '1387837517298139267';
  private readonly BRAND_COLOR = '#1EF763';

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Create or update a single FAQ thread
   */
  async createOrUpdateFAQThread(faq: FAQItem): Promise<ThreadChannel | null> {
    try {
      const forumChannel = await this.client.channels.fetch(this.FAQ_FORUM_ID) as ForumChannel;
      
      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        logger.error('FAQ forum channel not found or is not a forum channel');
        return null;
      }

      // Check if thread already exists
      const existingThread = await this.findExistingThread(forumChannel, faq.title);
      
      if (existingThread) {
        // Update existing thread
        return await this.updateFAQThread(existingThread, faq);
      } else {
        // Create new thread
        return await this.createNewFAQThread(forumChannel, faq);
      }
    } catch (error) {
      logger.error(`Error creating/updating FAQ thread for "${faq.title}":`, error);
      return null;
    }
  }

  /**
   * Create a new FAQ thread
   */
  private async createNewFAQThread(forumChannel: ForumChannel, faq: FAQItem): Promise<ThreadChannel | null> {
    try {
      const embed = this.createFAQEmbed(faq);
      const components = faq.button_label && faq.button_url ? [this.createActionRow(faq)] : [];

      const thread = await forumChannel.threads.create({
        name: faq.title,
        message: {
          embeds: [embed],
          components
        }
      });

      // Lock the thread so only staff can reply
      await thread.setLocked(true);
      
      logger.info(`Created FAQ thread: ${faq.title}`);
      return thread;
    } catch (error) {
      logger.error(`Error creating new FAQ thread for "${faq.title}":`, error);
      return null;
    }
  }

  /**
   * Update an existing FAQ thread
   */
  private async updateFAQThread(thread: ThreadChannel, faq: FAQItem): Promise<ThreadChannel | null> {
    try {
      const embed = this.createFAQEmbed(faq);
      const components = faq.button_label && faq.button_url ? [this.createActionRow(faq)] : [];

      // Get the first message (starter message) and edit it
      const messages = await thread.messages.fetch({ limit: 1 });
      const starterMessage = messages.first();

      if (starterMessage) {
        await starterMessage.edit({
          embeds: [embed],
          components
        });
      }

      // Update thread name if needed
      if (thread.name !== faq.title) {
        await thread.setName(faq.title);
      }

      // Ensure thread is locked
      if (!thread.locked) {
        await thread.setLocked(true);
      }

      logger.info(`Updated FAQ thread: ${faq.title}`);
      return thread;
    } catch (error) {
      logger.error(`Error updating FAQ thread for "${faq.title}":`, error);
      return null;
    }
  }

  /**
   * Find existing thread by title
   */
  private async findExistingThread(forumChannel: ForumChannel, title: string): Promise<ThreadChannel | null> {
    try {
      const threads = await forumChannel.threads.fetchActive();
      const archivedThreads = await forumChannel.threads.fetchArchived();
      
      const allThreads = [...threads.threads.values(), ...archivedThreads.threads.values()];
      
      return allThreads.find(thread => thread.name === title) || null;
    } catch (error) {
      logger.error(`Error finding existing thread for "${title}":`, error);
      return null;
    }
  }

  /**
   * Create FAQ embed
   */
  private createFAQEmbed(faq: FAQItem): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`${faq.icon} ${faq.title}`)
      .setDescription(faq.description)
      .setColor(this.BRAND_COLOR)
      .setTimestamp();
  }

  /**
   * Create action row with button
   */
  private createActionRow(faq: FAQItem): ActionRowBuilder<ButtonBuilder> {
    const button = new ButtonBuilder()
      .setLabel(faq.button_label!)
      .setURL(faq.button_url!)
      .setStyle(ButtonStyle.Link);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  }

  /**
   * Bulk create or update multiple FAQ threads
   */
  async bulkCreateFAQs(faqs: FAQItem[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    logger.info(`Starting bulk FAQ creation/update for ${faqs.length} FAQs`);

    for (const faq of faqs) {
      try {
        const thread = await this.createOrUpdateFAQThread(faq);

        if (thread) {
          results.success++;
          logger.info(`Successfully processed FAQ: ${faq.title}`);
        } else {
          results.failed++;
          results.errors.push(`Failed to create/update: ${faq.title}`);
          logger.error(`Failed to process FAQ: ${faq.title}`);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Error with ${faq.title}: ${errorMessage}`);
        logger.error(`Error processing FAQ "${faq.title}":`, error);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(`Bulk FAQ operation completed: ${results.success} success, ${results.failed} failed`);
    return results;
  }

  /**
   * Get all FAQ threads
   */
  async getAllFAQThreads(): Promise<ThreadChannel[]> {
    try {
      const forumChannel = await this.client.channels.fetch(this.FAQ_FORUM_ID) as ForumChannel;
      
      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        logger.error('FAQ forum channel not found or is not a forum channel');
        return [];
      }

      const activeThreads = await forumChannel.threads.fetchActive();
      const archivedThreads = await forumChannel.threads.fetchArchived();
      
      return [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
    } catch (error) {
      logger.error('Error fetching FAQ threads:', error);
      return [];
    }
  }

  /**
   * Delete a FAQ thread by title
   */
  async deleteFAQThread(title: string): Promise<boolean> {
    try {
      const forumChannel = await this.client.channels.fetch(this.FAQ_FORUM_ID) as ForumChannel;
      
      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        logger.error('FAQ forum channel not found or is not a forum channel');
        return false;
      }

      const thread = await this.findExistingThread(forumChannel, title);
      
      if (thread) {
        await thread.delete();
        logger.info(`Deleted FAQ thread: ${title}`);
        return true;
      } else {
        logger.warn(`FAQ thread not found: ${title}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error deleting FAQ thread "${title}":`, error);
      return false;
    }
  }
}