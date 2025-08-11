// Test main dashboard page
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3015,
  path: '/',
  method: 'GET',
  timeout: 3000,
};

console.log('🏠 Testing main page: http://localhost:3015/');
const startTime = Date.now();

const req = http.request(options, res => {
  const responseTime = Date.now() - startTime;
  console.log(`🎉 SUCCESS! Response in ${responseTime}ms`);
  console.log(`📊 Status: ${res.statusCode}`);

  let data = '';
  res.on('data', chunk => (data += chunk));
  res.on('end', () => {
    console.log(`📄 Content length: ${data.length}`);
    if (data.includes('Command Center') || data.includes('Unit Talk')) {
      console.log('✅ Dashboard loaded successfully!');
    } else {
      console.log('Content preview:', data.substring(0, 200));
    }
  });
});

req.on('error', err => console.log(`❌ Error: ${err.message}`));
req.on('timeout', () => {
  console.log('⏰ Main page also timing out');
  req.destroy();
});

req.end();
