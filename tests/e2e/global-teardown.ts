/**
 * Global test teardown for Executive Readiness Snapshot E2E tests
 * 
 * Cleans up test artifacts, temporary files, and test data
 */

import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown() {
  console.log('🧹 Starting Executive Readiness Snapshot E2E Test Teardown');
  
  try {
    // Clean up temp directory
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
      console.log('📁 Cleaning up temporary files');
      
      // Remove all files in temp directory
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Removed: ${file}`);
        } catch (error) {
          console.warn(`⚠️ Could not remove ${file}:`, error);
        }
      }
      
      // Remove temp directory
      try {
        fs.rmdirSync(tempDir);
        console.log('✅ Temporary directory cleaned up');
      } catch (error) {
        console.warn('⚠️ Could not remove temp directory:', error);
      }
    }
    
    // Clean up any test artifacts
    console.log('🎯 Test teardown complete');
    
  } catch (error) {
    console.error('❌ Teardown failed:', error);
    // Don't throw error during teardown
  }
}

export default globalTeardown;