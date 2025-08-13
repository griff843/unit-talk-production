import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for Command Center E2E tests
 * This runs once before all tests start
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Command Center E2E Test Suite');
  console.log(`📍 Base URL: ${config.use?.baseURL || 'http://localhost:3015'}`);
  console.log(`🎯 Test Directory: ${config.testDir}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'test'}`);

  // Launch browser for authentication setup if needed
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for development server to be ready
    const baseURL = config.use?.baseURL || 'http://localhost:3015';
    console.log(`⏳ Waiting for server at ${baseURL}...`);
    
    await page.goto(baseURL, { timeout: 30000 });
    console.log('✅ Server is ready');

    // Setup test database state if needed
    await setupTestData(page);
    
    // Setup authentication tokens for different user roles
    await setupAuthenticationStates(page);

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Setup test data in the database
 */
async function setupTestData(page: any) {
  console.log('📊 Setting up test data...');
  
  // Mock system configuration
  await page.addInitScript(() => {
    // Set up mock system flags
    window.localStorage.setItem('test-system-flags', JSON.stringify({
      SAFE_MODE: false,
      SYSTEM_FREEZE: false,
      SHADOW_MODE: false,
      PUBLISH_TO_DISCORD: true,
      PUBLISH_TO_NOTION: true
    }));

    // Set up mock user roles
    window.localStorage.setItem('test-user-roles', JSON.stringify({
      'admin-user-123': 'admin',
      'ops-user-123': 'ops',
      'viewer-user-123': 'viewer'
    }));
  });

  console.log('✅ Test data setup completed');
}

/**
 * Setup authentication states for different user roles
 */
async function setupAuthenticationStates(page: any) {
  console.log('🔐 Setting up authentication states...');

  // Create authentication tokens for different roles
  const authStates = {
    admin: {
      user: {
        id: 'admin-user-123',
        email: 'admin@unittalk.com',
        role: 'authenticated',
        user_metadata: { role: 'admin' }
      },
      session: {
        access_token: 'mock-admin-token',
        refresh_token: 'mock-admin-refresh',
        expires_at: Date.now() + 3600000
      }
    },
    ops: {
      user: {
        id: 'ops-user-123',
        email: 'ops@unittalk.com',
        role: 'authenticated',
        user_metadata: { role: 'ops' }
      },
      session: {
        access_token: 'mock-ops-token',
        refresh_token: 'mock-ops-refresh',
        expires_at: Date.now() + 3600000
      }
    },
    viewer: {
      user: {
        id: 'viewer-user-123',
        email: 'viewer@unittalk.com',
        role: 'authenticated',
        user_metadata: { role: 'viewer' }
      },
      session: {
        access_token: 'mock-viewer-token',
        refresh_token: 'mock-viewer-refresh',
        expires_at: Date.now() + 3600000
      }
    }
  };

  // Store authentication states
  await page.addInitScript((states) => {
    window.localStorage.setItem('test-auth-states', JSON.stringify(states));
  }, authStates);

  console.log('✅ Authentication states setup completed');
}

export default globalSetup;