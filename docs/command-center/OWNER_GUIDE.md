# Command Center Owner Guide

**Principal Engineer Documentation**  
**Branch:** `cmd-center-toggles/2025-08-12`  
**Implementation Status:** Complete ✅

This guide provides comprehensive ownership information for the Unit Talk Command Center toggle system, including architecture decisions, operational procedures, and maintenance protocols.

## 🎯 System Overview

The Command Center toggle system provides real-time operational control over the Unit Talk platform with backend enforcement, comprehensive audit trails, and role-based access control.

### Key Implementation Features

**✅ Complete Implementation:**
- Database schema with atomic operations and audit logging
- Backend API routes with RBAC and system flag enforcement
- Frontend safety toggles with real-time updates
- Alertmanager webhook integration for auto-incident creation
- E2E test coverage with CI/CD quality gates
- Production-ready deployment with comprehensive monitoring

## 🏗️ Architecture Overview

### Database Layer (`20250812_cc_toggles.sql`)

**Core Tables:**
```sql
app_system_config     -- System flags storage
app_audit_log         -- Comprehensive audit trail  
app_incidents         -- Incident management with auto-resolution
```

**Database Functions:**
- `get_system_flag(key)` - Atomic flag retrieval with defaults
- `set_system_flag(key, value, actor, metadata)` - Atomic flag updates with audit
- `write_audit_log(...)` - Structured audit logging with metadata
- `create_incident_auto_safemode(...)` - Auto-incident creation with critical alert handling

**Seeded Default Values:**
```sql
SAFE_MODE: false           -- Blocks promotions and publishing
SYSTEM_FREEZE: false       -- Halts all operations  
SHADOW_MODE: true          -- Suppresses real publishing
PUBLISH_TO_DISCORD: false  -- Discord publishing control
PUBLISH_TO_NOTION: false   -- Notion publishing control
```

### Backend Services

**Server Utilities (`server/systemConfig.ts`):**
- `getSystemFlags()` - Multi-flag retrieval with safe defaults
- `setSystemFlag()` - Atomic flag updates with audit logging
- `isPromotionAllowed()` - Business logic enforcement helpers
- `isIngestionAllowed()` - Operations control logic
- `isDiscordPublishingAllowed()` - Publishing enforcement
- `isNotionPublishingAllowed()` - Publishing enforcement

**RBAC System (`app/api/_lib/rbac.ts`):**
- Role-based permissions: Admin (all), Ops (toggle/resolve), Viewer (read)
- Automatic audit logging for unauthorized access attempts
- User role derivation from Supabase session metadata
- Client metadata extraction (IP, User-Agent) for audit trails

### API Endpoints

**System Configuration:**
- `GET /api/ops/system-config` - Retrieve all system flags
- `POST /api/ops/system-config` - Toggle flags with RBAC validation

**Health Monitoring:**  
- `GET /api/ops/health/tiles` - Real-time SLO metrics and health indicators

**Alertmanager Integration:**
- `POST /api/alerts/alertmanager` - Webhook for critical alert processing
- `GET /api/alerts/alertmanager` - Configuration and activity status

### Frontend Components

**Safety Toggles:**
- Real-time state synchronization with backend
- Optimistic UI updates with error handling
- Visual state indicators (ON/OFF badges)
- Role-based disable/enable based on permissions

**Health Monitoring:**
- 6 SLO tiles: Feed Freshness, Temporal Backlog, Canary Status, Failure Rate, Provider Spend, DLQ Count
- Color-coded status indicators (green/yellow/red)
- Auto-refresh capabilities with error handling

## 🔐 Security & Access Control

### Role-Based Access Control (RBAC)

**Admin Role:**
- Full system access including rollback operations
- Can modify all system flags including SYSTEM_FREEZE
- Access to audit trails and system configuration

**Ops Role:**  
- Toggle safety flags (except SYSTEM_FREEZE)
- Incident resolution and management
- Health monitoring and metrics access

**Viewer Role:**
- Read-only access to all dashboards
- View health metrics and system status
- No modification capabilities

### Audit Trail System

**Comprehensive Logging:**
- All flag changes with before/after values
- User identification and client metadata (IP, User-Agent)
- Timestamp precision and action categorization
- Unauthorized access attempt logging

**Audit Event Types:**
- `system_flag_changed` - Flag state modifications
- `system_config_read` - Configuration access  
- `health_tiles_read` - Health data access
- `unauthorized_access_attempt` - Security violations
- `auto_safe_mode_activated` - Critical alert responses

## 🚨 Alertmanager Integration

### Auto-Incident Creation

**Critical Alert Handling:**
- Automatic incident creation for severity=critical alerts
- Safe Mode activation for specific alert rules
- Auto-resolution when alerts clear

