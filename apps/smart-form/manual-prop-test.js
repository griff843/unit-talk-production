const { chromium } = require('playwright');

async function testPropSelection() {
  console.log('🧪 Manual prop selection test...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });

  try {
    // Navigate to form
    await page.goto('http://localhost:3002/submit-ticket');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('✅ Form loaded');
    console.log('\n📋 Console logs:');
    logs.forEach(log => console.log(`   ${log}`));

    // Take screenshot showing current state
    await page.screenshot({ path: 'current-form-state.png' });
    console.log('\n📸 Screenshot saved as current-form-state.png');

    console.log('\n🔍 Manual verification needed:');
    console.log('1. Check if form loads without errors');
    console.log('2. Navigate to bet type selection');
    console.log('3. Select "Player Props" option');
    console.log('4. Advance to game selection');
    console.log('5. Select any game');
    console.log('6. Verify props load (should see Over/Under buttons)');
    console.log('7. Click a prop option');
    console.log('8. Verify "Add Selection" button appears');
    console.log('9. Click "Add Selection"');
    console.log('10. Verify selection appears in list');

    console.log('\n⏳ Browser will stay open for 30 seconds for manual testing...');
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testPropSelection();
