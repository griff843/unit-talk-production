# Scheduler Operations Guide

Unit Talk Platform continuous schedulers with PM2 process management.

## Overview

Three continuous loops run in parallel:
- **FeedLoop**: Ingest props from Odds API (every 45s)
- **ScoringLoop**: Score props via Enhanced45Factor engine (every 30s)
- **PromotionLoop**: Promote approved picks to publish queue (every 30s)

## Quick Start

### Start Schedulers (Production)

**Windows (PowerShell)**:
```powershell
.\scripts\ops\start-schedulers.ps1
```

**Cross-platform (npm)**:
```bash
npm run ops:start-schedulers
```

This will:
1. Check for PM2 installation (auto-install if missing)
2. Start schedulers as background process
3. Save PM2 configuration for auto-restart
4. Display status

### Stop Schedulers

```bash
npm run ops:stop-schedulers
# or
pm2 stop unit-talk-schedulers
```

### Restart Schedulers

```bash
npm run ops:restart-schedulers
# or
pm2 restart unit-talk-schedulers
```

### View Logs

```bash
npm run ops:logs-schedulers
# or
pm2 logs unit-talk-schedulers
```

## PM2 Commands Reference

| Command | Description |
|---------|-------------|
| `pm2 list` | Show all running processes |
| `pm2 logs unit-talk-schedulers` | Stream scheduler logs |
| `pm2 monit` | Real-time monitoring dashboard |
| `pm2 show unit-talk-schedulers` | Detailed process info |
| `pm2 restart unit-talk-schedulers` | Graceful restart |
| `pm2 stop unit-talk-schedulers` | Stop schedulers |
| `pm2 delete unit-talk-schedulers` | Remove from PM2 |
| `pm2 save` | Save current process list |
| `pm2 resurrect` | Restore saved processes |

## One-Time Setup: Auto-Restart on Reboot

**Windows**:
```powershell
# Install PM2 Windows service
npm install -g pm2-windows-service
pm2-service-install

# Start schedulers once
npm run ops:start-schedulers

# Save configuration
pm2 save

# Schedulers will now auto-start on Windows reboot
```

**Linux/Mac**:
```bash
# Generate startup script
pm2 startup

# Follow the displayed command (will be something like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourusername --hp /home/yourusername

# Start schedulers
npm run ops:start-schedulers

# Save configuration
pm2 save

# Schedulers will now auto-start on system reboot
```

## Output Artifacts

Schedulers write JSON artifacts to `apps/api/out/ops/schedulers/`:

```
apps/api/out/ops/schedulers/
├── feedloop-2025-10-04T13-53-00-216Z.json
├── scoringloop-2025-10-04T13-53-02-517Z.json
└── promotionloop-2025-10-04T13-53-00-305Z.json
```

**Sample artifact (ScoringLoop)**:
```json
{
  "agent": "ScoringAgent",
  "timestamp": "2025-10-04T13:54:59.920Z",
  "considered": 22,
  "inserted": 0,
  "updated": 22,
  "errors": 0
}
```

**Retention**: Recommend cleaning artifacts older than 7 days:
```bash
find apps/api/out/ops/schedulers -type f -mtime +7 -delete
```

## Health Monitoring

Schedulers write health pings to `agent_health` table. Use the watchdog script to monitor:

```bash
npm run ops:watchdog
```

Watchdog alerts to Discord if any agent hasn't pinged in 2+ minutes.

See: [OPS_RUNBOOK.md](./OPS_RUNBOOK.md) for SQL queries to check agent health.

## Troubleshooting

### Schedulers won't start
```bash
# Check PM2 status
pm2 list

# Check for port conflicts
pm2 logs unit-talk-schedulers --lines 50

# Delete and restart fresh
pm2 delete unit-talk-schedulers
npm run ops:start-schedulers
```

### High memory usage
```bash
# Check memory
pm2 monit

# Restart to free memory
pm2 restart unit-talk-schedulers
```

### Scheduler loop errors
```bash
# View recent errors
pm2 logs unit-talk-schedulers --err --lines 100

# Check output artifacts
ls -lah apps/api/out/ops/schedulers/

# Verify database connectivity
npm run ops:verify
```

## Performance Tuning

**Current intervals** (in `apps/api/src/scripts/schedulers/liveLoops.ts`):
```typescript
const FEED_INTERVAL_MS = 45 * 1000;      // 45 seconds
const SCORING_INTERVAL_MS = 30 * 1000;   // 30 seconds
const PROMOTION_INTERVAL_MS = 30 * 1000; // 30 seconds
```

**Observed performance**:
- FeedLoop: ~150ms avg cycle time
- ScoringLoop: ~2.2s avg cycle time (22 scores)
- PromotionLoop: ~140ms avg cycle time

**Recommendation**: Keep current intervals. Sub-3s cycles are excellent for real-time updates.

## Alternative: Docker Sidecar (Future)

*Note: Not implemented yet. PM2 is current production approach.*

For containerized deployment, consider running schedulers as Docker sidecar:

**docker-compose.yml** (example only):
```yaml
services:
  schedulers:
    build: ./apps/api
    command: npx tsx src/scripts/schedulers/liveLoops.ts
    restart: unless-stopped
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - ./apps/api/out:/app/out
    depends_on:
      - api
```

**Supervisord alternative** (for single container):
```ini
[program:schedulers]
command=npx tsx /app/src/scripts/schedulers/liveLoops.ts
directory=/app
autostart=true
autorestart=true
stderr_logfile=/var/log/schedulers.err.log
stdout_logfile=/var/log/schedulers.out.log
```

---

**Last Updated**: 2025-10-04
**Owner**: Platform Engineering