**Trigger Conditions:**
```javascript
// Safe Mode auto-activation triggers
- HighErrorRate (>10% error rate)
- DatabaseDown or DatabaseHighLatency (>5s)  
- ServiceDown (API service)
- TemporalDown
- HighMemoryUsage (>90%) or HighCPUUsage (>95%)
- DataCorruption or PickValidationFailure
- Custom alerts with severity=critical or safe_mode=true annotation
```

### Webhook Configuration

**Endpoint:** `POST /api/alerts/alertmanager`
**Authentication:** None (system webhook)
**Payload:** Standard Alertmanager webhook format

**Response Handling:**
- Incident creation with metadata preservation
- Safe Mode activation for critical conditions
- Auto-resolution of incidents when alerts resolve
- Comprehensive audit logging of all webhook activity

## 🛡️ Backend Enforcement

### System Flag Enforcement Points

**Promotion Path Enforcement:**
```typescript
// In promotion/deployment services
const canPromote = await isPromotionAllowed();
if (!canPromote) {
  throw new Error('Promotions blocked by Safe Mode or System Freeze');
}
```

**Publishing Enforcement:**
```typescript
// In Discord/Notion publishers  
const canPublishDiscord = await isDiscordPublishingAllowed();
const canPublishNotion = await isNotionPublishingAllowed();
```

**Ingestion Control:**
```typescript
// In data ingestion services
const canIngest = await isIngestionAllowed();
if (!canIngest) {
  logger.warn('Ingestion blocked by System Freeze');
  return;
}
```

### Integration Points

**Publisher Services:**
- Discord webhook publishers check PUBLISH_TO_DISCORD && !SHADOW_MODE
- Notion API publishers check PUBLISH_TO_NOTION && !SHADOW_MODE
- All publishing respects SAFE_MODE and SYSTEM_FREEZE overrides

**Workflow Systems:**
- Temporal workflow schedules respect SYSTEM_FREEZE
- Agent orchestration checks system flags before operations
- Promotion pipelines validate flag states before deployment

## 📊 Monitoring & Observability

### Health Metrics (SLO Tiles)

**Feed Freshness:**
- Measures time since last data ingestion
- Green: <5min, Yellow: 5-15min, Red: >15min
- Sources: agent_health.last_heartbeat or raw_props.created_at

**Temporal Backlog Age:**
- Age of oldest unprocessed workflow item
- Green: <10min, Yellow: 10-30min, Red: >30min  
- Sources: unified_picks where graded_at IS NULL

**Canary Status:**
- Heartbeat status of monitoring canary
- Green: Active, Red: Inactive
- Sources: agent_health where agent_name='canary'

**Failure Burn Rate:**
- Error rate over last hour from audit logs
- Green: <10 errors, Yellow: 10-50 errors, Red: >50 errors
- Sources: app_audit_log where action LIKE '%error%'

**Provider Spend:**  
- API credits consumption rate and budget utilization
- Green: <80% budget, Yellow: 80-95%, Red: >95%
- Sources: provider_usage table with configurable budget

**DLQ Count:**
- Dead letter queue item count
- Green: 0 items, Yellow: 1-10 items, Red: >10 items
- Sources: notifications_outbox where status='retrying'

### Performance Targets

**API Response Times:**
- System config operations: <200ms
- Health tile data: <500ms  
- Toggle operations: <300ms

**Database Performance:**
- Flag retrieval: <50ms
- Audit logging: <100ms
- Incident creation: <200ms

## 🔄 Operational Procedures

### Daily Operations

**Morning Health Check:**
1. Review overnight incidents in Command Center
2. Validate all health tiles show green status
3. Confirm system flags are in expected state
4. Check audit trail for any unauthorized access attempts

**Flag State Management:**
- SAFE_MODE: Only enable during incidents or maintenance
- SYSTEM_FREEZE: Reserved for emergency situations
- SHADOW_MODE: Default enabled for safety, disable for production publishing
- Publishing flags: Enable when ready for external integrations

### Incident Response

**Critical Alert Response:**
1. Alertmanager webhook creates incident automatically
2. Safe Mode activated for critical severity
3. Ops team notified via standard incident channels
4. Resolution tracked in incident management system

**Manual Incident Management:**
1. Navigate to Command Center → Incidents page
2. Review incident details and system impact
3. Resolve incident with resolution notes
4. Verify automated flag changes if applicable

### Maintenance Procedures

**Planned Maintenance:**
1. Enable SAFE_MODE to block promotions
2. Enable SYSTEM_FREEZE if ingestion should stop
3. Notify stakeholders of maintenance window
4. Perform maintenance operations
5. Validate system health through health tiles
6. Disable maintenance flags when complete

