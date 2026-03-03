import { mlbCoreStats, mlbSynergy } from '../logic/scoring/rules/mlb';
import { nbaCoreStats, nbaSynergy } from '../logic/scoring/rules/nba';
import { nflCoreStats, nflSynergy } from '../logic/scoring/rules/nfl';
import { nhlCoreStats, nhlSynergy } from '../logic/scoring/rules/nhl';
import {
  unifiedEdgeScore,
  EDGE_SCORING_VERSION,
  type EdgeScoreResult,
  type EdgeScoreConfig,
  type ScoreBreakdown,
} from '../logic/scoring/unified-edge-score';
import { logger } from '../shared/logger';
import { professionalScoreOf } from '../types/compat';
import { PropObject } from '../types/propTypes';
import { RawProp } from '../types/rawProps';

import { LLMService } from './llmService';

interface ScoringResult extends EdgeScoreResult {
  aiEnhanced: boolean;
  confidence: number;
  insights: string[];
  leagueSpecific: {
    coreStats: ScoreBreakdown;
    synergy: ScoreBreakdown;
  };
}

export class UnifiedScoringService {
  private static instance: UnifiedScoringService;
  private llmService: LLMService;

  private constructor() {
    this.llmService = LLMService.getInstance();
  }

  public static getInstance(): UnifiedScoringService {
    if (!UnifiedScoringService.instance) {
      UnifiedScoringService.instance = new UnifiedScoringService();
    }
    return UnifiedScoringService.instance;
  }

  public async scoreProp(
    prop: PropObject | RawProp,
    config?: Partial<EdgeScoreConfig>,
    options: {
      useAI?: boolean;
      adminOverrideTier?: string | null;
      useLeagueRules?: boolean;
    } = {}
  ): Promise<ScoringResult> {
    try {
      // Get base edge professional_score
      const baseScore = unifiedEdgeScore(prop, config as EdgeScoreConfig, {
        adminOverrideTier: options.adminOverrideTier,
        useLeagueRules: options.useLeagueRules,
      });

      // Add league-specific scoring
      const leagueSpecific = await this.calculateLeagueSpecificScore(prop);

      // Enhance with AI if requested
      let aiEnhanced = false;
      let confidence = professionalScoreOf(baseScore) / 100;
      let insights: string[] = [];

      if (options.useAI) {
        const aiResult = await this.enhanceWithAI(prop, baseScore, leagueSpecific);
        aiEnhanced = true;
        confidence = aiResult.confidence;
        insights = aiResult.insights;
      }

      return {
        ...baseScore,
        aiEnhanced,
        confidence,
        insights,
        leagueSpecific,
      };
    } catch (error) {
      logger.error('Error in unified scoring:', error);
      throw error;
    }
  }

  private async calculateLeagueSpecificScore(prop: PropObject | RawProp): Promise<{
    coreStats: ScoreBreakdown;
    synergy: ScoreBreakdown;
  }> {
    const leagueValue = (prop as PropObject)['league'] || (prop as RawProp)['league'] || '';
    const league =
      typeof leagueValue === 'string'
        ? leagueValue.toUpperCase()
        : String(leagueValue).toUpperCase();
    let coreStats: ScoreBreakdown = {};
    let synergy: ScoreBreakdown = {};

    switch (league) {
      case 'NBA':
        coreStats = nbaCoreStats(prop as PropObject);
        synergy = nbaSynergy(prop as PropObject);
        break;
      case 'MLB':
        coreStats = mlbCoreStats(prop as PropObject);
        synergy = mlbSynergy(prop as PropObject);
        break;
      case 'NHL':
        coreStats = nhlCoreStats(prop as PropObject);
        synergy = nhlSynergy(prop as PropObject);
        break;
      case 'NFL':
        coreStats = nflCoreStats(prop as PropObject);
        synergy = nflSynergy(prop as PropObject);
        break;
      default:
        logger.warn(`No league-specific scoring rules for league: ${league}`);
    }

    return { coreStats, synergy };
  }

  private async enhanceWithAI(
    prop: PropObject | RawProp,
    baseScore: EdgeScoreResult,
    leagueSpecific: { coreStats: ScoreBreakdown; synergy: ScoreBreakdown }
  ): Promise<{
    confidence: number;
    insights: string[];
  }> {
    try {
      const prompt = this.buildAIPrompt(prop, baseScore, leagueSpecific);

      const response = await this.llmService.generateResponse({
        messages: [
          {
            role: 'system',
            content:
              'You are an expert sports betting analyst. Analyze this prop bet and provide insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        config: {
          temperature: 0.3,
          maxTokens: 500,
        },
      });

      const result = JSON.parse(response.content) as {
        confidence: number;
        insights: string[];
      };

      return {
        confidence: result.confidence,
        insights: result.insights,
      };
    } catch (error) {
      logger.error('Error enhancing score with AI:', error);
      return {
        confidence: professionalScoreOf(baseScore) / 100,
        insights: [],
      };
    }
  }

  private buildAIPrompt(
    prop: PropObject | RawProp,
    baseScore: EdgeScoreResult,
    leagueSpecific: { coreStats: ScoreBreakdown; synergy: ScoreBreakdown }
  ): string {
    return `Analyze this sports betting prop and provide insights:

Prop Details:
${JSON.stringify(prop, null, 2)}

Base Score Analysis:
${JSON.stringify(baseScore, null, 2)}

League-Specific Analysis:
${JSON.stringify(leagueSpecific, null, 2)}

Provide a response in this JSON format:
{
  "confidence": <number between 0 and 1>,
  "insights": [
    <string array of 2-3 key insights>
  ]
}`;
  }

  public getVersion(): typeof EDGE_SCORING_VERSION {
    return EDGE_SCORING_VERSION;
  }
}
