# Environment Layout - Unit Talk Platform

**Document Version:** 1.0.0
**Last Updated:** 2025-12-01
**Status:** Production-Ready Documentation

---

## 🎯 Overview

This document defines the complete environment layout for Unit Talk Platform, including infrastructure, configurations, and safety guardrails to prevent production incidents.

**CRITICAL SAFETY**: All environments are strictly isolated with production protection mechanisms to prevent accidental cross-environment access.

---

## 🏗️ Environment Matrix

| Environment | Purpose | Supabase | Temporal | Discord | API Keys | Safety Level |
|-------------|---------|----------|----------|---------|----------|--------------|
| **Local** | Development & Testing | Local PostgreSQL or Local Supabase | localhost:7233 | Test webhooks | Test keys | ✅ SAFE |
| **Staging** | Pre-production validation | Staging Supabase (isolated) | Staging Temporal | Staging channels | Staging keys | ✅ SAFE |
| **Production** | Live user-facing | Production Supabase | Production Temporal | Production channels | Production keys | ⚠️ PROTECTED |

---

## 1. LOCAL ENVIRONMENT

### Purpose
- Local development with hot reload
- Unit testing and integration testing
- E2E testing against local infrastructure
- Safe experimentation without risk to production

### Infrastructure

**Database**:
- **Option 1 (Recommended):** Local PostgreSQL via Docker Compose
  ```
  Host: localhost:5432
  Database: unit_talk_dev
  User: postgres
  Password: postgres
  ```

- **Option 2:** Supabase Local Dev (optional)
  ```
  URL: http://localhost:54321
  Studio: http://localhost:54323
  ```

**Temporal**:
```
Server: localhost:7233
UI: http://localhost:8088
Namespace: default
Task Queue: unit-talk-dev
```

**Redis**:
```
URL: redis://localhost:6379
```

**Discord**:
```
Test Discord Server: Create a separate test server
Test Webhooks: Use webhooks from test server only
Bot Token: Test bot token (NOT production bot)
```

**API Keys**:
```
Optimal API: Test key or dummy key
Odds API: Test key or dummy key
OpenAI: Personal dev key (separate from production)
```

### Configuration File
**File:** `.env` (copy from `.env.local.template`)

**Key Settings:**
```bash
NODE_ENV=development
SUPABASE_URL=http://localhost:54321  # OR leave blank for direct PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unit_talk_dev
TEMPORAL_ADDRESS=localhost:7233
REDIS_URL=redis://localhost:6379
SHADOW_MODE=true  # Enable shadow mode for safety
```

### Safety Guardrails
- ✅ Environment validator blocks startup if production URLs detected
- ✅ E2E tests refuse to run against production
- ✅ All data stays local - no external infrastructure risk
- ✅ SHADOW_MODE=true by default prevents Discord spam

### When to Use
- Daily development work
- Running unit/integration tests
- Debugging and troubleshooting
- Experimenting with new features
- Learning platform architecture

---

## 2. STAGING ENVIRONMENT

### Purpose
- Pre-production validation before production deployment
- Full E2E testing with realistic data
- Performance benchmarking
- Integration testing with external services
- QA and acceptance testing

### Infrastructure

**Database**:
```
🚨 CRITICAL: Create a NEW Supabase project for staging
DO NOT use production Supabase (cqfnsozknjzvyiziwicl)

Project Name: unit-talk-staging
URL: https://[STAGING-PROJECT-REF].supabase.co
Region: Same as production (for consistency)
Plan: Pro (required for staging workflows)

Direct Connection:
postgresql://postgres.[STAGING-PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Temporal**:
```
Option 1 (Recommended): Temporal Cloud
Server: staging.unit-talk.tmprl.cloud:7233
Namespace: unit-talk-staging
Task Queue: unit-talk-staging

Option 2: Self-hosted on DigitalOcean/AWS
Server: staging-temporal.unit-talk.com:7233
```

**Redis**:
```
DigitalOcean Managed Redis:
URL: rediss://[STAGING-REDIS-HOST]:25061

OR AWS ElastiCache:
URL: rediss://[STAGING-ELASTICACHE].cache.amazonaws.com:6379
```

**Discord**:
```
Staging Discord Server: Create separate server for staging
Channels: #staging-picks, #staging-alerts, #staging-recaps
Bot Token: Staging bot token (separate from production)
Webhooks: Staging webhooks (NOT production webhooks)
```

**API Keys**:
```
Optimal API: Staging key or rate-limited test key
Odds API: Staging key or rate-limited test key
OpenAI: Staging key (separate from production)
```

### Configuration File
**File:** `.env` (copy from `.env.staging.template`)

**Key Settings:**
```bash
NODE_ENV=staging
SUPABASE_URL=https://[STAGING-PROJECT-REF].supabase.co
TEMPORAL_ADDRESS=staging.unit-talk.tmprl.cloud:7233
SHADOW_MODE=false  # Real Discord posting in staging
PICK_DRIVER=canonical
PUBLISH_MODE=outbox

