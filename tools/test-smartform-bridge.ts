// Test SmartFormBridge processing with existing ticket
import { SmartFormBridge } from './src/services/SmartFormBridge';

async function testSmartFormBridge() {
  console.log('🧪 TESTING SMARTFORM BRIDGE INTEGRATION');
  console.log('=====================================');

  const existingTicketId = 'bet-1753840608561-ba00vp1zj';

  try {
    console.log(`🎯 Testing with existing ticket: ${existingTicketId}`);

    // Initialize SmartFormBridge
    console.log('🔧 Initializing SmartFormBridge...');
    const bridge = new SmartFormBridge();

    // Process the existing submission
    console.log('🚀 Processing submission through SmartFormBridge...');
    await bridge.processSubmission(existingTicketId);

    console.log('✅ SUCCESS: SmartFormBridge processing completed!');
    console.log('');
    console.log('🎯 Expected Results:');
    console.log('  ✅ Ticket should be in daily_picks table');
    console.log('  ✅ If high-grade: Ticket should be in final_picks table');
    console.log('  ✅ Smart ticket status should be "processed"');
    console.log('  ✅ Insights should be generated and stored');
  } catch (error) {
    console.error('❌ SmartFormBridge processing failed:', {
      ticketId: existingTicketId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.log('');
    console.log('🔍 Troubleshooting steps:');
    console.log('  1. Check if SmartFormBridge dependencies are available');
    console.log('  2. Verify database connection and schema');
    console.log('  3. Check if ScoringAgent is properly initialized');
    console.log('  4. Verify environment variables are set');
  }
}

testSmartFormBridge();
