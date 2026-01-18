/**
 * AI Assistants
 * Phase 12: Specialized AI assistants for different use cases
 *
 * Implements three core assistants:
 * 1. Scoring Copilot - Analyzes picks and provides scoring insights
 * 2. Insight Summarizer - Generates summaries of events and performance
 * 3. Moderator Coach - Assists moderators with decision-making
 */

import { AssistGateway } from './AssistGateway';
import type { AssistantRequest, AssistantResponse, AIMessage } from './types';
import { logger } from '../../shared/logger';

export class ScoringCopilot {
  constructor(private gateway: AssistGateway) {}

  /**
   * Analyze a pick and provide professional betting insights
   */
  async analyzePick(request: {
    pickData: {
      player_name: string;
      stat_type: string;
      line: number;
      over_odds: number;
      under_odds: number;
      professional_score?: number;
      devigged_edge?: number;
      kelly_fraction?: number;
      feature_contributions?: Record<string, number>;
    };
    marketContext?: {
      steam_detected?: boolean;
      clv_prediction?: number;
      timing_score?: number;
      injury_news?: string[];
    };
    tenantId: string;
    userId?: string;
  }): Promise<AssistantResponse> {
    const { pickData, marketContext, tenantId, userId } = request;

    const systemPrompt = `You are an expert sports betting analyst with deep knowledge of:
- Professional betting metrics (CLV, devigged edge, Kelly criterion)
- Market dynamics (steam moves, line movements, public vs sharp money)
- Risk management and bankroll optimization
- Statistical analysis and regression

Provide analysis in a professional, data-driven manner. Focus on actionable insights.
Always acknowledge uncertainty and provide context for your recommendations.`;

    const userPrompt = `Analyze this betting pick:

**Pick Details:**
- Player: ${pickData.player_name}
- Stat Type: ${pickData.stat_type}
- Line: ${pickData.line}
- Over Odds: ${pickData.over_odds}
- Under Odds: ${pickData.under_odds}

**Professional Metrics:**
${pickData.professional_score ? `- Professional Score: ${pickData.professional_score}/100` : ''}
${pickData.devigged_edge ? `- Devigged Edge: ${(pickData.devigged_edge * 100).toFixed(2)}%` : ''}
${pickData.kelly_fraction ? `- Kelly Fraction: ${(pickData.kelly_fraction * 100).toFixed(2)}%` : ''}

**Feature Contributions:**
${pickData.feature_contributions ? Object.entries(pickData.feature_contributions)
  .map(([feature, score]) => `- ${feature}: ${score}/100`)
  .join('\n') : 'Not available'}

**Market Context:**
${marketContext?.steam_detected ? '🔥 Steam move detected' : ''}
${marketContext?.clv_prediction ? `📈 Predicted CLV: ${marketContext.clv_prediction.toFixed(2)}%` : ''}
${marketContext?.timing_score ? `⏰ Timing Score: ${marketContext.timing_score}/100` : ''}
${marketContext?.injury_news?.length ? `🏥 Recent injury news:\n${marketContext.injury_news.join('\n')}` : ''}

Provide a concise professional analysis covering:
1. **Edge Assessment**: Is there genuine value here?
2. **Risk Factors**: What could invalidate this edge?
3. **Sizing Recommendation**: What's the optimal bet size given the metrics?
4. **Timing Considerations**: Is now the right time to bet this?
5. **Overall Recommendation**: Clear action guidance`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const aiResponse = await this.gateway.processRequest({
      messages,
      tenantId,
      userId,
      temperature: 0.7,
      maxTokens: 1500,
      metadata: {
        assistant_type: 'scoring_copilot',
        pick_id: pickData.player_name,
      },
    });

    // Calculate confidence based on available metrics
    const confidence = this.calculateConfidence(pickData, marketContext);

    return {
      type: 'scoring_copilot',
      output: aiResponse.content,
      confidence,
      aiResponse,
      metadata: {
        pickData,
        marketContext,
      },
    };
  }

  private calculateConfidence(
    pickData: any,
    marketContext?: any
  ): number {
    let confidence = 50; // Base confidence

    // Add confidence for professional metrics
    if (pickData.professional_score) {
      confidence += (pickData.professional_score / 100) * 20;
    }

    // Add confidence for devigged edge
    if (pickData.devigged_edge && pickData.devigged_edge > 0) {
      confidence += Math.min(pickData.devigged_edge * 100, 15);
    }

    // Add confidence for market context
    if (marketContext?.steam_detected) confidence += 10;
    if (marketContext?.clv_prediction && marketContext.clv_prediction > 0) confidence += 5;

    return Math.min(Math.max(confidence, 0), 100);
  }
}

