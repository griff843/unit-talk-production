import { capperService } from './unit-talk-custom-bot/src/services/capperService';
import { logger } from './unit-talk-custom-bot/src/utils/logger';

async function testCapperService() {
  console.log('🧪 Testing Capper Service...');
  
  try {
    // Test database connection
    const connected = await capperService.testConnection();
    console.log(`✅ Database connection: ${connected ? 'SUCCESS' : 'FAILED'}`);
    
    if (!connected) {
      console.log('❌ Cannot proceed with tests - database not connected');
      return;
    }
    
    // Test getting cappers
    console.log('📋 Testing getCappersWithStats...');
    const cappers = await capperService.getCappersWithStats();
    console.log(`✅ Found ${cappers.length} cappers`);
    
    // Test getting picks for today
    console.log('🎯 Testing getPicksForDate...');
    const today = new Date().toISOString().toISOString().split('T')[0];
    const picks = await capperService.getPicksForDate(today, 'pending');
    console.log(`✅ Found ${picks.length} pending picks for today`);
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Test failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

// Run the test
testCapperService().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});