# UT Capper System - Complete Implementation

## Overview

The UT Capper System is a comprehensive Discord bot integration that allows designated "UT Cappers" to submit, edit, and delete betting picks through Discord commands. The system includes automated daily publishing, performance tracking, and a complete onboarding flow.

## Features

### 🎯 Pick Management
- **Submit Picks**: Interactive `/submit-pick` command with step-by-step guidance
- **Edit Picks**: Modify analysis, units, and other pick details before publishing
- **Delete Picks**: Safely remove picks with confirmation dialogs
- **Validation**: Comprehensive pick validation and error handling

### 📊 Performance Tracking
- **Detailed Stats**: Win/loss records, ROI, profit tracking, streaks
- **Timeframe Filtering**: View stats for 7d, 30d, 90d, or all-time
- **Sport Breakdown**: Performance analysis by sport
- **Recent Picks**: Quick view of latest submissions

### 🤖 Automated Publishing
- **Daily Schedule**: Automatic publishing at 10:00 AM daily
- **Threaded Organization**: Summary posts with detailed pick threads
- **Analytics Tracking**: Complete event logging for all pick activities
- **Error Handling**: Failed pick republishing and admin notifications

### 👥 User Management
- **Onboarding Flow**: Complete registration process with guidelines
- **Role Assignment**: Automatic UT Capper role assignment
- **Profile Management**: Customizable capper profiles with stats

## Installation & Setup

### 1. Install Dependencies

```bash
npm install discord.js node-cron
```

### 2. Database Setup

The system requires the following database tables (extend your existing Supabase schema):

```sql
-- Daily picks table
CREATE TABLE daily_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  capper_id UUID NOT NULL,
  capper_discord_id TEXT NOT NULL,
  capper_username TEXT NOT NULL,
  event_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pick_type TEXT NOT NULL,
  total_legs INTEGER NOT NULL DEFAULT 1,
  total_odds INTEGER NOT NULL,
  total_units DECIMAL(5,2) NOT NULL,
  analysis TEXT,
  thread_id TEXT,
  message_id TEXT,
  legs JSONB NOT NULL,
  metadata JSONB
);

-- Capper profiles table
CREATE TABLE capper_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  tier TEXT NOT NULL DEFAULT 'ut_capper',
  bio TEXT,
  favorite_sports TEXT[],
  experience_level TEXT,
  timezone TEXT,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB
);

-- Analytics events table
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL,
  capper_id UUID,
  pick_id UUID,
  metadata JSONB
);
```

### 3. Basic Integration

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import { createCapperSystem, CapperSystemConfig } from './src/capperSystem';

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Configure capper system
const capperConfig: CapperSystemConfig = {
  publishChannelId: 'YOUR_PUBLISH_CHANNEL_ID',
  enableScheduledPublishing: true,
  timezone: 'America/New_York'
};

// Initialize capper system
const capperSystem = createCapperSystem(client, capperConfig);

// Start the bot
client.login('YOUR_BOT_TOKEN').then(async () => {
  const initialized = await capperSystem.initialize();
  
  if (initialized) {
    console.log('✅ UT Capper System ready!');
  } else {
    console.error('❌ Failed to initialize capper system');
  }
});
```

### 4. Advanced Integration

```typescript
import { Client } from 'discord.js';
import { CapperSystem } from './src/capperSystem';

class MyDiscordBot {
  private client: Client;
  private capperSystem: CapperSystem;

  constructor() {
    this.client = new Client({ /* your intents */ });
    this.capperSystem = new CapperSystem(this.client, {
      publishChannelId: process.env.PICKS_CHANNEL_ID!,
      adminRoleId: process.env.ADMIN_ROLE_ID,
      enableScheduledPublishing: true
    });
  }

  async start() {
    // Initialize capper system
    await this.capperSystem.initialize();
    
    // Add custom event handlers
    this.client.on('ready', () => {
      console.log('Bot is ready!');
      this.setupAdminCommands();
    });

    await this.client.login(process.env.DISCORD_TOKEN);
  }

  private setupAdminCommands() {
    // Add admin-only commands for system management
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      if (interaction.commandName === 'admin-publish-now') {
        // Manual publishing trigger
        const success = await this.capperSystem.publishPicksNow();
        await interaction.reply({
          content: success ? '✅ Picks published!' : '❌ Publishing failed',
          ephemeral: true
        });
      }
      
      if (interaction.commandName === 'admin-system-status') {
        // System health check
        const status = await this.capperSystem.getSystemStatus();
        await interaction.reply({
          content: `System Status: ${JSON.stringify(status, null, 2)}`,
          ephemeral: true
        });
      }
    });
  }
}

