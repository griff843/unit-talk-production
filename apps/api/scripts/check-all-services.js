#!/usr/bin/env node
/**
 * Service Status Checker
 * Checks status of all Unit Talk services and applications
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

console.log('🔍 UNIT TALK PRODUCTION v3 - SERVICE STATUS CHECK');
console.log('=' .repeat(70));

async function checkDockerServices() {
  console.log('🐳 DOCKER INFRASTRUCTURE SERVICES:');
  
  try {
    const { stdout } = await execAsync('docker-compose -f docker-compose.production-local.yml ps --format "table {{.Name}}\\t{{.Status}}\\t{{.Ports}}"');
    console.log(stdout);
  } catch (error) {
    console.log('  ❌ Docker services not running or error:', error.message);
  }
}

async function checkAgentProcesses() {
  console.log('🤖 AGENT SYSTEM STATUS:');
  
  try {
    // Check for running Node.js processes that might be agents
    const { stdout: nodeProcesses } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV 2>nul || echo "No Node.js processes"');
    
    if (nodeProcesses.includes('node.exe')) {
      const lines = nodeProcesses.split('\n');
      const nodeCount = lines.filter(line => line.includes('node.exe')).length;
      console.log(`  📊 Found ${nodeCount} Node.js processes running`);
      
      // Try to check for specific agent processes
      try {
        const { stdout: agentCheck } = await execAsync('netstat -ano | findstr ":3000\\|:3001" 2>nul || echo "No services on agent ports"');
        if (agentCheck.includes(':3000') || agentCheck.includes(':3001')) {
          console.log('  ✅ Detected services on agent ports (3000/3001)');
        } else {
          console.log('  ⚠️  No services detected on standard agent ports');
        }
      } catch (error) {
        console.log('  ⚠️  Could not check agent ports');
      }
    } else {
      console.log('  ❌ No Node.js agent processes detected');
    }
  } catch (error) {
    console.log('  ❌ Could not check agent processes:', error.message);
  }
}

async function checkApplications() {
  console.log('📱 APPLICATION STATUS:');
  
  const apps = [
    { name: 'Discord Bot', path: 'unit-talk-custom-bot', port: 'N/A' },
    { name: 'Smart Form', path: 'unit-talk-smart form', port: '3000' },
    { name: 'Frontend Dashboard', path: 'unit-talk-frontend', port: '3000' }
  ];
  
  for (const app of apps) {
    console.log(`  📋 ${app.name}:`);
    
    try {
      // Check if directory exists and has package.json
      const { stdout: dirCheck } = await execAsync(`dir "${app.path}\\package.json" 2>nul || echo "NOT_FOUND"`);
      
      if (dirCheck.includes('NOT_FOUND')) {
        console.log(`    ❌ Application directory not found: ${app.path}`);
        continue;
      }
      
      console.log(`    ✅ Application files present`);
      
      // Check if port is in use (for web apps)
      if (app.port !== 'N/A') {
        try {
          const { stdout: portCheck } = await execAsync(`netstat -ano | findstr ":${app.port}" 2>nul || echo "PORT_FREE"`);
          if (portCheck.includes('PORT_FREE')) {
            console.log(`    ⚠️  Not running (port ${app.port} free)`);
          } else {
            console.log(`    ✅ Running on port ${app.port}`);
          }
        } catch (error) {
          console.log(`    ⚠️  Could not check port ${app.port}`);
        }
      }
    } catch (error) {
      console.log(`    ❌ Error checking ${app.name}:`, error.message);
    }
  }
}

async function checkTemporalServices() {
  console.log('⏰ TEMPORAL WORKFLOW ENGINE:');
  
  try {
    // Check if Temporal is running in Docker
    const { stdout: temporalCheck } = await execAsync('docker ps --filter "name=temporal" --format "table {{.Names}}\\t{{.Status}}" 2>nul || echo "NOT_RUNNING"');
    
    if (temporalCheck.includes('NOT_RUNNING') || !temporalCheck.includes('temporal')) {
      console.log('  ❌ Temporal server not running in Docker');
    } else {
      console.log('  ✅ Temporal server running in Docker');
    }
    
    // Try to check Temporal web UI
    try {
      const { stdout: webUICheck } = await execAsync('curl -s -o nul -w "%{http_code}" http://localhost:8233 2>nul || echo "NO_RESPONSE"');
      
      if (webUICheck.includes('200')) {
        console.log('  ✅ Temporal Web UI accessible (port 8233)');
      } else {
        console.log('  ⚠️  Temporal Web UI not accessible');
      }
    } catch (error) {
      console.log('  ⚠️  Could not check Temporal Web UI');
    }
  } catch (error) {
    console.log('  ❌ Error checking Temporal:', error.message);
  }
}

async function generateSummary() {
  console.log('');
  console.log('📈 SUMMARY:');
  
  const services = [];
  
  // Infrastructure
  try {
    const { stdout } = await execAsync('docker-compose -f docker-compose.production-local.yml ps --services --filter="status=running" 2>nul || echo ""');
    const runningServices = stdout.trim().split('\n').filter(s => s.trim());
    services.push({ category: 'Infrastructure', count: runningServices.length, total: 2 });
  } catch (error) {
    services.push({ category: 'Infrastructure', count: 0, total: 2 });
  }
  
  // Applications
  let runningApps = 0;
  const appPorts = ['3000', '8080', '4000'];
  
  for (const port of appPorts) {
    try {
      const { stdout } = await execAsync(`netstat -ano | findstr ":${port}" 2>nul || echo ""`);
      if (stdout.trim()) runningApps++;
    } catch (error) {
      // ignore
    }
  }
  
  services.push({ category: 'Applications', count: runningApps, total: 3 });
  
  services.forEach(service => {
    const percentage = ((service.count / service.total) * 100).toFixed(0);
    const status = service.count === service.total ? '✅' : service.count > 0 ? '⚠️' : '❌';
    console.log(`   ${status} ${service.category}: ${service.count}/${service.total} running (${percentage}%)`);
  });
  
  const totalRunning = services.reduce((sum, s) => sum + s.count, 0);
  const totalServices = services.reduce((sum, s) => sum + s.total, 0);
  const overallPercentage = ((totalRunning / totalServices) * 100).toFixed(0);
  
  console.log('');
  console.log(`🎯 Overall System Status: ${totalRunning}/${totalServices} services (${overallPercentage}%)`);
  
  if (overallPercentage >= 80) {
    console.log('🎉 System Status: OPERATIONAL');
  } else if (overallPercentage >= 50) {
    console.log('⚠️  System Status: PARTIALLY OPERATIONAL');
  } else {
    console.log('❌ System Status: NEEDS ATTENTION');
  }
  
  console.log('=' .repeat(70));
}

async function main() {
  try {
    await checkDockerServices();
    console.log('');
    
    await checkAgentProcesses();
    console.log('');
    
    await checkApplications();
    console.log('');
    
    await checkTemporalServices();
    
    await generateSummary();
    
  } catch (error) {
    console.error('❌ Service check failed:', error);
    process.exit(1);
  }
}

// Run the check
main();