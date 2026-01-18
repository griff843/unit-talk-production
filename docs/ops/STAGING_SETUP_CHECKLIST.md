# Staging Environment Setup Checklist

**Version:** 1.0.0
**Last Updated:** 2025-12-01
**Estimated Time:** 4-6 hours
**Prerequisites:** Supabase account, DigitalOcean/AWS account, Discord admin access

---

## 🎯 Overview

This checklist provides step-by-step instructions for creating a complete staging environment for Unit Talk Platform. Follow each section in order to ensure proper setup and validation.

**Result:** A fully isolated staging environment for safe pre-production testing.

---

## Phase 1: Create Staging Supabase Project (1-2 hours)

### 1.1 Create New Supabase Project

- [ ] Go to https://supabase.com/dashboard
- [ ] Click "New Project"
- [ ] Fill in project details:
  - **Name:** `unit-talk-staging`
  - **Database Password:** Generate strong password (save to secrets manager)
  - **Region:** `us-east-1` (same as production for consistency)
  - **Pricing Plan:** Pro ($25/month - required for staging workflows)
- [ ] Wait for project provisioning (5-10 minutes)
- [ ] Note the Project Reference ID: `[STAGING-PROJECT-REF]`

### 1.2 Collect Staging Credentials

- [ ] Navigate to Project Settings → API
- [ ] Copy and save to secrets manager:
  ```
  SUPABASE_URL: https://[STAGING-PROJECT-REF].supabase.co
  SUPABASE_ANON_KEY: [anon-key-from-dashboard]
  SUPABASE_SERVICE_ROLE_KEY: [service-role-key-from-dashboard]
  ```

- [ ] Navigate to Project Settings → Database
- [ ] Copy connection strings:
  ```
  Direct Connection:
  postgresql://postgres.[STAGING-PROJECT-REF]:[DB-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

  Transaction Pooler:
  postgresql://postgres.[STAGING-PROJECT-REF]:[DB-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
  ```

### 1.3 Apply Database Migrations

```bash
# Set connection string for staging
export SUPABASE_DB_URL="postgresql://postgres.[STAGING-PROJECT-REF]:[PASSWORD]@db.[STAGING-PROJECT-REF].supabase.co:5432/postgres"

# Navigate to repo root
cd unit-talk-production-main

# Apply migrations in order
psql $SUPABASE_DB_URL -f supabase/migrations/20251101_core_picks.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20250130_phase1_dead_letter_queue.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251030_phase11_analytics_scoring.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251030_scoring_infrastructure.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251101_phase13_serving.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251025_phase14_partner_api.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251127_phase15_raw_props_event_time_and_game_link.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251201_raw_props_canonical_ids.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251201_clv_tracking_canonical_ids.sql
psql $SUPABASE_DB_URL -f supabase/migrations/20251202_daily_recaps_table.sql
```

- [ ] Verify all migrations applied successfully
- [ ] Check for errors in console output

### 1.4 Verify Database Schema

```bash
# Connect to staging database
psql $SUPABASE_DB_URL

# List all tables
\dt

# Expected tables (23 minimum):
# - picks
# - pick_publish
# - raw_props
# - dead_letter_queue
# - agent_health
# - agent_metrics
# - clv_tracking
# - daily_recaps
# ... etc

# Verify pick_publish table structure
\d pick_publish

# Verify raw_props has canonical columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'raw_props'
AND column_name IN ('canonical_player_id', 'canonical_game_id');

# Should return 2 rows

# Exit psql
\q
```

- [ ] All expected tables exist
- [ ] pick_publish table has correct structure
- [ ] raw_props has canonical_player_id and canonical_game_id columns

### 1.5 Seed Test Data (Optional but Recommended)

```bash
# Seed minimal test users
psql $SUPABASE_DB_URL << EOF
INSERT INTO users (id, username, discord_id, tier, active)
VALUES
  (gen_random_uuid(), 'staging_test_user', '123456789', 'S', true),
  (gen_random_uuid(), 'staging_admin', '987654321', 'S', true)
ON CONFLICT DO NOTHING;
EOF
```

- [ ] Test users created successfully
- [ ] Verify users exist: `SELECT * FROM users LIMIT 5;`

---

## Phase 2: Create Staging Environment Configuration (30 minutes)

### 2.1 Create .env.staging File

- [ ] Copy template:
  ```bash
  cp .env.staging.template .env.staging
  ```

### 2.2 Update Supabase Configuration

Replace all `[STAGING-*]` placeholders in `.env.staging`:

