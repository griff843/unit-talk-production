import { 
  Message, 
  MessageReaction, 
  User, 
  ButtonInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { supabaseService } from './supabase';
import { logger } from '../utils/logger';

export interface FeedbackData {
  messageId: string;
  userId: string;
  messageType: 'recap' | 'alert' | 'notification' | 'command_response';
  feedbackType: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface FeedbackSummary {
  messageType: 'recap' | 'alert' | 'notification' | 'command_response';
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positiveRate: number;
}

export class FeedbackService {
  private readonly feedbackEmojis = {
    positive: '👍',
    negative: '👎',
    neutral: '🤷'
  };

  /**
   * Add feedback reactions to a message
   */
  async addFeedbackReactions(message: Message, messageType: 'recap' | 'alert' | 'notification' | 'command_response'): Promise<void> {
    try {
      // Store message for feedback tracking
      await this.storeMessageForFeedback(message.id, messageType);

      // Add reaction emojis
      await message.react(this.feedbackEmojis.positive);
      await message.react(this.feedbackEmojis.negative);
      await message.react(this.feedbackEmojis.neutral);

    } catch (error) {
      logger.error('Error adding feedback reactions:', error);
    }
  }

  /**
   * Create feedback buttons
   */
  createFeedbackButtons(customId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`feedback_positive_${customId}`)
          .setLabel('👍 Helpful')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`feedback_negative_${customId}`)
          .setLabel('👎 Not Helpful')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`feedback_neutral_${customId}`)
          .setLabel('🤷 Neutral')
          .setStyle(ButtonStyle.Secondary)
      );
  }

  /**
   * Handle reaction-based feedback
   */
  async handleReactionFeedback(reaction: MessageReaction, user: User, added: boolean): Promise<void> {
    if (user.bot) return;

    try {
      const messageType = await this.getMessageType(reaction.message.id);
      if (!messageType) return;

      const feedbackType = this.getFeedbackTypeFromEmoji(reaction.emoji.name || '');
      if (!feedbackType) return;

      if (added) {
        await this.recordFeedback({
          messageId: reaction.message.id,
          userId: user.id,
          messageType,
          feedbackType,
          timestamp: new Date(),
          metadata: {
            source: 'reaction',
            emoji: reaction.emoji.name
          }
        });
      } else {
        await this.removeFeedback(reaction.message.id, user.id);
      }

    } catch (error) {
      logger.error('Error handling reaction feedback:', error);
    }
  }

  /**
   * Handle button-based feedback
   */
  async handleButtonFeedback(interaction: ButtonInteraction): Promise<void> {
    try {
      const customId = interaction.customId;
      const parts = customId.split('_');
      
      if (parts.length < 3 || parts[0] !== 'feedback') return;

      const feedbackType = parts[1] as 'positive' | 'negative' | 'neutral';
      const messageId = interaction.message?.id;

      if (!messageId) return;

      const messageType = await this.getMessageType(messageId);
      if (!messageType) {
        await interaction.reply({ 
          content: 'Unable to process feedback for this message.', 
          ephemeral: true 
        });
        return;
      }

      await this.recordFeedback({
        messageId,
        userId: interaction.user.id,
        messageType,
        feedbackType,
        timestamp: new Date(),
        metadata: {
          source: 'button',
          customId
        }
      });

      await interaction.reply({ 
        content: `Thank you for your ${feedbackType} feedback!`, 
        ephemeral: true 
      });

    } catch (error) {
      logger.error('Error handling button feedback:', error);
      if (!interaction.replied) {
        await interaction.reply({ 
          content: 'An error occurred while processing your feedback.', 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * Record feedback in database
   */
  private async recordFeedback(feedback: FeedbackData): Promise<void> {
    try {
      await supabaseService.client
        .from('message_feedback')
        .upsert({
          message_id: feedback.messageId,
          user_id: feedback.userId,
          message_type: feedback.messageType,
          feedback_type: feedback.feedbackType,
          metadata: feedback.metadata || {}
        });

    } catch (error) {
      logger.error('Error recording feedback:', error);
    }
  }

  /**
   * Remove feedback from database
   */
  private async removeFeedback(messageId: string, userId: string): Promise<void> {
    try {
      await supabaseService.client
        .from('message_feedback')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId);

    } catch (error) {
      logger.error('Error removing feedback:', error);
    }
  }

  /**
   * Store message for feedback tracking
   */
  private async storeMessageForFeedback(messageId: string, messageType: 'recap' | 'alert' | 'notification' | 'command_response'): Promise<void> {
    try {
      await supabaseService.client
        .from('feedback_messages')
        .upsert({
          message_id: messageId,
          message_type: messageType
        });

    } catch (error) {
      logger.error('Error storing message for feedback:', error);
    }
  }

  /**
   * Get message type from database
   */
  private async getMessageType(messageId: string): Promise<'recap' | 'alert' | 'notification' | 'command_response' | null> {
    try {
      const { data } = await supabaseService.client
        .from('feedback_messages')
        .select('message_type')
        .eq('message_id', messageId)
        .single();

      return data?.message_type as 'recap' | 'alert' | 'notification' | 'command_response' || null;

    } catch (error) {
      logger.error('Error getting message type:', error);
      return null;
    }
  }

  /**
   * Get feedback type from emoji
   */
  private getFeedbackTypeFromEmoji(emoji: string): 'positive' | 'negative' | 'neutral' | null {
    switch (emoji) {
      case this.feedbackEmojis.positive:
        return 'positive';
      case this.feedbackEmojis.negative:
        return 'negative';
      case this.feedbackEmojis.neutral:
        return 'neutral';
      default:
        return null;
    }
  }

  /**
   * Get feedback summary
   */
  async getFeedbackSummary(days: number = 30): Promise<FeedbackSummary[]> {
    try {
      const { data } = await supabaseService.client
        .from('message_feedback')
        .select('message_type, feedback_type')
        .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (!data) return [];

      const summaryMap = new Map<string, FeedbackSummary>();

      for (const feedback of data) {
        const messageType = feedback.message_type as 'recap' | 'alert' | 'notification' | 'command_response';
        
        if (!summaryMap.has(messageType)) {
          summaryMap.set(messageType, {
            messageType,
            totalFeedback: 0,
            positiveCount: 0,
            negativeCount: 0,
            neutralCount: 0,
            positiveRate: 0
          });
        }

        const summary = summaryMap.get(messageType)!;
        summary.totalFeedback++;

        switch (feedback.feedback_type) {
          case 'positive':
            summary.positiveCount++;
            break;
          case 'negative':
            summary.negativeCount++;
            break;
          case 'neutral':
            summary.neutralCount++;
            break;
        }
      }

      // Calculate positive rates
      for (const summary of summaryMap.values()) {
        summary.positiveRate = summary.totalFeedback > 0 
          ? Math.round((summary.positiveCount / summary.totalFeedback) * 100) 
          : 0;
      }

      return Array.from(summaryMap.values());

    } catch (error) {
      logger.error('Error getting feedback summary:', error);
      return [];
    }
  }

  /**
   * Get trending feedback (most recent feedback patterns)
   */
  async getTrendingFeedback(hours: number = 24): Promise<any[]> {
    try {
      const { data } = await supabaseService.client
        .from('message_feedback')
        .select('message_type, feedback_type, timestamp')
        .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);

      return data || [];

    } catch (error) {
      logger.error('Error getting trending feedback:', error);
      return [];
    }
  }

  /**
   * Create weekly feedback digest
   */
  async createWeeklyDigest(): Promise<EmbedBuilder> {
    try {
      const summary = await this.getFeedbackSummary(7);
      const trending = await this.getTrendingFeedback(168); // 7 days

      const embed = new EmbedBuilder()
        .setTitle('📊 Weekly Feedback Digest')
        .setColor(0x00AE86)
        .setTimestamp();

      if (summary.length === 0) {
        embed.setDescription('No feedback received this week.');
        return embed;
      }

      let description = '**Feedback Summary (Last 7 Days)**\n\n';

      for (const item of summary) {
        const emoji = this.getMessageTypeEmoji(item.messageType);
        description += `${emoji} **${item.messageType.toUpperCase()}**\n`;
        description += `├ Total: ${item.totalFeedback}\n`;
        description += `├ 👍 Positive: ${item.positiveCount} (${item.positiveRate}%)\n`;
        description += `├ 👎 Negative: ${item.negativeCount}\n`;
        description += `└ 🤷 Neutral: ${item.neutralCount}\n\n`;
      }

      embed.setDescription(description);

      // Add trending info
      if (trending.length > 0) {
        const recentPositive = trending.filter(f => f.feedback_type === 'positive').length;
        const recentTotal = trending.length;

        // Get recent negative feedback for context
        const recentNegativeFeedback = trending
          .filter(f => f.feedback_type === 'negative')
          .slice(0, 5)
          .map(f => ({
            messageType: f.message_type,
            feedback: f.feedback_type,
            timestamp: f.timestamp
          }));

        embed.addFields({
          name: '📈 Recent Trends (24h)',
          value: `${recentPositive}/${recentTotal} positive (${Math.round((recentPositive/recentTotal)*100)}%)\n` +
                 `Negative feedback examples: ${recentNegativeFeedback.length}`,
          inline: true
        });

        // Optionally append contextual negative feedback detail as description
        embed.addFields({
          name: '❗ Recent Negative Feedback Samples',
          value: recentNegativeFeedback.length > 0
            ? recentNegativeFeedback
                .map(f => `- ${this.getMessageTypeEmoji(f.messageType)} ${f.messageType.toUpperCase()} at ${new Date(f.timestamp).toLocaleString()}`)
                .join('\n')
            : 'No recent negative feedback samples available.',
          inline: false
        });
      }

      return embed;

    } catch (error) {
      logger.error('Error creating weekly digest:', error);
      return new EmbedBuilder()
        .setTitle('📊 Weekly Feedback Digest')
        .setDescription('Error generating digest.')
        .setColor(0xFF0000);
    }
  }

  /**
   * Get emoji for message type
   */
  private getMessageTypeEmoji(messageType: string): string {
    const emojis = {
      recap: '📝',
      alert: '🚨',
      notification: '🔔',
      command_response: '⚡'
    };

    return emojis[messageType as keyof typeof emojis] || '📄';
  }
}

export const feedbackService = new FeedbackService();