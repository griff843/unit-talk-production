// Test the fixed API endpoints
const http = require('http');

async function testEndpoint(path, description) {
  return new Promise(resolve => {
    console.log(`\n🧪 Testing ${description}: ${path}`);

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3015,
        path,
        method: 'GET',
        timeout: 5000,
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            console.log(`✅ ${description}: Status ${res.statusCode}`);
            console.log(`📄 Response keys: ${Object.keys(json).join(', ')}`);
            resolve({ success: true, status: res.statusCode, keys: Object.keys(json) });
          } catch (err) {
            console.log(`⚠️  ${description}: Non-JSON response (${data.length} chars)`);
            resolve({ success: true, status: res.statusCode, isHtml: data.includes('<html>') });
          }
        });
      }
    );

    req.on('error', err => {
      console.log(`❌ ${description}: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      console.log(`⏰ ${description}: Timeout`);
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing fixed API endpoints...\n');

  const tests = [
    ['/api/health', 'Health endpoint'],
    ['/api/agents', 'Agents endpoint'],
    ['/api/analytics', 'Analytics endpoint'],
    ['/api/system/metrics', 'System metrics endpoint'],
    ['/api/redis', 'Redis endpoint'],
    ['/api/stream', 'Stream endpoint (SSE)'],
  ];

  const results = [];
  for (const [path, description] of tests) {
    const result = await testEndpoint(path, description);
    results.push({ path, description, ...result });
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }

  console.log('\n📊 Test Summary:');
  console.log('=================');

  let passed = 0;
  let failed = 0;

  results.forEach(result => {
    if (result.success && result.status === 200) {
      console.log(`✅ ${result.description}: PASS`);
      passed++;
    } else {
      console.log(`❌ ${result.description}: FAIL (${result.error || result.status})`);
      failed++;
    }
  });

  console.log(`\n🎯 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 ALL API ENDPOINTS WORKING! Ready for production testing.');
  } else {
    console.log('⚠️  Some endpoints need attention.');
  }
}

runTests();