```bash
# Database configuration
SUPABASE_URL=https://[STAGING-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[staging-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[staging-service-role-key]
NEXT_PUBLIC_SUPABASE_URL=https://[STAGING-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[staging-anon-key]

DATABASE_DIRECT_URL=postgresql://postgres.[STAGING-PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

- [ ] All Supabase URLs updated
- [ ] All API keys replaced
- [ ] Database connection string updated

### 2.3 Configure Remaining Services

**Temporal:**
- [ ] Decision: Use Temporal Cloud or self-hosted?
- [ ] If Temporal Cloud: Sign up at https://cloud.temporal.io
- [ ] Create staging namespace: `unit-talk-staging`
- [ ] Update `.env.staging`:
  ```bash
  TEMPORAL_ADDRESS=staging.unit-talk.tmprl.cloud:7233
  TEMPORAL_NAMESPACE=unit-talk-staging
  TEMPORAL_TASK_QUEUE=unit-talk-staging
  ```

**Redis:**
- [ ] Create DigitalOcean Managed Redis (or AWS ElastiCache)
- [ ] Get connection string
- [ ] Update `.env.staging`:
  ```bash
  REDIS_URL=rediss://[staging-redis-host]:25061
  ```

**Security:**
- [ ] Generate new JWT secret (64+ characters):
  ```bash
  openssl rand -base64 64
  ```
- [ ] Update `.env.staging`:
  ```bash
  JWT_SECRET=[generated-jwt-secret]
  ENCRYPTION_KEY=[32-char-encryption-key]
  ```

### 2.4 Validate Configuration File

```bash
# Check for any remaining placeholders
grep -n "\[STAGING-" .env.staging

# Should return no results
```

- [ ] No placeholders remaining in `.env.staging`
- [ ] All sensitive values stored in secrets manager
- [ ] `.env.staging` added to `.gitignore`

---

## Phase 3: Create Staging Discord Integration (30 minutes)

### 3.1 Create Staging Discord Server

- [ ] Create new Discord server: "Unit Talk Staging"
- [ ] Create channels:
  - `#staging-picks` (for pick announcements)
  - `#staging-alerts` (for injury/steam alerts)
  - `#staging-recaps` (for daily recaps)
  - `#staging-logs` (for debug logs)
  - `#staging-errors` (for error notifications)

### 3.2 Create Staging Discord Bot

- [ ] Go to https://discord.com/developers/applications
- [ ] Click "New Application"
- [ ] Name: "Unit Talk Staging Bot"
- [ ] Navigate to "Bot" section
- [ ] Click "Add Bot"
- [ ] Copy bot token and save to secrets manager:
  ```
  DISCORD_TOKEN=[staging-bot-token]
  ```
- [ ] Enable required intents:
  - [x] SERVER MEMBERS INTENT
  - [x] MESSAGE CONTENT INTENT

### 3.3 Create Staging Webhooks

For each channel, create a webhook:

- [ ] #staging-picks:
  1. Channel Settings → Integrations → Webhooks
  2. Create Webhook
  3. Name: "Picks Publisher"
  4. Copy webhook URL

- [ ] #staging-alerts:
  1. Create webhook named "Alert System"
  2. Copy webhook URL

- [ ] Update `.env.staging`:
  ```bash
  DISCORD_WEBHOOK_URL=[staging-picks-webhook-url]
  DISCORD_OPERATOR_WEBHOOK_URL=[staging-alerts-webhook-url]
  ```

### 3.4 Invite Bot to Server

- [ ] Navigate to OAuth2 → URL Generator
- [ ] Select scopes:
  - [x] `bot`
  - [x] `applications.commands`
- [ ] Select bot permissions:
  - [x] Send Messages
  - [x] Embed Links
  - [x] Attach Files
  - [x] Read Message History
  - [x] Use Slash Commands
- [ ] Copy generated URL
- [ ] Open URL in browser
- [ ] Select "Unit Talk Staging" server
- [ ] Authorize bot
- [ ] Verify bot appears in member list

---

## Phase 4: Deploy Staging Infrastructure (2-3 hours)

### 4.1 Choose Deployment Method

**Option A: Kubernetes on DigitalOcean (Recommended)**
- [ ] Estimated cost: $50-100/month
- [ ] Scales well
- [ ] Production-like environment

**Option B: Docker Compose on DigitalOcean Droplet**
- [ ] Estimated cost: $20-40/month
- [ ] Simpler setup
- [ ] Good for small teams

