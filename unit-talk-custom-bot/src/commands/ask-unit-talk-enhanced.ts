import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { PermissionsService } from '../services/permissions';
import { logger } from '../utils/logger';
import { UserTier } from '../types/index';
import { aiCoachingService, AIAnalysisRequest } from '../services/aiCoaching'; // Import AIAnalysisRequest
import { DatabaseService } from '../services/database';


// Service instances
const supabaseService = new SupabaseService();
const permissionsService = new PermissionsService();
const databaseService = new DatabaseService();

// Helper function to get user tier
async function getUserTier(member: GuildMember): Promise<UserTier> {
  try {
    const userProfile = await databaseService.getUserProfile(member.id);
    if (userProfile && userProfile.tier) {
      return userProfile.tier as UserTier;
    }

    // Fallback to permissions service if no profile found
    const tierFromPermissions = await permissionsService.getUserTier(member);
    if (tierFromPermissions) {
      return tierFromPermissions as UserTier;
    }

    // Default to 'member'
    return 'member';
  } catch (error) {
    logger.warn('Failed to get user tier, defaulting to member', { userId: member.id, error });
    return 'member';
  }
}

const userCooldowns = new Map<string, number>();

// Input validation constants
const QUESTION_MIN_LENGTH = 10;
const QUESTION_MAX_LENGTH = 500;
const CONTEXT_MAX_LENGTH = 200;

const CONTEXT_MAX_LENGTH = 200;

