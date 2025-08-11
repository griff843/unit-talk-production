// Final test - bypass everything
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3015,
  path: '/bypass',
  method: 'GET',
  timeout: 3000,
};

console.log('🔍 FINAL TEST: http://localhost:3015/bypass');
console.log('This bypasses CSS, middleware, and all complex components');

const req = http.request(options, res => {
  console.log(`🎉 WORKING! Status: ${res.statusCode}`);

  let data = '';
  res.on('data', chunk => (data += chunk));
  res.on('end', () => {
    if (data.includes('BYPASS SUCCESS')) {
      console.log('✅ ROOT CAUSE IDENTIFIED:');
      console.log('   - Next.js server IS working');
      console.log('   - Problem is in main layout/CSS/components');
      console.log('   - Solution: Remove blocking imports/components');
    }
    console.log('Content preview:', data.substring(0, 200));
  });
});

req.on('error', err => console.log(`❌ Error: ${err.message}`));
req.on('timeout', () => {
  console.log('❌ DEEPER ISSUE: Even bypass page hangs');
  console.log('   - Next.js server has fundamental problem');
  console.log('   - Needs complete restart with clean environment');
  req.destroy();
});

req.end();
