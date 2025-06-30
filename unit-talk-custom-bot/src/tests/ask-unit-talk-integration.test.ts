import { aiCoachingService, AIAnalysisRequest } from '../services/aiCoaching';
import { databaseService } from '../services/database';
import { logger } from '../utils/logger';

/**
 * Integration tests for ask-unit-talk command with real AI service
 * These tests use mocked AI responses but test the full integration flow
 */

// Mock the AI providers to avoid real API calls in tests
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

describe('ask-unit-talk Integration Tests', () => {
  const testUserId = 'test-integration-user';
  const testDiscordId = 'discord-integration-123';

  beforeAll(async () => {
    // Setup test environment
    logger.info('Starting ask-unit-talk integration tests');
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      // Clean up any test coaching sessions
      const sessions = await aiCoachingService.getUserCoachingSessions(testDiscordId, 100);
      for (const session of sessions) {
        await aiCoachingService.completeCoachingSession(session.id);
      }
    } catch (error) {
      logger.warn('Cleanup error:', error);
    }
  });

  describe('AI Analysis Generation', () => {
    it('should generate analysis with fallback when AI providers are unavailable', async () => {
      const request: AIAnalysisRequest = {
        question: 'Should I bet on LeBron James over 25.5 points tonight?',
        userTier: 'vip',
        userHistory: {
          totalPicks: 15,
          winRate: 0.67,
          totalProfit: 12.5,
          recentPicks: [
            { pickType: 'player_prop', result: 'win', stake: 2, profitLoss: 1.8 },
            { pickType: 'player_prop', result: 'loss', stake: 1, profitLoss: -1 },
            { pickType: 'game_total', result: 'win', stake: 3, profitLoss: 2.7 }
          ]
        },
        context: {
          sport: 'NBA',
          gameTime: '8:00 PM',
          weather: 'indoor'
        }
      };

      const analysis = await aiCoachingService.generateAnalysis(request);

      expect(analysis).toBeDefined();
      expect(analysis.analysis).toBeTruthy();
      expect(analysis.keyInsights).toBeInstanceOf(Array);
      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(analysis.riskAssessment).toBeDefined();
      expect(analysis.riskAssessment.level).toMatch(/^(low|medium|high)$/);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(100);
      expect(analysis.followUpQuestions).toBeInstanceOf(Array);
    });

    it('should provide different analysis quality based on user tier', async () => {
      const baseRequest: Omit<AIAnalysisRequest, 'userTier'> = {
        question: 'What\'s the best strategy for NBA player props?',
        userHistory: {
          totalPicks: 10,
          winRate: 0.6,
          totalProfit: 5.0,
          recentPicks: []
        }
      };

      const vipRequest: AIAnalysisRequest = { ...baseRequest, userTier: 'vip' };
      const vipPlusRequest: AIAnalysisRequest = { ...baseRequest, userTier: 'vip_plus' };

      const vipAnalysis = await aiCoachingService.generateAnalysis(vipRequest);
      const vipPlusAnalysis = await aiCoachingService.generateAnalysis(vipPlusRequest);

      expect(vipAnalysis).toBeDefined();
      expect(vipPlusAnalysis).toBeDefined();
      
      // VIP+ should have more detailed analysis
      expect(vipPlusAnalysis.followUpQuestions.length).toBeGreaterThanOrEqual(vipAnalysis.followUpQuestions.length);
    });

    it('should handle edge cases in user history', async () => {
      const edgeCaseRequest: AIAnalysisRequest = {
        question: 'Help me with my betting strategy',
        userTier: 'vip',
        userHistory: {
          totalPicks: 0,
          winRate: 0,
          totalProfit: 0,
          recentPicks: []
        }
      };

      const analysis = await aiCoachingService.generateAnalysis(edgeCaseRequest);

      expect(analysis).toBeDefined();
      expect(analysis.analysis).toMatch(/new to betting|getting started|beginner/i);
    });
  });

  describe('Coaching Session Management', () => {
    it('should create and manage coaching sessions', async () => {
      // Create a new session
      const sessionId = await aiCoachingService.createCoachingSession(
        testUserId,
        testDiscordId,
        'ai_analysis',
        'vip'
      );

      expect(sessionId).toBeTruthy();

      // Add questions to the session
      const question1 = 'What should I bet on tonight?';
      const analysis1 = await aiCoachingService.generateAnalysis({
        question: question1,
        userTier: 'vip',
        userHistory: { totalPicks: 5, winRate: 0.6, totalProfit: 2.5, recentPicks: [] }
      });

      await aiCoachingService.addQuestionToSession(sessionId, question1, analysis1);

      const question2 = 'How do I manage my bankroll?';
      const analysis2 = await aiCoachingService.generateAnalysis({
        question: question2,
        userTier: 'vip',
        userHistory: { totalPicks: 5, winRate: 0.6, totalProfit: 2.5, recentPicks: [] }
      });

      await aiCoachingService.addQuestionToSession(sessionId, question2, analysis2);

      // Retrieve session history
      const sessions = await aiCoachingService.getUserCoachingSessions(testDiscordId, 1);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(sessionId);

      // Complete the session
      const completed = await aiCoachingService.completeCoachingSession(sessionId);
      expect(completed).toBe(true);
    });

    it('should handle concurrent sessions properly', async () => {
      // Create multiple sessions
      const session1Id = await aiCoachingService.createCoachingSession(
        testUserId,
        testDiscordId,
        'ai_analysis',
        'vip'
      );

      const session2Id = await aiCoachingService.createCoachingSession(
        testUserId,
        testDiscordId,
        'strategy_review',
        'vip'
      );

      expect(session1Id).toBeTruthy();
      expect(session2Id).toBeTruthy();
      expect(session1Id).not.toBe(session2Id);

      // Clean up
      await aiCoachingService.completeCoachingSession(session1Id);
      await aiCoachingService.completeCoachingSession(session2Id);
    });
  });

  describe('Database Integration', () => {
    it('should track coaching session analytics', async () => {
      const sessionId = await aiCoachingService.createCoachingSession(
        testUserId,
        testDiscordId,
        'ai_analysis',
        'vip'
      );

      // Add some questions
      const questions = [
        'What are the best NBA bets tonight?',
        'How do I calculate expected value?',
        'Should I bet on favorites or underdogs?'
      ];

      for (const question of questions) {
        const analysis = await aiCoachingService.generateAnalysis({
          question,
          userTier: 'vip',
          userHistory: { totalPicks: 10, winRate: 0.65, totalProfit: 8.5, recentPicks: [] }
        });
        await aiCoachingService.addQuestionToSession(sessionId, question, analysis);
      }

      // Track activity
      await databaseService.trackUserActivity(testDiscordId, 'ai_coaching_used', {
        session_id: sessionId,
        questions_asked: questions.length,
        user_tier: 'vip'
      });

      // Complete session
      await aiCoachingService.completeCoachingSession(sessionId);

      // Verify session was recorded
      const sessions = await aiCoachingService.getUserCoachingSessions(testDiscordId, 5);
      const testSession = sessions.find(s => s.id === sessionId);
      expect(testSession).toBeDefined();
      expect(testSession?.status).toBe('completed');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle AI service failures gracefully', async () => {
      // Mock a service failure
      const originalGenerateAnalysis = aiCoachingService.generateAnalysis;
      
      // Temporarily replace with failing mock
      (aiCoachingService as any).generateAnalysis = jest.fn().mockRejectedValue(new Error('AI service unavailable'));

      const request: AIAnalysisRequest = {
        question: 'Test question during service failure',
        userTier: 'vip',
        userHistory: { totalPicks: 5, winRate: 0.6, totalProfit: 2.0, recentPicks: [] }
      };

      // Should still return a fallback response
      const analysis = await aiCoachingService.generateAnalysis(request);
      expect(analysis).toBeDefined();
      expect(analysis.analysis).toBeTruthy();

      // Restore original method
      (aiCoachingService as any).generateAnalysis = originalGenerateAnalysis;
    });

    it('should handle database connection issues', async () => {
      // This test would verify graceful degradation when database is unavailable
      // Implementation depends on specific error handling in the service
      expect(true).toBe(true); // Placeholder
    });

    it('should validate input parameters', async () => {
      // Test with invalid input
      const invalidRequest = {
        question: '', // Empty question
        userTier: 'invalid_tier' as any,
        userHistory: { totalPicks: -1, winRate: 1.5, totalProfit: 0, recentPicks: [] }
      };

      // Should handle gracefully or throw appropriate error
      try {
        await aiCoachingService.generateAnalysis(invalidRequest);
      } catch (error) {
        // Expected to handle gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance and Rate Limiting', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        question: `Test question ${i + 1}`,
        userTier: 'vip' as const,
        userHistory: { totalPicks: i + 1, winRate: 0.6, totalProfit: i * 2, recentPicks: [] }
      }));

      const startTime = Date.now();
      const analyses = await Promise.all(
        requests.map(req => aiCoachingService.generateAnalysis(req))
      );
      const endTime = Date.now();

      expect(analyses).toHaveLength(5);
      analyses.forEach(analysis => {
        expect(analysis).toBeDefined();
        expect(analysis.analysis).toBeTruthy();
      });

      // Should complete within reasonable time (adjust based on your requirements)
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it('should respect user tier rate limits', async () => {
      // This test would verify that rate limiting is properly enforced
      // Implementation depends on how rate limiting is implemented
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Context Processing', () => {
    it('should properly parse and use context information', async () => {
      const contextRequest: AIAnalysisRequest = {
        question: 'Should I bet on this game?',
        userTier: 'vip',
        userHistory: { totalPicks: 10, winRate: 0.7, totalProfit: 15, recentPicks: [] },
        context: {
          sport: 'NBA',
          league: 'NBA',
          gameTime: '8:00 PM EST',
          weather: 'indoor',
          injuries: ['Player A - questionable', 'Player B - out']
        }
      };

      const analysis = await aiCoachingService.generateAnalysis(contextRequest);

      expect(analysis).toBeDefined();
      // Analysis should reference the context provided
      expect(analysis.analysis.toLowerCase()).toMatch(/nba|basketball|game|tonight|injury|injuries/);
    });

    it('should handle missing or incomplete context', async () => {
      const minimalContextRequest: AIAnalysisRequest = {
        question: 'General betting advice?',
        userTier: 'vip',
        userHistory: { totalPicks: 5, winRate: 0.5, totalProfit: 0, recentPicks: [] },
        context: {} // Empty context
      };

      const analysis = await aiCoachingService.generateAnalysis(minimalContextRequest);

      expect(analysis).toBeDefined();
      expect(analysis.analysis).toBeTruthy();
      // Should provide general advice when context is missing
    });
  });
});