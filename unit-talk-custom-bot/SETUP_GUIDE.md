# Unit Talk Discord Bot - Setup & Troubleshooting Guide

## 🚨 Current Issues Identified

Based on your error logs, the bot is failing because:

1. **Missing Database Tables**: The bot is trying to access `onboarding_flows` and `onboarding_config` tables that don't exist
2. **Database Connection Issues**: "TypeError: fetch failed" indicates network/connection problems
3. **Incomplete Database Schema**: Several required tables are missing from your Supabase database

## 🛠️ Complete Setup Instructions

### Step 1: Database Setup (CRITICAL)

**Option A: Using Supabase SQL Editor (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor" in the left sidebar
3. Copy the entire contents of `complete-database-setup.sql`
4. Paste it into the SQL Editor and click "Run"
5. Verify all tables were created successfully

**Option B: Using the Node.js Setup Script**
```bash
cd unit-talk-custom-bot
node setup-database.js
```

### Step 2: Environment Configuration

Verify your `.env` file has all required variables. Your current configuration looks mostly complete, but double-check these critical ones:

```env
# Database (CRITICAL - Must be correct)
SUPABASE_URL=https://lxqmuzmqtnnlpfapvief.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Discord (CRITICAL)
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=1385977625557602316
DISCORD_GUILD_ID=1284478946171293736
```

### Step 3: Verify Database Connection

Test your database connection:

```bash
cd unit-talk-custom-bot
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

supabase.from('onboarding_config').select('*').limit(1).then(({ data, error }) => {
  if (error) {
    console.error('❌ Database connection failed:', error);
  } else {
    console.log('✅ Database connection successful!');
    console.log('Data:', data);
  }
});
"
```

### Step 4: Install Dependencies

Make sure all dependencies are installed:

```bash
cd unit-talk-custom-bot
npm install
```

### Step 5: Build the Project

```bash
npm run build
```

### Step 6: Start the Bot

```bash
npm run dev
```

## 🔍 Troubleshooting Common Issues

### Issue 1: "TypeError: fetch failed"
**Cause**: Network connectivity or incorrect Supabase URL/keys
**Solutions**:
- Verify your internet connection
- Check Supabase URL format (should start with `https://`)
- Verify your service role key is correct
- Check if your Supabase project is active

### Issue 2: "Failed to load onboarding flows from DB"
**Cause**: Missing `onboarding_flows` table
**Solution**: Run the complete database setup SQL script

### Issue 3: "Failed to load onboarding config from DB"
**Cause**: Missing `onboarding_config` table
**Solution**: Run the complete database setup SQL script

### Issue 4: Bot connects but doesn't respond
**Cause**: Missing permissions or incorrect channel IDs
**Solutions**:
- Verify bot has necessary permissions in Discord server
- Check channel IDs in your `.env` file are correct
- Ensure bot is invited with proper scopes

## 📋 Required Database Tables

After running the setup, you should have these tables:
- `user_profiles`
- `picks`
- `onboarding_config`
- `onboarding_flows` ⚠️ (This was missing!)
- `onboarding_progress`
- `dm_failures`
- `analytics_events`
- `user_journeys`
- `agent_health_checks`
- `agent_notifications`
- `ab_test_cohorts`
- `user_cohort_assignments`
- `ab_test_results`
- `message_templates`
- `feedback_messages`
- `feedback_responses`
- `bot_config`

## 🚀 Quick Fix Commands

Run these commands in order:

```bash
# 1. Navigate to bot directory
cd unit-talk-custom-bot

# 2. Install dependencies
npm install

# 3. Set up database (run the SQL script in Supabase first!)

# 4. Test database connection
node -e "console.log('Testing...'); require('dotenv').config(); const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); supabase.from('onboarding_config').select('*').limit(1).then(r => console.log(r.error ? '❌ Failed' : '✅ Success'));"

# 5. Build and start
npm run build
npm run dev
```

## 🔧 Environment Variables Checklist

Make sure these are set in your `.env` file:

### Required (Bot won't start without these):
- ✅ `DISCORD_TOKEN`
- ✅ `DISCORD_CLIENT_ID`
- ✅ `DISCORD_GUILD_ID`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

### Important for functionality:
- ✅ Channel IDs (FREE_PICKS_CHANNEL_ID, VIP_PICKS_CHANNEL_ID, etc.)
- ✅ Role IDs (VIP_ROLE_IDS, ADMIN_ROLE_IDS, etc.)
- ✅ Feature flags (AUTO_GRADING_ENABLED, etc.)

## 📞 Still Having Issues?

If you're still experiencing problems after following this guide:

1. **Check the logs**: Look for specific error messages
2. **Verify Supabase project**: Ensure it's active and accessible
3. **Test Discord bot token**: Make sure it's valid and has proper permissions
4. **Check network connectivity**: Ensure you can reach Supabase from your server

## 🎯 Expected Success Output

When everything is working correctly, you should see:
```
🚀 Unit Talk Discord Bot starting...
📋 Loading environment configuration...
🏗️ Creating bot instance...
🔧 Initializing core services...
✅ Core services initialized
🔧 Initializing analytics service...
✅ Analytics service initialized
🔧 Initializing feature services...
✅ Feature services initialized
🔧 Initializing onboarding services...
✅ Onboarding services initialized
🔧 Initializing admin services...
✅ Admin services initialized
🔧 Initializing handlers...
✅ All handlers initialized
🚀 Starting bot...
🔐 Validating environment variables...
✅ Environment variables validated
🔗 Connecting to Discord...
🤖 Bot online: Unit Talk#7332
🏠 Serving 1 guilds
🔧 Running post-ready initialization...
⏰ Starting periodic tasks...
🎉 Unit Talk Discord Bot is fully operational!
```

**No error messages about failed database connections!**