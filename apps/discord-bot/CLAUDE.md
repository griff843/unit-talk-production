# CLAUDE.md - Discord Bot

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
> **Status**: AUTHORITATIVE
> **Role**: DISCORD INTEGRATION
> **Last Updated**: 2026-02-22

---

## Overview

The Discord Bot handles user interactions through Discord. It provides slash commands, notifications, and thread management. This service reads data via the API and Supabase but does not write directly to business tables.

---

## Service Boundaries

### This Service OWNS

- Discord user interactions
- Slash command handling
- Thread management
- Discord notifications
- User onboarding flow

### This Service MUST NOT

- Execute grading logic
- Process settlements
- Write directly to `unified_picks`
- Define professional betting rules
- Bypass API for business logic

---

## Read/Write Surfaces

### Write Authority

| Table | Purpose | Notes |
|-------|---------|-------|
| `user_profiles` | Discord linking | Via onboarding only |

### Read Access

| Table | Purpose |
|-------|---------|
| `user_profiles` | User lookup |
| `unified_picks` | Display user picks |
| `cappers` | Capper stats display |

### API Integration

Most operations go through API service:

```typescript
// Correct pattern - via API
const response = await fetch(`${API_URL}/api/picks/${pickId}`);

// NOT direct Supabase writes to business tables
```

---

## Environment Requirements

### All Profiles

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development`, `test`, `production` |
| `DISCORD_TOKEN` | Yes | Bot authentication |
| `DISCORD_CLIENT_ID` | Yes | Application ID |
| `DISCORD_GUILD_ID` | No | Development server |

### Local Profile

| Variable | Required | Source |
|----------|----------|--------|
| `DISCORD_TOKEN` | Yes | `.env` |
| `SUPABASE_URL` | Yes | `.env` |
| `SUPABASE_ANON_KEY` | Yes | `.env` |

### Docker Profile

| Variable | Required | Source |
|----------|----------|--------|
| `DISCORD_TOKEN` | Yes | `docker-compose.yml` |
| `SUPABASE_URL` | Yes | `docker-compose.yml` |
| `API_URL` | Yes | `http://api:3000` |

### CI Profile

| Variable | Required | Notes |
|----------|----------|-------|
| `DISCORD_TOKEN` | No | Disabled in CI |

### Production Profile

| Variable | Required | Source |
|----------|----------|--------|
| `DISCORD_TOKEN` | Yes | K8s Secrets |
| `DISCORD_CLIENT_ID` | Yes | K8s Secrets |
| `SUPABASE_URL` | Yes | K8s Secrets |
| `SUPABASE_ANON_KEY` | Yes | K8s Secrets |
| `API_URL` | Yes | K8s ConfigMap |
| `DEFAULT_DISCORD_TICKET_CHANNEL_ID` | Yes | K8s ConfigMap |

---

## Commands

### Development

```bash
# Local
pnpm --filter discord-bot dev

# Docker
docker-compose exec discord-bot npm run dev
```

### Build & Verify

```bash
pnpm --filter discord-bot build
pnpm --filter discord-bot type-check
pnpm --filter discord-bot test
```

### Command Registration

```bash
# Register slash commands
pnpm --filter discord-bot run register-commands
```

---

## Health Checks

### Endpoint

```
GET /health
```

### Expected Response

```json
{
  "status": "healthy",
  "service": "discord-bot",
  "discord": "connected",
  "supabase": "connected",
  "timestamp": "2026-02-22T12:00:00Z"
}
```

### Verification

```bash
# Docker
curl http://localhost:3020/health

# Production
# (Internal endpoint only)
```

---

## Common Failure Modes

| Failure | Cause | Prevention |
|---------|-------|------------|
| Bot offline | Invalid token | Token validation at startup |
| Command timeout | Slow API response | 3-second acknowledgment rule |
| Rate limiting | Too many requests | Graceful rate limit handling |
| Thread creation fail | Missing permissions | Permission pre-check |
| User lookup fail | Discord ID mismatch | Verified linking flow |

---

## Key Commands

| Command | Purpose |
|---------|---------|
| `/submit-pick` | Submit picks |
| `/capper-stats` | View statistics |
| `/ask-unit-talk` | AI Q&A |
| `/upgrade` | Tier management |
| `/recap` | Daily/weekly recaps |

---

## Best Practices

1. **Immediate Feedback**: Acknowledge interactions within 3 seconds
2. **Error Messages**: Clear, actionable user guidance
3. **Ephemeral Responses**: Use for sensitive information
4. **Rate Limiting**: Handle Discord rate limits gracefully
5. **Logging**: Correlation IDs for debugging

---

## References

- Root Governance: `../../CLAUDE.md`
- Execution Contract: `../../CLAUDE_EXECUTION_CONTRACT.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`
- Env Contract: `../../docs/ENV_CONTRACT.md`

---

**Document Owner**: Engineering Team
**Last Audit**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
