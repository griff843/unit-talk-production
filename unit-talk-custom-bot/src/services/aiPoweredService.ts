import { Client, GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { AICoachingSession, AIGradingResult, MultiLangResponse, UserTier } from '../types';
import { logger } from '../utils/logger';
import { botConfig } from '../config';
import axios from 'axios';

export class AIPoweredService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private aiApiKey: string;
  private aiBaseUrl: string;
  private activeCoachingSessions: Map<string, AICoachingSession> = new Map();

  constructor(client: Client, supabaseService: SupabaseService, permissionsService: PermissionsService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.aiApiKey = process.env.AI_API_KEY || '';
    this.aiBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  }

  /**
   * AI-powered pick grading with detailed analysis
   */
  async gradePickWithAI(pickData: any, actualResult: any): Promise<AIGradingResult> {
    try {
      const prompt = this.createGradingPrompt(pickData, actualResult);
      
      const response = await axios.post(`${this.aiBaseUrl}/chat/completions`, {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert sports betting analyst. Provide detailed analysis of betting picks including accuracy assessment, reasoning evaluation, and improvement suggestions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${this.aiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiAnalysis = response.data.choices[0].message.content;
      
      const gradingResult: AIGradingResult = {
        pickId: pickData.id,
        grade: this.convertGradeToNumber(this.extractGradeFromAnalysis(aiAnalysis)),
        accuracy: this.extractAccuracyScore(aiAnalysis),
        reasoning: this.extractReasoningFromAnalysis(aiAnalysis),
        suggestions: this.extractImprovementSuggestions(aiAnalysis),
        confidence: this.assessConfidenceAccuracy(pickData, actualResult),
        analysis: {
          strengths: this.extractStrengths(aiAnalysis),
          weaknesses: this.extractWeaknesses(aiAnalysis),
          marketAnalysis: await this.getMarketAnalysis(pickData),
          riskAssessment: this.extractRiskAssessment(aiAnalysis)
        },
        gradedAt: new Date(),
        gradedBy: 'ai' as const,
        accuracyScore: this.extractAccuracyScore(aiAnalysis)
      };

      // Store grading result
      await this.supabaseService.client
        .from('ai_grading_results')
        .insert(gradingResult);

      // Send grading result to user if VIP+
      const member = await this.client.guilds.cache.first()?.members.fetch(pickData.userId);
      if (member && this.permissionsService.getUserTier(member) === 'vip_plus') {
        await this.sendGradingResultDM(member, gradingResult);
      }

      logger.info(`AI graded pick ${pickData.id} with score ${gradingResult.grade}`);
      return gradingResult;

    } catch (error) {
      logger.error('Failed to grade pick with AI:', error);
      throw error;
    }
  }

  /**
   * Start AI coaching session for VIP+ users
   */
  async startCoachingSession(userId: string, sessionType: string): Promise<AICoachingSession> {
    try {
      const member = await this.client.guilds.cache.first()?.members.fetch(userId);
      if (!member || this.permissionsService.getUserTier(member) !== 'vip_plus') {
        throw new Error('AI coaching is only available for VIP+ members');
      }

      // Get user's betting history
      const userHistory = await this.getUserBettingHistory(userId);
      
      // Create coaching session
      const session: AICoachingSession = {
        id: `coaching_${Date.now()}_${userId}`,
        userId: userId,
        sessionType: sessionType,
        startedAt: new Date(),
        lastActivity: new Date(),
        status: 'active',
        messages: [],
        userProfile: await this.getUserProfile(userId),
        currentFocus: sessionType,
        improvementAreas: await this.identifyImprovementAreas(userId),
        goals: []
      };

      this.activeCoachingSessions.set(session.id, session);

      // Generate initial coaching message
      const initialMessage = await this.generateCoachingMessage(session, 'welcome');
      session.messages.push({
        role: 'assistant',
        content: initialMessage,
        timestamp: new Date()
      });

      // Send initial coaching message
      await this.sendCoachingMessage(userId, initialMessage, session.id);

      // Store session
      await this.supabaseService.client
        .from('ai_coaching_sessions')
        .insert({
          id: session.id,
          user_id: userId,
          session_type: sessionType,
          session_data: session,
          started_at: session.startedAt
        });

      logger.info(`Started AI coaching session for user ${userId}`);
      return session;

    } catch (error) {
      logger.error(`Failed to start coaching session for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Continue AI coaching conversation
   */
  async continueCoachingSession(sessionId: string, userMessage: string): Promise<string> {
    try {
      const session = this.activeCoachingSessions.get(sessionId);
      if (!session) {
        throw new Error('Coaching session not found');
      }

      // Add user message to session
      session.messages.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      });

      // Generate AI response
      const aiResponse = await this.generateCoachingResponse(session, userMessage);

      // Add AI response to session
      session.messages.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      });

      // Update session in database
      await this.supabaseService.client
        .from('ai_coaching_sessions')
        .update({
          session_data: session,
          updated_at: new Date()
        })
        .eq('id', sessionId);

      return aiResponse;

    } catch (error) {
      logger.error(`Failed to continue coaching session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Generate multi-lingual response for VIP+ users
   */
  async generateMultiLingualResponse(content: string, targetLanguage: string, userId: string): Promise<MultiLangResponse> {
    try {
      const member = await this.client.guilds.cache.first()?.members.fetch(userId);
      if (!member || this.permissionsService.getUserTier(member) !== 'vip_plus') {
        throw new Error('Multi-lingual support is only available for VIP+ members');
      }

      const translationPrompt = `Translate the following sports betting content to ${targetLanguage}. Maintain the technical accuracy and betting terminology:\n\n${content}`;

      const response = await axios.post(`${this.aiBaseUrl}/chat/completions`, {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator specializing in sports betting content. Translate accurately while preserving betting terminology and context.`
          },
          {
            role: 'user',
            content: translationPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1500
      }, {
        headers: {
          'Authorization': `Bearer ${this.aiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const translatedContent = response.data.choices[0].message.content;

      const multiLangResponse: MultiLangResponse = {
        id: `translation_${Date.now()}_${userId}`,
        originalContent: content,
        translatedContent: translatedContent,
        sourceLanguage: 'en',
        targetLanguage: targetLanguage,
        userId: userId,
        createdAt: new Date(),
        confidence: 0.95 // Would be calculated based on AI response
      };

      // Store translation
      await this.supabaseService.client
        .from('multi_lang_responses')
        .insert(multiLangResponse);

      logger.info(`Generated multi-lingual response for user ${userId} in ${targetLanguage}`);
      return multiLangResponse;

    } catch (error) {
      logger.error(`Failed to generate multi-lingual response for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Analyze user's betting patterns and provide insights
   */
  async analyzeBettingPatterns(userId: string): Promise<any> {
    try {
      const userHistory = await this.getUserBettingHistory(userId);
      if (userHistory.length === 0) {
        return { message: 'Not enough betting history for analysis' };
      }

      const analysisPrompt = this.createPatternAnalysisPrompt(userHistory);

      const response = await axios.post(`${this.aiBaseUrl}/chat/completions`, {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert sports betting analyst. Analyze betting patterns and provide actionable insights for improvement.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1200
      }, {
        headers: {
          'Authorization': `Bearer ${this.aiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const analysis = response.data.choices[0].message.content;

      const patternAnalysis = {
        userId: userId,
        analysis: analysis,
        strengths: this.extractStrengths(analysis),
        weaknesses: this.extractWeaknesses(analysis),
        recommendations: this.extractRecommendations(analysis),
        riskAssessment: this.assessRiskLevel(userHistory),
        profitabilityTrend: this.calculateProfitabilityTrend(userHistory),
        analyzedAt: new Date().toISOString()
      };

      // Store analysis
      await this.supabaseService.client
        .from('betting_pattern_analyses')
        .insert(patternAnalysis);

      return patternAnalysis;

    } catch (error) {
      logger.error(`Failed to analyze betting patterns for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate personalized pick recommendations
   */
  async generatePickRecommendations(userId: string, gameData: any[]): Promise<any[]> {
    try {
      const member = await this.client.guilds.cache.first()?.members.fetch(userId);
      if (!member || this.permissionsService.getUserTier(member) !== 'vip_plus') {
        throw new Error('Personalized recommendations are only available for VIP+ members');
      }

      const userProfile = await this.getUserProfile(userId);
      const userHistory = await this.getUserBettingHistory(userId);
      
      const recommendationPrompt = this.createRecommendationPrompt(userProfile, userHistory, gameData);

      const response = await axios.post(`${this.aiBaseUrl}/chat/completions`, {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert sports betting advisor. Generate personalized pick recommendations based on user history and preferences.'
          },
          {
            role: 'user',
            content: recommendationPrompt
          }
        ],
        temperature: 0.4,
        max_tokens: 1500
      }, {
        headers: {
          'Authorization': `Bearer ${this.aiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const recommendations = this.parseRecommendations(response.data.choices[0].message.content);

      // Store recommendations
      await this.supabaseService.client
        .from('ai_pick_recommendations')
        .insert({
          user_id: userId,
          recommendations: recommendations,
          generated_at: new Date().toISOString()
        });

      return recommendations;

    } catch (error) {
      logger.error(`Failed to generate pick recommendations for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Provide real-time coaching during live games
   */
  async provideLiveCoaching(userId: string, gameId: string, currentSituation: any): Promise<string> {
    try {
      const member = await this.client.guilds.cache.first()?.members.fetch(userId);
      if (!member || this.permissionsService.getUserTier(member) !== 'vip_plus') {
        throw new Error('Live coaching is only available for VIP+ members');
      }

      const coachingPrompt = `Provide real-time coaching advice for this live betting situation:
        Game: ${currentSituation.game}
        Current Score: ${currentSituation.score}
        Time Remaining: ${currentSituation.timeRemaining}
        User's Position: ${currentSituation.userPosition}
        Available Bets: ${JSON.stringify(currentSituation.availableBets)}
        
        Provide specific, actionable advice for this moment.`;

      const response = await axios.post(`${this.aiBaseUrl}/chat/completions`, {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a live sports betting coach. Provide real-time, specific advice for live betting situations.'
          },
          {
            role: 'user',
            content: coachingPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      }, {
        headers: {
          'Authorization': `Bearer ${this.aiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const coachingAdvice = response.data.choices[0].message.content;

      // Log live coaching session
      await this.supabaseService.client
        .from('live_coaching_sessions')
        .insert({
          user_id: userId,
          game_id: gameId,
          situation: currentSituation,
          advice: coachingAdvice,
          created_at: new Date().toISOString()
        });

      return coachingAdvice;

    } catch (error) {
      logger.error(`Failed to provide live coaching for ${userId}:`, error);
      throw error;
    }
  }

  // Private helper methods
  private createGradingPrompt(pickData: any, actualResult: any): string {
    return `Analyze this sports betting pick:
      
      Pick Details:
      - Teams: ${pickData.teams}
      - Pick: ${pickData.pick}
      - Units: ${pickData.units}
      - Odds: ${pickData.odds}
      - Confidence: ${pickData.confidence}%
      - Reasoning: ${pickData.reasoning}
      
      Actual Result:
      - Final Score: ${actualResult.finalScore}
      - Pick Result: ${actualResult.result}
      - Game Flow: ${actualResult.gameFlow}
      
      Please provide:
      1. Overall grade (A-F)
      2. Accuracy score (1-10)
      3. Reasoning quality score (1-10)
      4. Specific improvement suggestions
      5. Analysis of what went right/wrong`;
  }

  private async generateCoachingMessage(session: AICoachingSession, messageType: string): Promise<string> {
    const prompt = `Generate a ${messageType} message for an AI coaching session:
      
      User Profile: ${JSON.stringify(session.userProfile)}
      Session Type: ${session.sessionType}
      Improvement Areas: ${JSON.stringify(session.improvementAreas)}
      
      Create a personalized, encouraging, and actionable coaching message.`;

    const response = await axios.post(`${this.aiBaseUrl}/chat/completions`, {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional sports betting coach. Create personalized, encouraging coaching messages.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 600
    }, {
      headers: {
        'Authorization': `Bearer ${this.aiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  }

  private async generateCoachingResponse(session: AICoachingSession, userMessage: string): Promise<string> {
    const conversationHistory = session.messages.slice(-10); // Last 10 messages for context
    
    const messages = [
      {
        role: 'system',
        content: `You are an AI sports betting coach. Continue this coaching conversation based on the user's profile and history. Be supportive, specific, and actionable.
        
        User Profile: ${JSON.stringify(session.userProfile)}
        Session Focus: ${session.currentFocus}
        Improvement Areas: ${JSON.stringify(session.improvementAreas)}`
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await axios.post(`${this.aiBaseUrl}/chat/completions`, {
      model: 'gpt-4',
      messages: messages,
      temperature: 0.5,
      max_tokens: 800
    }, {
      headers: {
        'Authorization': `Bearer ${this.aiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  }

  private async sendGradingResultDM(member: GuildMember, result: AIGradingResult): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('🤖 AI Pick Analysis Complete')
        .setDescription(`Your pick has been analyzed by our AI system.`)
        .addFields(
          { name: 'Overall Grade', value: result.grade.toString(), inline: true },
          { name: 'Accuracy Score', value: `${result.accuracyScore}/10`, inline: true },
          { name: 'Reasoning Score', value: `${result.reasoningScore}/10`, inline: true }
        )
        .setColor('#4169E1')
        .setTimestamp();

      if (result.improvementSuggestions && result.improvementSuggestions.length > 0) {
        embed.addFields({
          name: 'Improvement Suggestions',
          value: result.improvementSuggestions.slice(0, 3).join('\n'),
          inline: false
        });
      }

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`view_full_analysis_${result.pickId}`)
            .setLabel('View Full Analysis')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId(`start_coaching_${member.id}`)
            .setLabel('Start Coaching')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎯')
        );

      await member.send({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      logger.error('Failed to send grading result DM:', error);
    }
  }

  private async sendCoachingMessage(userId: string, message: string, sessionId: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('🎯 AI Coaching Session')
        .setDescription(message)
        .setColor('#FFD700')
        .setTimestamp()
        .setFooter({ text: `Session ID: ${sessionId}` });

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`coaching_continue_${sessionId}`)
            .setLabel('Continue Session')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💬'),
          new ButtonBuilder()
            .setCustomId(`coaching_end_${sessionId}`)
            .setLabel('End Session')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛑')
        );

      await user.send({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      logger.error('Failed to send coaching message:', error);
    }
  }

  // Additional helper methods for data extraction and analysis
  private extractGradeFromAnalysis(analysis: string): string {
    const gradeMatch = analysis.match(/grade[:\s]*([A-F][+-]?)/i);
    return gradeMatch && gradeMatch[1] ? gradeMatch[1] : 'C';
  }

  private convertGradeToNumber(grade: string): number {
    const gradeMap: Record<string, number> = {
      'A+': 4.3,
      'A': 4.0,
      'A-': 3.7,
      'B+': 3.3,
      'B': 3.0,
      'B-': 2.7,
      'C+': 2.3,
      'C': 2.0,
      'C-': 1.7,
      'D+': 1.3,
      'D': 1.0,
      'D-': 0.7,
      'F': 0.0
    };
    const upperGrade = grade.toUpperCase();
    return gradeMap[upperGrade] !== undefined ? gradeMap[upperGrade] : 2.0; // Default to 'C' numeric value if unknown
  }

  private extractAccuracyScore(analysis: string): number {
    const scoreMatch = analysis.match(/accuracy[:\s]*(\d+)/i);
    return scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1]) : 5;
  }

  private extractReasoningScore(analysis: string): number {
    const scoreMatch = analysis.match(/reasoning[:\s]*(\d+)/i);
    return scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1]) : 5;
  }

  private extractImprovementSuggestions(analysis: string): string[] {
    // Extract improvement suggestions from AI analysis
    const suggestions = analysis.split('\n')
      .filter(line => line.includes('suggest') || line.includes('improve') || line.includes('consider'))
      .slice(0, 5);
    return suggestions;
  }

  private assessConfidenceAccuracy(pickData: any, actualResult: any): string {
    const confidence = pickData.confidence;
    const wasCorrect = actualResult.result === 'won';
    
    if (wasCorrect && confidence >= 80) return 'Excellent - High confidence, correct outcome';
    if (wasCorrect && confidence < 50) return 'Lucky - Low confidence but correct';
    if (!wasCorrect && confidence >= 80) return 'Overconfident - High confidence but incorrect';
    if (!wasCorrect && confidence < 50) return 'Appropriate - Low confidence, incorrect outcome';
    return 'Moderate confidence level';
  }

  private async getMarketAnalysis(pickData: any): Promise<string> {
    // Implementation for market analysis
    return 'Market analysis would be implemented here';
  }

  private async getUserBettingHistory(userId: string): Promise<any[]> {
    const { data } = await this.supabaseService.client
      .from('user_picks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    return data || [];
  }

  private async getUserProfile(userId: string): Promise<any> {
    const { data } = await this.supabaseService.client
      .from('user_profiles')
      .select('*')
      .eq('discord_id', userId)
      .single();

    return data;
  }

  private async identifyImprovementAreas(userId: string): Promise<string[]> {
    const history = await this.getUserBettingHistory(userId);
    const areas = [];

    // Analyze betting patterns to identify improvement areas
    const winRate = history.filter(p => p.result === 'won').length / history.length;
    if (winRate < 0.5) areas.push('Pick Selection');
    
    const avgUnits = history.reduce((sum, p) => sum + p.units, 0) / history.length;
    if (avgUnits > 3) areas.push('Bankroll Management');

    return areas;
  }

  private createPatternAnalysisPrompt(userHistory: any[]): string {
    return `Analyze this user's betting history and identify patterns:
      
      ${JSON.stringify(userHistory.slice(0, 20))}
      
      Provide insights on:
      1. Betting patterns and tendencies
      2. Strengths and weaknesses
      3. Risk management
      4. Specific recommendations for improvement`;
  }

  private createRecommendationPrompt(userProfile: any, userHistory: any[], gameData: any[]): string {
    return `Generate personalized pick recommendations:
      
      User Profile: ${JSON.stringify(userProfile)}
      Recent History: ${JSON.stringify(userHistory.slice(0, 10))}
      Available Games: ${JSON.stringify(gameData)}
      
      Recommend 2-3 picks that match this user's style and improve their chances of success.`;
  }

  private parseRecommendations(aiResponse: string): any[] {
    // Parse AI response to extract structured recommendations
    return []; // Implementation would parse the AI response
  }

  private extractStrengths(analysis: string): string[] {
    return analysis.split('\n').filter(line => line.toLowerCase().includes('strength')).slice(0, 3);
  }

  private extractWeaknesses(analysis: string): string[] {
    return analysis.split('\n').filter(line => line.toLowerCase().includes('weakness')).slice(0, 3);
  }

  private extractRecommendations(analysis: string): string[] {
    return analysis.split('\n').filter(line => line.toLowerCase().includes('recommend')).slice(0, 5);
  }

  private assessRiskLevel(userHistory: any[]): string {
    const avgUnits = userHistory.reduce((sum, p) => sum + p.units, 0) / userHistory.length;
    if (avgUnits > 5) return 'High Risk';
    if (avgUnits > 2) return 'Moderate Risk';
    return 'Low Risk';
  }

  private calculateProfitabilityTrend(userHistory: any[]): string {
    // Calculate profitability trend over time
    const recentProfits = userHistory.slice(0, 10).map(p => p.result === 'won' ? p.units : -p.units);
    const trend = recentProfits.reduce((sum, profit) => sum + profit, 0);

    if (trend > 5) return 'Strongly Positive';
    if (trend > 0) return 'Positive';
    if (trend > -5) return 'Neutral';
    return 'Negative';
  }

  /**
   * Extract reasoning from AI analysis
   */
  private extractReasoningFromAnalysis(analysis: string): string {
    // Extract reasoning from AI analysis text
    const reasoningMatch = analysis.match(/reasoning[:\s]+(.*?)(?:\n|$)/i);
    return reasoningMatch ? reasoningMatch[1].trim() : 'No specific reasoning provided';
  }

  /**
   * Extract risk assessment from AI analysis
   */
  private extractRiskAssessment(analysis: string): string {
    // Extract risk assessment from AI analysis text
    const riskMatch = analysis.match(/risk[:\s]+(low|medium|high)/i);
    return riskMatch ? riskMatch[1].toLowerCase() : 'medium';
  }

  /**
   * Convert grade string to number
   */
  private convertGradeToNumber(grade: string): number {
    const gradeMap: { [key: string]: number } = {
      'A+': 97, 'A': 93, 'A-': 90,
      'B+': 87, 'B': 83, 'B-': 80,
      'C+': 77, 'C': 73, 'C-': 70,
      'D+': 67, 'D': 63, 'D-': 60,
      'F': 50
    };
    return gradeMap[grade] || 75;
  }

  /**
   * Assess confidence accuracy
   */
  private assessConfidenceAccuracy(pickData: any, actualResult: any): number {
    const confidence = pickData.confidence || 0.5;
    const wasCorrect = actualResult?.result === 'won';

    if (wasCorrect && confidence > 0.7) return 0.9;
    if (wasCorrect && confidence > 0.5) return 0.8;
    if (!wasCorrect && confidence < 0.5) return 0.7;
    return 0.6;
  }
}