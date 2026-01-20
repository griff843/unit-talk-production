# CLAUDE.md - Unit Talk Discord Bot

This file provides guidance to Claude Code (claude.ai/code) when working with
the Unit Talk Discord Bot application.

## > Application Overview

The Unit Talk Discord Bot is the primary user interface for the sports betting
intelligence platform. It provides seamless integration between the backend
analytics platform and Discord communities, enabling real-time alerts,
interactive commands, and automated content delivery.

### Key Features

- **Real-Time Alerts**: Live betting intelligence delivered instantly to Discord
  channels
- **Interactive Commands**: Slash commands for pick submissions, statistics, and
  user management
- **Automated Onboarding**: Intelligent user onboarding with tier-based access
  control
- **Thread Management**: Automated thread creation and management for organized
  discussions
- **VIP+ Features**: Premium functionality for high-tier subscribers
- **Contest Integration**: Seamless integration with contest and leaderboard
  systems

## 🔐 Secrets Management

**CRITICAL**: All sensitive credentials (Discord tokens, API keys, Supabase keys)
are stored in **GitHub Secrets**, NOT local `.env` files.

- Local `.env` files contain templates/placeholders only
- Bot tokens and API keys are injected via GitHub Actions or deployment
- Never hardcode or commit actual secrets to the repository
- See the root `CLAUDE.md` for comprehensive secrets management documentation

## 📊� Development Commands

### Core Development

```bash
# Start Discord bot
npm start

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### Testing Commands

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage reports
npm run test:coverage

# Integration tests
npm run test:integration
```

### Quality Assurance

```bash
# Code quality
npm run lint
npm run lint:fix
npm run format

# Security testing
npm run test:security

# Performance testing
npm run test:performance
```

## <� Architecture

### Discord.js Integration

Built on Discord.js v14 with modern TypeScript patterns:

```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});
```

### Command System

**Slash Commands Structure**:

- `src/commands/` - Command implementations
- `src/handlers/commandHandler.ts` - Command routing and execution
- `src/utils/registerCommands.ts` - Command registration with Discord API

**Key Commands**:

- `/submit-pick` - Submit betting picks with validation
- `/capper-stats` - View capper performance statistics
- `/ask-unit-talk` - AI-powered Q&A system
- `/upgrade` - Tier upgrade and subscription management
- `/recap` - Generate and view daily/weekly recaps

### Service Architecture

**Core Services**:

- `OnboardingService`: Automated user onboarding and tier management
- `ThreadService`: Thread creation and management
- `PermissionService`: Role-based access control
- `DatabaseService`: Supabase integration for user data
- `NotificationService`: Multi-channel notification delivery

**Integration Services**:

- `TrendAnalysisService`: Real-time trend analysis and alerts
- `VIPNotificationService`: Premium user notification management
- `AutomatedThreadService`: Intelligent thread automation
- `WelcomeService`: New user welcome workflows

### Event Handling

```typescript
// Event handling pattern
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    await commandHandler.execute(interaction);
  } else if (interaction.isButton()) {
    await buttonHandler.execute(interaction);
  }
});
```

## =� Development Guidelines

### Discord Bot Standards

**CRITICAL RULES**:

1. **Always validate permissions** before executing commands
2. **Handle rate limits** gracefully with exponential backoff
3. **Use ephemeral responses** for sensitive information
4. **Implement proper error handling** with user-friendly messages
5. **Log all interactions** with correlation IDs for debugging

### Command Development Checklist

1. **Command Registration**:

```typescript
export const commandData = new SlashCommandBuilder()
  .setName('command-name')
  .setDescription('Command description')
  .addStringOption(option =>
    option
      .setName('parameter')
      .setDescription('Parameter description')
      .setRequired(true)
  );
```

2. **Permission Validation**:

```typescript
const hasPermission = await PermissionService.checkUserTier(
  interaction.user.id,
  requiredTier
);
```

3. **Error Handling**:

```typescript
try {
  // Command logic
} catch (error) {
  logger.error('Command execution failed', {
    error,
    userId: interaction.user.id,
  });
  await interaction.reply({
    content: 'An error occurred. Please try again.',
    ephemeral: true,
  });
}
```

### Integration Patterns

**Database Integration**:

```typescript
import { supabaseClient } from '@shared/database';

// User data management
const userData = await supabaseClient
  .from('user_profiles')
  .select('*')
  .eq('discord_id', userId)
  .single();
```

**API Integration**:

```typescript
import { apiClient } from '@shared/utils';

// Platform API calls
const picks = await apiClient.get('/api/picks', {
  params: { userId, dateRange },
});
```

