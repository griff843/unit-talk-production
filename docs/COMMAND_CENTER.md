# Command Center Operations Guide

## Overview

The Command Center provides a unified operations dashboard for monitoring and controlling the Unit Talk platform. It features artifact-based monitoring, runtime controls, and comprehensive health checks - all designed to be Windows-safe and ESM-compliant.

## Key Features

### 1. Health Monitoring (`/health`)

Unified health monitoring page that displays the status of all platform services:

- **API Service**: HTTP health, version, and uptime
- **Worker Service**: Active workers and status
- **Database**: Connection health and entity counts
- **Temporal**: HTTP/gRPC connectivity and namespace info

**Features:**
- Real-time health status with visual indicators
- Last-checked timestamps for each service
- On-demand probe execution via "Run Probes" button
- RBAC-protected (admin/ops roles only)

### 2. Temporal Monitoring (`/temporal`)

Dedicated Temporal workflow system monitoring:

- **Dual Connection Status**: Separate HTTP and gRPC health indicators
- **Server Details**: Version, namespace, and round-trip latency
- **Backward Compatibility**: Supports both old (`ok`) and new (`httpOk`/`grpcOk`) artifact formats

**Health States:**
- ✅ **Operational**: Both HTTP and gRPC connections healthy
- ⚠️ **Partial**: One connection type down
- ❌ **Offline**: Both connections down

### 3. Runtime Mode Control (`/ops`)

Advanced runtime configuration with effective flags display:

**Modes:**
- **Production**: Full live operations
- **Shadow**: Monitoring only, no external writes
- **Maintenance**: Limited functionality

**Effective Flags Semantics:**

The system computes effective flags based on both the runtime mode and individual toggles:

| Flag | Production Mode | Shadow Mode | Maintenance Mode |
|------|----------------|-------------|------------------|
| Discord | ✅ If enabled | ❌ Always OFF | ❌ Always OFF |
| SmartForm Writes | ✅ If enabled | ❌ Always OFF | ❌ Always OFF |
| Ingestion | ✅ If enabled | ✅ If enabled | ❌ Always OFF |
| Promoter | ✅ If enabled | ❌ Always OFF | ❌ Always OFF |
| Alerts | ✅ If enabled | ❌ Always OFF | ❌ Always OFF |

**Safety Features:**
- Production mode switch requires explicit confirmation
- Visual indicators show current mode and effective states
- Tooltip explanations for why flags are on/off

### 4. Alert Policies (`/alerts`)

Comprehensive alert policy management with API-first design:

**Features:**
- CRUD operations for alert policies
- JSON-based channel configuration
- Enable/disable toggles per policy
- Optional threshold values

**Local Stub Fallback:**

When the alerts API is not available (404 or network error), the system automatically falls back to a local file-based stub:

- **Storage**: `out/ops/alert-policies.local.json`
- **Behavior**: Full CRUD functionality maintained
- **Indication**: Yellow warning banner when using stub
- **Seamless**: Automatic switchover when API becomes available

**Supported Channels:**
- Discord (`#channel-name` targets)
- Email (email addresses)
- Slack (channel identifiers)

### 5. On-Demand Probes

Execute health checks on-demand via the API:

**Endpoint**: `POST /api/ops/probes/health`

**Executes sequentially:**
1. `scripts/ops/health-temporal.ts`
2. `scripts/ops/health-api.ts`  
3. `scripts/ops/health-worker.ts`
4. `scripts/ops/db-preflight.ts`

**Features:**
- 30-second timeout per probe
- Results written to `out/ops/` artifacts
- Summary returned in API response
- Automatic page refresh after execution

## CI Integration

### Command Center Ops Job (`cc-ops`)

The CI pipeline includes a dedicated job for Command Center operations testing:

```yaml
cc-ops:
  name: Command Center Ops
  runs-on: ubuntu-latest
```

**Steps:**
1. Creates ops artifacts directory
2. Generates mock health artifacts for testing
3. Runs `cc-smoke.ts` smoke tests
4. Validates test results
5. Uploads artifacts for inspection

