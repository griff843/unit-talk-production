"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedScoringService = void 0;
const mlb_1 = require("../logic/scoring/rules/mlb");
const nba_1 = require("../logic/scoring/rules/nba");
const nfl_1 = require("../logic/scoring/rules/nfl");
const nhl_1 = require("../logic/scoring/rules/nhl");
const unified_edge_score_1 = require("../logic/scoring/unified-edge-score");
const logger_1 = require("../shared/logger");
const llmService_1 = require("./llmService");
class UnifiedScoringService {
    constructor() {
        this.llmService = llmService_1.LLMService.getInstance();
    }
    static getInstance() {
        if (!UnifiedScoringService.instance) {
            UnifiedScoringService.instance = new UnifiedScoringService();
        }
        return UnifiedScoringService.instance;
    }
    async scoreProp(prop, config, options = {}) {
        try {
            // Get base edge professional_score
            const baseScore = (0, unified_edge_score_1.unifiedEdgeScore)(prop, config, {
                adminOverrideTier: options.adminOverrideTier,
                useLeagueRules: options.useLeagueRules
            });
            // Add league-specific scoring
            const leagueSpecific = await this.calculateLeagueSpecificScore(prop);
            // Enhance with AI if requested
            let aiEnhanced = false;
            let confidence = baseScore.score / 100;
            let insights = [];
            if (options.useAI) {
                const aiResult = await this.enhanceWithAI(prop, baseScore, leagueSpecific);
                aiEnhanced = true;
                confidence = aiResult.confidence ?? (baseScore.score / 100);
                insights = aiResult.insights;
            }
            return {
                ...baseScore,
                aiEnhanced,
                confidence,
                insights,
                leagueSpecific
            };
        }
        catch (error) {
            logger_1.logger.error('Error in unified scoring:', error);
            throw error;
        }
    }
    async calculateLeagueSpecificScore(prop) {
        const leagueValue = prop['league'] || prop['league'] || '';
        const league = typeof leagueValue === 'string' ? leagueValue.toUpperCase() : String(leagueValue).toUpperCase();
        let coreStats = {};
        let synergy = {};
        switch (league) {
            case 'NBA':
                coreStats = (0, nba_1.nbaCoreStats)(prop);
                synergy = (0, nba_1.nbaSynergy)(prop);
                break;
            case 'MLB':
                coreStats = (0, mlb_1.mlbCoreStats)(prop);
                synergy = (0, mlb_1.mlbSynergy)(prop);
                break;
            case 'NHL':
                coreStats = (0, nhl_1.nhlCoreStats)(prop);
                synergy = (0, nhl_1.nhlSynergy)(prop);
                break;
            case 'NFL':
                coreStats = (0, nfl_1.nflCoreStats)(prop);
                synergy = (0, nfl_1.nflSynergy)(prop);
                break;
            default:
                logger_1.logger.warn(`No league-specific scoring rules for league: ${league}`);
        }
        return { coreStats, synergy };
    }
    async enhanceWithAI(prop, baseScore, leagueSpecific) {
        try {
            const prompt = this.buildAIPrompt(prop, baseScore, leagueSpecific);
            const response = await this.llmService.generateResponse({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert sports betting analyst. Analyze this prop bet and provide insights.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                config: {
                    temperature: 0.3,
                    maxTokens: 500
                }
            });
            const result = JSON.parse(response.content);
            return {
                confidence: result.confidence,
                insights: result.insights
            };
        }
        catch (error) {
            logger_1.logger.error('Error enhancing score with AI:', error);
            return {
                confidence: baseScore.score / 100,
                insights: []
            };
        }
    }
    buildAIPrompt(prop, baseScore, leagueSpecific) {
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
    getVersion() {
        return unified_edge_score_1.EDGE_SCORING_VERSION;
    }
}
exports.UnifiedScoringService = UnifiedScoringService;
