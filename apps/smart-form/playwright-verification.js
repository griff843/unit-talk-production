const { chromium } = require('playwright');

async function runSmartFormVerification() {
  let browser;
  let context;
  let page;

  try {
    console.log('🚀 Starting Playwright Smart Form Verification...\n');

    // Launch browser with proper settings for container environment
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--remote-debugging-port=9222'
      ]
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true
    });

    page = await context.newPage();

    // Test 1: Navigate to home page
    console.log('1️⃣ Testing Home Page Navigation...');
    await page.goto('http://localhost:3021', { waitUntil: 'networkidle' });
    
    const title = await page.title();
    console.log(`   ✅ Page Title: ${title}`);
    
    const heading = await page.textContent('h1');
    console.log(`   ✅ Main Heading: ${heading}`);

    // Test 2: Navigate to submit ticket form
    console.log('\n2️⃣ Testing Form Page Navigation...');
    await page.click('a[href="/submit-ticket"]');
    await page.waitForLoadState('networkidle');
    
    const formTitle = await page.title();
    console.log(`   ✅ Form Page Title: ${formTitle}`);

    // Test 3: Verify APIs are loaded
    console.log('\n3️⃣ Testing API Data Loading...');
    
    // Wait for cappers to load
    await page.waitForSelector('[data-testid="capper-select"], select', { timeout: 10000 });
    console.log('   ✅ Cappers dropdown loaded');

    // Test 4: Check form components are present
    console.log('\n4️⃣ Verifying Form Components...');
    
    const formElements = [
      'select', // capper selector
      'input[type="number"]', // unit size
      'textarea', // notes
    ];

    for (const selector of formElements) {
      const element = await page.$(selector);
      if (element) {
        console.log(`   ✅ Found: ${selector}`);
      } else {
        console.log(`   ⚠️  Not found: ${selector}`);
      }
    }

    // Test 5: Test form submission flow (without actually submitting)
    console.log('\n5️⃣ Testing Form Interaction...');
    
    // Select first capper
    const capperSelect = await page.$('select');
    if (capperSelect) {
      await page.selectOption('select', { index: 1 });
      console.log('   ✅ Capper selected');
    }

    // Fill unit size
    const unitInput = await page.$('input[type="number"]');
    if (unitInput) {
      await page.fill('input[type="number"]', '2');
      console.log('   ✅ Unit size filled');
    }

    // Fill notes
    const notesTextarea = await page.$('textarea');
    if (notesTextarea) {
      await page.fill('textarea', 'Playwright test submission');
      console.log('   ✅ Notes filled');
    }

    // Test 6: API endpoints verification
    console.log('\n6️⃣ Testing API Endpoints...');
    
    const apiTests = [
      { name: 'Cappers API', url: 'http://localhost:3021/api/cappers' },
      { name: 'Games API', url: 'http://localhost:3021/api/games?sport=NCAAF' },
    ];

    for (const api of apiTests) {
      try {
        const response = await page.goto(api.url);
        if (response.ok()) {
          console.log(`   ✅ ${api.name}: Successful (${response.status()})`);
        } else {
          console.log(`   ❌ ${api.name}: Failed (${response.status()})`);
        }
      } catch (error) {
        console.log(`   ❌ ${api.name}: Error - ${error.message}`);
      }
    }

    // Test 7: Complete form submission test
    console.log('\n7️⃣ Testing Complete Form Submission...');
    
    // Go back to form page
    await page.goto('http://localhost:3021/submit-ticket', { waitUntil: 'networkidle' });
    
    // Fill out the form completely
    await page.selectOption('select', { index: 1 }); // Select capper
    await page.fill('input[type="number"]', '1'); // Unit size
    await page.fill('textarea', 'Playwright E2E test - Complete workflow verification'); // Notes
    
    // Submit the form and check response
    const submitButton = await page.$('button[type="submit"], button:has-text("Submit")');
    if (submitButton) {
      console.log('   ✅ Submit button found');
      
      // Listen for the API call
      const responsePromise = page.waitForResponse(response => 
        response.url().includes('/api/submit-ticket') && response.request().method() === 'POST'
      );
      
      await submitButton.click();
      
      try {
        const response = await responsePromise;
        const responseData = await response.json();
        
        if (response.ok()) {
          console.log('   ✅ Form submitted successfully!');
          console.log(`   📄 Response: ${JSON.stringify(responseData, null, 2)}`);
        } else {
          console.log('   ❌ Form submission failed');
          console.log(`   📄 Error: ${JSON.stringify(responseData, null, 2)}`);
        }
      } catch (error) {
        console.log('   ❌ Form submission error:', error.message);
      }
    } else {
      console.log('   ⚠️  Submit button not found');
    }

    console.log('\n🎉 Playwright Smart Form Verification Complete!');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

// Run the verification
runSmartFormVerification().then(() => {
  console.log('\n✅ Verification script completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});