import { VIPPlusChannelService } from '../services/VIPPlusChannelService';
import { logger } from '../shared/logger';

/**
 * Test script for VIP+ channel posting with comprehensive examples
 */
async function testVIPPlusChannels() {
  const correlationId = `vip-plus-test-${Date.now()}`;
  const testLogger = logger.child({ correlationId });
  
  try {
    testLogger.info('Starting comprehensive VIP+ channel testing');
    
    const vipPlusService = new VIPPlusChannelService();
    
    // Run all test posts
    await vipPlusService.runTestPosts(correlationId);
    
    testLogger.info('✅ All VIP+ channel tests completed successfully');
    console.log('\n🎉 SUCCESS: All VIP+ test posts sent to Discord!');
    console.log('\nCheck these channels for the results:');
    console.log('├── 💎 exclusive-insights (1288613114815840466)');
    console.log('├── 📊 trader-insights (1356613995175481405)');
    console.log('├── 🎯 best-bets (1288613037539852329)');
    console.log('├── 🧵 game-threads (1291234713213734912)');
    console.log('└── 🧠 strategy-room (1356624758485287105)');
    console.log('\nNow use Playwright to take screenshots of each channel!');
    
  } catch (error) {
    testLogger.error('❌ VIP+ channel testing failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('Failed to test VIP+ channels:', error);
    process.exit(1);
  }
}

// Also create a standard capper corner test
async function testStandardCapperPost() {
  const correlationId = `capper-test-${Date.now()}`;
  const testLogger = logger.child({ correlationId });
  
  try {
    testLogger.info('Testing standard capper corner post format');
    
    // This would integrate with your existing capper posting system
    // For now, we'll log what the standard post would look like
    
    const standardPost = {
      title: '🏀 **Lakers vs Warriors** | S-tier Pick',
      content: [
        '🎯 **Lakers -4.5** (-110) | 3 Units',
        '📊 **Confidence**: 87% | **Edge Score**: +2.4%',
        '⏰ **Game Time**: 10:30 PM EST',
        '',
        '💡 **Quick Analysis**: Lakers revenge game at home, Warriors on B2B',
        '📈 **Key Stats**: Lakers 12-3 ATS at home vs .500+ teams',
        '',
        '🔗 **VIP+ Members**: Check exclusive-insights for advanced breakdown!'
      ].join('\n')
    };
    
    testLogger.info('Standard capper post format ready', {
      title: standardPost.title,
      contentLength: standardPost.content.length
    });
    
    console.log('\n📝 STANDARD CAPPER CORNER POST FORMAT:');
    console.log('═'.repeat(60));
    console.log(standardPost.title);
    console.log('─'.repeat(60));
    console.log(standardPost.content);
    console.log('═'.repeat(60));
    
  } catch (error) {
    testLogger.error('Failed to generate standard capper post test', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Run both tests
async function runAllTests() {
  console.log('🚀 Starting VIP+ Channel Testing Suite...\n');
  
  // Test standard capper format first
  await testStandardCapperPost();
  
  console.log('\n' + '='.repeat(80));
  console.log('📡 Now sending test posts to all VIP+ channels...');
  console.log('='.repeat(80) + '\n');
  
  // Test all VIP+ channels
  await testVIPPlusChannels();
  
  console.log('\n' + '🎯'.repeat(20));
  console.log('✅ TESTING COMPLETE - USE PLAYWRIGHT TO CAPTURE SCREENSHOTS');
  console.log('🎯'.repeat(20));
}

// Execute if run directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testVIPPlusChannels, testStandardCapperPost, runAllTests };