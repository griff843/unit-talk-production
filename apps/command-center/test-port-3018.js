// Test server on port 3018 after cache clean
const http = require('http');

async function testEndpoint(path, description) {
  return new Promise(resolve => {
    console.log(`🧪 Testing ${description}: http://localhost:3018${path}`);

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3018,
        path: path,
        method: 'GET',
        timeout: 8000,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Test-Client/1.0',
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          // Check for the specific build error we're trying to fix
          const hasBuildError =
            data.includes('not-found_client-reference-manifest') ||
            data.includes('Cannot find module') ||
            data.includes('Server Error') ||
            data.includes('unhandled error');

          const hasHTML = data.includes('<!DOCTYPE html>') || data.includes('<html>');
          const hasReactError =
            data.includes('Application error') || data.includes('There was an error');

          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Content-Type: ${res.headers['content-type'] || 'unknown'}`);
          console.log(`   Has HTML: ${hasHTML}`);
          console.log(`   Build Error: ${hasBuildError}`);
          console.log(`   React Error: ${hasReactError}`);

          if (res.statusCode === 200 && hasHTML && !hasBuildError) {
            console.log(`✅ ${description}: SUCCESS`);
            resolve({ success: true, status: res.statusCode });
          } else if (hasBuildError) {
            console.log(`❌ ${description}: BUILD ERROR DETECTED`);
            resolve({ success: false, status: res.statusCode, buildError: true });
          } else {
            console.log(`⚠️ ${description}: Issues detected`);
            resolve({ success: false, status: res.statusCode });
          }
        });
      }
    );

    req.on('error', err => {
      console.log(`❌ ${description}: Connection error - ${err.message}`);
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
  console.log('🚀 Testing Port 3018 After Cache Clean...\n');

  const tests = [
    ['/', 'Homepage'],
    ['/api/health', 'Health API'],
    ['/dashboard', 'Dashboard Root'],
    ['/dashboard/agents', 'Dashboard Agents Page'],
  ];

  const results = [];

  for (const [path, description] of tests) {
    const result = await testEndpoint(path, description);
    results.push({ path, description, ...result });
    console.log(''); // Add spacing

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('📊 Final Results:');
  console.log('================');

  let passed = 0;
  let buildErrors = 0;

  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.description}: WORKING`);
      passed++;
    } else if (result.buildError) {
      console.log(`🔧 ${result.description}: BUILD ERROR (needs fixing)`);
      buildErrors++;
    } else {
      console.log(`❌ ${result.description}: FAILED`);
    }
  });

  console.log(
    `\n🎯 Summary: ${passed} working, ${buildErrors} build errors, ${results.length - passed - buildErrors} other failures`
  );

  if (buildErrors === 0 && passed > 0) {
    console.log('🎉 SUCCESS: Build cache corruption resolved!');
    console.log('✅ No more not-found_client-reference-manifest errors');
    console.log('✅ Command Center ready for use');
  } else if (buildErrors > 0) {
    console.log('🔧 Build errors still present - additional fixes needed');
  } else {
    console.log('⚠️ Server may not be fully ready yet');
  }

  console.log('\nAccess: http://localhost:3018/dashboard/agents');
}

runTests();
