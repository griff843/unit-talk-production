/**
 * Global test setup for Executive Readiness Snapshot E2E tests
 * 
 * Sets up test environment, database connections, and mock data
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Executive Readiness Snapshot E2E Test Setup');
  
  // Create temp directory for test artifacts
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Launch browser for setup operations
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Verify Command Center is running
    const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3004';
    console.log(`🌐 Testing Command Center at: ${baseURL}`);
    
    await page.goto(baseURL);
    
    // Wait for basic page load
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Check if readiness API endpoint is accessible
    const response = await page.request.get('/api/ops/readiness/snapshot');
    if (response.ok()) {
      console.log('✅ Readiness API endpoint is accessible');
    } else {
      console.warn('⚠️ Readiness API endpoint returned:', response.status());
    }
    
    // Set up test data or mock responses if needed
    console.log('🎯 Test environment setup complete');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;