**Smoke Test Coverage:**
- Runtime Mode API (expects 200 response)
- Alerts API (handles 404 with stub fallback)
- Temporal health artifact validation
- Results written to `out/ops/cc-smoke.json`

## Artifact Structure

All operational data is stored as JSON artifacts in `out/ops/`:

```
out/ops/
├── temporal-health.json     # Temporal connectivity status
├── health-api.json          # API service health
├── health-worker.json       # Worker service health
├── db-preflight.json        # Database health
├── alert-policies.local.json # Local alert policy stub
├── cc-smoke.json           # Smoke test results
└── runtime-mode.json       # Current runtime configuration
```

## Environment Variables

Required environment variables for full functionality:

```bash
# API Configuration
API_URL=http://localhost:3001  # API service URL
OPS_API_KEY=your-ops-key       # Operations API key

# Optional
NODE_ENV=production            # Environment mode
```

## Error Handling

The Command Center includes comprehensive error handling:

1. **ErrorBoundary Components**: Catch and display React errors gracefully
2. **Artifact Fallbacks**: Return null with soft warnings for missing files
3. **API Fallbacks**: Automatic stub mode for unavailable endpoints
4. **Graceful Degradation**: Pages render even with partial data

## Verification Runbook

### 1. Verify Health Page

```bash
# Generate health artifacts
npm run ops:health

# Visit /health page
# Click "Run Probes" button
# Verify all tiles update
```

### 2. Verify Temporal Page

```bash
# Check temporal health
npx tsx scripts/ops/health-temporal.ts

# Visit /temporal page
# Verify HTTP/gRPC status pills
```

### 3. Verify Runtime Mode

```bash
# Visit /ops page or wherever RuntimeModePanel is used
# Click "Configure Runtime Mode"
# Switch modes and verify effective flags update
# Test production mode confirmation dialog
```

### 4. Verify Alerts Page

```bash
# Visit /alerts page
# Create a test policy
# Edit the policy
# Toggle enabled state
# Delete the policy
# Check out/ops/alert-policies.local.json if using stub
```

### 5. Run Smoke Tests

```bash
# Set environment
export OPS_API_KEY=your-key
export API_URL=http://localhost:3001

# Run smoke tests
npx tsx scripts/e2e/cc-smoke.ts

# Check results
cat out/ops/cc-smoke.json | jq '.'
```

## Security Considerations

- All ops endpoints require `x-ops-key` header authentication
- RBAC enforcement on all pages (admin/ops roles)
- Tenant isolation for multi-tenant deployments
- No database migrations or schema modifications
- Server-only operations for sensitive actions

## Windows Compatibility

All components are Windows-safe:

- Path operations use `path.join()` and `path.resolve()`
- No shell-specific commands
- ESM modules throughout
- Cross-platform Node.js APIs only

## Troubleshooting

### Missing Artifacts

**Problem**: "No data yet — run ops checks" message

**Solution**: 
```bash
npm run ops:health
```

### Alerts API Not Found

**Problem**: Yellow "Using Local Stub" warning

**Solution**: 
- Verify OPS_API_KEY is set
- Check API service is running
- Confirm `/api/ops/alerts` endpoints exist

### Probe Execution Fails

**Problem**: "Run Probes" button shows error

**Solution**:
- Check OPS_API_KEY environment variable
- Verify API service is accessible
- Check probe scripts exist in `scripts/ops/`

### Runtime Mode Not Updating

**Problem**: Mode changes don't take effect

**Solution**:
- Check browser console for errors
- Verify API `/api/ops/runtime-mode` endpoint
- Confirm OPS_API_KEY is configured

## Future Enhancements

Potential improvements for future iterations:

1. **WebSocket Support**: Real-time artifact updates
2. **Historical Data**: Time-series health metrics
3. **Alert Testing**: Send test notifications
4. **Batch Operations**: Bulk alert policy management
5. **Export/Import**: Configuration backup/restore
6. **Dashboard Customization**: User-defined layouts