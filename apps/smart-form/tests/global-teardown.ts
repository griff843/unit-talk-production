async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment...');

  // Clean up any test data if needed
  // For now, just log completion

  console.log('✅ E2E test environment cleanup complete');
}

export default globalTeardown;