# E2E Testing
E2E_SUPABASE_URL=https://[STAGING-PROJECT-REF].supabase.co
E2E_STAGING_URL=https://staging.unit-talk.com
E2E_ENVIRONMENT=staging
```

### Safety Guardrails
- ✅ Isolated Supabase project (no production data access)
- ✅ Separate Discord server (no production channel spam)
- ✅ Rate-limited API keys (no production quota usage)
- ✅ Environment validator confirms staging mode
- ✅ Can be safely reset/destroyed without affecting production

### Deployment
**Option 1:** DigitalOcean Kubernetes
```bash
kubectl create namespace staging
kubectl apply -f infrastructure/kubernetes/apps/api/staging/
kubectl apply -f infrastructure/kubernetes/apps/smart-form/staging/
kubectl apply -f infrastructure/kubernetes/apps/discord-bot/staging/
```

**Option 2:** Docker Compose on DigitalOcean Droplet
```bash
docker-compose -f staging.docker-compose.yml up -d
```

### When to Use
- Pre-production validation before every deployment
- Full E2E test suite execution
- Performance benchmarking and load testing
- Integration testing with staging external services
- QA acceptance testing
- Demonstrating features to stakeholders

---

## 3. PRODUCTION ENVIRONMENT

### Purpose
- Live user-facing platform
- Real betting intelligence for paying customers
- Real money and real user data
- 24/7 uptime and reliability

### Infrastructure

**Database**:
```
🔒 PRODUCTION - HANDLE WITH EXTREME CARE

Project: unit-talk-production
URL: https://cqfnsozknjzvyiziwicl.supabase.co
Region: us-east-1 (AWS)
Plan: Pro with point-in-time recovery

Direct Connection:
postgresql://postgres.cqfnsozknjzvyiziwicl:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```

**Temporal**:
```
Production Temporal Cloud:
Server: prod.unit-talk.tmprl.cloud:7233
Namespace: unit-talk-production
Task Queue: unit-talk-production
```

**Redis**:
```
DigitalOcean Managed Redis (Production):
URL: rediss://[PRODUCTION-REDIS-HOST]:25061
Persistence: Enabled with daily backups
```

**Discord**:
```
Production Discord Server: Unit Talk Community
Channels: #picks, #alerts, #daily-recaps
Bot Token: Production bot token
Webhooks: Production webhooks
```

**API Keys**:
```
🔒 PRODUCTION KEYS - ROTATE EVERY 90 DAYS
Optimal API: Production key with full quota
Odds API: Production key with full quota
OpenAI: Production key with rate limits
```

### Configuration File
**File:** `.env.production` (NEVER commit to git)

**Key Settings:**
```bash
NODE_ENV=production
SUPABASE_URL=https://cqfnsozknjzvyiziwicl.supabase.co
TEMPORAL_ADDRESS=prod.unit-talk.tmprl.cloud:7233
SHADOW_MODE=false  # LIVE mode - real Discord posting
PICK_DRIVER=canonical
PUBLISH_MODE=outbox

# Production grade security
JWT_SECRET=[64-CHAR-CRYPTOGRAPHICALLY-RANDOM-KEY]
ENCRYPTION_KEY=[32-CHAR-ENCRYPTION-KEY]

# Monitoring and alerting
DATADOG_API_KEY=[PRODUCTION-DATADOG-KEY]
SENTRY_DSN=[PRODUCTION-SENTRY-DSN]
```

### Safety Guardrails
- ✅ Environment validator blocks local/dev/test from accessing production
- ✅ API and workers refuse to start with NODE_ENV=development + production URLs
- ✅ E2E tests cannot run against production (hard-coded block)
- ✅ All access requires explicit NODE_ENV=production
- ✅ Audit logging for all production database access
- ✅ Secrets stored in AWS Secrets Manager / 1Password

### Deployment
**Kubernetes Production Cluster:**
```bash
kubectl apply -f infrastructure/kubernetes/apps/api/production/
kubectl apply -f infrastructure/kubernetes/apps/smart-form/production/
kubectl apply -f infrastructure/kubernetes/apps/discord-bot/production/
```

**Blue/Green Deployment:**
```bash
# Deploy to blue environment
kubectl apply -f infrastructure/kubernetes/blue/

# Run smoke tests
npm run ops:production:smoke-test

# Switch traffic to blue
kubectl patch service unit-talk-api -p '{"spec":{"selector":{"version":"blue"}}}'

# Monitor for 30 minutes
npm run ops:production:monitor

# If stable, decommission green
kubectl delete -f infrastructure/kubernetes/green/
```

### When to Use
- ONLY for production deployments
- ONLY with explicit approval
- ONLY after successful staging validation
- NEVER for development or testing
- NEVER for experimentation

---

## 🔒 Security & Access Control

### Environment Isolation

**CRITICAL RULES:**
1. **NEVER use production credentials in local/dev/test**
2. **NEVER run tests against production infrastructure**
3. **ALWAYS validate environment on application startup**
4. **ALWAYS use separate API keys per environment**
5. **ALWAYS use separate Discord servers per environment**

