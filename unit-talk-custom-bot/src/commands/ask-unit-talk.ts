import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { supabaseService } from '../services/supabase';
import { permissionsService } from '../services/permissions';
import { logger } from '../utils/logger';
import { createInfoEmbed, createErrorEmbed } from '../utils/embeds';
import { CommandUsageService } from '../services/commandUsage';

const commandUsageService = new CommandUsageService();

export const data = new SlashCommandBuilder()
  .setName('ask-unit-talk')
  .setDescription('🧠 Get AI analysis for picks or parlays (VIP+ only)')
  .addStringOption(option =>
    option.setName('picks')
      .setDescription('Enter your pick(s) - single pick or comma-separated parlay')
      .setRequired(true)
      .setMaxLength(500)
  )
  .setDefaultMemberPermissions(0); // Restrict to specific roles

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Check if user has VIP+ access
    const member = interaction.member;
    if (!member) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const permissions = await permissionsService.getUserPermissions(member as any);
    if (!permissions.canViewVipPlusContent) {
      const errorEmbed = createErrorEmbed(
        '🔒 VIP+ Required',
        'This command is exclusive to VIP+ members. Upgrade to access AI-powered pick analysis!'
      );
      
      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true
      });
      return;
    }

    // Check rate limit (3 per day per user)
    const userId = interaction.user.id;
    const today = new Date().toISOString().split('T')[0];

    const currentUsage = await commandUsageService.getUsageCount(userId, 'ask_unit_talk', today);
    if (currentUsage >= 3) {
      await interaction.reply({
        content: '⏰ You\'ve reached your daily limit of 3 AI analyses. Try again tomorrow!',
        ephemeral: true
      });
      return;
    }

    const picksInput = interaction.options.getString('picks', true);
    
    await interaction.deferReply();

    // Parse picks (single or comma-separated)
    const picks = picksInput.split(',').map(pick => pick.trim()).filter(pick => pick.length > 0);
    
    if (picks.length === 0) {
      await interaction.editReply({
        content: '❌ Please provide at least one valid pick.'
      });
      return;
    }

    // Simulate AI analysis (in production, this would call your AI service)
    const analysisResults = await analyzePicksWithAI(picks);

    // Create analysis embed
    const analysisEmbed = new EmbedBuilder()
      .setTitle('🧠 Unit Talk AI Analysis')
      .setColor('#4A90E2')
      .setTimestamp();

    // Add analysis for each pick
    analysisResults.forEach((analysis, index) => {
      const pick = picks[index];
      analysisEmbed.addFields({
        name: `📊 ${pick}`,
        value: `**Matchup:** ${analysis.matchup}\n**Line Movement:** ${analysis.lineMovement}\n**DVP:** ${analysis.dvp}\n**EV Signal:** ${analysis.evSignal}\n**Tier:** ${analysis.tier}`,
        inline: false
      });
    });

    // Add overall confidence and verdict
    const overallConfidence = Math.round(analysisResults.reduce((sum, a) => sum + a.confidence, 0) / analysisResults.length);
    const verdict = getVerdict(overallConfidence);

    analysisEmbed.addFields(
      {
        name: '📊 Confidence Score',
        value: `**${overallConfidence}%**`,
        inline: true
      },
      {
        name: '🔎 Verdict',
        value: `${verdict.emoji} ${verdict.text}`,
        inline: true
      }
    );

    if (picks.length > 1) {
      analysisEmbed.addFields({
        name: '🎯 Parlay Notes',
        value: 'Multi-leg parlays carry increased risk. Consider individual pick strength and correlation.',
        inline: false
      });
    }

    // Create action buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('detailed_analysis')
          .setLabel('Detailed Analysis')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📈'),
        new ButtonBuilder()
          .setCustomId('track_performance')
          .setLabel('Track Performance')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      );

    await interaction.editReply({
      embeds: [analysisEmbed],
      components: [actionRow]
    });

    // Update usage count
    await commandUsageService.incrementUsage(userId, 'ask_unit_talk', today);

    // Log usage
    logger.info(`Ask Unit Talk used by ${interaction.user.username}`, {
      service: 'unit-talk-bot',
      userId: interaction.user.id,
      picksAnalyzed: picks.length,
      picks: picks
    });

  } catch (error) {
    logger.error('Error in ask-unit-talk command:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while analyzing your picks. Please try again later.'
      });
    } else {
      await interaction.reply({
        content: '❌ An error occurred while analyzing your picks. Please try again later.',
        ephemeral: true
      });
    }
  }
}

// AI Analysis simulation (replace with actual AI service call)
async function analyzePicksWithAI(picks: string[]) {
  // This is a mock implementation - replace with actual AI analysis
  return picks.map(pick => {
    const confidence = Math.floor(Math.random() * 30) + 70; // 70-100%
    
    return {
      matchup: `vs ${getRandomTeam()}, pace up, favorable matchup`,
      lineMovement: `opened ${getRandomLine()} → ${getRandomLine()}, ${getRandomOdds()} odds holding`,
      dvp: `favorable (Top ${Math.floor(Math.random() * 15) + 10})`,
      evSignal: Math.random() > 0.3 ? '✅ Confirmed by model' : '⚠️ Mixed signals',
      tier: Math.random() > 0.5 ? 'S' : 'A',
      confidence: confidence
    };
  });
}

function getVerdict(confidence: number) {
  if (confidence >= 85) {
    return { emoji: '🔥', text: 'Green light — high edge & role stability' };
  } else if (confidence >= 70) {
    return { emoji: '✅', text: 'Confident play with solid fundamentals' };
  } else if (confidence >= 55) {
    return { emoji: '⚠️', text: 'Proceed with caution — mixed signals' };
  } else {
    return { emoji: '🧪', text: 'Risky play — consider fading' };
  }
}

function getRandomTeam() {
  const teams = ['NYK', 'LAL', 'GSW', 'BOS', 'MIA', 'PHX', 'DEN', 'MIL'];
  return teams[Math.floor(Math.random() * teams.length)];
}

function getRandomLine() {
  return (Math.random() * 10 + 15).toFixed(1);
}

function getRandomOdds() {
  const odds = ['-110', '-115', '-105', '+100', '+105'];
  return odds[Math.floor(Math.random() * odds.length)];
}