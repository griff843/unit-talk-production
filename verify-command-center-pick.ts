import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyPickInCommandCenter() {
  console.log('🔍 Verifying pick in Command Center...\n');

  // First, verify pick exists in database
  const { data: pick, error: pickError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('id', '03cfb6b8-1652-4c12-9742-d567c3f35591')
    .single();

  if (pickError || !pick) {
    console.error('❌ Pick not found in database:', pickError);
    return;
  }

  console.log('✅ Pick found in database:');
  console.log(`   ID: ${pick.id}`);
  console.log(`   Player: ${pick.player_name}`);
  console.log(`   Market: ${pick.market} ${pick.selection} ${pick.line}`);
  console.log(`   Status: ${pick.status}`);
  console.log(`   Discord Posted: ${pick.posted_at ? 'YES' : 'NO'}\n`);

  // Launch browser to check Command Center
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log('🌐 Opening Command Center...');
    await page.goto('http://localhost:3015', { waitUntil: 'networkidle', timeout: 30000 });

    await page.screenshot({ path: '.playwright-mcp/command-center-home.png' });
    console.log('✅ Command Center loaded');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Look for the pick ID in the page
    const pickIdVisible = await page.locator(`text=${pick.id}`).count() > 0;
    const playerVisible = await page.locator(`text=${pick.player_name}`).count() > 0;

    console.log('\n📊 Command Center Visibility Check:');
    console.log(`   Pick ID visible: ${pickIdVisible ? '✅ YES' : '❌ NO'}`);
    console.log(`   Player name visible: ${playerVisible ? '✅ YES' : '❌ NO'}`);

    // Get page HTML to analyze structure
    const bodyText = await page.textContent('body');
    const hasPendingSection = bodyText?.includes('pending') || bodyText?.includes('Pending');
    const hasPicksSection = bodyText?.includes('pick') || bodyText?.includes('Pick');

    console.log(`   Has "pending" section: ${hasPendingSection ? '✅ YES' : '❌ NO'}`);
    console.log(`   Has "picks" section: ${hasPicksSection ? '✅ YES' : '❌ NO'}`);

    await page.screenshot({ path: '.playwright-mcp/command-center-picks-check.png', fullPage: true });

    // Check if there's a picks table or list
    const tables = await page.locator('table').count();
    console.log(`   Tables found: ${tables}`);

    if (tables > 0) {
      // Get table content
      const tableText = await page.locator('table').first().textContent();
      console.log('\n📋 First table preview:');
      console.log(tableText?.substring(0, 500));
    }

    // Check for navigation links
    const navLinks = await page.locator('nav a, [role="navigation"] a').allTextContents();
    if (navLinks.length > 0) {
      console.log('\n🔗 Navigation links found:');
      navLinks.forEach(link => console.log(`   - ${link}`));
    }

    console.log('\n💡 Next Steps:');
    if (!pickIdVisible && !playerVisible) {
      console.log('   ⚠️ Pick not visible in Command Center');
      console.log('   → May need to navigate to picks section');
      console.log('   → Check if Command Center is querying unified_picks correctly');
      console.log('   → Verify API endpoint is working');
    } else {
      console.log('   ✅ Pick is visible in Command Center!');
    }

    // Keep browser open for manual inspection
    console.log('\n👀 Browser left open for inspection. Press Ctrl+C when done.');
    await page.waitForTimeout(300000); // 5 minutes

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '.playwright-mcp/command-center-error.png' });
  } finally {
    await browser.close();
  }
}

verifyPickInCommandCenter().catch(console.error);
