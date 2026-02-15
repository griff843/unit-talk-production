# Windows Development Environment Setup

One-time setup guide for Unit Talk development on Windows.

## Prerequisites

### 1. Install Docker Desktop

1. Download from: https://docker.com/products/docker-desktop
2. Run installer, accept defaults
3. Restart computer when prompted
4. After restart, open Docker Desktop
5. Wait for "Docker Desktop is running" status

**Verification:**
```powershell
docker --version
# Expected: Docker version 24.x or higher
```

### 2. Install Node.js (LTS)

1. Download from: https://nodejs.org (LTS version)
2. Run installer, accept defaults
3. Include "Add to PATH" option

**Verification:**
```powershell
node --version
# Expected: v18.x or higher
```

### 3. Install pnpm

```powershell
npm install -g pnpm
```

**Verification:**
```powershell
pnpm --version
# Expected: 8.x or higher
```

### 4. Clone Repository

```powershell
git clone https://github.com/your-org/unit-talk-production.git
cd unit-talk-production
```

## First-Time Bootstrap

After cloning, run the bootstrap script:

```powershell
pnpm ops:bootstrap
```

This will:
1. Validate all required tools are installed
2. Install npm dependencies (`pnpm install`)
3. Start all Docker containers (`docker compose up -d`)
4. Wait for services to become healthy (up to 8 minutes)
5. Output a proof file to `out/dx-ops-pack/<date>/proof_bootstrap_windows.txt`

**Expected Outcome:**
- All containers running and healthy
- API available at http://localhost:3010/api/health
- Command Center at http://localhost:3004
- Smart Form at http://localhost:3002

## Service Ports Reference

| Service | Local Port | Internal Port | URL |
|---------|------------|---------------|-----|
| API | 3010 | 3000 | http://localhost:3010 |
| Smart Form | 3002 | 3021 | http://localhost:3002 |
| Command Center | 3004 | 3015 | http://localhost:3004 |
| Dashboard | 3003 | 3000 | http://localhost:3003 |
| Temporal UI | 8088 | 8080 | http://localhost:8088 |
| Prometheus | 9090 | 9090 | http://localhost:9090 |
| Grafana | 3001 | 3000 | http://localhost:3001 |
| PostgreSQL | 5432 | 5432 | - |
| Redis | 6379 | 6379 | - |

## Troubleshooting

### Docker Desktop Not Running

**Symptom:** `docker: error during connect: ... Is the docker daemon running?`

**Fix:**
1. Open Docker Desktop from Start Menu
2. Wait for green "running" indicator
3. Retry your command

### Port Already in Use

**Symptom:** `Bind for 0.0.0.0:3010 failed: port is already allocated`

**Fix:**
1. Find process using port:
   ```powershell
   netstat -ano | findstr :3010
   ```
2. Kill the process or stop the conflicting service
3. Run `pnpm ops:restart`

### Container Health Check Failing

**Symptom:** Container shows "unhealthy" or "starting" for extended period

**Fix:**
1. Check logs:
   ```powershell
   docker compose logs api
   ```
2. If database connection issues, restart with clean volumes:
   ```powershell
   pnpm ops:restart -- --wipe
   ```
   **Warning:** This removes all data volumes.

### pnpm install fails

**Symptom:** Network or dependency resolution errors

**Fix:**
1. Clear pnpm cache:
   ```powershell
   pnpm store prune
   ```
2. Delete node_modules and retry:
   ```powershell
   Remove-Item -Recurse -Force node_modules
   pnpm install
   ```

### Windows Firewall Blocking

**Symptom:** Can't access localhost URLs from browser

**Fix:**
1. Check Windows Firewall settings
2. Allow Docker Desktop through firewall
3. Try using `127.0.0.1` instead of `localhost`

## Environment Variables

The `.env` file in the project root contains environment configuration.

**Important:** Production secrets are managed via GitHub Secrets, not local `.env` files.
See `CLAUDE.md` for secrets management guidelines.

## Optional: Install Profile Aliases

For faster daily workflows, install PowerShell aliases:

```powershell
# Preview what will be installed
.\tools\profile\install-profile.ps1

# Actually install
.\tools\profile\install-profile.ps1 -Apply

# Activate immediately
. $PROFILE
```

After installation, you'll have shortcuts like:
- `ut-up` - Start containers
- `ut-down` - Stop containers
- `ut-health` - Run health check
- `ut-logs api` - View API logs

See [OPS_SHORTCUTS.md](./OPS_SHORTCUTS.md) for full list.

## Daily Workflow

See [OPS_SHORTCUTS.md](./OPS_SHORTCUTS.md) for daily development workflow commands.