export const data = new SlashCommandBuilder()
  .setName('ask-unit-talk')
  .setDescription('Get personalized AI coaching and betting analysis')
  .addStringOption(option =>
    option.setName('question')
      .setDescription('Your betting question, scenario, or strategy inquiry')
      .setRequired(true)
      .setMinLength(QUESTION_MIN_LENGTH)
      .setMaxLength(QUESTION_MAX_LENGTH)
  )
  .addStringOption(option =>
    option.setName('context')
      .setDescription('Additional context (sport, league, game, etc.)')
      .setRequired(false)
      .setMaxLength(CONTEXT_MAX_LENGTH)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const startTime = Date.now();
  
  try {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      await interaction.editReply({ 
        content: '❌ Unable to verify your membership status. Please try again or contact support.' 
      });
      return;
    }

    const userTier = await getUserTier(member) as UserTier;
    const discordId = interaction.user.id;
    const username = interaction.user.username;
    
    // Enhanced tier validation
    if (!['vip', 'vip_plus', 'staff', 'admin', 'owner'].includes(userTier)) {
      const embed = createAccessDeniedEmbed();
      await interaction.editReply({ embeds: [embed] });
      
      // Track denied access for analytics
      await databaseService.trackUserActivity(discordId, 'ai_coaching_denied', {
        user_tier: userTier,
        reason: 'insufficient_tier'
      });
      return;
    }

    // Enhanced input validation
    const question = interaction.options.getString('question', true);
    const contextString = interaction.options.getString('context');
    
    const validationResult = validateInput(question, contextString);
    if (!validationResult.isValid) {
      const embed = createValidationErrorEmbed(validationResult.errors);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Enhanced cooldown check
    const cooldownResult = checkCooldown(discordId, userTier);
    if (!cooldownResult.allowed) {
      const embed = createCooldownEmbed(cooldownResult.remainingTime || 0);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Daily usage limit check
    const usageResult = await checkDailyUsage(discordId, userTier);
    if (!usageResult.allowed) {
      const embed = createUsageLimitEmbed(usageResult.used, usageResult.limit);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get or create user profile with enhanced error handling
    let userProfile = await databaseService.getUserProfile(discordId);
    if (!userProfile) {
      userProfile = await databaseService.createUserProfile({
        discord_id: discordId,
        username: username,
        tier: userTier,
        subscription_tier: mapTierToSubscription(userTier),
        metadata: { 
          created_via: 'ask_unit_talk',
          first_question: question.substring(0, 100),
          created_at: new Date().toISOString()
        }
      });
      
      if (!userProfile) {
        logger.error('Failed to create user profile', { discordId, username, userTier });
        await interaction.editReply({ 
          content: '❌ Failed to create user profile. Please try again or contact support.' 
        });
        return;
      }
    }

    // Enhanced data retrieval with error handling
    const [userPicks, pickStats] = await Promise.allSettled([
      databaseService.getUserPicks(discordId, { limit: 20, orderBy: 'created_at', ascending: false }),
      databaseService.getUserPickStats(discordId)
    ]);

    if (userPicks.status === 'rejected' || pickStats.status === 'rejected') {
      logger.error('Failed to retrieve user data', { 
        discordId, 
        picksError: userPicks.status === 'rejected' ? userPicks.reason : null,
        statsError: pickStats.status === 'rejected' ? pickStats.reason : null
      });
      
      const embed = createDataRetrievalErrorEmbed();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Prepare enhanced AI analysis request
    const analysisRequest: AIAnalysisRequest = {
      question: sanitizeInput(question),
      userTier,
      userHistory: {
        totalPicks: pickStats.value.totalPicks,
        winRate: pickStats.value.winRate,
        totalProfit: pickStats.value.totalProfit,
        recentPicks: userPicks.value.slice(0, 10).map(pick => ({
          pickType: pick.pick_type,
          result: pick.result,
          stake: pick.stake,
          profitLoss: pick.profit_loss || 0,
          reasoning: pick.reasoning || undefined
        }))
      },
      context: contextString ? parseContext(contextString) : undefined
    };

    // Show enhanced thinking indicator
    const thinkingEmbed = createThinkingEmbed(userTier);
    await interaction.editReply({ embeds: [thinkingEmbed] });

    // Generate AI analysis with timeout and retry logic
    const analysis = await generateAnalysisWithRetry(analysisRequest, 3);

    // Enhanced session management
    let sessionId: string;
    const activeSession = await databaseService.getActiveCoachingSession(discordId);
    
    if (activeSession) {
      sessionId = activeSession.id;
    } else {
      sessionId = await aiCoachingService.createCoachingSession(
        discordId, 
        discordId, 
        'ai_analysis', 
        userTier
      );
    }

    // Add Q&A to session with error handling
    try {
      await aiCoachingService.addQuestionToSession(sessionId, question, analysis);
    } catch (error) {
      logger.warn('Failed to add question to session', { sessionId, error });
      // Continue execution - this is not critical
    }

    // Create enhanced response embed
    const responseEmbed = createAnalysisEmbed(analysis, userTier, pickStats.value, question);
    
    // Create enhanced action buttons
    const actionRow = createActionButtons(sessionId, discordId, userTier);

    await interaction.editReply({ 
      embeds: [responseEmbed], 
      components: [actionRow] 
    });

    // Set cooldown
    userCooldowns.set(`ask-unit-talk:${discordId}`, Date.now());

    // Enhanced analytics tracking
    const processingTime = Date.now() - startTime;
    await databaseService.trackUserActivity(discordId, 'ai_coaching_used', {
      question_length: question.length,
      user_tier: userTier,
      session_id: sessionId,
      confidence: analysis.confidence,
      risk_level: analysis.riskAssessment.level,
      processing_time_ms: processingTime,
      context_provided: !!contextString,
      user_picks_count: pickStats.value.totalPicks,
      user_win_rate: pickStats.value.winRate
    });

    logger.info('AI coaching question processed successfully', {
      userId: discordId,
      userTier,
      sessionId,
      questionLength: question.length,
      confidence: analysis.confidence,
      processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Error in ask-unit-talk command:', { 
      error, 
      userId: interaction.user.id,
      processingTime 
    });
    
    const errorEmbed = createGenericErrorEmbed();
    await interaction.editReply({ embeds: [errorEmbed] });

    // Track error for monitoring
    await databaseService.trackUserActivity(interaction.user.id, 'ai_coaching_error', {
      error_type: error instanceof Error ? error.name : 'unknown',
      error_message: error instanceof Error ? error.message : 'unknown error',
      processing_time_ms: processingTime
    }).catch(() => {}); // Ignore tracking errors
  }
}

// Enhanced validation function
function validateInput(question: string, context?: string | null): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Question validation
  if (!question || question.trim().length === 0) {
    errors.push('Question cannot be empty');
  } else if (question.length < QUESTION_MIN_LENGTH) {
    errors.push(`Question must be at least ${QUESTION_MIN_LENGTH} characters long`);
  } else if (question.length > QUESTION_MAX_LENGTH) {
    errors.push(`Question must be no more than ${QUESTION_MAX_LENGTH} characters long`);
  }

  // Check for spam patterns
  if (question && isSpamPattern(question)) {
    errors.push('Question appears to be spam or invalid');
  }

  // Context validation
  if (context && context.length > CONTEXT_MAX_LENGTH) {
    errors.push(`Context must be no more than ${CONTEXT_MAX_LENGTH} characters long`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Enhanced spam detection
function isSpamPattern(text: string): boolean {
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /^[^a-zA-Z]*$/, // No letters
    /^\s*$/, // Only whitespace
    /(http|www|\.com|\.net|\.org)/i, // URLs
    /[^\w\s\?\!\.\,\-\'\"\(\)]/g // Excessive special characters
  ];

  return spamPatterns.some(pattern => pattern.test(text));
}

// Helper function to safely get daily limit for a user tier
function getDailyLimit(tier: UserTier): number {
  const limits = {
    member: 0,
    trial: 5,
    vip: 20,
    vip_plus: 50,
    capper: 30,
    staff: 100,
    admin: 1000,
    owner: 1000
  } as Record<UserTier, number>;
  return limits[tier];
}

// Helper function to safely get cooldown duration for a user tier
function getCooldownDuration(tier: UserTier): number {
  const cooldowns = {
    member: 5 * 60 * 1000,
    trial: 3 * 60 * 1000,
    vip: 2 * 60 * 1000,
    vip_plus: 30 * 1000,
    capper: 1 * 60 * 1000,
    staff: 10 * 1000,
    admin: 0,
    owner: 0,
  } as Record<UserTier, number>;
  return cooldowns[tier];
}

// Helper function to safely get tier message
function getTierMessage(tier: UserTier): string {
  const messages = {
    member: 'Processing...',
    trial: 'Analyzing your trial question with basic AI coaching...',
    vip: 'Analyzing your question with AI coaching...',
    vip_plus: 'Running advanced AI analysis with premium insights...',
    capper: 'Processing with capper-focused AI analysis...',
    staff: 'Processing with staff-level AI capabilities...',
    admin: 'Executing admin-level comprehensive analysis...',
    owner: 'Running full-spectrum AI analysis...'
  } as Record<UserTier, string>;
  return messages[tier];
}

// Helper function to safely get tier color
function getTierColor(tier: UserTier): number {
  const colors = {
    member: 0x87ceeb,
    trial: 0x17a2b8,
    vip: 0xffd700,
    vip_plus: 0xff4500,
    capper: 0xE67E22,
    staff: 0x9370db,
    admin: 0xff1493,
    owner: 0x00ff00
  } as Record<UserTier, number>;
  return colors[tier];
}

// Enhanced cooldown check
function checkCooldown(discordId: string, userTier: UserTier): { allowed: boolean; remainingTime?: number } {
  const now = Date.now();
  const cooldownKey = `ask-unit-talk:${discordId}`;
  const lastUsed = userCooldowns.get(cooldownKey) || 0;
  const cooldownTime = getCooldownDuration(userTier);

  if (now - lastUsed < cooldownTime) {
    const remainingTime = Math.ceil((cooldownTime - (now - lastUsed)) / 1000);
    return { allowed: false, remainingTime };
  }

  return { allowed: true };
}

// Daily usage limit check
async function checkDailyUsage(discordId: string, userTier: UserTier): Promise<{ allowed: boolean; used: number; limit: number }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const usageCount = await databaseService.getUserDailyUsage(discordId, 'ai_coaching_used', today);
    const limit = getDailyLimit(userTier);

    return {
      allowed: usageCount < limit,
      used: usageCount,
      limit: getDailyLimit(userTier)
    };
  } catch (error) {
    logger.warn('Failed to check daily usage, allowing request', { discordId, error });
    return { allowed: true, used: 0, limit: getDailyLimit(userTier) };
  }
}

// Enhanced AI analysis with retry logic
async function generateAnalysisWithRetry(request: AIAnalysisRequest, maxRetries: number) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const analysis = await aiCoachingService.generateAnalysis(request);
      
      // Validate analysis response
      if (!analysis || !analysis.analysis || analysis.analysis.trim().length === 0) {
        throw new Error('Invalid analysis response');
      }
      
      return analysis;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`AI analysis attempt ${attempt} failed`, { error, attempt, maxRetries });
      
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError || new Error('Failed to generate analysis after retries');
}

// Input sanitization
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, QUESTION_MAX_LENGTH); // Ensure max length
}

