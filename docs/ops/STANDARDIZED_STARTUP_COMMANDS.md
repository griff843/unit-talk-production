# Standardized Startup Commands

## Environment Variable Loading Order

All services must load environment variables in this precedence:
1. `.env.shared` - Shared configuration across all environments
2. `.env` - Environment-specific configuration
3. `.env.canary` - Canary-specific overrides (when applicable)

## PowerShell Commands

### API Server

```powershell
# Development (Docker)
docker-compose up api

# Local development with dotenv (outside Docker)
npx dotenv -e .env.shared -e .env -e .env.canary -- npm run start:dev

# Local development for debugging
npx dotenv -e .env.shared -e .env -e .env.canary -- npx tsx src/index.ts
```

### Worker Process

```powershell
# Development (Docker)
docker-compose up worker

# Local development with dotenv
npx dotenv -e .env.shared -e .env -e .env.canary -- npm run worker:dev

# Direct worker execution
npx dotenv -e .env.shared -e .env -e .env.canary -- npx tsx src/worker.ts
```

### Canary E2E Smoke Test

```powershell
# Run with proper env loading
npx dotenv -e .env.shared -e .env -e .env.canary -- npx tsx scripts/canary_e2e_smoke.ts
```

### Manual Environment Verification

```powershell
# Print effective environment (masks secrets automatically)
npx dotenv -e .env.shared -e .env -e .env.canary -- node -e "console.log(Object.keys(process.env).filter(k => k.startsWith('DISCORD_')).map(k => k + '=' + (process.env[k] ? 'SET' : 'NOT_SET')).join('\n'))"

# Check specific variable presence (boolean only)
npx dotenv -e .env.shared -e .env -e .env.canary -- node -e "console.log('hasDiscordBotToken:', !!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_BOT_TOKEN !== 'false'))"
```

## Docker Compose (Recommended)

Docker Compose handles environment loading automatically via `env_file`:

```yaml
services:
  api:
    env_file:
      - .env
      - .env.shared
    # .env.canary loaded via docker-compose.override.yml for canary deployments
```

## Evidence-Based Commands

All commands must produce verifiable output. Examples:

```powershell
# Start API with output redirect for evidence
npx dotenv -e .env.shared -e .env -e .env.canary -- npm run start:dev 2>&1 | Tee-Object -FilePath logs/api-startup.log

# Run E2E test with timestamped log
npx dotenv -e .env.shared -e .env -e .env.canary -- npx tsx scripts/canary_e2e_smoke.ts 2>&1 | Tee-Object -FilePath "logs/e2e-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').log"
```

## Validation

After any startup, verify configuration loaded correctly:

```powershell
# Check API is running with correct env
curl http://localhost:3010/api/health | ConvertFrom-Json | Format-List

# Verify environment detection (from logs)
docker-compose logs api | Select-String "Environment Detection" | Select-Object -Last 1
```

## Notes

- **Docker is primary**: All production and staging deployments use Docker Compose
- **Local debugging**: Use dotenv commands only for local troubleshooting
- **No manual exports**: Never use `$env:VAR=value` - always use dotenv files
- **Evidence required**: All operational commands must produce logs for audit trail
