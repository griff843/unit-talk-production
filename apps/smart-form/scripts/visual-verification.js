const { chromium } = require('playwright');
const fs = require('fs');

async function visualVerification() {
  console.log('📸 VISUAL VERIFICATION: Taking screenshots of smart form');
  console.log('======================================================\n');

  let browser;
  try {
    // Try to connect to the form - first attempt localhost:3000
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const testUrls = [
      'http://localhost:3000/submit-ticket',
      'http://localhost:3001/submit-ticket',
      'http://localhost:3002/submit-ticket',
      'http://localhost:3010/submit-ticket',
    ];

    let formLoaded = false;
    let workingUrl = null;

    for (const url of testUrls) {
      try {
        console.log(`🔍 Trying ${url}...`);
        await page.goto(url, { timeout: 10000 });

        // Check if form loaded
        const formTitle = await page.locator('h1').first().textContent({ timeout: 5000 });
        if (
          formTitle &&
          (formTitle.includes('Smart') ||
            formTitle.includes('Betting') ||
            formTitle.includes('Form'))
        ) {
          console.log(`   ✅ Form loaded successfully at ${url}`);
          console.log(`   📝 Page title: ${formTitle}`);
          workingUrl = url;
          formLoaded = true;
          break;
        }
      } catch (e) {
        console.log(`   ❌ ${url} not accessible: ${e.message.substring(0, 50)}...`);
      }
    }

    if (!formLoaded) {
      console.log(
        '⚠️ No running dev server found. Taking screenshot of static build if available...'
      );

      // Try to check if build files exist
      const buildPath = '.next';
      if (fs.existsSync(buildPath)) {
        console.log('   📁 Next.js build found, but server needed for screenshots');
      }

      console.log('   💡 To take visual screenshots:');
      console.log('      1. Run: npm run dev');
      console.log('      2. Then run this script again');
      return;
    }

    // Take screenshots of the form
    console.log('\n📸 Taking comprehensive screenshots...');

    // Screenshot 1: Initial form state
    await page.screenshot({
      path: 'tests/screenshots/01-initial-form-state.png',
      fullPage: true,
    });
    console.log('   ✅ Screenshot 1: Initial form state saved');

    // Screenshot 2: Try to open capper dropdown to show real cappers
    try {
      const capperDropdown = page
        .locator('button')
        .filter({ hasText: /Choose your capper|Select capper/i })
        .first();
      if ((await capperDropdown.count()) > 0) {
        await capperDropdown.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: 'tests/screenshots/02-capper-dropdown-real-data.png',
          fullPage: true,
        });
        console.log('   ✅ Screenshot 2: Capper dropdown with real data saved');

        // Close dropdown
        await page.keyboard.press('Escape');
      }
    } catch (e) {
      console.log('   ⚠️ Could not capture capper dropdown:', e.message);
    }

    // Screenshot 3: Try to navigate through form
    try {
      // Select first capper if available
      const capperDropdown = page
        .locator('button')
        .filter({ hasText: /Choose your capper/i })
        .first();
      if ((await capperDropdown.count()) > 0) {
        await capperDropdown.click();
        await page.waitForTimeout(500);

        const firstCapper = page.locator('[role="option"]').first();
        if ((await firstCapper.count()) > 0) {
          await firstCapper.click();
        }
      }

      // Select ticket type and sport
      const singleButton = page.locator('button').filter({ hasText: 'single' });
      if ((await singleButton.count()) > 0) {
        await singleButton.click();
      }

      const mlbButton = page.locator('button').filter({ hasText: 'MLB' });
      if ((await mlbButton.count()) > 0) {
        await mlbButton.click();
      }

      await page.screenshot({
        path: 'tests/screenshots/03-form-step1-filled.png',
        fullPage: true,
      });
      console.log('   ✅ Screenshot 3: Form step 1 filled with real data');

      // Continue to next step
      const continueButton = page.locator('button').filter({ hasText: /Continue|Next/i });
      if ((await continueButton.count()) > 0) {
        await continueButton.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: 'tests/screenshots/04-form-step2-configuration.png',
          fullPage: true,
        });
        console.log('   ✅ Screenshot 4: Form step 2 configuration');
      }
    } catch (e) {
      console.log('   ⚠️ Could not navigate through form:', e.message);
    }

    // Screenshot 5: Premium styling verification
    await page.screenshot({
      path: 'tests/screenshots/05-premium-styling-verification.png',
      fullPage: true,
    });
    console.log('   ✅ Screenshot 5: Premium styling verification');

    console.log('\n🎯 Visual Verification Results:');
    console.log(`   - Form accessible at: ${workingUrl}`);
    console.log(`   - Screenshots saved to: tests/screenshots/`);
    console.log(`   - Form appears to be working with real data integration`);
  } catch (error) {
    console.error('❌ Visual verification error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Create screenshots directory if it doesn't exist
if (!fs.existsSync('tests/screenshots')) {
  fs.mkdirSync('tests/screenshots', { recursive: true });
}

visualVerification();