// Enhanced embed creators
function createAccessDeniedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🔒 VIP Feature')
    .setDescription('AI Coaching is available for VIP members and above.\n\n' +
      '**What you\'re missing:**\n' +
      '• Personalized betting analysis\n' +
      '• AI-powered strategy recommendations\n' +
      '• Historical performance insights\n' +
      '• Risk assessment and bankroll guidance\n' +
      '• 24/7 coaching availability\n\n' +
      'Type `/vip-info` to learn about upgrading.')
    .setColor(0xff0000)
    .setFooter({ text: 'Unit Talk AI Coaching' })
    .setTimestamp();
}

function createValidationErrorEmbed(errors: string[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ Invalid Input')
    .setDescription('Please fix the following issues:\n\n' + errors.map(e => `• ${e}`).join('\n'))
    .setColor(0xff6b6b)
    .setFooter({ text: 'Check your input and try again' });
}

function createCooldownEmbed(remainingTime: number): EmbedBuilder {
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  
  return new EmbedBuilder()
    .setTitle('⏰ Cooldown Active')
    .setDescription(`Please wait ${timeString} before asking another question.\n\n` +
      '**Upgrade for shorter cooldowns:**\n' +
      '• VIP: 2 minute cooldown\n' +
      '• VIP+: 30 second cooldown')
    .setColor(0xffa500)
    .setFooter({ text: 'Rate limiting helps ensure quality responses' });
}

function createUsageLimitEmbed(used: number, limit: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📊 Daily Limit Reached')
    .setDescription(`You've used ${used}/${limit} AI coaching questions today.\n\n` +
      '**Upgrade for more questions:**\n' +
      '• VIP: 20 questions/day\n' +
      '• VIP+: 50 questions/day\n\n' +
      'Limit resets at midnight UTC.')
    .setColor(0xff4500)
    .setFooter({ text: 'Upgrade to VIP+ for unlimited access' });
}

function createDataRetrievalErrorEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⚠️ Data Retrieval Issue')
    .setDescription('We\'re having trouble accessing your betting history right now.\n\n' +
      'Your AI coaching will work with limited context. Please try again in a few minutes for full analysis.')
    .setColor(0xffa500)
    .setFooter({ text: 'If this persists, contact support' });
}

