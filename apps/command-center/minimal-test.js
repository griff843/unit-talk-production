// Minimal server test - just check if anything is running
const net = require('net');

function testPort(port) {
  return new Promise(resolve => {
    const socket = new net.Socket();

    socket.setTimeout(2000);

    socket.on('connect', () => {
      console.log(`✅ Port ${port}: Server is running`);
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      console.log(`⏰ Port ${port}: Timeout`);
      socket.destroy();
      resolve(false);
    });

    socket.on('error', err => {
      if (err.code === 'ECONNREFUSED') {
        console.log(`❌ Port ${port}: No server running`);
      } else {
        console.log(`❌ Port ${port}: Error - ${err.message}`);
      }
      resolve(false);
    });

    socket.connect(port, 'localhost');
  });
}

async function checkPorts() {
  console.log('🔍 Checking common Next.js ports...');

  const ports = [3000, 3015, 3030, 3055, 8080];

  for (const port of ports) {
    await testPort(port);
  }
}

checkPorts();
