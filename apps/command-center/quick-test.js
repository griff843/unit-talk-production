// Quick test to check if server is responsive
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3055,
  path: '/test',
  method: 'GET',
  timeout: 5000,
};

console.log('🧪 Quick test: Connecting to http://localhost:3055/test');

const req = http.request(options, res => {
  console.log(`✅ Status: ${res.statusCode}`);
  console.log(`📝 Headers:`, res.headers);

  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`📄 Response length: ${data.length}`);
    if (data.includes('Command Center Test Page')) {
      console.log('✅ Test page loaded successfully!');
    } else {
      console.log('❌ Test page content not found');
      console.log('First 200 chars:', data.substring(0, 200));
    }
  });
});

req.on('error', err => {
  console.log('❌ Connection error:', err.message);
});

req.on('timeout', () => {
  console.log('⏰ Request timed out');
  req.destroy();
});

req.end();