function createThinkingEmbed(userTier: UserTier): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🤖 AI Coach - Processing Your Question')
    .setDescription(getTierMessage(userTier))
    .setColor(0x17a2b8)
    .setTimestamp();
}

function createGenericErrorEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ Analysis Error')
    .setDescription('I encountered an issue while analyzing your question.\n\n' +
      '**What to try:**\n' +
      '• Wait a moment and try again\n' +
      '• Rephrase your question\n' +
      '• Check if the service is experiencing issues\n\n' +
      'If this persists, please contact support.')
    .setColor(0xff0000)
    .setFooter({ text: 'Error ID: ' + Date.now().toString(36) });
}

function createActionButtons(sessionId: string, discordId: string, userTier: UserTier): ActionRowBuilder<ButtonBuilder> {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(`ask_followup:${sessionId}`)
      .setLabel('Ask Follow-up')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('💬'),
    new ButtonBuilder()
      .setCustomId(`view_history:${discordId}`)
      .setLabel('View History')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊'),
    new ButtonBuilder()
      .setCustomId(`end_session:${sessionId}`)
      .setLabel('End Session')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔚')
  ];

  // Add premium features for VIP+
  if (userTier === 'vip_plus') {
    buttons.splice(2, 0, new ButtonBuilder()
      .setCustomId(`export_session:${sessionId}`)
      .setLabel('Export Analysis')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📄')
    );
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

// Rest of the existing functions remain the same...
// (handleButtonInteraction, handleFollowUpQuestion, handleViewHistory, handleEndSession, 
//  createAnalysisEmbed, parseContext, mapTierToSubscription)

/**
 * Handle button interactions for follow-up questions and session management
 */
export async function handleButtonInteraction(interaction: any) {
  try {
    const [action, identifier] = interaction.customId.split(':');
    
    switch (action) {
      case 'ask_followup':
        await handleFollowUpQuestion(interaction, identifier);
        break;
      case 'view_history':
        await handleViewHistory(interaction, identifier);
        break;
      case 'end_session':
        await handleEndSession(interaction, identifier);
        break;
      case 'export_session':
        await handleExportSession(interaction);
        break;
    }
  } catch (error) {
    logger.error('Error handling button interaction:', error);
    await interaction.reply({ 
      content: '❌ An error occurred. Please try again.', 
      ephemeral: true 
    });
  }
}

async function handleFollowUpQuestion(interaction: any, sessionId: string) {
  const modal = {
    title: 'Ask Follow-up Question',
    custom_id: `followup_modal:${sessionId}`,
    components: [
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: 'followup_question',
            label: 'Your Follow-up Question',
            style: 2,
            placeholder: 'Ask a follow-up question about the analysis...',
            required: true,
            min_length: QUESTION_MIN_LENGTH,
            max_length: QUESTION_MAX_LENGTH
          }
        ]
      }
    ]
  };

  await interaction.showModal(modal);
}

