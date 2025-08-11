#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Unit Talk Discord Bot Deployment Script');
console.log('==========================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('Please create a .env file with the following variables:');
  console.log(`
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id_for_dev_testing

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: Agent Services
AGENTS_BASE_URL=http://localhost:3001
AGENTS_API_KEY=your_agents_api_key

# Discord Role IDs (configure based on your server)
ADMIN_ROLE_IDS=role_id_1,role_id_2
MODERATOR_ROLE_IDS=role_id_1,role_id_2
VIP_ROLE_IDS=role_id_1,role_id_2
VIP_PLUS_ROLE_IDS=role_id_1,role_id_2

# Discord Channel IDs (configure based on your server)
ANNOUNCEMENTS_CHANNEL_ID=channel_id
FREE_PICKS_CHANNEL_ID=channel_id
VIP_PICKS_CHANNEL_ID=channel_id
VIP_PLUS_PICKS_CHANNEL_ID=channel_id
GENERAL_CHANNEL_ID=channel_id
VIP_GENERAL_CHANNEL_ID=channel_id
VIP_PLUS_GENERAL_CHANNEL_ID=channel_id
THREADS_CHANNEL_ID=channel_id
ADMIN_CHANNEL_ID=channel_id

# Feature Flags
AUTO_GRADING_ENABLED=true
DM_NOTIFICATIONS_ENABLED=true
THREAD_MANAGEMENT_ENABLED=true
ANALYTICS_ENABLED=true

# Limits and Configuration
MAX_PICKS_PER_DAY=10
MAX_UNITS_PER_PICK=10
THREAD_AUTO_ARCHIVE_MINUTES=1440

# Logging
LOG_LEVEL=info
  `);
  process.exit(1);
}

console.log('✅ .env file found');

// Function to run commands with error handling
function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    const output = execSync(command, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      encoding: 'utf8',
    });
    console.log(`✅ ${description} completed successfully`);
    return output;
  } catch (error) {
    console.log(`❌ ${description} failed:`);
    console.log(error.message);
    return null;
  }
}

// Step 1: Install dependencies
console.log('\n📦 Step 1: Installing Dependencies');
runCommand('npm install', 'Installing npm dependencies');

// Step 2: Build the project
console.log('\n🔨 Step 2: Building the Project');
const buildOutput = runCommand('npm run build', 'Building TypeScript project');

if (!buildOutput) {
  console.log('❌ Build failed. Please fix the errors above and try again.');
  process.exit(1);
}

// Step 3: Register commands
console.log('\n📝 Step 3: Registering Discord Commands');
runCommand('npm run register-commands', 'Registering slash commands');

// Step 4: Start the bot
console.log('\n🚀 Step 4: Starting the Bot');
console.log('Starting the bot in development mode...');
console.log('Press Ctrl+C to stop the bot');

try {
  execSync('npm run dev', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
} catch (error) {
  console.log('\n🛑 Bot stopped');
}

console.log('\n✅ Deployment script completed');
console.log('\n📋 Next Steps:');
console.log('1. Test basic commands: /help, /ping, /stats');
console.log('2. Test pick submission: /pick');
console.log('3. Test VIP features: /vip-info');
console.log('4. Test AI features: /ask-ai (VIP+)');
console.log('5. Test admin features: /admin (if admin)');
console.log('\n📚 Documentation:');
console.log('- User Guide: docs/QUICK_START_GUIDE.md');
console.log('- Command Reference: docs/USER_COMMAND_REFERENCE.md');
console.log('- Admin Guide: docs/ADMIN_GUIDE.md');
