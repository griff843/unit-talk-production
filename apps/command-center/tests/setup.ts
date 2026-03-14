import { test as base } from '@playwright/test';

// Extend basic test by providing common fixtures
export const test = base.extend<{
  testData: any;
}>({
  // Add test data setup
  testData: async (_ctx, use) => {
    const data = {
      testUser: {
        id: 'test-user-1',
        email: 'test@example.com',
        tier: 'VIP',
      },
      testAgent: {
        id: 'test-agent-1',
        name: 'AlertAgent',
        status: 'healthy',
      },
    };
    await use(data);
  },
});

export { expect } from '@playwright/test';

// Global setup function
export async function globalSetup() {
  console.log('Running global test setup...');
  // Add any global setup logic here
  return async () => {
    console.log('Running global test teardown...');
    // Add any cleanup logic here
  };
}
