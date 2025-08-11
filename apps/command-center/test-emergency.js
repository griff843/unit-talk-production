// Test emergency page with shorter timeout
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3015,
  path: '/emergency',
  method: 'GET',
  timeout: 5000,
  headers: {
    'User-Agent': 'Emergency-Test/1.0',
  },
};

console.log('🚨 Testing emergency page: http://localhost:3015/emergency');
const startTime = Date.now();

const req = http.request(options, res => {
  const responseTime = Date.now() - startTime;
  console.log(`✅ BREAKTHROUGH! Response in ${responseTime}ms`);
  console.log(`📊 Status: ${res.statusCode}`);
  console.log(`📝 Content-Type: ${res.headers['content-type']}`);

  let data = '';
  res.on('data', chunk => {
    data += chunk.toString();
    console.log(`📦 Received chunk: ${chunk.length} bytes`);
  });

  res.on('end', () => {
    const totalTime = Date.now() - startTime;
    console.log(`🏁 Complete response in ${totalTime}ms`);
    console.log(`📄 Total content: ${data.length} characters`);

    if (data.includes('Emergency Command Center')) {
      console.log('🎉 SUCCESS: Emergency page is working!');
      console.log('🔧 This proves Next.js server is functional');
      console.log('⚠️  Main dashboard issue is likely in specific components/middleware');
    } else {
      console.log('❌ Unexpected content received');
    }
    process.exit(0);
  });
});

req.on('error', err => {
  console.log(`❌ Request error:`, err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.log(`⏰ Still timing out after 5 seconds`);
  req.destroy();
  process.exit(1);
});

req.end();
