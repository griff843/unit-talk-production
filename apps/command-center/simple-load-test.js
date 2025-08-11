const startTime = Date.now();
console.log('🚀 Starting command center load test...');

// Test HTTP response time
const http = require('http');
const url = require('url');

const testUrl = 'http://localhost:3055';
console.log(`📍 Testing: ${testUrl}`);

const req = http.request(testUrl, res => {
  const responseTime = Date.now() - startTime;
  console.log(`✅ Server responded in: ${responseTime}ms`);
  console.log(`📊 Status Code: ${res.statusCode}`);
  console.log(`📝 Headers: ${JSON.stringify(res.headers, null, 2)}`);

  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {
    const totalTime = Date.now() - startTime;
    console.log(`🏁 Total load time: ${totalTime}ms`);
    console.log(`📄 Content length: ${data.length} characters`);

    // Check if content has key indicators
    const hasTitle = data.includes('Unit Talk Command Center');
    const hasReact = data.includes('__NEXT_DATA__');
    const hasStyles = data.includes('/_next/static');

    console.log(`🎯 Has title: ${hasTitle}`);
    console.log(`⚛️ Has React: ${hasReact}`);
    console.log(`🎨 Has styles: ${hasStyles}`);

    if (totalTime > 5000) {
      console.log('❌ SLOW: Server response took over 5 seconds');
    } else if (totalTime > 1000) {
      console.log('⚠️ MODERATE: Server response took over 1 second');
    } else {
      console.log('✅ FAST: Server responded quickly');
    }
  });
});

req.on('error', err => {
  const errorTime = Date.now() - startTime;
  console.log(`❌ Request failed after ${errorTime}ms:`, err.message);
  console.log('Error details:', err);
});

req.on('timeout', () => {
  const timeoutTime = Date.now() - startTime;
  console.log(`⏰ Request timed out after ${timeoutTime}ms`);
});

req.setTimeout(30000); // 30 second timeout
req.end();
