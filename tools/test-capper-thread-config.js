const { env } = require('./src/config/env');

console.log('🔍 Testing Capper Thread Configuration');
console.log('='.repeat(40));

console.log('\n1️⃣ Environment variable:');
console.log('CAPPER_THREAD_GRIFF843:', process.env.CAPPER_THREAD_GRIFF843);

console.log('\n2️⃣ Parsed capperThreads configuration:');
console.log('env.capperThreads:', env.capperThreads);

console.log('\n3️⃣ Griff843 thread ID lookup:');
console.log('env.capperThreads.Griff843:', env.capperThreads.Griff843);

console.log('\n4️⃣ Testing SmartFormBridge getCapperThreadId logic:');
const capperName = 'Griff843';
const threadId = env.capperThreads[capperName];
console.log(`getCapperThreadId('${capperName}'):`, threadId || 'null');

console.log('\n📊 Configuration Status:');
if (threadId) {
  console.log('✅ Griff843 thread ID is properly configured');
  console.log('SmartFormBridge should be able to route picks to Discord');
} else {
  console.log('❌ Griff843 thread ID configuration failed');
  console.log('SmartFormBridge cannot route picks to Discord');
}
