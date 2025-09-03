# Environment Configuration Management

This document describes the centralized environment configuration system for the Unit Talk monorepo, following SaaS-level best practices.

## 🏗️ Architecture Overview

### The Problem We Solved

Previously, the monorepo had **19 different .env files** scattered across applications:
- Multiple `.env` files per application  
- Duplicate and inconsistent variable definitions
- No central source of truth
- Difficult maintenance and security management
- Risk of configuration drift between environments

### The Solution: Centralized Configuration

We've implemented a **single source of truth** pattern with application-specific adapters:

```
├── .env                           # 🎯 SINGLE SOURCE OF TRUTH
├── .env.local                     # Local development overrides
├── config/
│   └── environment.ts            # Centralized configuration manager
└── apps/
    ├── api/src/config/index.ts           # API-specific adapter
    ├── command-center/src/config/index.ts # Command Center adapter
    ├── discord-bot/src/config/index.ts   # Discord Bot adapter
    └── smart-form/src/config/index.ts    # Smart Form adapter
```

## 🔧 Configuration Files

### 1. `.env` - Single Source of Truth

The **ONLY** file where environment variables should be defined:

```bash
# =============================================================================
# UNIT TALK PRODUCTION V3.0.0 - CENTRALIZED ENVIRONMENT CONFIGURATION
# =============================================================================
# This is the SINGLE SOURCE OF TRUTH for all environment variables across the monorepo.
# All applications (api, discord-bot, command-center, smart-form, dashboard) read from this file.
#
# CRITICAL: Never create additional .env files. Update only this central file.
# =============================================================================

# Database Configuration (v3.0.0 Unified Schema)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY

# Data Provider API Keys (CRITICAL FOR MONITORING)
OPTIMAL_API_KEY=your_optimal_api_key_here
ODDS_API_KEY=your_odds_api_key_here

# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_discord_guild_id_here
# ... and many more
```

### 2. `.env.local` - Development Overrides

Contains **ONLY** variables that differ in local development:

```bash
# =============================================================================
# LOCAL DEVELOPMENT OVERRIDES
# =============================================================================
# This file overrides specific values from .env for local development only.
# Only include variables that differ from production/staging values.
# =============================================================================

# Development Environment Settings
NODE_ENV=development
LOG_LEVEL=debug
DEBUG_MODE=true

# Local Service URLs (override production URLs)
NEXT_PUBLIC_APP_URL=http://localhost:3015
# ... only overrides
```

### 3. `config/environment.ts` - Central Manager

The centralized configuration manager with validation and type safety:

```typescript
import { z } from 'zod';

// Schema validation for all environment variables
const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  OPTIMAL_API_KEY: z.string().min(1, 'Optimal API key is required'),
  // ... comprehensive validation
});

class EnvironmentConfig {
  private config: z.infer<typeof EnvironmentSchema>;
  
  constructor() {
    this.config = EnvironmentSchema.parse(process.env);
  }
  
  get database() {
    return {
      supabaseUrl: this.config.SUPABASE_URL,
      supabaseAnonKey: this.config.SUPABASE_ANON_KEY,
      // ... typed configuration groups
    };
  }
}

export const env = new EnvironmentConfig();
```

## 📱 Application Adapters

Each application has a configuration adapter that provides app-specific interfaces while using the centralized environment:

### API Configuration (`apps/api/src/config/index.ts`)

```typescript
import { env } from '../../../../config/environment';

export interface ApiConfiguration {
  port: number;
  database: { supabaseUrl: string; /* ... */ };
  apiKeys: { optimal: string; odds: string; };
  // ... API-specific interface
}

class ApiConfig implements ApiConfiguration {
  get database() {
    return env.database; // Uses centralized config
  }
  
  get apiKeys() {
    return env.apiKeys; // Uses centralized config
  }
}

export const apiConfig = new ApiConfig();
```

### Command Center Configuration (`apps/command-center/src/config/index.ts`)

```typescript
import { env } from '../../../../config/environment';

export interface CommandCenterConfiguration {
  nextjs: { appUrl: string; /* ... */ };
  apiKeys: { optimal: string; odds: string; }; // For API monitoring
  // ... Command Center-specific interface
}

class CommandCenterConfig implements CommandCenterConfiguration {
  get apiKeys() {
    return {
      optimal: env.apiKeys.optimal, // CRITICAL: For API monitoring
      odds: env.apiKeys.odds,
    };
  }
}

export const commandCenterConfig = new CommandCenterConfig();
```

### Discord Bot Configuration (`apps/discord-bot/src/config/index.ts`)

```typescript
import { env } from '../../../../config/environment';

// Maintains compatibility with existing BotConfig interface
export const botConfig: BotConfig = {
  channels: {
    general: env.discord.channels.general,
    freePicks: env.discord.channels.freePicks,
    // ... all Discord channels preserved
  },
  roles: {
    admin: env.discord.roles.admin[0] || '',
    // ... all Discord roles preserved  
  },
  // ... full Discord configuration
};
```