**Emergency Procedures:**
1. SYSTEM_FREEZE provides immediate halt of all operations
2. SAFE_MODE blocks promotions but allows ingestion
3. Check audit trail for root cause analysis
4. Use recovery operations for rollback if needed

## 🧪 Testing & Validation

### E2E Test Coverage

**Comprehensive Test Suite:**
- Safety toggle functionality across all 5 flags
- Health monitoring tile data display and status indicators  
- RBAC enforcement for Admin/Ops/Viewer roles
- System flag enforcement in backend operations
- Incident management workflow
- Recovery operations (replay, rollback)
- Alertmanager webhook integration
- Data trust widgets and validation

**Test Execution:**
```bash
# Local testing
cd apps/command-center
npm run test:e2e

# CI/CD pipeline
# Runs automatically on PR to main branch
# Quality gate blocks merge if tests fail
```

**Performance Testing:**
- Load testing with realistic user scenarios
- Database performance under concurrent flag operations
- API response time validation
- Frontend responsiveness testing

### Quality Gates

**CI/CD Requirements:**
- All E2E tests must pass
- Database migration must apply cleanly
- TypeScript compilation with zero errors
- Build process must complete successfully
- Performance budgets must be met

## 📋 Maintenance & Troubleshooting

### Common Issues

**Toggle Not Updating:**
1. Check browser console for API errors
2. Verify user has appropriate role permissions
3. Check audit trail for authorization failures
4. Validate database connectivity

**Health Tiles Showing Stale Data:**
1. Verify data source tables have recent data
2. Check API endpoint response times
3. Review error logs for database connection issues
4. Confirm calculation logic in health endpoint

**Alertmanager Webhook Failures:**
1. Check webhook endpoint accessibility
2. Verify payload format matches schema
3. Review audit trail for webhook processing logs
4. Validate incident creation and Safe Mode activation

### Debugging Tools

**Audit Trail Analysis:**
```sql
-- Recent flag changes
SELECT * FROM app_audit_log 
WHERE action = 'system_flag_changed' 
ORDER BY occurred_at DESC LIMIT 10;

-- Unauthorized access attempts
SELECT * FROM app_audit_log 
WHERE action = 'unauthorized_access_attempt'
ORDER BY occurred_at DESC;
```

**System Flag Status:**
```sql
-- Current flag states
SELECT key, value, updated_at, updated_by 
FROM app_system_config 
ORDER BY updated_at DESC;
```

**Health Diagnostics:**
```sql
-- Recent incidents
SELECT * FROM app_incidents 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Performance Monitoring

**Database Performance:**
- Monitor query execution times for flag operations
- Track audit log table growth and archival needs
- Analyze database connection pool utilization

**API Performance:**
- Monitor response times for system config endpoints
- Track error rates and retry patterns
- Analyze health tile data freshness

**Frontend Performance:**
- Monitor toggle response times
- Track failed API calls and retry logic
- Analyze user experience metrics

## 🚀 Deployment & Rollback

### Deployment Process

**Prerequisites:**
1. Database migration applied successfully
2. E2E tests passing in CI/CD  
3. Performance validation complete
4. Security review completed

**Deployment Steps:**
1. Deploy database migration to production
2. Deploy backend API changes
3. Deploy frontend updates  
4. Validate health tiles show correct data
5. Test toggle functionality with appropriate roles
6. Verify Alertmanager webhook integration

**Validation Checklist:**
- [ ] All 5 safety toggles functional
- [ ] Health tiles displaying current data
- [ ] RBAC permissions working correctly
- [ ] Audit trail capturing all events
- [ ] Alertmanager webhook creating incidents
- [ ] Backend enforcement blocking operations when appropriate

### Rollback Procedures

**Emergency Rollback:**
1. Enable SYSTEM_FREEZE to halt operations
2. Use recovery operations in Command Center
3. Rollback database migration if necessary
4. Restore previous API/frontend versions
5. Validate system stability
6. Disable SYSTEM_FREEZE when stable

**Partial Rollback:**
- Database: Rollback specific migration only
- API: Revert to previous API version  
- Frontend: Disable Command Center features via feature flags

## 📞 Support & Escalation

### Support Contacts

**Primary Owner:** Platform Engineering Team
**Secondary:** Site Reliability Engineering
**Escalation:** Principal Engineering

### Documentation Updates

**When to Update:**
- Flag enforcement logic changes
- New health metrics added
- RBAC permission changes
- New integration points

**Update Process:**
1. Update technical documentation
2. Notify stakeholders of changes
3. Update runbooks and procedures
4. Train operations team on changes

---

**Document Owner:** Principal Engineering  
**Last Updated:** Implementation Date  
**Next Review:** Monthly operational review  
**Version:** 1.0.0