#!/usr/bin/env npx tsx
/**
 * Phase 19 Runner - Loads .env and executes orchestrator
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env file manually
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=');
    
    if (key && value) {
      process.env[key] = value;
    }
  }
  
  console.log('✅ Loaded .env file');
}

// Now import and run the orchestrator
import('./phase19-migration-orchestrator.ts').catch(err => {
  console.error('❌ Failed to run orchestrator:', err);
  process.exit(1);
});

