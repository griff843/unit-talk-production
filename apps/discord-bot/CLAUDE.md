# CLAUDE.md - Unit Talk Discord Bot

> **Governance**: See [../../CLAUDE.md](../../CLAUDE.md) for Docker rules,
> secrets, database architecture, and service boundaries.

---

## Service Overview

The Discord Bot handles user interactions through Discord. It provides commands,
notifications, and thread management.

---

## Service Boundaries

### This Service OWNS

- Discord user interactions
- Slash command handling
- Thread management
- Discord notifications

### This Service MUST NOT

- Execute grading logic
- Process settlements
- Write directly to business tables
- Define professional betting rules

---

## Development Commands

```bash
# Start
docker-compose exec discord-bot npm start

# Development
docker-compose exec discord-bot npm run dev

# Build
docker-compose exec discord-bot npm run build

# Type check
docker-compose exec discord-bot npm run type-check

# Test
docker-compose exec discord-bot npm test

# Lint
docker-compose exec discord-bot npm run lint
```

---

## Architecture

### Discord.js Setup

```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});
```

### Command Structure

- `src/commands/` - Command implementations
- `src/handlers/commandHandler.ts` - Routing
- `src/utils/registerCommands.ts` - Registration

---

## Key Commands

- `/submit-pick` - Submit picks
- `/capper-stats` - View statistics
- `/ask-unit-talk` - AI Q&A
- `/upgrade` - Tier management
- `/recap` - Daily/weekly recaps

---

## Services

- `OnboardingService` - User onboarding
- `ThreadService` - Thread management
- `PermissionService` - Access control
- `DatabaseService` - Supabase integration (read via API)
- `NotificationService` - Notifications

---

## Data Access

**This service reads data via API endpoints.**

**No direct database writes to business tables.**

```typescript
// Read user data via Supabase (read-only)
const userData = await supabase
  .from('user_profiles')
  .select('*')
  .eq('discord_id', userId)
  .single();
```

---

## Event Handling

```typescript
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    await commandHandler.execute(interaction);
  }
});
```

---

## Best Practices

1. **Immediate Feedback**: Acknowledge within 3 seconds
2. **Error Messages**: Clear, actionable
3. **Ephemeral Responses**: Use for sensitive info
4. **Rate Limiting**: Handle gracefully
5. **Logging**: Correlation IDs for debugging

---

## Security

1. Validate all user inputs
2. Verify permissions for every action
3. Sanitize user-generated content
4. Never expose sensitive info in errors
5. Log all admin actions

---

**Status**: See CI/CD pipelines
