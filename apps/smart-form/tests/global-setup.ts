import { chromium, FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  // Test Supabase connection
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      // Test connection with a simple query
      const { data, error } = await supabase.from('cappers').select('count').limit(1).single();

      if (error) {
        console.warn('⚠️ Supabase connection test failed:', error.message);
        console.warn('⚠️ Live data tests will use fallback data where possible');
      } else {
        console.log('✅ Supabase connection verified - live data tests enabled');
      }
    } catch (err) {
      console.warn('⚠️ Supabase configuration incomplete - some tests may use mock data');
    }
  } else {
    console.warn('⚠️ Supabase environment variables not found - tests will use fallback data');
  }

  // Warm up the browser and test server connectivity
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3004';
    console.log(`🔍 Testing server connectivity at ${baseURL}...`);

    await page.goto(baseURL, { timeout: 30000 });
    console.log('✅ Development server is responsive');

    // Test that the form page loads
    await page.goto(`${baseURL}/submit-ticket`, { timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 10000 });
    console.log('✅ Smart form application is accessible');
  } catch (err) {
    console.error('❌ Development server is not accessible:', err);
    console.error('❌ Please ensure the smart form dev server is running on the expected port');
    throw new Error('Development server not accessible - cannot run E2E tests');
  } finally {
    await browser.close();
  }

  console.log('✅ E2E test environment setup complete\n');
}

export default globalSetup;
