# Command Center Dashboard Inventory

**Last Updated:** 2025-01-14
**Total Dashboards:** 21
**Status:** Production Ready

---

## Dashboard Categories

### 1. Core Operational Dashboards (6)

| # | Dashboard | Route | Status | Key Features | Dependencies |
|---|-----------|-------|--------|--------------|--------------|
| 1 | **Overview** | `/dashboard` | ✅ Production | System-wide health, pipeline metrics, publishing status, data freshness | `/api/pipeline/health`, `/api/health/provider` |
| 2 | **Agents** | `/dashboard/agents` | ✅ Production | Agent health grid, metrics history, control buttons | `/api/agents/health`, `/api/agents/status` |
| 3 | **Analytics** | `/dashboard/analytics` | ✅ Production | Performance trends, business metrics, tenant analytics | `/api/analytics` |
| 4 | **SLOs** | `/dashboard/slo` | ✅ Production | SLO status table, recent alerts, threshold configuration | `/api/slo/status`, `/api/alerts/recent` |
| 5 | **Alerts** | Embedded in `/dashboard` | ✅ Production | Real-time alert feed, severity badges, acknowledgement | `/api/alerts` |
| 6 | **Publishing** | `/dashboard/publishing` | ✅ Production | Publishing metrics from `pick_publish` table, success rates | `/api/publishing/metrics` |

### 2. Pipeline Monitoring Dashboards (4)

| # | Dashboard | Route | Status | Key Features | Dependencies |
|---|-----------|-------|--------|--------------|--------------|
| 7 | **Data Flow** | `/dashboard/data-flow` | ✅ Production | End-to-end pipeline visualization, bottleneck detection | `/api/monitoring/pipeline` |
| 8 | **Grading** | `/dashboard/grading` | ✅ Production | Grading queue status, backlog metrics, agent performance | `/api/grading/picks`, `/api/grading/agents` |
| 9 | **Events** | `/dashboard/events` | ✅ Production | Event stream with filtering, SSE support, replay controls | `/api/events`, `/api/stream`, `/api/replay` |
| 10 | **Picks** | `/dashboard/picks` | ✅ Production | Real-time pick feed with lifecycle controls, workflow management | Supabase `picks` table, Realtime subscriptions |

### 3. System Administration Dashboards (4)

| # | Dashboard | Route | Status | Key Features | Dependencies |
|---|-----------|-------|--------|--------------|--------------|
| 11 | **API Health** | `/dashboard/api-health` | ✅ Production | External API monitoring, response times, error rates | `/api/health?detailed=true` |
| 12 | **Security** | `/dashboard/security` | ✅ Production | Security posture, RBAC status, rate limiting metrics | `/api/security` |
| 13 | **Users** | `/dashboard/users` | ✅ Production | User management, permission assignment, activity logs | `/api/users` |
| 14 | **Audit** | `/dashboard/audit` | ✅ Production | Comprehensive audit trail, search/filter capabilities | `/api/audit` |

### 4. Advanced Features Dashboards (4)

| # | Dashboard | Route | Status | Key Features | Dependencies |
|---|-----------|-------|--------|--------------|--------------|
| 15 | **LLM** | `/dashboard/llm` | ✅ Production | LLM request monitoring, token usage, model performance | `/api/llm/requests`, `/api/llm/models` |
| 16 | **Revenue** | `/dashboard/revenue` | ✅ Production | Revenue metrics, billing status, subscription tracking | `/api/analytics` (revenue subset) |
| 17 | **Smart Form** | `/dashboard/smartform` | ✅ Production | Smart Form integration health, bridge outbox status | Supabase `bridge_outbox` table |
| 18 | **Tasks** | `/dashboard/tasks` | ✅ Production | Background task management, job queue status | `/api/operations` |

### 5. Development/Testing Dashboards (3)