### 4.2 Deploy via Kubernetes (Option A)

```bash
# Create staging namespace
kubectl create namespace staging

# Create secrets from .env.staging
kubectl create secret generic staging-env \
  --from-env-file=.env.staging \
  --namespace=staging

# Deploy API
kubectl apply -f infrastructure/kubernetes/apps/api/staging/ \
  --namespace=staging

# Deploy Workers
kubectl apply -f infrastructure/kubernetes/apps/workers/staging/ \
  --namespace=staging

# Deploy Smart Form
kubectl apply -f infrastructure/kubernetes/apps/smart-form/staging/ \
  --namespace=staging

# Deploy Discord Bot
kubectl apply -f infrastructure/kubernetes/apps/discord-bot/staging/ \
  --namespace=staging

# Deploy Command Center
kubectl apply -f infrastructure/kubernetes/apps/command-center/staging/ \
  --namespace=staging

# Verify deployments
kubectl get pods --namespace=staging

# Wait for all pods to be Ready (may take 5-10 minutes)
watch kubectl get pods --namespace=staging
```

- [ ] All pods in "Running" state
- [ ] All pods show "1/1" or "2/2" ready
- [ ] No pods in "CrashLoopBackOff" or "Error" state

### 4.3 Deploy via Docker Compose (Option B)

```bash
# Create staging droplet on DigitalOcean
# Size: 4GB RAM, 2 vCPUs minimum
# OS: Ubuntu 22.04 LTS

# SSH into droplet
ssh root@[droplet-ip]

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin

# Clone repo
git clone https://github.com/your-org/unit-talk-production.git
cd unit-talk-production

# Copy staging environment
cp .env.staging .env

# Start all services
docker-compose up -d

# Verify all services running
docker-compose ps

# Monitor logs
docker-compose logs -f
```

- [ ] All services in "Up" state
- [ ] No error messages in logs
- [ ] Health checks passing

### 4.4 Configure DNS (Optional but Recommended)

```bash
# Add DNS records for staging
staging.unit-talk.com → [staging-load-balancer-ip]
staging-api.unit-talk.com → [staging-api-ip]
```

- [ ] DNS records created
- [ ] Wait 5-10 minutes for propagation
- [ ] Verify: `nslookup staging.unit-talk.com`

---

## Phase 5: Validate Staging Environment (1 hour)

### 5.1 Health Checks

```bash
# API health check
curl https://staging-api.unit-talk.com/api/health | jq

# Expected output:
# {
#   "status": "healthy",
#   "environment": "staging",
#   "supabase": "ok",
#   "temporal": "ok",
#   "redis": "ok"
# }

# Database connectivity
curl https://staging-api.unit-talk.com/api/ops/db-health | jq

# Temporal connectivity
curl http://[staging-temporal-ui]:8088/health

# Redis connectivity
redis-cli -u [staging-redis-url] PING
# Should return: PONG
```

- [ ] API returns healthy status
- [ ] All service checks passing
- [ ] No error messages

### 5.2 Database Validation

```bash
# Connect to staging database
psql $SUPABASE_DB_URL

# Verify tables exist
\dt

# Check agent_health
SELECT count(*) FROM agent_health;

# Check picks schema
SELECT count(*) FROM picks LIMIT 1;

# Check pick_publish schema
SELECT count(*) FROM pick_publish LIMIT 1;

# Exit
\q
```

- [ ] All tables accessible
- [ ] No permission errors
- [ ] Schema matches production

### 5.3 Run E2E Tests

```bash
# Set E2E environment variables
export E2E_SUPABASE_URL=https://[STAGING-PROJECT-REF].supabase.co
export E2E_SUPABASE_KEY=[staging-service-role-key]
export E2E_TEMPORAL_URL=https://staging-temporal.unit-talk.com:7233
export E2E_STAGING_URL=https://staging.unit-talk.com
export E2E_ENVIRONMENT=staging

# Run E2E test suite
npm run test:e2e:staging

# Or run individual flows
npm run test:e2e:flow1  # Smart Form → Discord
npm run test:e2e:flow2  # Command Center Dashboard
npm run test:e2e:flow3  # Daily Recap Workflow
```

- [ ] All E2E tests passing
- [ ] No test failures
- [ ] Test report generated

### 5.4 Manual Validation

**Smart Form Submission:**
- [ ] Navigate to https://staging.unit-talk.com/submit-ticket
- [ ] Fill out test ticket
- [ ] Submit successfully
- [ ] Verify ticket appears in staging database
- [ ] Check Discord #staging-picks for announcement