## =' Configuration

### Environment Variables

```bash
# Discord Configuration
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# Platform Integration
API_BASE_URL=your_api_url
API_KEY=your_api_key
```

### Bot Permissions

Required Discord permissions:

- **Send Messages**: Basic message sending
- **Use Slash Commands**: Command execution
- **Manage Threads**: Thread creation and management
- **Manage Roles**: Role assignment for tier management
- **Read Message History**: Context for interactions
- **Embed Links**: Rich message formatting

## =� Monitoring & Observability

### Bot Health Monitoring

```typescript
// Health check endpoint
app.get('/health', (req, res) => {
  const status = {
    uptime: process.uptime(),
    discord: client.readyAt ? 'connected' : 'disconnected',
    database: 'checking...',
    lastHeartbeat: client.ws.ping,
  };

  res.json(status);
});
```

### Metrics Collection

**Discord Metrics**:

- Command execution rates and success rates
- User interaction patterns and engagement
- Error rates and failure modes
- Response time distributions

**Business Metrics**:

- Pick submission rates
- User onboarding conversion
- Tier upgrade rates
- Feature adoption metrics

### Error Tracking

```typescript
import { logger } from '@shared/utils';

// Structured error logging
logger.error('Discord interaction failed', {
  error: error.message,
  stack: error.stack,
  userId: interaction.user.id,
  commandName: interaction.commandName,
  correlationId: generateCorrelationId(),
});
```

## =� Troubleshooting

### Common Issues

**Bot Not Responding**:

```bash
# Check bot status
npm run health:check

# Verify token and permissions
npm run verify:config

# Check Discord API status
npm run test:discord-connection
```

**Command Registration Issues**:

```bash
# Re-register commands
npm run commands:register

# Clear and re-register
npm run commands:clear && npm run commands:register
```

**Database Connection Issues**:

```bash
# Test database connection
npm run test:database

# Verify Supabase configuration
npm run verify:supabase
```

### Debug Commands

```bash
# Full bot diagnostics
npm run debug:full

# Command-specific debugging
DEBUG=discord:commands npm start

# Database query debugging
DEBUG=database:queries npm start
```

## <� Best Practices

### User Experience

1. **Immediate Feedback**: Always acknowledge user interactions within 3 seconds
2. **Clear Error Messages**: Provide actionable error messages with next steps
3. **Consistent Formatting**: Use consistent embed styling and formatting
4. **Accessibility**: Support screen readers and accessibility tools
5. **Rate Limiting**: Handle Discord rate limits gracefully

### Security

1. **Input Validation**: Validate all user inputs before processing
2. **Permission Checks**: Verify user permissions for every action
3. **Data Sanitization**: Sanitize all user-generated content
4. **Error Information**: Never expose sensitive information in error messages
5. **Audit Logging**: Log all administrative actions and permission changes

### Performance

1. **Efficient Queries**: Optimize database queries for common operations
2. **Caching**: Cache frequently accessed data (user profiles, permissions)
3. **Async Operations**: Use async/await for all Discord API calls
4. **Resource Management**: Properly manage memory and connection pools
5. **Monitoring**: Continuously monitor performance metrics

## <� Excellence Standards

**CRITICAL MANDATE**: Always deliver best-in-class results. No shortcuts. No
compromises.

**Quality Requirements**:

- **User Experience**: Sub-3-second response times for all interactions
- **Reliability**: 99.9% uptime with graceful degradation
- **Security**: Zero-trust architecture with comprehensive validation
- **Scalability**: Support for 10,000+ concurrent users
- **Maintainability**: Clean, documented, and testable code

**Implementation Philosophy**:

- User experience is paramount - never compromise UX for technical convenience
- Security and privacy are non-negotiable requirements
- Performance optimizations must maintain code clarity
- All features must be fully tested and documented
- Error handling must be comprehensive and user-friendly

## =� Additional Resources

- **[Discord.js Documentation](https://discord.js.org/#/docs/)** - Official
  Discord.js documentation
- **[Discord Developer Portal](https://discord.com/developers/docs/)** - Discord
  API documentation
- **[../../docs/discord/](../../docs/discord/)** - Internal Discord bot
  documentation
- **[../../docs/api/](../../docs/api/)** - Platform API integration guides

---

**Application Owner**: Discord Team  
**Last Updated**: Current  
**Next Review**: Bi-weekly Discord feature review[byterover-mcp]

# important

always use byterover-retrive-knowledge tool to get the related context before
any tasks always use byterover-store-knowledge to store all the critical
informations after sucessful tasks
