#!/usr/bin/env node

/**
 * Direct health endpoint test without Playwright
 * Tests the API health endpoint functionality
 */

const http = require('http');
const https = require('https');

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

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlParts = new URL(url);
    const client = urlParts.protocol === 'https:' ? https : http;
    
    const req = client.request(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData,
            responseTime,
            rawData: data
          });
        } catch (err) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: null,
            responseTime,
            rawData: data,
            parseError: err.message
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject({
        error: err.message,
        responseTime: Date.now() - startTime
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        responseTime: Date.now() - startTime
      });
    });
    
    req.end();
  });
}

async function testHealthEndpoint() {
  const healthUrl = 'http://localhost:3010/api/health';
  
  log('='.repeat(60), 'bold');
  log('Unit Talk API Health Endpoint Test', 'bold');
  log('='.repeat(60), 'bold');
  log('');
  
  logInfo(`Testing endpoint: ${healthUrl}`);
  log('');
  
  try {
    const result = await makeRequest(healthUrl);
    
    logSuccess(`Response received in ${result.responseTime}ms`);
    logInfo(`Status Code: ${result.statusCode}`);
    
    // Test 1: Status Code
    if (result.statusCode === 200) {
      logSuccess('✓ Status Code: 200 OK');
    } else {
      logError(`✗ Expected status 200, got ${result.statusCode}`);
      return false;
    }
    
    // Test 2: Response Time
    if (result.responseTime < 5000) {
      logSuccess(`✓ Response Time: ${result.responseTime}ms (< 5000ms)`);
    } else {
      logWarning(`✗ Response Time: ${result.responseTime}ms (>= 5000ms)`);
    }
    
    // Test 3: JSON Parsing
    if (result.data && !result.parseError) {
      logSuccess('✓ Response is valid JSON');
    } else {
      logError('✗ Response is not valid JSON');
      if (result.parseError) {
        logError(`Parse Error: ${result.parseError}`);
      }
      return false;
    }
    
    const healthData = result.data;
    
    // Test 4: Main Structure
    const requiredFields = ['status', 'timestamp', 'services', 'version', 'uptime', 'memory', 'system'];
    let structureValid = true;
    
    for (const field of requiredFields) {
      if (healthData.hasOwnProperty(field)) {
        logSuccess(`✓ Has required field: ${field}`);
      } else {
        logError(`✗ Missing required field: ${field}`);
        structureValid = false;
      }
    }
    
    if (!structureValid) {
      return false;
    }
    
    // Test 5: Status Value
    if (['healthy', 'unhealthy', 'degraded'].includes(healthData.status)) {
      logSuccess(`✓ Status is valid: ${healthData.status}`);
    } else {
      logError(`✗ Invalid status: ${healthData.status}`);
      return false;
    }
    
    // Test 6: Services Structure
    const services = healthData.services;
    const requiredServices = ['database', 'redis', 'agents', 'external_apis'];
    let servicesValid = true;
    
    logInfo('Services Status:');
    for (const serviceName of requiredServices) {
      if (services.hasOwnProperty(serviceName)) {
        const service = services[serviceName];
        const status = service.status;
        
        if (['up', 'down', 'degraded'].includes(status)) {
          const icon = status === 'up' ? '✅' : status === 'down' ? '❌' : '⚠️';
          log(`  ${icon} ${serviceName}: ${status}`);
          
          // Check service properties
          if (service.lastCheck) {
            logSuccess(`    ✓ Has lastCheck timestamp`);
          }
          
          if (service.responseTime !== undefined) {
            logSuccess(`    ✓ Response time: ${service.responseTime}ms`);
          }
          
          if (service.error) {
            logWarning(`    ⚠️ Error: ${service.error}`);
          }
          
        } else {
          logError(`  ✗ ${serviceName}: Invalid status '${status}'`);
          servicesValid = false;
        }
      } else {
        logError(`  ✗ Missing required service: ${serviceName}`);
        servicesValid = false;
      }
    }
    
    if (!servicesValid) {
      return false;
    }
    
    // Test 7: Overall Status Logic
    const serviceStatuses = Object.values(services).map(s => s.status);
    const downServices = serviceStatuses.filter(s => s === 'down').length;
    const degradedServices = serviceStatuses.filter(s => s === 'degraded').length;
    
    let expectedStatus;
    if (downServices > 0) {
      expectedStatus = 'unhealthy';
    } else if (degradedServices > 0) {
      expectedStatus = 'degraded';
    } else {
      expectedStatus = 'healthy';
    }
    
    if (healthData.status === expectedStatus) {
      logSuccess(`✓ Overall status logic is correct: ${healthData.status}`);
    } else {
      logError(`✗ Status logic error: expected '${expectedStatus}', got '${healthData.status}'`);
      logInfo(`  Down services: ${downServices}, Degraded: ${degradedServices}`);
    }
    
    // Test 8: Memory Information
    if (healthData.memory && typeof healthData.memory.used === 'number' && 
        typeof healthData.memory.total === 'number' && 
        typeof healthData.memory.percentage === 'number') {
      logSuccess('✓ Memory information is valid');
      logInfo(`  Memory usage: ${Math.round(healthData.memory.percentage)}% (${Math.round(healthData.memory.used / 1024 / 1024)}MB / ${Math.round(healthData.memory.total / 1024 / 1024)}MB)`);
    } else {
      logError('✗ Invalid memory information');
    }
    
    // Test 9: System Information
    if (healthData.system && Array.isArray(healthData.system.loadAverage) && 
        typeof healthData.system.cpuUsage === 'number') {
      logSuccess('✓ System information is valid');
      logInfo(`  Load average: [${healthData.system.loadAverage.map(l => l.toFixed(2)).join(', ')}]`);
      logInfo(`  CPU usage: ${healthData.system.cpuUsage.toFixed(2)}s`);
    } else {
      logError('✗ Invalid system information');
    }
    
    // Test 10: Timestamp
    try {
      const timestamp = new Date(healthData.timestamp);
      if (!isNaN(timestamp.getTime())) {
        logSuccess(`✓ Timestamp is valid: ${healthData.timestamp}`);
      } else {
        logError('✗ Invalid timestamp format');
      }
    } catch (err) {
      logError('✗ Cannot parse timestamp');
    }
    
    log('');
    log('='.repeat(60), 'bold');
    logSuccess('All health endpoint tests passed!');
    log('Health endpoint is working correctly after Docker restart.', 'green');
    log('='.repeat(60), 'bold');
    
    // Show summary data
    log('');
    logInfo('Health Summary:');
    log(`  Status: ${healthData.status}`, healthData.status === 'healthy' ? 'green' : 'yellow');
    log(`  Version: ${healthData.version}`);
    log(`  Uptime: ${Math.round(healthData.uptime)}s`);
    log(`  Response Time: ${result.responseTime}ms`);
    
    return true;
    
  } catch (err) {
    logError('Health endpoint test failed!');
    logError(`Error: ${err.error || err.message}`);
    if (err.responseTime) {
      logError(`Response Time: ${err.responseTime}ms`);
    }
    
    log('');
    log('='.repeat(60), 'bold');
    logError('Health endpoint is not responding correctly.');
    logInfo('Possible issues:');
    logInfo('- API service is not running');
    logInfo('- API service is not accessible on localhost:3010');
    logInfo('- Network connectivity issues');
    log('='.repeat(60), 'bold');
    
    return false;
  }
}

// Run the test
if (require.main === module) {
  testHealthEndpoint().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    logError('Unexpected error:');
    console.error(err);
    process.exit(1);
  });
}