// Start the bot
new MyDiscordBot().start();
```

## Commands Reference

### User Commands

#### `/submit-pick`
Interactive pick submission with step-by-step guidance.

**Features:**
- Event date selection with validation
- Sport selection from comprehensive list
- Pick type selection (single/parlay)
- Detailed leg configuration
- Analysis input
- Preview before submission
- Validation and warnings

**Usage Flow:**
1. Run `/submit-pick`
2. Fill basic info modal (date, type, analysis)
3. Select sport from dropdown
4. Enter leg details (teams, market, selection, odds, units)
5. For parlays: add additional legs or preview
6. Review complete pick with calculated odds
7. Submit for daily publishing

#### `/edit-pick [date]`
Edit pending picks before publishing deadline.

**Options:**
- `date` (optional): Specific date to view picks for

**Features:**
- List all editable picks for date
- Edit analysis text
- Modify total units
- View full pick details
- Real-time validation

#### `/delete-pick [date]`
Delete pending picks with confirmation.

**Options:**
- `date` (optional): Specific date to view picks for

**Features:**
- List all deletable picks
- Confirmation dialog with full pick preview
- Permanent deletion with logging
- Option to edit instead of delete

#### `/capper-stats [capper] [timeframe]`
View detailed performance statistics.

**Options:**
- `capper` (optional): View another capper's stats
- `timeframe` (optional): 7d, 30d, 90d, or all

**Features:**
- Win/loss records and percentages
- Financial performance (ROI, profit/loss)
- Current streaks and best sports
- Sport-by-sport breakdown
- Recent picks history

#### `/capper-onboard`
Complete onboarding process for new cappers.

**Features:**
- Welcome and feature overview
- Guidelines and rules agreement
- Profile setup (bio, experience, sports)
- Automatic role assignment
- Getting started guidance

### Admin Commands (Custom Implementation)

```typescript
// Example admin command implementations
const adminCommands = [
  {
    name: 'admin-publish-now',
    description: 'Manually trigger daily pick publishing'
  },
  {
    name: 'admin-republish-failed',
    description: 'Republish failed picks for a specific date',
    options: [{
      name: 'date',
      description: 'Date to republish (YYYY-MM-DD)',
      type: 'STRING',
      required: true
    }]
  },
  {
    name: 'admin-system-status',
    description: 'View capper system health and status'
  },
  {
    name: 'admin-capper-stats',
    description: 'View comprehensive capper statistics',
    options: [{
      name: 'timeframe',
      description: 'Statistics timeframe',
      type: 'STRING',
      choices: [
        { name: 'Last 7 Days', value: '7d' },
        { name: 'Last 30 Days', value: '30d' },
        { name: 'All Time', value: 'all' }
      ]
    }]
  }
];
```

## Configuration Options

### CapperSystemConfig

```typescript
interface CapperSystemConfig {
  publishChannelId: string;        // Required: Channel for daily pick publishing
  adminRoleId?: string;           // Optional: Admin role for management commands
  enableScheduledPublishing?: boolean; // Optional: Enable/disable auto publishing (default: true)
  timezone?: string;              // Optional: Timezone for scheduling (default: America/New_York)
}
```

### Environment Variables

```env
# Discord Configuration
DISCORD_TOKEN=your_bot_token_here
PICKS_CHANNEL_ID=channel_id_for_daily_picks
ADMIN_ROLE_ID=admin_role_id_for_management