async function handleViewHistory(interaction: any, discordId: string) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const sessions = await aiCoachingService.getUserCoachingSessions(discordId, 5);
    const stats = await databaseService.getCoachingSessionStats(discordId);
    
    const historyEmbed = new EmbedBuilder()
      .setTitle('📊 Your AI Coaching History')
      .setDescription(`**Overall Stats:**\n` +
        `• Total Sessions: ${stats.totalSessions}\n` +
        `• Questions Asked: ${stats.totalQuestions}\n` +
        `• Average Session: ${stats.averageSessionDuration} minutes\n` +
        `• Last Session: ${stats.lastSessionDate ? new Date(stats.lastSessionDate).toLocaleDateString() : 'Never'}\n\n` +
        `**Recent Sessions:**`)
      .setColor(0x00ff00);

    if (sessions.length > 0) {
      sessions.forEach((session, index) => {
        const sessionDate = new Date(session.startedAt).toLocaleDateString();
        const questionCount = session.metadata.totalQuestions;
        historyEmbed.addFields({
          name: `Session ${index + 1} - ${sessionDate}`,
          value: `${questionCount} questions • ${session.status}`,
          inline: true
        });
      });
    } else {
      historyEmbed.addFields({
        name: 'No History',
        value: 'This is your first AI coaching session!',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [historyEmbed] });
  } catch (error) {
    logger.error('Error retrieving coaching history:', error);
    await interaction.editReply({ 
      content: '❌ Failed to retrieve your coaching history. Please try again.' 
    });
  }
}

async function handleEndSession(interaction: any, sessionId: string) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const success = await aiCoachingService.completeCoachingSession(sessionId);
    
    if (success) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Session Ended')
        .setDescription('Your AI coaching session has been completed and saved to your history.\n\n' +
          'Thank you for using Unit Talk AI Coaching!')
        .setColor(0x00ff00)
        .setFooter({ text: 'Session data saved for future reference' });
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ 
        content: '❌ Failed to end session. Please try again or contact support.' 
      });
    }
  } catch (error) {
    logger.error('Error ending coaching session:', error);
    await interaction.editReply({ 
      content: '❌ An error occurred while ending the session. Please try again.' 
    });
  }
}

async function handleExportSession(interaction: any) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // This would generate a PDF or text export of the session
    // Implementation depends on your export requirements
    await interaction.editReply({
      content: '📄 Session export feature coming soon! This will allow VIP+ members to download their coaching sessions.'
    });
  } catch (error) {
    logger.error('Error exporting session:', error);
    await interaction.editReply({
      content: '❌ Failed to export session. Please try again.'
    });
  }
}

