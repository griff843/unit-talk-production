#!/usr/bin/env node

/**
 * Docker-aware health endpoint test runner
 * This script ensures Docker services are running and tests the health endpoint
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`${step}. ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function checkDockerServices() {
  logStep(1, 'Checking Docker services status...');
  
  try {
    const result = await execCommand('docker-compose ps --format json');
    const services = result.stdout.trim().split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    log('\nDocker Services Status:', 'bold');
    services.forEach(service => {
      const status = service.State === 'running' ? 'green' : 'red';
      log(`  ${service.Name}: ${service.State}`, status);
    });
    
    const runningServices = services.filter(s => s.State === 'running');
    if (runningServices.length === 0) {
      logWarning('No Docker services are running. Starting services...');
      return false;
    }
    
    // Check if API service is running
    const apiService = services.find(s => s.Name.includes('api'));
    if (!apiService || apiService.State !== 'running') {
      logWarning('API service is not running.');
      return false;
    }
    
    logSuccess('Docker services are running');
    return true;
  } catch (err) {
    logError('Failed to check Docker services');
    logError(err.error?.message || err.toString());
    return false;
  }
}

async function startDockerServices() {
  logStep(2, 'Starting Docker services...');
  
  try {
    log('Running: ./dev.sh start');
    const result = await execCommand('./dev.sh start', { timeout: 60000 });
    
    // Wait a bit for services to fully start
    log('Waiting for services to initialize...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    logSuccess('Docker services started');
    return true;
  } catch (err) {
    logError('Failed to start Docker services');
    logError(err.error?.message || err.stderr || err.toString());
    return false;
  }
}

async function waitForHealthEndpoint() {
  logStep(3, 'Waiting for health endpoint to be ready...');
  
  const maxAttempts = 30;
  const delayMs = 2000;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await execCommand('curl -s http://localhost:3010/api/health');
      const healthData = JSON.parse(result.stdout);
      
      if (healthData.status) {
        logSuccess(`Health endpoint is responding (attempt ${attempt})`);
        log(`Status: ${healthData.status}`);
        return true;
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        logError('Health endpoint failed to respond after maximum attempts');
        return false;
      }
      
      log(`Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return false;
}

async function runPlaywrightTests() {
  logStep(4, 'Running Playwright tests...');
  
  try {
    // Run Playwright tests specifically for the health endpoint
    const command = 'npx playwright test tests/api/health.spec.ts --project=chromium';
    log(`Running: ${command}`);
    
    const result = await execCommand(command);
    
    logSuccess('Playwright tests completed successfully');
    
    // Show test output
    if (result.stdout) {
      log('\nTest Output:', 'bold');
      log(result.stdout);
    }
    
    return true;
  } catch (err) {
    logError('Playwright tests failed');
    
    if (err.stdout) {
      log('\nTest Output:', 'bold');
      log(err.stdout);
    }
    
    if (err.stderr) {
      log('\nError Output:', 'bold');
      log(err.stderr, 'red');
    }
    
    return false;
  }
}

async function generateTestReport() {
  logStep(5, 'Generating test report...');
  
  try {
    // Open Playwright report if it exists
    if (fs.existsSync('./playwright-report/index.html')) {
      logSuccess('Test report generated at ./playwright-report/index.html');
      
      // Try to show the report in browser (optional)
      try {
        await execCommand('npx playwright show-report --timeout=5000');
      } catch (err) {
        log('Could not automatically open report in browser');
      }
    }
  } catch (err) {
    logWarning('Could not generate test report');
  }
}

async function main() {
  log('='.repeat(60), 'bold');
  log('Unit Talk API Health Endpoint Test', 'bold');
  log('='.repeat(60), 'bold');
  log('');
  
  let success = true;
  
  // Check if Docker services are running
  const servicesRunning = await checkDockerServices();
  
  // Start services if needed
  if (!servicesRunning) {
    const started = await startDockerServices();
    if (!started) {
      logError('Failed to start Docker services. Please run "./dev.sh start" manually.');
      process.exit(1);
    }
  }
  
  // Wait for health endpoint to be ready
  const healthReady = await waitForHealthEndpoint();
  if (!healthReady) {
    logError('Health endpoint is not responding. Check service status.');
    success = false;
  } else {
    // Run Playwright tests
    const testsPassed = await runPlaywrightTests();
    if (!testsPassed) {
      success = false;
    }
  }
  
  // Generate test report
  await generateTestReport();
  
  log('');
  log('='.repeat(60), 'bold');
  if (success) {
    logSuccess('All tests completed successfully!');
    log('Health endpoint is working correctly.', 'green');
  } else {
    logError('Some tests failed or services are not responding.');
    log('Check the output above for details.', 'red');
  }
  log('='.repeat(60), 'bold');
  
  process.exit(success ? 0 : 1);
}

// Run the main function
if (require.main === module) {
  main().catch(err => {
    logError('Unexpected error:');
    console.error(err);
    process.exit(1);
  });
}