# Database Configuration (Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional Configuration
CAPPER_TIMEZONE=America/New_York
ENABLE_SCHEDULED_PUBLISHING=true
```

## Daily Schedule

### Submission Window
- **Opens**: 12:01 AM daily
- **Closes**: 9:00 AM daily
- **Timezone**: Configurable (default: Eastern Time)

### Publishing Schedule
- **Time**: 10:00 AM daily
- **Process**: 
  1. Collect all pending picks for the day
  2. Create summary embed in main channel
  3. Create thread for detailed picks
  4. Post individual pick embeds in thread
  5. Update pick statuses to 'published'
  6. Log analytics events

### Error Handling
- Failed picks are logged and can be republished
- Admin notifications for publishing failures
- Automatic retry mechanisms for transient errors

## Analytics & Tracking

### Event Types
- `pick_submitted`: When a capper submits a new pick
- `pick_edited`: When a pick is modified
- `pick_deleted`: When a pick is removed
- `pick_published`: When a pick is published to Discord
- `capper_onboarded`: When a new capper completes onboarding

### Performance Metrics
- Total picks submitted/published
- Win rates by capper and timeframe
- ROI and profit/loss tracking
- Popular sports and markets
- Submission timing patterns

## Troubleshooting

### Common Issues

#### "Capper profile not found"
- User needs to complete `/capper-onboard` first
- Check database connection and table structure

#### "Submissions are closed"
- Check current time vs 9:00 AM deadline
- Verify timezone configuration

#### "Role assignment failed"
- Ensure bot has permission to manage roles
- Check role hierarchy (bot role must be higher)

#### Publishing failures
- Verify channel permissions
- Check rate limiting
- Review error logs for specific issues

### Debug Mode

```typescript
// Enable detailed logging
process.env.LOG_LEVEL = 'debug';

// Check system status
const status = await capperSystem.getSystemStatus();
console.log('System Status:', status);

// Test database connection
const capperService = capperSystem.getCapperService();
const connected = await capperService.testConnection();
console.log('Database Connected:', connected);
```

## API Reference

### CapperSystem Methods

```typescript
class CapperSystem {
  // Core lifecycle
  async initialize(): Promise<boolean>
  async shutdown(): Promise<void>
  isReady(): boolean

  // Publishing control
  async publishPicksNow(): Promise<boolean>
  async republishFailedPicks(date: string): Promise<boolean>
  async getPublishingStats(startDate: string, endDate: string)

  // System monitoring
  async getSystemStatus()
  getCapperService(): CapperService
}
```

### CapperService Methods

```typescript
class CapperService {
  // Pick management
  async createDailyPick(pick: DailyPickInsert): Promise<DailyPick | null>
  async updateDailyPick(id: string, updates: Partial<DailyPick>): Promise<DailyPick | null>
  async deleteDailyPick(id: string, capperId: string): Promise<boolean>
  
  // Capper profiles
  async createCapperProfile(profile: CapperProfileInsert): Promise<CapperProfile | null>
  async getCapperProfile(discordId: string): Promise<CapperProfile | null>
  async updateCapperProfile(id: string, updates: Partial<CapperProfile>): Promise<CapperProfile | null>
  
  // Analytics
  async logAnalyticsEvent(event: AnalyticsEventInsert): Promise<void>
  async getCapperStats(capperId: string, startDate?: Date, endDate?: Date)
  
  // Utility
  async isSubmissionOpen(): Promise<boolean>
  async getNextSubmissionWindow(): Promise<Date>
  async testConnection(): Promise<boolean>
}
```

## Contributing

### Adding New Features

1. **New Commands**: Add to `src/commands/` directory
2. **Database Changes**: Update `src/db/types/` and migration files
3. **Validation**: Add rules to `src/utils/pickValidation.ts`
4. **Embeds**: Update `src/utils/pickEmbeds.ts` for display
5. **Interactions**: Register in `src/handlers/capperInteractionHandler.ts`

### Testing

```typescript
// Unit tests for validation
import { validatePickLeg } from './src/utils/pickValidation';

const testLeg = {
  sport: 'NFL',
  team_home: 'Chiefs',
  team_away: 'Bills',
  market_type: 'spread',
  selection: 'home',
  line: -3.5,
  odds: -110,
  units: 1.0
};

const result = validatePickLeg(testLeg);
console.log('Validation:', result);
```

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add comprehensive error handling
- Include JSDoc comments for public methods
- Use structured logging with context

## License

This implementation is part of the Unit Talk platform. Please ensure compliance with your project's licensing terms.

---

## Quick Start Checklist

- [ ] Install dependencies (`discord.js`, `node-cron`)
- [ ] Set up database tables (daily_picks, capper_profiles, analytics_events)
- [ ] Configure environment variables
- [ ] Initialize CapperSystem in your bot
- [ ] Set up publish channel permissions
- [ ] Test with `/capper-onboard` command
- [ ] Verify daily publishing schedule
- [ ] Set up admin commands (optional)
- [ ] Monitor system logs and analytics

**Need help?** Check the troubleshooting section or review the example implementations above.