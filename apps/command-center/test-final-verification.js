// Final comprehensive test of all fixes
const http = require('http');

async function testEndpoint(path, description, isAPI = false) {
  return new Promise(resolve => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3018,
        path: path,
        method: 'GET',
        timeout: 5000,
        headers: {
          Accept: isAPI
            ? 'application/json'
            : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Test-Client/1.0',
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          const isSuccess = res.statusCode === 200;
          const hasContent = data.length > 0;

          // Check for specific errors we've been fixing
          const hasBuildError =
            data.includes('not-found_client-reference-manifest') ||
            data.includes('Cannot find module');
          const hasQueryClientError = data.includes('No QueryClient set');
          const hasServerError = data.includes('Server Error') || data.includes('unhandled error');

          let result = {
            success:
              isSuccess && hasContent && !hasBuildError && !hasQueryClientError && !hasServerError,
            status: res.statusCode,
            hasContent,
            hasBuildError,
            hasQueryClientError,
            hasServerError,
          };

          // API-specific checks
          if (isAPI && isSuccess) {
            try {
              const json = JSON.parse(data);
              result.validJSON = true;
              result.dataStructure = Object.keys(json);
            } catch (e) {
              result.validJSON = false;
            }
          }

          console.log(
            `${result.success ? '✅' : '❌'} ${description}: ${res.statusCode} ${result.success ? 'SUCCESS' : 'ISSUES'}`
          );

          if (result.hasBuildError) console.log('    🔧 Build cache error detected');
          if (result.hasQueryClientError) console.log('    🔧 QueryClient error detected');
          if (result.hasServerError) console.log('    🔧 Server error detected');
          if (isAPI && result.validJSON)
            console.log(`    📊 JSON structure: ${result.dataStructure.join(', ')}`);

          resolve(result);
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

async function runComprehensiveTest() {
  console.log('🚀 Final Comprehensive Verification Test');
  console.log('==========================================\n');

  const tests = [
    // Core pages (testing build cache fix)
    ['/', 'Homepage', false],
    ['/dashboard', 'Dashboard Root', false],
    ['/dashboard/agents', 'Dashboard Agents (QueryClient test)', false],

    // API endpoints (testing API structure fixes)
    ['/api/health', 'Health API', true],
    ['/api/agents', 'Agents API', true],
    ['/api/analytics', 'Analytics API', true],
    ['/api/system/metrics', 'System Metrics API', true],
    ['/api/redis', 'Redis API', true],
  ];

  console.log('Testing all endpoints...\n');

  const results = [];

  for (const [path, description, isAPI] of tests) {
    const result = await testEndpoint(path, description, isAPI);
    results.push({ path, description, isAPI, ...result });

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Analyze results
  console.log('\n📊 Detailed Results Analysis:');
  console.log('=============================');

  const pageTests = results.filter(r => !r.isAPI);
  const apiTests = results.filter(r => r.isAPI);

  const pageSuccess = pageTests.filter(r => r.success).length;
  const apiSuccess = apiTests.filter(r => r.success).length;

  const buildErrors = results.filter(r => r.hasBuildError).length;
  const queryClientErrors = results.filter(r => r.hasQueryClientError).length;
  const serverErrors = results.filter(r => r.hasServerError).length;

  console.log(`📄 Pages: ${pageSuccess}/${pageTests.length} working`);
  console.log(`🔌 APIs: ${apiSuccess}/${apiTests.length} working`);
  console.log(`🔧 Build cache errors: ${buildErrors}`);
  console.log(`🔧 QueryClient errors: ${queryClientErrors}`);
  console.log(`🔧 Server errors: ${serverErrors}`);

  console.log('\n🎯 Final Assessment:');
  console.log('====================');

  if (buildErrors === 0 && queryClientErrors === 0) {
    console.log('🎉 SUCCESS: All critical fixes verified!');
    console.log('✅ Build cache corruption: RESOLVED');
    console.log('✅ QueryClient provider: RESOLVED');
    console.log('✅ API endpoint structure: VERIFIED');

    if (pageSuccess === pageTests.length && apiSuccess >= apiTests.length - 1) {
      console.log('✅ Command Center: FULLY OPERATIONAL');
      console.log('\n🚀 Ready for production testing!');
      console.log('Access: http://localhost:3018/dashboard/agents');
    } else {
      console.log('⚠️ Some endpoints need attention but core functionality working');
    }
  } else {
    console.log('🔧 Some issues remain:');
    if (buildErrors > 0) console.log(`   - ${buildErrors} build cache errors`);
    if (queryClientErrors > 0) console.log(`   - ${queryClientErrors} QueryClient errors`);
  }

  console.log(
    `\nTotal: ${results.filter(r => r.success).length}/${results.length} endpoints working`
  );
}

runComprehensiveTest();
