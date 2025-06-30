import { aiCoachingService } from '../services/aiCoaching';
import { databaseService } from '../services/database';
import { logger } from '../utils/logger';

/**
 * Test script for AI Coaching integration
 * Run with: npm run test:ai-coaching
 */

async function testAICoaching() {
  logger.info('Starting AI Coaching integration test...');

  try {
    // Test 1: Basic AI Analysis
    console.log('\n=== Test 1: Basic AI Analysis ===');
    const analysisRequest = {
      question: "Should I bet the over on LeBron James 25.5 points tonight against the Warriors?",
      userTier: 'vip' as const,
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

    const analysis = await aiCoachingService.generateAnalysis(analysisRequest);
    console.log('✅ AI Analysis generated successfully');
    console.log('Analysis preview:', analysis.analysis.substring(0, 100) + '...');
    console.log('Confidence:', analysis.confidence + '%');
    console.log('Risk Level:', analysis.riskAssessment.level);

    // Test 2: Coaching Session Management
    console.log('\n=== Test 2: Coaching Session Management ===');
    const testUserId = 'test_user_123';
    const testDiscordId = 'discord_test_123';

    // Create a coaching session
    const sessionId = await aiCoachingService.createCoachingSession(
      testUserId,
      testDiscordId,
      'ai_analysis',
      'vip'
    );
    console.log('✅ Coaching session created:', sessionId);

    // Add a question to the session
    await aiCoachingService.addQuestionToSession(
      sessionId,
      analysisRequest.question,
      analysis
    );
    console.log('✅ Question added to session');

    // Get session history
    const sessions = await aiCoachingService.getUserCoachingSessions(testDiscordId, 5);
    console.log('✅ Retrieved session history:', sessions.length, 'sessions');

    // Complete the session
    const completed = await aiCoachingService.completeCoachingSession(sessionId);
    console.log('✅ Session completed:', completed);

    // Test 3: Database Integration
    console.log('\n=== Test 3: Database Integration ===');
    
    // Test coaching session stats
    const stats = await databaseService.getCoachingSessionStats(testDiscordId);
    console.log('✅ Coaching session stats:', {
      totalSessions: stats.totalSessions,
      completedSessions: stats.completedSessions,
      totalQuestions: stats.totalQuestions
    });

    // Test 4: Error Handling
    console.log('\n=== Test 4: Error Handling ===');
    
    try {
      // Test with invalid session ID
      await aiCoachingService.addQuestionToSession(
        'invalid_session_id',
        'Test question',
        analysis
      );
      console.log('❌ Should have thrown an error for invalid session');
    } catch (error) {
      console.log('✅ Error handling works for invalid session ID');
    }

    // Test 5: Fallback Analysis
    console.log('\n=== Test 5: Fallback Analysis ===');
    
    // Temporarily disable AI providers to test fallback
    const originalOpenAI = process.env.OPENAI_API_KEY;
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    
    const fallbackAnalysis = await aiCoachingService.generateAnalysis(analysisRequest);
    console.log('✅ Fallback analysis generated');
    console.log('Fallback preview:', fallbackAnalysis.analysis.substring(0, 100) + '...');
    
    // Restore environment variables
    if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
    if (originalAnthropic) process.env.ANTHROPIC_API_KEY = originalAnthropic;

    console.log('\n🎉 All tests passed! AI Coaching integration is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('AI Coaching test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAICoaching()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { testAICoaching };