## 🔑 API Key Management

### Centralized API Key Storage

All API keys are stored in the central `.env` file:

```bash
# =============================================================================
# DATA PROVIDER API KEYS (CRITICAL FOR MONITORING)
# =============================================================================
# Optimal API - Primary player props source (NFL/NBA/MLB/NHL)
OPTIMAL_API_KEY=optimalbet_LZsTNl2SGX0o9Bz9GhLurvSTQuAMQapp

# Odds API - NCAAF exclusive + settlement data  
ODDS_API_KEY=8014c48eb8a05f289de049c0961ac4cf
```

### API Key Access Patterns

Applications access API keys through their configuration adapters:

```typescript
// ✅ CORRECT: Use application config adapter
import { commandCenterConfig } from '../config';
const optimalKey = commandCenterConfig.apiKeys.optimal;

// ❌ INCORRECT: Direct process.env access
const optimalKey = process.env.OPTIMAL_API_KEY;
```

### API Monitoring Integration

The Command Center API monitoring system now uses centralized keys:

```typescript
// apps/command-center/src/lib/apiHealthMonitoring.ts
import { commandCenterConfig } from '../config';

async checkApiHealth(config) {
  // Get API key from centralized configuration
  const apiKey = config.envKey === 'OPTIMAL_API_KEY' 
    ? commandCenterConfig.apiKeys.optimal    // ✅ New centralized approach
    : commandCenterConfig.apiKeys.odds;
}
```

## 🚀 Migration Process

### Completed Migration Steps

1. ✅ **Centralized Configuration Created** - Single source of truth in `.env`
2. ✅ **Configuration Manager Built** - Type-safe environment validation
3. ✅ **Application Adapters Created** - App-specific configuration interfaces
4. ✅ **API Key Management Updated** - Centralized key access for monitoring
5. ✅ **New API Key Integrated** - Updated Optimal API key across all systems

### Verification Steps

Use the migration script to verify the setup:

```bash
# Validate configuration without making changes
npx tsx scripts/migrate-env-config.ts --validate-only

# Test API key functionality
npx tsx scripts/migrate-env-config.ts

# Clean up old .env files (when ready)
npx tsx scripts/migrate-env-config.ts --cleanup-old-files
```

## 🎯 Best Practices

### DO ✅

- **Use application config adapters** for all environment variable access
- **Update the central `.env` file** for all configuration changes
- **Use type-safe configuration objects** instead of direct `process.env` access
- **Validate environment variables** at application startup
- **Override only necessary variables** in `.env.local` for development

### DON'T ❌

- **Create new .env files** in application directories
- **Access `process.env` directly** in application code
- **Duplicate environment variables** across files
- **Store sensitive keys** in version control (use secure secret management)
- **Mix development and production values** in the same file

## 🔒 Security Considerations

### Environment Variable Security

1. **Single Point of Control** - All sensitive values in one location
2. **Type Validation** - Runtime validation prevents configuration errors
3. **Development Isolation** - Local overrides don't affect production values
4. **Secret Management** - Clear separation between config and secrets

### Production Deployment

For production deployment:

1. **Replace `.env` values** with production secrets
2. **Use environment-specific secret management** (AWS Secrets Manager, etc.)
3. **Validate API keys** at startup using the migration script
4. **Monitor configuration drift** using the centralized validation

## 📊 Monitoring Integration

### API Health Monitoring

The Command Center now monitors API key health using centralized configuration:

- **Real-time API key validation** for Optimal API and Odds API
- **Centralized key rotation** - update once in `.env`, applies everywhere
- **Automatic expiration detection** - monitors for 401/403 responses
- **Dashboard visibility** - API health displayed in Command Center UI

### Configuration Validation

The system validates configuration at startup:

```typescript
// Automatic validation on import
import { env } from './config/environment';

// Production-specific validation
if (env.isProduction) {
  validateProductionApiKeys();
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Configuration not found** - Ensure `.env` file exists in monorepo root
2. **Type validation errors** - Check environment variable formats in `.env`
3. **API key not working** - Verify new key in centralized `.env` file
4. **Application can't find config** - Check import paths in application adapters

### Debug Commands

```bash
# Validate entire configuration setup
npx tsx scripts/migrate-env-config.ts --validate-only

# Test specific application config
node -e "console.log(require('./apps/api/src/config').apiConfig.apiKeys)"

# Check environment loading
node -e "console.log(require('./config/environment').env.database)"
```

## 📚 Additional Resources

- [Environment Variables Best Practices](https://12factor.net/config)
- [TypeScript Configuration Patterns](https://www.typescriptlang.org/docs/)
- [Zod Validation Library](https://github.com/colinhacks/zod)
- [Monorepo Configuration Management](https://nx.dev/concepts/config)

---

**Last Updated**: January 2025  
**Architecture Owner**: Platform Engineering Team  
**Next Review**: Quarterly configuration audit