export class InsightSummarizer {
  constructor(private gateway: AssistGateway) {}

  /**
   * Generate summary of pick scoring events
   */
  async summarizePickEvent(request: {
    eventType: 'pick.scored' | 'pick.failed';
    eventData: {
      pick_id: string;
      user_name?: string;
      player_name?: string;
      stat_type?: string;
      line?: number;
      result?: string;
      professional_score?: number;
      outcome?: 'win' | 'loss' | 'push';
      actual_value?: number;
      clv?: number;
    };
    tenantId: string;
    userId?: string;
  }): Promise<AssistantResponse> {
    const { eventType, eventData, tenantId, userId } = request;

    const systemPrompt = `You are a sports betting intelligence analyst specializing in post-game analysis.
Generate concise, insightful summaries of betting outcomes focusing on:
- Result analysis (what happened and why)
- CLV (Closing Line Value) performance
- Professional scoring accuracy
- Key takeaways for future bets

Keep summaries brief (3-5 sentences) but impactful.`;

    const userPrompt = eventType === 'pick.scored'
      ? this.buildScoredPickPrompt(eventData)
      : this.buildFailedPickPrompt(eventData);

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const aiResponse = await this.gateway.processRequest({
      messages,
      tenantId,
      userId,
      temperature: 0.6,
      maxTokens: 500,
      metadata: {
        assistant_type: 'insight_summarizer',
        event_type: eventType,
        pick_id: eventData.pick_id,
      },
    });

    return {
      type: 'insight_summarizer',
      output: aiResponse.content,
      confidence: 85, // High confidence for factual summaries
      aiResponse,
      metadata: {
        eventType,
        eventData,
      },
    };
  }

  private buildScoredPickPrompt(data: any): string {
    const outcome = data.outcome === 'win' ? '✅ WIN' : data.outcome === 'loss' ? '❌ LOSS' : '🔄 PUSH';

    return `Summarize this pick result:

**Pick**: ${data.player_name} - ${data.stat_type} ${data.line}
**Result**: ${outcome}
**Actual Value**: ${data.actual_value}
**Professional Score**: ${data.professional_score || 'N/A'}/100
**CLV**: ${data.clv ? `${(data.clv * 100).toFixed(2)}%` : 'N/A'}
**User**: ${data.user_name || 'Unknown'}

Generate a brief, insightful summary focusing on:
1. Outcome analysis (why did it win/lose/push?)
2. Professional score validation (did the score predict correctly?)
3. CLV performance (did we get good line value?)
4. Key lesson learned`;
  }

  private buildFailedPickPrompt(data: any): string {
    return `Analyze this failed pick processing:

**Pick**: ${data.player_name} - ${data.stat_type} ${data.line}
**Status**: Failed to process
**Reason**: ${data.result || 'Unknown error'}
**User**: ${data.user_name || 'Unknown'}

Generate a brief explanation of:
1. What went wrong?
2. Potential causes
3. User impact
4. Recommended action`;
  }

  /**
   * Generate daily/weekly performance summary
   */
  async summarizePerformance(request: {
    period: 'daily' | 'weekly' | 'monthly';
    stats: {
      total_picks: number;
      won_picks: number;
      lost_picks: number;
      pushed_picks: number;
      win_rate: number;
      avg_clv: number;
      avg_professional_score: number;
      total_roi: number;
      best_pick?: {
        player_name: string;
        stat_type: string;
        professional_score: number;
        outcome: string;
      };
      worst_pick?: {
        player_name: string;
        stat_type: string;
        professional_score: number;
        outcome: string;
      };
    };
    tenantId: string;
    userId?: string;
  }): Promise<AssistantResponse> {
    const { period, stats, tenantId, userId } = request;

    const systemPrompt = `You are a performance analyst for a professional sports betting platform.
Generate insightful summaries of betting performance focusing on:
- Win rate and profitability trends
- CLV (Closing Line Value) analysis - the key metric for long-term success
- Professional scoring system accuracy
- Areas for improvement

Be encouraging but honest about performance. Provide actionable insights.`;

    const userPrompt = `Generate a ${period} performance summary:

**Overall Stats:**
- Total Picks: ${stats.total_picks}
- Won: ${stats.won_picks} | Lost: ${stats.lost_picks} | Pushed: ${stats.pushed_picks}
- Win Rate: ${(stats.win_rate * 100).toFixed(1)}%
- Average CLV: ${(stats.avg_clv * 100).toFixed(2)}%
- Average Professional Score: ${stats.avg_professional_score.toFixed(1)}/100
- Total ROI: ${(stats.total_roi * 100).toFixed(2)}%

${stats.best_pick ? `**Best Pick:**
- ${stats.best_pick.player_name} ${stats.best_pick.stat_type}
- Professional Score: ${stats.best_pick.professional_score}/100
- Outcome: ${stats.best_pick.outcome}` : ''}

${stats.worst_pick ? `**Worst Pick:**
- ${stats.worst_pick.player_name} ${stats.worst_pick.stat_type}
- Professional Score: ${stats.worst_pick.professional_score}/100
- Outcome: ${stats.worst_pick.outcome}` : ''}

Provide a concise summary covering:
1. Performance highlights (what went well?)
2. CLV analysis (are we beating the closing line?)
3. Professional score accuracy (is the system working?)
4. Areas for improvement
5. Recommendations for next ${period}`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const aiResponse = await this.gateway.processRequest({
      messages,
      tenantId,
      userId,
      temperature: 0.7,
      maxTokens: 800,
      metadata: {
        assistant_type: 'insight_summarizer',
        summary_type: 'performance',
        period,
      },
    });

    return {
      type: 'insight_summarizer',
      output: aiResponse.content,
      confidence: 90,
      aiResponse,
      metadata: {
        period,
        stats,
      },
    };
  }
}

