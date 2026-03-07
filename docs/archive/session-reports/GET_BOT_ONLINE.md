# 🚀 Get Unit Talk Bot Online - Quick Start

## **Step 1: Environment Setup**

### **Create .env file:**

```bash
# In unit-talk-custom-bot directory
cp config/env.example .env
```

### **Fill in your .env file:**

```env
# Discord Configuration (REQUIRED)
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_test_guild_id_here

# Supabase Configuration (REQUIRED)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Discord Role IDs (OPTIONAL - for testing)
ADMIN_ROLE_IDS=123456789,987654321
VIP_ROLE_IDS=111222333
VIP_PLUS_ROLE_IDS=444555666

# Discord Channel IDs (OPTIONAL - for testing)
ANNOUNCEMENTS_CHANNEL_ID=123456789
GENERAL_CHANNEL_ID=987654321

# Feature Flags
AUTO_GRADING_ENABLED=true
DM_NOTIFICATIONS_ENABLED=true
THREAD_MANAGEMENT_ENABLED=true
ANALYTICS_ENABLED=true

# Logging
LOG_LEVEL=info
```

## **Step 2: Get Discord Bot Token**

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application
3. Go to "Bot" section
4. Create bot and copy token
5. Add to `.env` file

## **Step 3: Get Discord Client ID**

1. In Discord Developer Portal
2. Go to "General Information"
3. Copy "Application ID"
4. Add to `.env` file

## **Step 4: Get Guild ID (for testing)**

1. Enable Developer Mode in Discord
2. Right-click your test server
3. Copy Server ID
4. Add to `.env` file

## **Step 5: Setup Supabase**

1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Go to Settings → API
4. Copy URL and keys
5. Add to `.env` file

## **Step 6: Deploy Bot**

### **Option A: Use Deployment Script**

```bash
node scripts/deploy-bot.js
```

### **Option B: Manual Deployment**

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Register commands
npm run register-commands

# Start the bot
npm run dev
```

## **Step 7: Test Basic Commands**

Once bot is online, test these commands:

### **Basic Commands:**

- `/help` - Enhanced help system
- `/tutorial` - Interactive tutorials
- `/ping` - Check bot status
- `/stats` - View your stats

### **Pick Commands:**

- `/pick sport:NFL selection:Chiefs -3.5 odds:-110 units:2 confidence:7`

### **VIP Commands:**

- `/vip-info` - View VIP benefits
- `/trial-status` - Check trial status

## **Step 8: Test Different Tiers**

### **Create Test Users:**

1. Create different Discord roles for testing
2. Assign roles to test users
3. Test tier-specific features

### **Test Each Tier:**

- **Free**: Basic commands only
- **VIP**: Enhanced features
- **VIP+**: AI features
- **Black Label**: Professional features
- **Admin**: Administrative features

## **Step 9: Troubleshooting**

### **Common Issues:**

**Bot not responding:**

- Check if token is correct
- Verify bot has proper permissions
- Check console for errors

**Commands not found:**

- Run `npm run register-commands`
- Check if bot is in server
- Verify bot has "Use Slash Commands" permission

**Database errors:**

- Check Supabase connection
- Verify database schema
- Check API keys

**Permission errors:**

- Verify role IDs in .env
- Check bot permissions
- Ensure user has proper roles

## **Step 10: Next Steps**

### **Complete Testing:**

1. Follow `docs/TESTING_GUIDE.md`
2. Test all features systematically
3. Verify tier access controls
4. Test error handling

### **Production Deployment:**

1. Review `PRODUCTION_READINESS_CHECKLIST.md`
2. Set up monitoring
3. Configure backups
4. Deploy to production

## **📞 Need Help?**

- **Documentation**: Check `docs/` directory
- **Testing Guide**: `docs/TESTING_GUIDE.md`
- **Admin Guide**: `docs/ADMIN_GUIDE.md`
- **User Guide**: `docs/QUICK_START_GUIDE.md`

## **🎯 Quick Test Checklist**

- [ ] Bot responds to `/ping`
- [ ] `/help` shows enhanced help
- [ ] `/tutorial` starts interactive tutorial
- [ ] `/pick` allows pick submission
- [ ] `/vip-info` shows upgrade options
- [ ] Tier restrictions work correctly
- [ ] Button interactions work
- [ ] Error messages are helpful

---

**Your bot should now be online and ready for testing! 🎉**
