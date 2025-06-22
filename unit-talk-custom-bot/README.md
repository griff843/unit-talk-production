# Unit Talk Discord Bot

A comprehensive Discord bot for sports betting communities with advanced features including pick tracking, user management, analytics, and automated grading.

## 🚀 Features

- **Pick Management**: Submit, track, and grade sports betting picks
- **User Tiers**: VIP, VIP+, and Member tier system with role-based permissions
- **Analytics**: Comprehensive tracking of user engagement and performance
- **Thread Management**: Automated game thread creation and management
- **DM Notifications**: Personalized direct message notifications
- **Admin Tools**: Comprehensive administrative commands and monitoring
- **Real-time Grading**: Automated pick grading and performance tracking

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher
- **Discord Application**: Bot token and client ID from Discord Developer Portal
- **Supabase**: Database instance with proper schema
- **Redis** (optional): For caching and session management

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
cd unit-talk-custom-bot
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `unit-talk-custom-bot` directory:

```env
# Discord Configuration (Required)
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id_for_dev_testing

# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Agent Services (Optional)
AGENTS_BASE_URL=http://localhost:3001
AGENTS_API_KEY=your_agents_api_key

# Discord Role IDs (Configure based on your server)
ADMIN_ROLE_IDS=role_id_1,role_id_2
MODERATOR_ROLE_IDS=role_id_1,role_id_2
VIP_ROLE_IDS=role_id_1,role_id_2
VIP_PLUS_ROLE_IDS=role_id_1,role_id_2

# Discord Channel IDs (Configure based on your server)
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
```

### 3. Database Setup

Ensure your Supabase database has the required schema. Run the migration:

```bash
# Apply database migrations
psql -h your_supabase_host -U postgres -d postgres -f migrations/001_fortune_100_enhancements.sql
```

## 🏃‍♂️ Running the Bot

### Development Mode

For development with hot reloading:

```bash
npm run dev
```

This will:
- Start the bot with TypeScript compilation
- Enable hot reloading on file changes
- Use development logging levels
- Deploy commands to your test guild (if DISCORD_GUILD_ID is set)

### Production Build

For production deployment:

```bash
# Build the TypeScript code
npm run build

# Start the production server
npm run start
```

### Alternative Production Command

```bash
# Build and start in one command
npm run deploy
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Health Check

The bot includes a health check endpoint:

```bash
# Check if the bot is running
npm run health

# Or manually
curl -f http://localhost:3000/health
```

## 🔧 Configuration Guide

### Discord Setup

1. **Create Discord Application**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" section and create a bot
   - Copy the token and client ID

2. **Bot Permissions**:
   The bot requires these permissions:
   - Send Messages
   - Use Slash Commands
   - Manage Messages
   - Manage Threads
   - Add Reactions
   - Read Message History
   - Mention Everyone
   - Use External Emojis

3. **Invite Bot to Server**:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
   ```

### Role and Channel Configuration

1. **Get Role IDs**:
   - Enable Developer Mode in Discord
   - Right-click on roles → Copy ID
   - Add to environment variables

2. **Get Channel IDs**:
   - Right-click on channels → Copy ID
   - Configure in environment variables

### Supabase Setup

1. **Create Supabase Project**:
   - Go to [Supabase](https://supabase.com)
   - Create a new project
   - Get URL and keys from Settings → API

2. **Database Schema**:
   - Run the provided migration file
   - Ensure proper RLS policies are set

## 📊 Available Commands

### User Commands

- `/help` - Show available commands and bot information
- `/ping` - Check bot latency and response time
- `/stats` - Show user statistics and activity
- `/profile` - View user profile information
- `/pick` - Submit a new sports betting pick
- `/leaderboard` - Show server activity leaderboard

### Admin Commands

- `/admin sync` - Sync user data and permissions
- `/admin backup` - Create database backup
- `/admin restore` - Restore from backup
- `/admin analytics` - View analytics dashboard
- `/admin system` - System status and metrics
- `/admin cleanup` - Clean up old data

## 🔍 Monitoring and Logging

### Log Levels

Set `LOG_LEVEL` environment variable:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging information

### Monitoring

The bot includes built-in monitoring:
- Performance metrics
- Error tracking
- User engagement analytics
- System health checks

## 🚀 Deployment

### Docker Deployment (Recommended)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t unit-talk-bot .
docker run -d --env-file .env -p 3000:3000 unit-talk-bot
```

### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name "unit-talk-bot"

# Save PM2 configuration
pm2 save
pm2 startup
```

### Environment-Specific Configurations

#### Development
- Set `DISCORD_GUILD_ID` for faster command deployment
- Use `LOG_LEVEL=debug` for detailed logging
- Enable all feature flags for testing

#### Production
- Remove `DISCORD_GUILD_ID` for global command deployment
- Use `LOG_LEVEL=info` or `LOG_LEVEL=warn`
- Configure proper role and channel IDs
- Set up monitoring and alerting

## 🛠️ Development

### Code Structure

```
src/
├── commands/          # Slash commands
├── handlers/          # Event and command handlers
├── services/          # Business logic services
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
└── config/           # Configuration management
```

### Adding New Commands

1. Create command file in `src/commands/`
2. Register in `src/index.ts`
3. Add to command deployment in `deployCommands()`

### Adding New Features

1. Create service in `src/services/`
2. Add event handlers in `src/handlers/eventHandler.ts`
3. Update configuration if needed
4. Add tests

## 🐛 Troubleshooting

### Common Issues

1. **Bot not responding to commands**:
   - Check if commands are deployed: Look for "Successfully reloaded X commands" in logs
   - Verify bot permissions in Discord server
   - Check if bot is online and connected

2. **Database connection errors**:
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure database schema is up to date

3. **Permission errors**:
   - Verify role IDs are correct
   - Check bot's role hierarchy in Discord
   - Ensure bot has required permissions

4. **Environment variable issues**:
   - Check `.env` file exists and is properly formatted
   - Verify all required variables are set
   - Restart bot after changing environment variables

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Health Checks

The bot provides several health check endpoints:
- Database connectivity
- Discord API status
- Service availability

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run linting: `npm run lint:fix`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Check the troubleshooting section above
- Review logs for error messages
- Ensure all environment variables are properly configured
- Verify Discord bot permissions and server setup

---

**Note**: This bot is designed for sports betting communities and includes features specific to pick tracking and user tier management. Ensure compliance with your local laws and Discord's Terms of Service when using betting-related features.