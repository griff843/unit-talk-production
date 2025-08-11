// Test the minimal page specifically
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3055,
  path: '/minimal',
  method: 'GET',
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
};

console.log('🧪 Testing minimal page: http://localhost:3055/minimal');
const startTime = Date.now();

const req = http.request(options, res => {
  const responseTime = Date.now() - startTime;
  console.log(`✅ Response received in ${responseTime}ms`);
  console.log(`📊 Status: ${res.statusCode}`);
  console.log(`📝 Headers:`, Object.keys(res.headers).join(', '));

  let data = '';
  res.on('data', chunk => {
    data += chunk.toString();
  });

  res.on('end', () => {
    const totalTime = Date.now() - startTime;
    console.log(`🏁 Total time: ${totalTime}ms`);
    console.log(`📄 Content length: ${data.length}`);

    if (data.includes('Minimal Test Page')) {
      console.log('✅ SUCCESS: Minimal page loaded correctly!');
      console.log('First 200 chars:', data.substring(0, 200));
    } else {
      console.log('❌ FAILED: Expected content not found');
      console.log('First 500 chars:', data.substring(0, 500));
    }
    process.exit(0);
  });
});

req.on('error', err => {
  const errorTime = Date.now() - startTime;
  console.log(`❌ Error after ${errorTime}ms:`, err.message);
  process.exit(1);
});

req.on('timeout', () => {
  const timeoutTime = Date.now() - startTime;
  console.log(`⏰ Timeout after ${timeoutTime}ms`);
  req.destroy();
  process.exit(1);
});

req.end();