| # | Dashboard | Route | Status | Key Features | Dependencies |
|---|-----------|-------|--------|--------------|--------------|
| 19 | **Phase D** | `/dashboard/phase-d` | ✅ Operational | Development phase testing interface | Various test APIs |
| 20 | **Test** | `/dashboard/test` | ✅ Operational | E2E testing interface with automation triggers | Playwright test suite |
| 21 | **Layout** | `/dashboard/layout.tsx` | ✅ Core | Shared layout with sidebar navigation | N/A |

---

## Dashboard Components Inventory

### Reusable Monitoring Components

| Component | Location | Purpose | Used By |
|-----------|----------|---------|---------|
| **PublishingMetrics** | `src/components/monitoring/PublishingMetrics.tsx` | Canonical pick_publish monitoring | Overview, Publishing dashboards |
| **RealTimeDataFlow** | `src/components/monitoring/RealTimeDataFlow.tsx` | Live data pipeline visualization | Data Flow dashboard |
| **GradingQueue** | `src/components/monitoring/GradingQueue.tsx` | Grading backlog display | Grading dashboard |
| **AutopilotReport** | `src/components/monitoring/AutopilotReport.tsx` | Autopilot decision display | Analytics, Agents dashboards |
| **AuditTrail** | `src/components/monitoring/AuditTrail.tsx` | Audit log viewer | Audit dashboard |
| **PipelineHealth** | `src/components/monitoring/PipelineHealth.tsx` | Component health cards | Overview dashboard |
| **ServiceHealthDashboard** | `src/components/monitoring/ServiceHealthDashboard.tsx` | Service status grid | API Health dashboard |

### Dashboard-Specific Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **OperationalControls** | `src/components/dashboard/OperationalControls.tsx` | Agent control interface (start/stop/restart) |
| **OperationalOverview** | `src/components/dashboard/OperationalOverview.tsx` | High-level system status |
| **SLOStatusWidget** | `src/components/dashboard/SLOStatusWidget.tsx` | SLO status indicator |
| **TemporalHealthWidget** | `src/components/dashboard/TemporalHealthWidget.tsx` | Temporal workflow status |
| **UnifiedPicksHealthCard** | `src/components/dashboard/UnifiedPicksHealthCard.tsx` | v3.0.0 picks health |
| **ExposureRiskWidget** | `src/components/dashboard/ExposureRiskWidget.tsx` | Risk exposure metrics |

### Pick Management Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **RealtimePickFeed** | `src/components/picks/RealtimePickFeed.tsx` | Real-time pick stream with filtering |
| **PickLifecycleControls** | `src/components/picks/PickLifecycleControls.tsx` | Workflow state management (approve/reject/publish) |
| **PickDetailsModal** | `src/components/PickDetailsModal.tsx` | Detailed pick information popup |

### Event & Replay Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **EventStream** | `src/components/EventStream.tsx` | Real-time event display with SSE |
| **ReplayControlPanel** | `src/components/ReplayControlPanel.tsx` | Event replay orchestration |
| **WorkflowMonitoring** | `src/components/WorkflowMonitoring.tsx` | Temporal workflow viewer |

### Pipeline Monitoring Cards

| Component | Location | Purpose |
|-----------|----------|---------|
| **PipelineLagCard** | `src/components/cards/PipelineLagCard.tsx` | Publishing lag metrics |
| **PromoBacklogCard** | `src/components/cards/PromoBacklogCard.tsx` | Promotion backlog status |
| **RecentPromotionsCard** | `src/components/cards/RecentPromotionsCard.tsx` | Recent pick promotions |

---

## Dashboard Navigation Structure

```
/dashboard (Overview)
├── /agents (Agent Management)
├── /analytics (Performance Analytics)
│   └── /tenant-analytics (Tenant-specific)
├── /slo (SLO Dashboard)
├── /publishing (Publishing Metrics)
├── /data-flow (Pipeline Visualization)
├── /grading (Grading Queue)
├── /events (Event Stream)
├── /picks (Pick Management)
├── /api-health (API Monitoring)
├── /security (Security Posture)
├── /users (User Management)
├── /audit (Audit Trail)
├── /llm (LLM Monitoring)
├── /revenue (Revenue Metrics)
├── /smartform (Smart Form Integration)
├── /tasks (Background Tasks)
├── /phase-d (Development Testing)
└── /test (E2E Testing)
```

