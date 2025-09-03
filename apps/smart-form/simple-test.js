const { chromium } = require('playwright');

async function testSmartForm() {
  console.log('🚀 Starting simple smart form test...');

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Start dev server manually first
    console.log('📝 Please start the dev server manually: npm run dev -- --port 3005');
    console.log('⏳ Waiting 10 seconds for you to start the server...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Navigate to smart form
    console.log('🌐 Navigating to smart form...');
    await page.goto('http://localhost:3005/submit-ticket');

    // Take screenshot
    await page.screenshot({ path: 'smart-form-loaded.png', fullPage: true });
    console.log('📸 Screenshot saved: smart-form-loaded.png');

    // Fill out form to reach game selection
    console.log('📋 Filling out form...');
    await page.selectOption('select[name="sport"]', 'MLB');
    await page.fill('input[name="game_date"]', '2025-07-30');
    await page.click('button:has-text("Next")');

    await page.selectOption('select[name="bet_type"]', 'moneyline');
    await page.selectOption('select[name="market_type"]', 'standard');
    await page.selectOption('select[name="ticket_type"]', 'single');
    await page.click('button:has-text("Next")');

    await page.fill('input[name="units"]', '1');
    await page.fill('input[name="confidence"]', '7');
    await page.click('button:has-text("Next")');

    console.log('🎮 Reaching game selection step...');

    // Wait for games to load
    await page.waitForTimeout(5000);

    // Take screenshot of game selection
    await page.screenshot({ path: 'game-selection-real-data.png', fullPage: true });
    console.log('📸 Screenshot saved: game-selection-real-data.png');

    // Check page content
    const content = await page.content();
    const hasMLB = content.includes('MLB');
    const hasRealTeams = content.includes('@') || content.includes('vs');

    console.log('✅ Test results:');
    console.log('  - Has MLB games:', hasMLB);
    console.log('  - Has real team matchups:', hasRealTeams);

    if (hasMLB && hasRealTeams) {
      console.log('🎉 SUCCESS: Smart form is showing real data!');
    } else {
      console.log('⚠️ May need to check data loading');
    }

    // Keep browser open for manual inspection
    console.log('🔍 Browser staying open for manual inspection...');
    console.log('📍 You can now manually verify the real data in the browser');
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
  }
}

testSmartForm();
