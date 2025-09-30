console.log('🔍 Testing Environment Variable Loading Order\n');

// Test without any dotenv first
console.log('1. Raw environment (before dotenv):');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT SET');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

// Load main .env
console.log('\n2. Loading main .env file:');
require('dotenv').config({ path: '../../.env' });
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30) + '...');

// Check if .env.local exists and what it would load
console.log('\n3. Checking .env.local:');
const fs = require('fs');
const path = require('path');
const envLocalPath = path.join(__dirname, '../../.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('   .env.local EXISTS');
  const envLocalContent = fs.readFileSync(envLocalPath, 'utf8');
  const supabaseUrlMatch = envLocalContent.match(/SUPABASE_URL=(.+)/);
  if (supabaseUrlMatch) {
    console.log('   .env.local SUPABASE_URL:', supabaseUrlMatch[1]);
  } else {
    console.log('   .env.local does NOT contain SUPABASE_URL');
  }
} else {
  console.log('   .env.local does NOT exist');
}

// Load .env.local if it exists
console.log('\n4. Loading .env.local (if exists):');
require('dotenv').config({ path: '../../.env.local' });
console.log('   SUPABASE_URL after .env.local:', process.env.SUPABASE_URL);
console.log('   SUPABASE_SERVICE_ROLE_KEY after .env.local:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30) + '...');

// Final values
console.log('\n5. Final environment values:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30) + '...');
console.log('   NODE_ENV:', process.env.NODE_ENV);