### Credential Management

**Local Development:**
- Store in `.env` file (gitignored)
- Use test/dummy keys when possible
- Never share local credentials

**Staging:**
- Store in Kubernetes secrets
- Use staging-specific API keys
- Rotate every 90 days

**Production:**
- Store in AWS Secrets Manager or 1Password
- Use production-grade API keys
- Rotate every 90 days
- Audit access monthly
- Enable MFA for all access

### Access Levels

| Environment | Who Can Access | How to Access |
|-------------|----------------|---------------|
| **Local** | All developers | Clone repo, copy .env.local.template |
| **Staging** | All developers + QA | Kubernetes access or VPN |
| **Production** | DevOps team only | MFA + approval required |

---

## 🚀 Environment Validation

### Startup Validation

Every application (API, workers, bots) validates environment on startup:

```typescript
import { validateEnvironmentOrExit, getEnvironmentConfig } from '@shared/env-validator';

// First thing on startup - BEFORE any imports
validateEnvironmentOrExit(getEnvironmentConfig());
```

**What It Checks:**
- NODE_ENV matches detected infrastructure
- No production URLs when NODE_ENV=development/test
- No local URLs when NODE_ENV=production
- Temporal, Redis, Discord, Supabase all match expected environment

**What Happens on Failure:**
- Application exits immediately (process.exit(1))
- Clear error message explaining the issue
- Instructions on how to fix the configuration
- Prevents any code execution or database access

### E2E Test Validation

E2E tests validate environment before running:

```typescript
import { validateTestEnvironment } from '@shared/env-validator';

// In global-setup.ts
validateTestEnvironment(); // Throws error if production detected
```

**What It Checks:**
- E2E_SUPABASE_URL is NOT production
- E2E_TEMPORAL_URL is NOT production
- NODE_ENV is set to 'test'

**What Happens on Failure:**
- Tests refuse to run
- Clear error message
- Exit code 1 for CI/CD failure

---

## 📋 Environment Checklist

### Setting Up Local Environment

- [ ] Install Docker Desktop
- [ ] Run `docker-compose up -d` to start local services
- [ ] Copy `.env.local.template` to `.env`
- [ ] Update Discord test webhook URLs
- [ ] Run `npm install` in root directory
- [ ] Run `npm run db:migrate` to apply migrations
- [ ] Verify all services healthy: `./dev.sh status`
- [ ] Run tests: `npm test`

### Setting Up Staging Environment

- [ ] Create new Supabase project named "unit-talk-staging"
- [ ] Copy `.env.staging.template` to `.env`
- [ ] Update all `[STAGING-*]` placeholders
- [ ] Create staging Discord server and channels
- [ ] Create staging Discord bot and webhooks
- [ ] Deploy to Kubernetes or Docker Compose
- [ ] Apply all database migrations to staging Supabase
- [ ] Seed test data for staging validation
- [ ] Run E2E tests: `npm run test:e2e:staging`
- [ ] Verify monitoring dashboards

### Deploying to Production

- [ ] All staging tests passing (100% success rate)
- [ ] Performance benchmarks meet SLOs
- [ ] Security audit completed
- [ ] Change management approval received
- [ ] Production credentials stored in secrets manager
- [ ] Backup verified and tested
- [ ] Rollback plan documented
- [ ] Deploy to production Kubernetes cluster
- [ ] Run smoke tests: `npm run ops:production:smoke-test`
- [ ] Monitor for 30 minutes post-deployment
- [ ] Update status page
- [ ] Notify team of successful deployment

---

## 🔧 Troubleshooting

### Environment Validation Failures

**Error:** "NODE_ENV=development but configuration points to PRODUCTION"

**Cause:** Your `.env` file has production Supabase URL while NODE_ENV is set to development.

**Fix:**
1. Copy `.env.local.template` to `.env`
2. Update SUPABASE_URL to local or staging
3. Verify: `echo $SUPABASE_URL` should NOT contain `cqfnsozknjzvyiziwicl`

**Error:** "Tests attempted to run against PRODUCTION infrastructure"

**Cause:** E2E_SUPABASE_URL or SUPABASE_URL points to production database.

**Fix:**
1. Set `E2E_SUPABASE_URL=http://localhost:54321` for local testing
2. OR set `E2E_SUPABASE_URL=https://[STAGING-PROJECT].supabase.co` for staging
3. Verify: Tests should run successfully

**Error:** "Application startup blocked for safety"

**Cause:** Environment validator detected unsafe configuration.

**Fix:**
1. Review error message for specific issue
2. Update `.env` to match correct environment
3. Restart application

---

## 📞 Support

For questions or issues with environment configuration:

**Slack:** #unit-talk-devops
**Email:** devops@unit-talk.com
**Documentation:** https://docs.unit-talk.com/ops/environments

---

**Document Owner:** DevOps Team
**Last Reviewed:** 2025-12-01
**Next Review:** 2025-12-31
