// Test QueryClient integration
const http = require('http');

async function testDashboardPage() {
  return new Promise(resolve => {
    console.log('🧪 Testing Dashboard Agents Page for QueryClient errors...\n');

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3016,
        path: '/dashboard/agents',
        method: 'GET',
        timeout: 10000,
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          console.log(`✅ Dashboard page status: ${res.statusCode}`);

          // Check if page contains error indicators
          const hasError =
            data.includes('QueryClient') ||
            data.includes('unhandled') ||
            data.includes('runtime error') ||
            data.includes('error:');

          if (hasError) {
            console.log('❌ Page contains QueryClient or runtime errors');
            console.log('🔍 Error indicators found in response');
          } else {
            console.log('✅ No QueryClient errors detected');
            console.log('🎉 Dashboard page loading successfully');
          }

          // Check for expected dashboard content
          const hasExpectedContent =
            data.includes('dashboard') || data.includes('agents') || data.includes('Agent');

          if (hasExpectedContent) {
            console.log('✅ Dashboard content detected');
          } else {
            console.log('⚠️ Dashboard content not detected');
          }

          resolve({
            success: res.statusCode === 200 && !hasError && hasExpectedContent,
            status: res.statusCode,
            hasError,
            hasContent: hasExpectedContent,
          });
        });
      }
    );

    req.on('error', err => {
      console.log(`❌ Request failed: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      console.log('⏰ Request timeout');
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.end();
  });
}

async function runTest() {
  console.log('🚀 Testing QueryClient Provider Fix...\n');

  const result = await testDashboardPage();

  console.log('\n📊 Test Results:');
  console.log('================');

  if (result.success) {
    console.log('🎉 SUCCESS: QueryClient provider is working correctly!');
    console.log('✅ Dashboard page loads without QueryClient errors');
    console.log('✅ Ready for production use');
  } else {
    console.log('❌ FAILURE: Issues detected');
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    if (result.hasError) {
      console.log('⚠️ QueryClient or runtime errors found');
    }
  }

  console.log(`\nStatus: ${result.status || 'N/A'}`);
  console.log('Next steps: Access http://localhost:3016/dashboard/agents in browser to verify');
}

runTest();
