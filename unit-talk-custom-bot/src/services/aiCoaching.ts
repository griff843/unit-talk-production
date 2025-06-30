import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { databaseService, UserTier } from './database';

export interface AIAnalysisRequest {
  question: string;
  userTier: UserTier;
  userHistory: {
    totalPicks: number;
    winRate: number;
    totalProfit: number;
    recentPicks: Array<{
      pickType: string;
      result: string;
      stake: number;
      profitLoss: number;
      reasoning?: string;
    }>;
  };
  context?: {
    sport?: string;
    league?: string;
    gameTime?: string;
    weather?: string;
    injuries?: string[];
  };
}

export interface AIAnalysisResponse {
  analysis: string;
  keyInsights: string[];
  recommendations: string[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
  confidence: number;
  followUpQuestions: string[];
}

export interface CoachingSession {
  id: string;
  userId: string;
  discordId: string;
  sessionType: 'ai_analysis' | 'strategy_review' | 'bankroll_management' | 'general_coaching';
  questions: Array<{
    question: string;
    response: AIAnalysisResponse;
    timestamp: string;
  }>;
  startedAt: string;
  status: 'active' | 'completed';
  metadata: {
    userTier: UserTier;
    totalQuestions: number;
    sessionDuration?: number;
  };
}

class AICoachingService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private preferredProvider: 'openai' | 'claude' = 'openai';

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    try {
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        logger.info('OpenAI client initialized');
      }

      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });
        logger.info('Anthropic client initialized');
      }

      if (!this.openai && !this.anthropic) {
        logger.warn('No AI providers configured. AI coaching will use fallback responses.');
      }
    } catch (error) {
      logger.error('Error initializing AI providers:', error);
    }
  }

  /**
   * Generate AI analysis based on user question and betting history
   */
  async generateAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      // Use AI provider if available, otherwise fallback to rule-based analysis
      if (this.preferredProvider === 'openai' && this.openai) {
        return await this.generateOpenAIAnalysis(request);
      } else if (this.preferredProvider === 'claude' && this.anthropic) {
        return await this.generateClaudeAnalysis(request);
      } else {
        return this.generateFallbackAnalysis(request);
      }
    } catch (error) {
      logger.error('Error generating AI analysis:', error);
      return this.generateFallbackAnalysis(request);
    }
  }

  private async generateOpenAIAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const systemPrompt = this.buildSystemPrompt(request.userTier);
    const userPrompt = this.buildUserPrompt(request);

    const completion = await this.openai.chat.completions.create({
      model: request.userTier === 'vip_plus' ? 'gpt-4' : 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: request.userTier === 'vip_plus' ? 1500 : 800,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error('No response from OpenAI');

    return JSON.parse(response) as AIAnalysisResponse;
  }

  private async generateClaudeAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (!this.anthropic) throw new Error('Anthropic not initialized');

    const systemPrompt = this.buildSystemPrompt(request.userTier);
    const userPrompt = this.buildUserPrompt(request);

    const message = await this.anthropic.messages.create({
      model: request.userTier === 'vip_plus' ? 'claude-3-opus-20240229' : 'claude-3-sonnet-20240229',
      max_tokens: request.userTier === 'vip_plus' ? 1500 : 800,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const response = message.content[0];
    if (response.type !== 'text') throw new Error('Invalid response type from Claude');

    return JSON.parse(response.text) as AIAnalysisResponse;
  }

  private generateFallbackAnalysis(request: AIAnalysisRequest): AIAnalysisResponse {
    const { question, userHistory, userTier } = request;
    
    // Rule-based analysis based on user history and question patterns
    const keyInsights = this.generateKeyInsights(userHistory, question);
    const recommendations = this.generateRecommendations(userHistory, userTier, question);
    const riskAssessment = this.assessRisk(question, userHistory);
    
    return {
      analysis: this.generateFallbackAnalysisText(question, userHistory, keyInsights),
      keyInsights,
      recommendations,
      riskAssessment,
      confidence: 75, // Moderate confidence for rule-based analysis
      followUpQuestions: this.generateFollowUpQuestions(question, userTier)
    };
  }

  private buildSystemPrompt(userTier: UserTier): string {
    const basePrompt = `You are an expert sports betting coach and analyst. Your role is to provide personalized betting advice, strategy guidance, and risk management recommendations.

Key principles:
- Always emphasize responsible gambling and bankroll management
- Provide data-driven insights when possible
- Consider the user's betting history and patterns
- Tailor advice to the user's experience level and tier
- Never guarantee wins or encourage reckless betting
- Focus on long-term profitability and sustainable strategies

Response format: Return a valid JSON object with the following structure:
{
  "analysis": "Detailed analysis of the question/scenario",
  "keyInsights": ["insight1", "insight2", "insight3"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "riskAssessment": {
    "level": "low|medium|high",
    "factors": ["factor1", "factor2"]
  },
  "confidence": 85,
  "followUpQuestions": ["question1", "question2"]
}`;

    const tierSpecificPrompts = {
      member: `\nUser Tier: MEMBER - Provide basic analysis with fundamental concepts. Focus on education and risk management.`,
      trial: `\nUser Tier: TRIAL - Provide basic analysis with fundamental concepts and encourage upgrade for advanced features.`,
      vip: `\nUser Tier: VIP - Provide intermediate analysis with market insights and strategic considerations.`,
      vip_plus: `\nUser Tier: VIP+ - Provide advanced analysis with sophisticated strategies, market inefficiencies, and professional-level insights.`,
      capper: `\nUser Tier: CAPPER - Provide analysis focused on pick quality, market analysis, and professional betting strategies.`,
      staff: `\nUser Tier: STAFF - Provide comprehensive analysis suitable for someone with betting industry knowledge.`,
      admin: `\nUser Tier: ADMIN - Provide expert-level analysis with advanced concepts and industry insights.`,
      owner: `\nUser Tier: OWNER - Provide the highest level of analysis with cutting-edge strategies and market intelligence.`
    };

    return basePrompt + tierSpecificPrompts[userTier];
  }

  private buildUserPrompt(request: AIAnalysisRequest): string {
    const { question, userHistory, context } = request;
    
    let prompt = `User Question: "${question}"\n\n`;
    
    prompt += `User Betting History:
- Total Picks: ${userHistory.totalPicks}
- Win Rate: ${(userHistory.winRate * 100).toFixed(1)}%
- Total Profit/Loss: ${userHistory.totalProfit > 0 ? '+' : ''}${userHistory.totalProfit} units
- Recent Performance: ${userHistory.recentPicks.length} recent picks\n\n`;

    if (userHistory.recentPicks.length > 0) {
      prompt += `Recent Picks Analysis:\n`;
      userHistory.recentPicks.forEach((pick, index) => {
        prompt += `${index + 1}. ${pick.pickType} - ${pick.result} (${pick.profitLoss > 0 ? '+' : ''}${pick.profitLoss} units)`;
        if (pick.reasoning) prompt += ` - Reasoning: ${pick.reasoning}`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    if (context) {
      prompt += `Additional Context:\n`;
      if (context.sport) prompt += `- Sport: ${context.sport}\n`;
      if (context.league) prompt += `- League: ${context.league}\n`;
      if (context.gameTime) prompt += `- Game Time: ${context.gameTime}\n`;
      if (context.weather) prompt += `- Weather: ${context.weather}\n`;
      if (context.injuries?.length) prompt += `- Key Injuries: ${context.injuries.join(', ')}\n`;
      prompt += '\n';
    }

    prompt += `Please provide a comprehensive analysis addressing the user's question while considering their betting history and performance patterns.`;

    return prompt;
  }

  private generateKeyInsights(userHistory: any, question: string): string[] {
    const insights: string[] = [];

    if (userHistory.winRate < 0.45) {
      insights.push('Your recent win rate suggests focusing on bet selection quality over quantity');
    } else if (userHistory.winRate > 0.60) {
      insights.push('Strong win rate indicates good analytical skills - consider increasing unit sizes gradually');
    }

    if (userHistory.totalProfit < 0) {
      insights.push('Current negative ROI suggests reviewing bankroll management and bet sizing strategy');
    }

    if (question.toLowerCase().includes('parlay') || question.toLowerCase().includes('combo')) {
      insights.push('Parlays have exponentially lower win probability - consider single bets for better long-term results');
    }

    if (question.toLowerCase().includes('chase') || question.toLowerCase().includes('double')) {
      insights.push('Chasing losses is a common pitfall - stick to your predetermined unit sizes');
    }

    return insights.slice(0, 3); // Limit to 3 key insights
  }

  private generateRecommendations(userHistory: any, userTier: UserTier, _question: string): string[] {
    const recommendations: string[] = [];
    
    // Tier-based recommendations
    if (userTier === 'member') {
      recommendations.push('Focus on learning fundamental analysis before increasing bet sizes');
      recommendations.push('Keep detailed records of all bets to identify patterns');
    } else if (userTier === 'vip_plus') {
      recommendations.push('Consider advanced strategies like arbitrage or value betting');
      recommendations.push('Analyze market inefficiencies and line shopping opportunities');
    }
    
    // History-based recommendations
    if (userHistory.totalPicks < 50) {
      recommendations.push('Build a larger sample size before drawing conclusions about your strategy');
    }
    
    if (userHistory.winRate > 0.55 && userHistory.totalProfit > 0) {
      recommendations.push('Your strategy is working - maintain consistency and gradually scale up');
    }
    
    return recommendations.slice(0, 3);
  }

  private assessRisk(question: string, userHistory: any): { level: 'low' | 'medium' | 'high'; factors: string[] } {
    const factors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    if (question.toLowerCase().includes('all in') || question.toLowerCase().includes('max bet')) {
      factors.push('High stake betting mentioned');
      riskLevel = 'high';
    }

    if (question.toLowerCase().includes('parlay') || question.toLowerCase().includes('combo')) {
      factors.push('Multi-leg betting increases variance');
      riskLevel = 'high';
    }

    if (userHistory.winRate < 0.40) {
      factors.push('Below-average win rate indicates higher risk');
      riskLevel = 'high';
    }

    if (userHistory.totalProfit < -50) {
      factors.push('Significant losses suggest risk management issues');
      riskLevel = 'high';
    }

    if (factors.length === 0) {
      factors.push('Standard betting scenario');
      riskLevel = 'low';
    }

    return { level: riskLevel, factors };
  }

  private generateFallbackAnalysisText(_question: string, userHistory: any, insights: string[]): string {
    return `Based on your question and betting history, here's my analysis:

Your current performance shows ${userHistory.totalPicks} total picks with a ${(userHistory.winRate * 100).toFixed(1)}% win rate and ${userHistory.totalProfit > 0 ? 'a profit' : 'a loss'} of ${Math.abs(userHistory.totalProfit)} units.

${insights.join(' ')}

The key to long-term success in sports betting is maintaining discipline, proper bankroll management, and continuous learning from both wins and losses.`;
  }

  private generateFollowUpQuestions(_question: string, userTier: UserTier): string[] {
    const baseQuestions = [
      'What\'s your current bankroll management strategy?',
      'How do you typically research your bets?'
    ];

    if (userTier === 'vip_plus') {
      baseQuestions.push('Are you interested in exploring advanced betting strategies?');
      baseQuestions.push('Do you track closing line value on your bets?');
    }

    return baseQuestions;
  }

  /**
   * Create a new coaching session
   */
  async createCoachingSession(userId: string, discordId: string, sessionType: CoachingSession['sessionType'], userTier: UserTier): Promise<string> {
    try {
      const session = await databaseService.createCoachingSession({
        user_id: userId,
        discord_id: discordId,
        coach_id: 'ai_coach',
        session_type: sessionType,
        status: 'in_progress',
        scheduled_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        notes: `AI coaching session started for ${userTier} user`,
        feedback: {
          userTier,
          totalQuestions: 0,
          sessionStarted: new Date().toISOString()
        }
      });

      if (!session) {
        throw new Error('Failed to create coaching session');
      }

      logger.info('Coaching session created', {
        sessionId: session.id,
        userId,
        sessionType,
        userTier
      });

      return session.id;
    } catch (error) {
      logger.error('Error creating coaching session:', error);
      throw error;
    }
  }

  /**
   * Add Q&A to existing coaching session
   */
  async addQuestionToSession(sessionId: string, question: string, response: AIAnalysisResponse): Promise<boolean> {
    try {
      const session = await databaseService.getCoachingSession(sessionId);
      if (!session) {
        throw new Error('Coaching session not found');
      }

      const currentFeedback = session.feedback as any || {};
      const questions = currentFeedback.questions || [];
      
      questions.push({
        question,
        response,
        timestamp: new Date().toISOString()
      });

      const updatedFeedback = {
        ...currentFeedback,
        questions,
        totalQuestions: questions.length,
        lastActivity: new Date().toISOString()
      };

      const success = await databaseService.updateCoachingSession(sessionId, {
        feedback: updatedFeedback,
        notes: `${questions.length} questions asked in this session`
      });

      if (success) {
        logger.info('Question added to coaching session', {
          sessionId,
          questionCount: questions.length
        });
      }

      return success;
    } catch (error) {
      logger.error('Error adding question to session:', error);
      return false;
    }
  }

  /**
   * Complete a coaching session
   */
  async completeCoachingSession(sessionId: string): Promise<boolean> {
    try {
      const session = await databaseService.getCoachingSession(sessionId);
      if (!session) {
        return false;
      }

      const startTime = new Date(session.started_at || session.created_at);
      const endTime = new Date();
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      const success = await databaseService.updateCoachingSession(sessionId, {
        status: 'completed',
        completed_at: endTime.toISOString(),
        duration_minutes: durationMinutes
      });

      if (success) {
        logger.info('Coaching session completed', {
          sessionId,
          durationMinutes
        });
      }

      return success;
    } catch (error) {
      logger.error('Error completing coaching session:', error);
      return false;
    }
  }

  /**
   * Get user's coaching session history
   */
  async getUserCoachingSessions(discordId: string, limit: number = 10): Promise<CoachingSession[]> {
    try {
      const sessions = await databaseService.getUserCoachingSessions(discordId, { limit });
      
      return sessions.map(session => ({
        id: session.id,
        userId: session.user_id,
        discordId: session.discord_id,
        sessionType: session.session_type as CoachingSession['sessionType'],
        questions: (session.feedback as any)?.questions || [],
        startedAt: session.started_at || session.created_at,
        status: session.status === 'completed' ? 'completed' : 'active',
        metadata: {
          userTier: (session.feedback as any)?.userTier || 'member',
          totalQuestions: (session.feedback as any)?.totalQuestions || 0,
          sessionDuration: session.duration_minutes || undefined
        }
      }));
    } catch (error) {
      logger.error('Error fetching user coaching sessions:', error);
      return [];
    }
  }
}

// Export singleton instance
export const aiCoachingService = new AICoachingService();