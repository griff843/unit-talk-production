// Test build fix and server response
const http = require('http');

async function testServer(port, path, description) {
  return new Promise(resolve => {
    console.log(`🧪 Testing ${description}: http://localhost:${port}${path}`);

    const req = http.request(
      {
        hostname: 'localhost',
        port: port,
        path: path,
        method: 'GET',
        timeout: 8000,
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          const hasError =
            data.includes('Server Error') ||
            data.includes('Cannot find module') ||
            data.includes('not-found_client-reference-manifest') ||
            data.includes('unhandled error');

          const hasSuccess = data.includes('<html>') || data.includes('<!DOCTYPE html>');

          if (res.statusCode === 200 && !hasError && hasSuccess) {
            console.log(`✅ ${description}: SUCCESS (Status ${res.statusCode})`);
            resolve({ success: true, status: res.statusCode });
          } else if (hasError) {
            console.log(`❌ ${description}: BUILD ERROR DETECTED`);
            console.log(`Status: ${res.statusCode}`);
            console.log('Error indicators found in response');
            resolve({ success: false, status: res.statusCode, hasError: true });
          } else {
            console.log(
              `⚠️ ${description}: Status ${res.statusCode} (${hasSuccess ? 'HTML detected' : 'No HTML'})`
            );
            resolve({ success: false, status: res.statusCode });
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
  console.log('🚀 Testing Build Fix and Server Health...\n');

  const tests = [
    [3017, '/', 'Homepage'],
    [3017, '/dashboard', 'Dashboard root'],
    [3017, '/dashboard/agents', 'Dashboard agents page'],
    [3017, '/api/health', 'Health API'],
  ];

  const results = [];

  for (const [port, path, description] of tests) {
    const result = await testServer(port, path, description);
    results.push({ path, description, ...result });

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 Test Summary:');
  console.log('================');

  let passed = 0;
  let failed = 0;

  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.description}: PASS`);
      passed++;
    } else {
      console.log(`❌ ${result.description}: FAIL ${result.hasError ? '(BUILD ERROR)' : ''}`);
      failed++;
    }
  });

  console.log(`\n🎯 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 SUCCESS: All pages loading without build errors!');
    console.log('✅ Build cache corruption resolved');
    console.log('✅ Command Center ready for production testing');
  } else {
    console.log('⚠️ Some pages still have issues');
    if (results.some(r => r.hasError)) {
      console.log('🔧 Build errors detected - may need additional cleanup');
    }
  }

  console.log('\nNext: Access http://localhost:3017/dashboard/agents in browser to verify');
}

runTests();
