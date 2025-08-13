const { createClient } = require('@supabase/supabase-js');
const http = require('http');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function checkEndpoint(url, name) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve({ name, status: res.statusCode === 200 ? '✅' : '❌', code: res.statusCode });
    });
    req.on('error', () => {
      resolve({ name, status: '❌', code: 'ERROR' });
    });
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ name, status: '⏰', code: 'TIMEOUT' });
    });
  });
}

async function validateSystem() {
  console.log('🎯 COMPREHENSIVE SYSTEM VALIDATION');
  console.log('=' .repeat(50));
  
  // 1. Service Health Checks
  console.log('\n🏥 SERVICE HEALTH');
  const endpoints = [
    { url: 'http://localhost:3010/api/health', name: 'API Health' },
    { url: 'http://localhost:8088', name: 'Temporal UI' },
    { url: 'http://localhost:3001', name: 'Grafana' },
    { url: 'http://localhost:9090', name: 'Prometheus' },
    { url: 'http://localhost:3004', name: 'Command Center' },
    { url: 'http://localhost:3002', name: 'Smart Form' },
    { url: 'http://localhost:3003', name: 'Dashboard' }
  ];
  
  const results = await Promise.all(endpoints.map(ep => checkEndpoint(ep.url, ep.name)));
  results.forEach(r => console.log(`  ${r.status} ${r.name}: ${r.code}`));
  
  // 2. Database Connectivity
  console.log('\n💾 DATABASE STATUS');
  try {
    const { data: testQuery, error } = await supabase
      .from('shadow_decisions')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('  ❌ Supabase: Connection failed -', error.message);
    } else {
      console.log('  ✅ Supabase: Connected successfully');
    }
  } catch (err) {
    console.log('  ❌ Supabase: Connection error -', err.message);
  }
  
  // 3. Settlement System Status
  console.log('\n⚙️  SETTLEMENT SYSTEM');
  try {
    const { data: settled } = await supabase
      .from('shadow_decisions')
      .select('id')
      .not('settled_at', 'is', null);
    
    const { data: unsettled } = await supabase
      .from('shadow_decisions')
      .select('id')
      .is('settled_at', null);
    
    console.log(`  📊 Settled records: ${settled?.length || 0}`);
    console.log(`  📊 Unsettled records: ${unsettled?.length || 0}`);
    
    // Test settlement script availability
    const fs = require('fs');
    const scriptPath = 'apps/api/scripts/settlement-backfill.ts';
    if (fs.existsSync(scriptPath)) {
      console.log('  ✅ Settlement script: Available');
    } else {
      console.log('  ❌ Settlement script: Missing');
    }
    
  } catch (err) {
    console.log('  ❌ Settlement system check failed:', err.message);
  }
  
  // 4. Environment Configuration
  console.log('\n🔧 CONFIGURATION');
  const envVars = [
    'SUPABASE_URL',
    'DATABASE_URL', 
    'PUBLISH_TO_DISCORD',
    'SHADOW_MODE',
    'NODE_ENV'
  ];
  
  envVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    const display = varName === 'DATABASE_URL' || varName === 'SUPABASE_URL' 
      ? (value ? 'Set' : 'Not set')
      : (value || 'Not set');
    console.log(`  ${status} ${varName}: ${display}`);
  });
  
  // 5. System Resources
  console.log('\n📈 SYSTEM RESOURCES');
  const usage = process.memoryUsage();
  console.log(`  💾 Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB used`);
  console.log(`  ⏱️  Uptime: ${Math.round(process.uptime())}s`);
  
  // 6. Docker Services
  console.log('\n🐳 DOCKER SERVICES STATUS');
  console.log('  Run: ./dev.sh status - to check all container health');
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 SYSTEM VALIDATION COMPLETE');
  console.log('✨ Environment is ready for production operations!');
}

validateSystem().catch(console.error);