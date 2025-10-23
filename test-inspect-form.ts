import { chromium, Browser, Page } from 'playwright';

async function inspectForm() {
  console.log('🔍 SMART FORM DOM INSPECTION');
  console.log('============================');

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();
    page.setDefaultTimeout(15000);

    console.log('\n📋 Loading Smart Form...');
    await page.goto('http://localhost:3002/submit-ticket', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });

    // Wait a moment for dynamic content
    await page.waitForTimeout(3000);

    console.log('\n🔍 Inspecting DOM Structure...');

    // Get all select elements
    const selects = await page.$$('select');
    console.log(`\n📝 Found ${selects.length} select elements:`);
    for (let i = 0; i < selects.length; i++) {
      const select = selects[i];
      const name = await select.getAttribute('name');
      const id = await select.getAttribute('id');
      const disabled = await select.getAttribute('disabled');
      console.log(`  ${i + 1}. select[name="${name}", id="${id}"] ${disabled ? '(disabled)' : '(enabled)'}`);

      // Get options
      const options = await select.$$('option');
      for (let j = 0; j < Math.min(options.length, 3); j++) {
        const option = options[j];
        const value = await option.getAttribute('value');
        const text = await option.textContent();
        console.log(`     Option ${j + 1}: value="${value}" text="${text}"`);
      }
    }

    // Get all buttons
    const buttons = await page.$$('button');
    console.log(`\n🔘 Found ${buttons.length} button elements:`);
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const disabled = await button.getAttribute('disabled');
      const role = await button.getAttribute('role');
      console.log(`  ${i + 1}. "${text?.trim()}" ${disabled ? '(disabled)' : '(enabled)'} role="${role}"`);
    }

    // Get all inputs
    const inputs = await page.$$('input');
    console.log(`\n📄 Found ${inputs.length} input elements:`);
    for (let i = 0; i < Math.min(inputs.length, 5); i++) {
      const input = inputs[i];
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const value = await input.getAttribute('value');
      console.log(`  ${i + 1}. input[name="${name}", type="${type}", placeholder="${placeholder}"] value="${value}"`);
    }

    // Look for combobox/dropdown elements (Radix UI components)
    const comboboxes = await page.$$('[role="combobox"]');
    console.log(`\n🎛️ Found ${comboboxes.length} combobox elements:`);
    for (let i = 0; i < comboboxes.length; i++) {
      const combobox = comboboxes[i];
      const ariaExpanded = await combobox.getAttribute('aria-expanded');
      const ariaHasPopup = await combobox.getAttribute('aria-haspopup');
      const disabled = await combobox.getAttribute('disabled');
      const text = await combobox.textContent();
      console.log(`  ${i + 1}. combobox: "${text?.trim()}" expanded="${ariaExpanded}" disabled="${disabled}"`);
    }

    // Check for Radix Select components
    const radixSelects = await page.$$('[data-radix-select-trigger]');
    console.log(`\n⚡ Found ${radixSelects.length} Radix Select triggers:`);
    for (let i = 0; i < radixSelects.length; i++) {
      const trigger = radixSelects[i];
      const value = await trigger.getAttribute('data-radix-select-value');
      const placeholder = await trigger.getAttribute('data-placeholder');
      const text = await trigger.textContent();
      console.log(`  ${i + 1}. Radix Select: "${text?.trim()}" value="${value}" placeholder="${placeholder}"`);
    }

    // Look for any element containing "capper" or "Griff"
    const capperElements = await page.$$('text=capper, text=Capper, text=griff, text=Griff');
    console.log(`\n👤 Found ${capperElements.length} elements mentioning capper/griff`);

    // Look for loading states
    const loadingElements = await page.$$('text=Loading, text=loading, .loading, [data-loading]');
    console.log(`\n⏳ Found ${loadingElements.length} loading indicators`);

    // Take a screenshot
    await page.screenshot({ path: 'test-screenshots/dom-inspection.png', fullPage: true });
    console.log('\n📸 Screenshot saved: dom-inspection.png');

    console.log('\n✅ DOM inspection complete');

  } catch (error) {
    console.error('\n❌ Inspection failed:', error);
    if (page) {
      await page.screenshot({ path: 'test-screenshots/inspection-error.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

inspectForm().catch(console.error);