export class ModeratorCoach {
  constructor(private gateway: AssistGateway) {}

  /**
   * Assist moderators with community management decisions
   */
  async assistModeration(request: {
    scenario: string;
    context: {
      user_tier?: string;
      user_history?: {
        total_picks: number;
        win_rate: number;
        account_age_days: number;
        warnings: number;
      };
      message_content?: string;
      violation_type?: string;
      community_guidelines?: string[];
    };
    tenantId: string;
    userId?: string;
  }): Promise<AssistantResponse> {
    const { scenario, context, tenantId, userId } = request;

    const systemPrompt = `You are an experienced community moderator coach for a premium sports betting platform.
Help moderators make fair, consistent decisions while maintaining community standards.

Key principles:
- Fairness and consistency in rule enforcement
- User education over punishment when possible
- Escalation paths for serious violations
- Balance between strict moderation and community growth
- Protect the integrity of professional betting discussions

Always provide:
1. Recommended action
2. Reasoning based on guidelines
3. How to communicate with the user
4. Follow-up steps if needed`;

    const userPrompt = `Moderator needs guidance on this situation:

**Scenario:** ${scenario}

**User Context:**
${context.user_tier ? `- Tier: ${context.user_tier}` : ''}
${context.user_history ? `
- Total Picks: ${context.user_history.total_picks}
- Win Rate: ${(context.user_history.win_rate * 100).toFixed(1)}%
- Account Age: ${context.user_history.account_age_days} days
- Previous Warnings: ${context.user_history.warnings}
` : ''}

${context.message_content ? `**Message Content:**
"${context.message_content}"` : ''}

${context.violation_type ? `**Potential Violation:** ${context.violation_type}` : ''}

${context.community_guidelines?.length ? `**Relevant Guidelines:**
${context.community_guidelines.map((g, i) => `${i + 1}. ${g}`).join('\n')}` : ''}

Provide moderation guidance covering:
1. Recommended action (warning, timeout, ban, etc.)
2. Reasoning based on context and guidelines
3. How to communicate this decision to the user
4. Follow-up monitoring or escalation if needed`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const aiResponse = await this.gateway.processRequest({
      messages,
      tenantId,
      userId,
      temperature: 0.6, // Lower temperature for more consistent guidance
      maxTokens: 1000,
      metadata: {
        assistant_type: 'moderator_coach',
        scenario_type: context.violation_type || 'general',
      },
    });

    return {
      type: 'moderator_coach',
      output: aiResponse.content,
      confidence: 80,
      aiResponse,
      metadata: {
        scenario,
        context,
      },
    };
  }