function createAnalysisEmbed(analysis: any, userTier: UserTier, pickStats: any, question: string): EmbedBuilder {

  const embed = new EmbedBuilder()
    .setTitle('🧠 AI Coach Analysis')
    .setDescription(`**Your Question:** ${question.length > 100 ? question.substring(0, 100) + '...' : question}`)
    .setColor(getTierColor(userTier))
    .setFooter({
      text: `${userTier.toUpperCase()} Access | Confidence: ${analysis.confidence}% | Unit Talk AI`
    })
    .setTimestamp();

  // Add analysis
  embed.addFields({
    name: '📈 Analysis',
    value: analysis.analysis.length > 1024 ? analysis.analysis.substring(0, 1021) + '...' : analysis.analysis,
    inline: false
  });

  // Add key insights
  if (analysis.keyInsights.length > 0) {
    embed.addFields({
      name: '🎯 Key Insights',
      value: analysis.keyInsights.map((insight: string, index: number) => 
        `${index + 1}. ${insight}`
      ).join('\n').substring(0, 1024),
      inline: false
    });
  }

  // Add recommendations
  if (analysis.recommendations.length > 0) {
    embed.addFields({
      name: '💡 Recommendations',
      value: analysis.recommendations.map((rec: string, index: number) => 
        `${index + 1}. ${rec}`
      ).join('\n').substring(0, 1024),
      inline: false
    });
  }

  // Add risk assessment
  const riskEmoji: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🔴'
  };

  const riskLevel = analysis.riskAssessment.level as string;
  const emoji = riskEmoji[riskLevel] || '⚪';

  embed.addFields({
    name: `${emoji} Risk Assessment`,
    value: `**Level:** ${analysis.riskAssessment.level.toUpperCase()}\n` +
           `**Factors:** ${analysis.riskAssessment.factors.join(', ')}`,
    inline: false
  });

  // Add user stats for context
  embed.addFields({
    name: '📊 Your Stats',
    value: `**Record:** ${pickStats.totalPicks} picks • ${(pickStats.winRate * 100).toFixed(1)}% win rate\n` +
           `**Profit:** ${pickStats.totalProfit > 0 ? '+' : ''}${pickStats.totalProfit.toFixed(2)} units`,
    inline: true
  });

  // Add follow-up questions for VIP+
  if (userTier === 'vip_plus' && analysis.followUpQuestions.length > 0) {
    embed.addFields({
      name: '🤔 Suggested Follow-ups',
      value: analysis.followUpQuestions.slice(0, 2).map((q: string, index: number) => 
        `${index + 1}. ${q}`
      ).join('\n'),
      inline: false
    });
  }

  return embed;
}

function parseContext(contextString: string): any {
  const context: any = {};
  
  // Enhanced parsing for common context patterns
  const sportMatch = contextString.match(/\b(NBA|NFL|MLB|NHL|soccer|football|basketball|baseball|hockey|tennis|golf|MMA|UFC)\b/i);
  if (sportMatch) context.sport = sportMatch[1].toUpperCase();
  
  const timeMatch = contextString.match(/\b(\d{1,2}:\d{2}|\d{1,2}(am|pm))\b/i);
  if (timeMatch) context.gameTime = timeMatch[0];
  
  const weatherMatch = contextString.match(/\b(rain|snow|wind|cold|hot|dome|indoor|outdoor)\b/i);
  if (weatherMatch) context.weather = weatherMatch[0];
  
  const leagueMatch = contextString.match(/\b(NBA|NFL|MLB|NHL|Premier League|Champions League|La Liga|Serie A)\b/i);
  if (leagueMatch) context.league = leagueMatch[0];
  
  return context;
}

function mapTierToSubscription(tier: UserTier): 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS' {
  switch (tier) {
    case 'vip_plus':
      return 'VIP_PLUS';
    case 'vip':
      return 'VIP';
    case 'staff':
    case 'admin':
    case 'owner':
      return 'VIP_PLUS';
    default:
      return 'FREE';
  }
}