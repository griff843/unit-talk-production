const fs = require('fs');
const path = require('path');

console.log('Starting test runner...');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

console.log('Created logs directory:', logsDir);

// Clear test log file
const logFile = path.join(process.cwd(), 'logs/test.log');
fs.writeFileSync(logFile, '', 'utf8');

console.log('Cleared test log file:', logFile);

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_LOG_LEVEL = 'debug';
process.env.ENABLE_TEST_MODE = 'true';
process.env.MOCK_EXTERNAL_SERVICES = 'true';
process.env.SUPABASE_URL = 'http://mock-supabase-url';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
process.env.SUPABASE_KEY = 'mock-key';
process.env.SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.TEST_LOG_FILE = logFile;

console.log('Set environment variables');

// Register ts-node
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs'
  }
});

console.log('Registered ts-node');

// Run the test
console.log('Running test script...');
require('./onboarding-test.ts');
console.log('Test script loaded'); 