  /**
   * Generate suggested responses for moderator communications
   */
  async generateResponse(request: {
    responseType: 'warning' | 'welcome' | 'explanation' | 'announcement';
    context: {
      user_name?: string;
      violation?: string;
      action_taken?: string;
      reason?: string;
      custom_context?: string;
    };
    tenantId: string;
    userId?: string;
  }): Promise<AssistantResponse> {
    const { responseType, context, tenantId, userId } = request;

    const systemPrompt = `You are a professional community manager crafting communications for a premium sports betting platform.

Communication should be:
- Professional and respectful
- Clear and concise
- Empathetic but firm when needed
- Aligned with community values
- Action-oriented with next steps

Maintain the premium, professional tone of the platform.`;

    const userPrompt = this.buildModeratorResponsePrompt(responseType, context);

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const aiResponse = await this.gateway.processRequest({
      messages,
      tenantId,
      userId,
      temperature: 0.7,
      maxTokens: 600,
      metadata: {
        assistant_type: 'moderator_coach',
        response_type: responseType,
      },
    });

    return {
      type: 'moderator_coach',
      output: aiResponse.content,
      confidence: 85,
      aiResponse,
      metadata: {
        responseType,
        context,
      },
    };
  }

  private buildModeratorResponsePrompt(type: string, context: any): string {
    switch (type) {
      case 'warning':
        return `Draft a warning message to ${context.user_name || 'a user'} about: ${context.violation}
Action taken: ${context.action_taken || 'Warning issued'}
Reason: ${context.reason || 'Violation of community guidelines'}

The message should:
1. Clearly state what guideline was violated
2. Explain why this matters to the community
3. Outline next steps/expectations
4. Be firm but professional`;

      case 'welcome':
        return `Draft a welcome message for a new ${context.user_name ? `user: ${context.user_name}` : 'community member'}.
${context.custom_context || ''}

The message should:
1. Welcome them warmly to the community
2. Highlight key features and resources
3. Explain community standards briefly
4. Encourage engagement`;

      case 'explanation':
        return `Draft an explanation about: ${context.custom_context || 'a platform feature or policy'}

The message should:
1. Explain clearly and concisely
2. Provide context for why this exists
3. Address potential concerns
4. Offer resources for more information`;

      case 'announcement':
        return `Draft a community announcement about: ${context.custom_context || 'a platform update'}

The message should:
1. State the update/change clearly
2. Explain benefits and impact
3. Provide timeline if applicable
4. Address likely questions`;

      default:
        return 'Draft a professional community message based on the provided context.';
    }
  }
}

/**
 * Assistant factory - creates all assistants with shared gateway
 */
export class AssistantFactory {
  private scoringCopilot: ScoringCopilot;
  private insightSummarizer: InsightSummarizer;
  private moderatorCoach: ModeratorCoach;

  constructor(private gateway: AssistGateway) {
    this.scoringCopilot = new ScoringCopilot(gateway);
    this.insightSummarizer = new InsightSummarizer(gateway);
    this.moderatorCoach = new ModeratorCoach(gateway);

    logger.info('AI Assistants initialized', {
      assistants: ['ScoringCopilot', 'InsightSummarizer', 'ModeratorCoach'],
    });
  }

  getScoringCopilot(): ScoringCopilot {
    return this.scoringCopilot;
  }

  getInsightSummarizer(): InsightSummarizer {
    return this.insightSummarizer;
  }

  getModeratorCoach(): ModeratorCoach {
    return this.moderatorCoach;
  }

  /**
   * Route assistant request to appropriate assistant
   */
  async processAssistantRequest(request: AssistantRequest): Promise<AssistantResponse> {
    switch (request.type) {
      case 'scoring_copilot':
        // @ts-ignore - Dynamic context type (AI assistant request routing)
        return this.scoringCopilot.analyzePick({
          pickData: request.context?.pickData || {},
          marketContext: request.context?.marketContext,
          tenantId: request.tenantId,
          userId: request.userId,
        } as any);

      case 'insight_summarizer':
        if (request.context?.eventType) {
          return this.insightSummarizer.summarizePickEvent({
            eventType: request.context.eventType as any,
            eventData: (request.context.eventData as any) || {},
            tenantId: request.tenantId,
            userId: request.userId,
          });
        } else if (request.context?.stats) {
          return this.insightSummarizer.summarizePerformance({
            period: (request.context.period as any) || 'daily',
            stats: (request.context.stats as any),
            tenantId: request.tenantId,
            userId: request.userId,
          });
        }
        throw new Error('Invalid context for insight_summarizer');

      case 'moderator_coach':
        if (request.context?.scenario) {
          return this.moderatorCoach.assistModeration({
            scenario: request.context.scenario as any,
            context: request.context,
            tenantId: request.tenantId,
            userId: request.userId,
          });
        } else if (request.context?.responseType) {
          return this.moderatorCoach.generateResponse({
            responseType: request.context.responseType as any,
            context: request.context,
            tenantId: request.tenantId,
            userId: request.userId,
          });
        }
        throw new Error('Invalid context for moderator_coach');

      default:
        throw new Error(`Unknown assistant type: ${request.type}`);
    }
  }
}
