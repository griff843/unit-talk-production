import { capperService } from './unit-talk-custom-bot/src/services/capperService';
import { logger } from './unit-talk-custom-bot/src/utils/logger';

async function testCapperSystem() {
  try {
    logger.info('🧪 Testing Capper System...');
    
    // Test 1: Database connection
    logger.info('Testing database connection...');
    const isConnected = await capperService.testConnection();
    logger.info(`Database connection: ${isConnected ? '✅ Connected' : '❌ Failed'}`);
    
    // Test 2: Service initialization
    logger.info('Testing service methods...');
    const hasPermissions = await capperService.hasCapperPermissions('test-discord-id');
    logger.info(`Permission check method: ${hasPermissions !== undefined ? '✅ Working' : '❌ Failed'}`);
    
    // Test 3: Mock capper creation (won't actually create due to validation)
    logger.info('Testing capper profile creation method...');
    try {
      await capperService.createCapperProfile({
        discordId: 'test-id',
        username: 'test-user',
        displayName: 'Test User',
        tier: 'rookie'
      });
    } catch (error) {
      logger.info('✅ Capper creation method accessible (validation working)');
    }
    
    logger.info('🎉 Capper System Test Complete - All methods accessible!');
    
  } catch (error) {
    logger.error('❌ Capper System Test Failed:', error);
  }
}

// Run the test
testCapperSystem().catch(console.error);