---

## Dashboard Performance Metrics

### Load Times (Target)

| Dashboard | Initial Load | Refresh Interval | Real-Time Updates |
|-----------|--------------|------------------|-------------------|
| Overview | < 2s | 15s | Yes (SSE + polling) |
| Agents | < 1.5s | 30s | Yes (Supabase Realtime) |
| SLOs | < 1s | 30s | Yes (polling) |
| Events | < 1s | N/A | Yes (SSE continuous) |
| Picks | < 2s | 5s | Yes (Supabase Realtime) |
| Publishing | < 1.5s | 15s | Yes (polling) |
| All Others | < 1s | 60s | Optional |

### Real-Time Technologies

| Technology | Dashboards Using | Purpose |
|------------|------------------|---------|
| **Supabase Realtime** | Picks, Agents, Smart Form | Database change subscriptions |
| **Server-Sent Events (SSE)** | Events | Continuous event stream |
| **Polling (React Query)** | Overview, SLOs, Publishing | Periodic data refresh |
| **WebSocket** | System-wide | Bidirectional real-time (future) |

---

## Dashboard Access Control

### RBAC Requirements

| Dashboard | Required Permission | Notes |
|-----------|---------------------|-------|
| Overview | `VIEW_DASHBOARD` | Public to authenticated users |
| Agents | `VIEW_METRICS` | Viewing only |
| Agents (Controls) | `CONTROL_AGENTS` | Start/Stop/Restart actions |
| Analytics | `VIEW_METRICS` | Standard analytics |
| SLOs | `VIEW_METRICS` | SLO status viewing |
| Alerts | `VIEW_METRICS` | Alert viewing |
| Alerts (Actions) | `MANAGE_ALERTS` | Acknowledge/Resolve |
| Publishing | `VIEW_METRICS` | Metrics viewing |
| Security | `VIEW_METRICS` | Security status |
| Users | `MANAGE_USERS` | User administration |
| Audit | `VIEW_AUDIT` | Audit log access |
| Emergency Controls | `EMERGENCY_CONTROLS` | Freeze/Safe-Mode actions |

---

## Dashboard Dependencies

### External Services

- **Supabase**: All dashboards depend on Supabase for data
- **Redis**: Caching for performance optimization (optional)
- **Temporal**: Workflow dashboards and background processing
- **Discord**: Publishing and alert notifications

### Internal APIs

- **Health API**: `/api/health` - Used by Overview, API Health
- **Monitoring API**: `/api/monitoring/pipeline` - Used by Data Flow, Overview
- **SLO API**: `/api/slo/status` - Used by SLO Dashboard
- **Alerts API**: `/api/alerts/*` - Used by Overview, Alerts
- **Agents API**: `/api/agents/*` - Used by Agents Dashboard
- **Events API**: `/api/events` - Used by Events Dashboard
- **Publishing API**: `/api/publishing/metrics` - Used by Publishing Dashboard

---

## Future Dashboard Enhancements

### Planned Q1 2025

1. **Temporal Workflow Dashboard** - Dedicated workflow execution traces
2. **Ingestion Pipeline Dashboard** - Dedicated ingestion visualization
3. **Redis Cache Dashboard** - Cache performance metrics
4. **Mobile Operations Dashboard** - Mobile-optimized emergency controls

### Planned Q2 2025

1. **Cost Analytics Dashboard** - Infrastructure cost tracking
2. **Business Intelligence Dashboard** - Advanced business metrics
3. **Compliance Dashboard** - Regulatory compliance tracking
4. **Predictive Analytics Dashboard** - ML-powered forecasting

---

**Maintenance Notes:**
- Update this inventory when adding new dashboards
- Run smoke tests on all dashboards before production deployment
- Monitor dashboard load times and optimize as needed
- Review RBAC permissions quarterly
