# Quick Setup Guide - Discord Onboarding System

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in your values:
```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id  
DISCORD_GUILD_ID=your_discord_guild_id
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Register Commands
```bash
npm run register-commands
```

### 4. Start the Bot
```bash
npm run dev
```

## 🎯 New Commands Available

- `/help` - Comprehensive help with interactive buttons
- `/vip-info` - VIP tier information and upgrade options
- `/trial-status` - Check trial status and remaining time
- `/upgrade` - Quick access to VIP upgrade options  
- `/heat-signal` - Live market alerts (VIP+ only)

## 🎮 Interactive Features

### Button Interactions
All commands include interactive buttons for:
- Viewing VIP perks and benefits
- Starting $1 trials
- Upgrading to VIP/VIP+ tiers
- Accessing VIP lounges and dashboards
- Getting contextual help

### Tier-Based Access
- **Free**: Basic commands and information
- **VIP**: Premium picks and features
- **VIP+**: Heat signals and advanced analytics
- **Trial**: 72-hour access to VIP features

## 📊 Analytics Integration

The system automatically tracks:
- User engagement and interactions
- Command usage patterns
- Trial conversions
- Upgrade funnel metrics

## 🔧 Key Files Created/Modified

### New Commands
- `src/commands/help.ts` - Interactive help system
- `src/commands/vip-info.ts` - VIP information and trials
- `src/commands/trial-status.ts` - Trial management
- `src/commands/upgrade.ts` - Quick upgrade access
- `src/commands/heat-signal.ts` - VIP+ market signals

### New Services
- `src/services/comprehensiveOnboardingService.ts` - Main onboarding logic
- `src/handlers/onboardingButtonHandler.ts` - Button interaction handling

### Updated Files
- `src/types/index.ts` - Added onboarding types
- `src/utils/embeds.ts` - New embed functions
- `src/index.ts` - Integrated new services
- `src/handlers/interactionHandler.ts` - Button routing
- `src/handlers/commandHandler.ts` - Command routing

## 🎨 Customization

### Adding New Tiers
1. Update `UserTier` enum in `src/types/index.ts`
2. Add tier checks in permission services
3. Create tier-specific welcome flows

### Creating New Commands
1. Create command file in `src/commands/`
2. Add to `src/utils/registerCommands.ts`
3. Add handler in `src/handlers/commandHandler.ts`

### Custom Button Actions
1. Add button ID to `onboardingButtonHandler.ts`
2. Create handler method
3. Update interaction routing

## 🚨 Troubleshooting

### Commands Not Appearing
```bash
# Re-register commands
npm run register-commands
```

### Permission Errors
- Verify bot has required Discord permissions
- Check role hierarchy in Discord server
- Validate environment variables

### Database Issues
- Verify Supabase connection
- Check table schemas match types
- Review database permissions

## 📈 Monitoring

### Health Check
```bash
npm run health
```

### Logs
- Check console output for errors
- Monitor user interaction patterns
- Track conversion metrics

## 🔐 Security Notes

- All user actions are permission-checked
- Sensitive operations require tier validation
- Payment processing uses secure methods
- User data is handled per privacy policies

## 📞 Support

For issues:
1. Check logs for specific errors
2. Verify environment configuration  
3. Test with `/help` command
4. Review Discord bot permissions

The system is now ready for production use with comprehensive onboarding, tier management, and user engagement features!