**Command Center:**
- [ ] Navigate to https://staging.unit-talk.com/command-center
- [ ] Verify dashboard loads
- [ ] Check agent health status
- [ ] Verify recent picks display

**Discord Bot:**
- [ ] Send test command in staging Discord
- [ ] Verify bot responds
- [ ] Check #staging-logs for activity

### 5.5 Load Testing (Optional)

```bash
# Run load tests
npm run qa:performance:staging

# Monitor resource usage
kubectl top pods --namespace=staging
# OR
docker stats
```

- [ ] No performance degradation
- [ ] Memory usage stable
- [ ] CPU usage acceptable
- [ ] Response times < 200ms

---

## Phase 6: Documentation and Handoff (30 minutes)

### 6.1 Document Staging Credentials

- [ ] Create entry in secrets manager (1Password/AWS Secrets Manager):
  ```
  Name: unit-talk-staging-credentials

  Supabase URL: [url]
  Supabase Service Role Key: [key]
  Discord Bot Token: [token]
  Discord Webhooks: [webhooks]
  Temporal Address: [address]
  Redis URL: [url]
  JWT Secret: [secret]
  ```

### 6.2 Update Team Documentation

- [ ] Add staging access instructions to team wiki
- [ ] Document staging deployment process
- [ ] Create runbook for staging issues
- [ ] Add staging monitoring dashboards

### 6.3 Configure CI/CD Pipeline

```yaml
# .github/workflows/staging-deploy.yml
name: Deploy to Staging

on:
  push:
    branches: [main, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Tests
        run: npm run test

      - name: Deploy to Staging
        run: |
          kubectl apply -f infrastructure/kubernetes/apps/api/staging/
        env:
          KUBECONFIG: ${{ secrets.KUBECONFIG_STAGING }}

      - name: Run E2E Tests
        run: npm run test:e2e:staging
        env:
          E2E_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          E2E_SUPABASE_KEY: ${{ secrets.STAGING_SUPABASE_KEY }}
```

- [ ] CI/CD pipeline configured
- [ ] Automated deployments working
- [ ] E2E tests run on every deploy

### 6.4 Set Up Monitoring

- [ ] Configure Grafana dashboards for staging
- [ ] Set up alerting for staging failures
- [ ] Add staging to status page
- [ ] Configure log aggregation

---

## ✅ Final Checklist

Before marking staging complete, verify:

- [ ] Staging Supabase project created and migrations applied
- [ ] All environment variables configured in `.env.staging`
- [ ] Staging Discord server and bot configured
- [ ] Staging infrastructure deployed (Kubernetes or Docker Compose)
- [ ] All services running and healthy
- [ ] E2E tests passing (100% success rate)
- [ ] Manual validation completed successfully
- [ ] Credentials stored in secrets manager
- [ ] Team documentation updated
- [ ] CI/CD pipeline configured
- [ ] Monitoring and alerting configured

---

## 🎉 Success Criteria

Staging environment is considered ready when:

1. ✅ All 15 services running and healthy
2. ✅ E2E tests passing (3/3 flows green)
3. ✅ Can submit test picks via Smart Form
4. ✅ Picks appear in staging Discord channels
5. ✅ Command Center displays picks correctly
6. ✅ No production credentials used anywhere
7. ✅ Environment validator confirms staging mode
8. ✅ API responds in < 200ms
9. ✅ Database queries complete in < 50ms
10. ✅ No critical errors in logs

**Binary Answer:** Staging is ready when all 10 criteria above are met.

---

## 🆘 Troubleshooting

### Common Issues

**Issue:** Migrations fail with permission errors
**Fix:** Ensure you're using the service_role key, not anon key

**Issue:** E2E tests fail with "production detected"
**Fix:** Set `E2E_SUPABASE_URL` to staging URL, not production

**Issue:** Discord webhooks not working
**Fix:** Verify webhook URLs are correct and bot has permissions

**Issue:** Temporal connection fails
**Fix:** Check `TEMPORAL_ADDRESS` is correct and Temporal is running

**Issue:** Environment validation fails
**Fix:** Verify all URLs in `.env.staging` point to staging, not production

---

## 📞 Support

For help with staging setup:

**Slack:** #unit-talk-devops
**Email:** devops@unit-talk.com
**Documentation:** https://docs.unit-talk.com/ops/staging-setup

---

**Document Owner:** DevOps Team
**Last Updated:** 2025-12-01
**Estimated Total Time:** 4-6 hours
