# Ops Wiring Plan

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
> **Status**: AUTHORITATIVE
> **Last Updated**: 2026-02-22

This document shows EXACTLY how environment flows work across local/docker/CI/prod with zero ambiguity.

---

## Environment Profiles

| Profile | Purpose | Database | Discord | Secrets |
|---------|---------|----------|---------|---------|
| `local` | Developer laptop | Cloud or Local | Optional | `.env` file |
| `docker` | Docker Compose dev | Via `DB_MODE` | Optional | `.env` + compose |
| `ci` | CI/CD pipelines | Mocked | Disabled | GitHub Secrets |
| `production` | Production deploy | Cloud (required) | Required | K8s Secrets |

---

## Local Development Flow

### Prerequisites
```bash
# Required
node >= 18.0.0
pnpm >= 10.29.3
```

### Setup
```bash
# 1. Clone and install
git clone <repo>
cd unit-talk-platform
pnpm install

# 2. Create .env from template
cp .env.example .env

# 3. Configure .env
# Required for cloud mode:
SUPABASE_URL=https://cqfnsozknjzvyiziwicl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
NEXT_PUBLIC_SUPABASE_URL=https://cqfnsozknjzvyiziwicl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Running
```bash
# Option A: Full stack via Docker
./dev.sh start

# Option B: Individual apps
pnpm --filter api dev
pnpm --filter smart-form dev
pnpm --filter command-center dev
```

### Env Validation
```bash
# Validate before running
pnpm ops:env:check
```

---

## Docker Compose Flow

### Profiles

| Profile | Command | Services |
|---------|---------|----------|
| `cloud` (default) | `docker-compose up` | API, workers, apps (cloud DB) |
| `local` | `docker-compose --profile local up` | + PostgreSQL |
| `ha` | `docker-compose --profile ha up` | + PostgreSQL replica |
| `tools` | `docker-compose --profile tools up` | + pgAdmin, Redis Commander |

### Service Ports

| Service | Container Port | Host Port |
|---------|---------------|-----------|
| API | 3000 | 3010 |
| Smart Form | 3021 | 3021 |
| Command Center | 3015 | 3004 |
| Dashboard | 3000 | 3003 |
| Temporal UI | 8080 | 8080 |
| Prometheus | 9090 | 9090 |
| Grafana | 3000 | 3005 |

### Env Loading Order
```
1. .env (root)
2. docker-compose.yml environment section
3. apps/*/.env.local (for Next.js apps)
```

### Build-Time vs Runtime

**CRITICAL**: Next.js apps embed `NEXT_PUBLIC_*` vars at BUILD time.

```yaml
# docker-compose.yml (correct pattern)
smart-form:
  build:
    args:
      # Build-time args for Next.js
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
  environment:
    # Runtime vars (not for NEXT_PUBLIC_*)
    NODE_ENV: production
```

---

## CI/CD Flow

### GitHub Actions Environment

```yaml
# .github/workflows/ci.yml
env:
  CI: true
  NODE_ENV: test
  # Placeholder values for build (not real secrets)
  NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
```

### Secrets (via GitHub Secrets)

| Secret | Used In | Purpose |
|--------|---------|---------|
| `SUPABASE_URL` | deploy.yml | Production DB URL |
| `SUPABASE_SERVICE_ROLE_KEY` | deploy.yml | Production DB key |
| `DISCORD_TOKEN` | deploy.yml | Discord bot auth |
| `AWS_ACCESS_KEY_ID` | deploy.yml | EKS access |
| `AWS_SECRET_ACCESS_KEY` | deploy.yml | EKS access |

### CI Gate Sequence

```
1. Checkout
2. Install (pnpm install)
3. Type Check (pnpm run type-check)
4. Lint (pnpm run lint)
5. Build (pnpm run build)
6. Test (pnpm run test)
7. Lifecycle Gate (npm run lifecycle:single-writer -- --strict)
8. Docker Build (docker-compose build)
```

### CI vs Production Builds

| Aspect | CI | Production |
|--------|-----|------------|
| Database | Mocked/None | Real Supabase |
| Discord | Disabled | Enabled |
| NEXT_PUBLIC_* | Placeholders | Real values |
| Secrets | Not required | Required |

---

## Production Flow

### Deployment Pipeline

```
1. PR merged to main
2. CI runs all gates
3. Docker images built
4. Images pushed to ghcr.io
5. K8s manifests updated
6. Rolling deployment
7. Health checks pass
8. Traffic shifted
```

### Required Secrets

```bash
# All must be set in production
NODE_ENV=production
DB_MODE=cloud

# Database (REQUIRED)
SUPABASE_URL=https://cqfnsozknjzvyiziwicl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>

# Frontend (embedded at build)
NEXT_PUBLIC_SUPABASE_URL=https://cqfnsozknjzvyiziwicl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<secret>
NEXT_PUBLIC_API_URL=https://api.unit-talk.com

# Discord (REQUIRED for posting)
DISCORD_TOKEN=<secret>
DISCORD_WEBHOOK_URL=<secret>
DEFAULT_DISCORD_TICKET_CHANNEL_ID=<id>

# Security (REQUIRED)
JWT_SECRET=<32+ chars>
ENCRYPTION_KEY=<32 chars>

# Redis (distributed state)
REDIS_URL=redis://redis:6379
```

### Health Checks

| Service | Endpoint | Expected |
|---------|----------|----------|
| API | `/health` | 200 + JSON status |
| Smart Form | `/api/health` | 200 |
| Command Center | `/api/health` | 200 |
| Dashboard | `/api/system/health` | 200 |

### Fail-Closed Behavior

In production:
- Missing env vars → Service crashes at startup
- DEMO_MODE=false (default) → No mock data
- Redis unavailable → Autopilot freeze activates
- Supabase host mismatch → Startup fails

---

## Canonical Supabase Host

```
CANONICAL: cqfnsozknjzvyiziwicl.supabase.co
```

**Enforced by**:
- `apps/smart-form/lib/env.ts`
- `apps/command-center/src/lib/env.ts`
- Health endpoints
- `npm run guard:supabase-endpoint`

---

## Environment Variable Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         LOCAL DEV                                │
│  .env → process.env → Zod validation → App startup              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOCKER COMPOSE                              │
│  .env → compose env → container → Zod validation → App startup  │
│  (NEXT_PUBLIC_* via build args, not runtime)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                           CI                                     │
│  GitHub Secrets → workflow env → container → build/test         │
│  (placeholders OK for type-check, no real DB needed)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PRODUCTION                                 │
│  K8s Secrets → container env → Zod validation → App startup     │
│  (NEXT_PUBLIC_* baked into image at build time)                 │
│  FAIL-CLOSED: Missing required → crash                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Mode Wiring

### Cloud Mode (Default)
```bash
DB_MODE=cloud  # or unset

# Required:
SUPABASE_URL=https://cqfnsozknjzvyiziwicl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Connection: via Supabase client
```

### Local Mode (Development)
```bash
DB_MODE=local

# Required:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unit_talk

# Requires: docker-compose --profile local
```

### Demo Mode (Explicit Only)
```bash
DEMO_MODE=true  # MUST be explicit

# Allows: Mock data in Command Center
# PROHIBITED: Production use
```

---

## Service Startup Sequence

```
1. Load environment variables
2. Validate via Zod schema (packages/config)
3. Check canonical Supabase host
4. Initialize database connection
5. Run health check
6. Start HTTP server
7. Register with Prometheus
```

**If any step fails → Service crashes (fail-closed)**

---

## Verification Commands

### By Profile

```bash
# Local
pnpm ops:env:check --profile local

# Docker
docker-compose exec api pnpm ops:env:check

# CI (runs automatically in workflow)

# Production
kubectl exec -it <pod> -- pnpm ops:env:check
```

### Full Stack Health

```bash
# Docker Compose
docker-compose ps
curl http://localhost:3010/health    # API
curl http://localhost:3021/api/health # Smart Form
curl http://localhost:3004/api/health # Command Center

# Production
curl https://api.unit-talk.com/health
curl https://forms.unit-talk.com/api/health
curl https://command.unit-talk.com/api/health
```

---

## Common Failure Modes

| Failure | Cause | Fix |
|---------|-------|-----|
| App crashes on start | Missing required env var | Add to .env |
| Build fails | NEXT_PUBLIC_* not provided | Add to build args |
| Health check fails | DB connection refused | Check DB_MODE and credentials |
| Supabase host error | Wrong project URL | Use canonical host |
| Demo data appears | DEMO_MODE not false | Set DEMO_MODE=false |
| Autopilot frozen | Redis unavailable | Check REDIS_URL |

---

## References

- `docs/ENV_CONTRACT.md` - Variable definitions
- `docs/BUILD_MATRIX.md` - Build requirements
- `docker-compose.yml` - Service definitions
- `.github/workflows/deploy.yml` - CI/CD pipeline

---

**Document Owner**: Engineering Team
**Last Audit**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
