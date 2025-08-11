# Unit Talk Command Center - Architecture Overview

**Version**: 3.0.0 Fortune-100 Quality  
**Last Updated**: January 2025  
**Classification**: Technical Architecture Documentation

## 🏗️ High-Level Architecture

The Unit Talk Command Center is a Fortune-100 quality SaaS monitoring and control system built with enterprise-grade observability, risk management, and operational controls.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Next.js Frontend)              │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard Widgets  │  Admin Controls  │  Real-time Updates     │
│  - SLO Status       │  - Safe Mode     │  - WebSocket           │
│  - Exposure Risk    │  - System Freeze │  - Server-Sent Events  │
│  - Temporal Health  │  - RBAC Auth     │  - 30s Refresh Cycle   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                API LAYER (Next.js App Router)                   │
├─────────────────────────────────────────────────────────────────┤
│  REST Endpoints     │  Admin Routes    │  Health Monitoring     │
│  - /api/monitoring  │  - /api/admin    │  - /api/health         │
│  - /api/exposure    │  - /api/temporal │  - /api/telemetry      │
│  - RBAC Middleware  │  - Audit Logging │  - OpenTelemetry       │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               BUSINESS LOGIC LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Metrics Aggregator │  RBAC Service   │  Telemetry Service     │
│  - SLO Monitoring   │  - Role Management│ - Trace Collection    │
│  - Burn Rate Calc   │  - Audit Trail   │  - Synthetic Canaries │
│  - Auto-remediation │  - Permissions   │  - Business Context   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DATA LAYER (Supabase PostgreSQL)              │
├─────────────────────────────────────────────────────────────────┤
│  SLO Tables         │  Audit Tables    │  Telemetry Tables     │
│  - slos             │  - audit_log     │  - system_metrics     │
│  - slo_incidents    │  - roles         │  - exposure_snapshots │
│  - Burn Rate Views  │  - permissions   │  - temporal_health    │
└─────────────────────────────────────────────────────────────────┘
```

## 🧩 Component Architecture

### 1. Frontend Dashboard (Next.js + TypeScript)

**Tech Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS, Shadcn/UI

**Key Components**:
- `SLOStatusWidget.tsx` - Real-time SLO monitoring with burn-rate visualization
- `ExposureRiskWidget.tsx` - Kelly-at-risk tracking with auto-remediation
- `TemporalHealthWidget.tsx` - Workflow execution monitoring
- `AdminControlPanel.tsx` - Safe Mode and System Freeze controls

**Features**:
- Real-time data updates (30-second refresh)
- Responsive design for mobile operations
- Role-based UI components
- Error boundaries and loading states

### 2. API Layer (Next.js App Router)

**Architecture**: RESTful APIs with TypeScript validation

**Core Endpoints**:
```
/api/monitoring/
├── slos                    # SLO status and incidents
├── metrics                 # System metrics collection
└── burn-rates             # SLO burn-rate calculations

/api/admin/
├── safe-mode              # Emergency safe mode controls
├── freeze                 # System freeze controls
└── permissions            # RBAC management

/api/exposure/
├── snapshot               # Exposure risk analysis
├── remediation            # Auto-remediation actions
└── limits                 # Daily exposure limits

/api/temporal/
├── summary                # Workflow health overview
├── missed-schedules       # Schedule monitoring
└── health                 # Deep temporal monitoring

/api/telemetry/
├── traces                 # OpenTelemetry trace access
├── canaries              # Synthetic monitoring
└── metrics               # Custom telemetry
```

**Middleware Stack**:
1. **CORS Handling** - Cross-origin resource sharing
2. **Authentication** - Session/JWT validation  
3. **RBAC Authorization** - Role-based access control
4. **Rate Limiting** - API usage protection
5. **Request Validation** - Input sanitization
6. **Audit Logging** - Security event tracking
7. **Error Handling** - Structured error responses
8. **OpenTelemetry** - Distributed tracing

### 3. Business Logic Layer

#### Metrics Aggregator Service
**Purpose**: Continuous SLO monitoring and incident management
**Schedule**: 60-second collection, 5-minute SLO checks, hourly cleanup

**Metrics Collected**:
- Grading lag (avg, P95, P50)
- Queue backlog (instant, scheduled)
- System health (uptime, error rate, response time)
- Exposure metrics (total exposure, Kelly at risk)
- Temporal health (success rate, failures, stuck workflows)

**SLO Burn Rate Algorithm**:
```typescript
// Multi-window burn rate calculation
const burnRate = await supabase.rpc('calculate_slo_burn_rate', {
  slo_name: 'api_response_time',
  window_duration: '1 hour'
});

// Alert thresholds
if (burnRate > fastBurnThreshold) {
  severity = 'critical';  // >14.4x
} else if (burnRate > slowBurnThreshold) {
  severity = 'high';      // >1.0x
}
```

#### RBAC Service
**Purpose**: Role-based access control and audit logging
**Roles**: VIEWER, OPS, ADMIN
**Permissions**: 15 granular permissions for different system functions

**Permission Matrix**:
```
VIEWER: VIEW_DASHBOARD, VIEW_METRICS, VIEW_LOGS
OPS:    + CONTROL_AGENTS, MANAGE_SCHEDULES, TRIGGER_WORKFLOWS
ADMIN:  + SAFE_MODE, SYSTEM_FREEZE, USER_MANAGEMENT, AUDIT_ACCESS
```

**Audit Trail**: All admin actions logged with full context
```sql
INSERT INTO audit_log (
  actor, action, resource_type, resource_id,
  old_values, new_values, ip_address, user_agent,
  status, details, created_at
);
```

#### Telemetry Service
**Purpose**: OpenTelemetry instrumentation and synthetic monitoring
**Features**:
- Distributed tracing across all services
- Business context injection
- Synthetic canary monitoring
- Custom metrics collection
- Trace correlation and analysis

### 4. Data Layer (Supabase PostgreSQL)

#### Schema Design Principles
- **Denormalized for Performance** - Optimized read patterns
- **Indexed for Speed** - Strategic indexing on query patterns
- **Partitioned for Scale** - Time-based partitioning on large tables
- **Audited for Compliance** - Complete audit trail
- **Consistent Naming** - Snake_case with clear prefixes

#### Core Tables

**SLO Monitoring**:
```sql
slos                     -- SLO definitions and thresholds
slo_incidents           -- Active and historical incidents  
system_metrics          -- Time-series metrics storage
```

**Risk Management**:
```sql
exposure_snapshots      -- Daily exposure tracking
kelly_calculations      -- Kelly criterion analysis
correlation_clusters    -- Risk correlation groups
```

**Operational Control**:
```sql
audit_log              -- Complete admin action audit trail
roles                  -- RBAC role assignments
permissions            -- Permission definitions
```

**Temporal Monitoring**:
```sql
temporal_workflow_health    -- Workflow execution tracking
temporal_schedule_health    -- Schedule monitoring
```

#### Optimized Views
```sql
-- Performance monitoring
CREATE VIEW vw_grading_lag AS ...     -- Grading performance metrics
CREATE VIEW vw_queue_backlog AS ...   -- Processing queue status
CREATE VIEW vw_slo_status AS ...      -- Real-time SLO health

-- Business intelligence  
CREATE VIEW vw_clv_cohorts AS ...     -- Customer lifetime value analysis
CREATE VIEW vw_exposure_summary AS ...-- Risk exposure overview
CREATE VIEW vw_post_window_reco AS ...-- Post-window recommendations
```

#### Database Functions
```sql
-- SLO burn rate calculation
CREATE FUNCTION calculate_slo_burn_rate(slo_name TEXT, window_duration INTERVAL)

-- Expired metrics cleanup
CREATE FUNCTION cleanup_expired_metrics()

-- Auto-remediation calculations
CREATE FUNCTION calculate_kelly_adjustments(exposure_limit DECIMAL)
```

## 🔄 Data Flow Architecture

### 1. Metrics Collection Pipeline
```
External Systems → Metrics Aggregator → PostgreSQL → Dashboard Widgets
     │                      │              │              │
     ▼                      ▼              ▼              ▼
- API responses       - 60s collection  - Time series   - 30s refresh
- Database queries    - SLO calculations - Indexed storage- Real-time UI
- Temporal workflows  - Incident creation- View queries  - Alert display
- User actions        - Audit logging    - Function calls- Auto-remediation
```

### 2. SLO Monitoring Flow
```
Metric Collection → SLO Evaluation → Burn Rate Calculation → Incident Management
       │                  │                │                    │
       ▼                  ▼                ▼                    ▼
- System metrics    - Threshold      - Multi-window      - Auto-creation
- Performance data  - Comparison     - Algorithm         - Severity routing  
- Error rates       - Status update  - Alert triggers    - Notification
- User experience   - Trend analysis - Escalation rules  - Resolution tracking
```

### 3. Risk Management Flow
```
Trading Activity → Exposure Calculation → Risk Analysis → Auto-Remediation
      │                   │                  │               │
      ▼                   ▼                  ▼               ▼
- Pick submissions   - Kelly criterion - Correlation    - Position sizing
- Market positions   - Position sizing - Limit checking - Tier adjustments
- Settlement data    - Daily tracking  - Alert creation - Risk reduction
- User behavior      - Audit trail    - Impact analysis- Execution tracking
```

## 🛡️ Security Architecture

### Defense in Depth
1. **Network Security**: HTTPS/TLS 1.3, CORS policies, Rate limiting
2. **Authentication**: JWT tokens, Session management, Password policies
3. **Authorization**: RBAC with granular permissions, Audit logging
4. **Data Protection**: Encryption at rest, PII scrubbing, Access controls
5. **Monitoring**: Real-time threat detection, Anomaly alerts, Incident response

### RBAC Implementation
```typescript
// Permission checking middleware
export async function withPermission(permission: Permission) {
  return async (req: NextRequest) => {
    const userId = req.headers.get('x-user-id');
    const hasPermission = await RBACService.hasPermission(userId, permission);
    
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Log the action for audit
    await RBACService.logAudit({
      actor: userId,
      action: permission,
      resource_type: 'api_endpoint',
      status: 'success'
    });
    
    return NextResponse.next();
  };
}
```

### Audit Trail Architecture
- **Complete Coverage** - All admin actions logged
- **Tamper Resistance** - Immutable audit records
- **Compliance Ready** - SOX/GDPR/HIPAA compatible
- **Real-time Monitoring** - Suspicious activity detection
- **Retention Policy** - Configurable data retention

## 🚀 Performance Architecture

### Caching Strategy
```
Browser Cache (1 hour) → CDN Cache (24 hours) → API Cache (5 minutes) → Database
        │                       │                    │                  │
        ▼                       ▼                    ▼                  ▼
- Static assets         - API responses       - Query results    - Raw data
- Component state       - Dashboard data      - Computed metrics - Source tables
- User preferences      - Public content      - SLO calculations - Audit logs
```

### Database Optimization
- **Connection Pooling** - pgBouncer for connection management
- **Query Optimization** - Indexed access patterns, materialized views
- **Partitioning** - Time-based partitioning for large tables
- **Archival Strategy** - Automated data lifecycle management

### Horizontal Scaling
```
Load Balancer → API Instances (Auto-scaling) → Database Read Replicas
     │               │                              │
     ▼               ▼                              ▼
- Health checks  - Stateless design        - Read scaling
- Failover       - Container orchestration - Query distribution
- SSL termination- Metrics collection      - Backup/recovery
```

## 📊 Monitoring & Observability

### Three Pillars of Observability

**1. Metrics** (Quantitative measurements)
- System performance metrics (CPU, memory, disk, network)
- Application metrics (response times, error rates, throughput)  
- Business metrics (SLO compliance, exposure levels, success rates)
- Custom metrics (Kelly at risk, correlation violations, workflow health)

**2. Logs** (Event records)
- Structured JSON logging with consistent format
- Contextual information (user_id, request_id, trace_id)
- Security events (authentication, authorization, admin actions)
- Error logs with stack traces and debugging context

**3. Traces** (Request journey tracking)
- Distributed tracing across all service boundaries
- Business context injection for domain-specific analysis
- Performance bottleneck identification
- End-to-end request flow visualization

### OpenTelemetry Implementation
```typescript
// Trace creation with business context
const span = UnitTalkTracing.startAgentSpan('exposure', 'risk_analysis');
UnitTalkTracing.addBusinessContext(span, {
  user_id: userId,
  operation_type: 'kelly_calculation',
  risk_tier: 'high',
  correlation_cluster: clusterId
});

// Automatic instrumentation
trace.getTracer('unit-talk-command-center').startActiveSpan('slo_check', span => {
  // Business logic here
  span.setAttributes({
    'slo.name': sloName,
    'slo.burn_rate': burnRate,
    'slo.threshold_exceeded': burnRate > threshold
  });
  span.end();
});
```

### Alerting Strategy
- **Proactive Monitoring** - Predictive alerts before SLO violations
- **Multi-channel Delivery** - Slack, PagerDuty, email, SMS
- **Context-rich Notifications** - Actionable information in alerts
- **Escalation Policies** - Automatic escalation based on severity and response time

## 🔧 Deployment Architecture

### Container Strategy
```dockerfile
# Multi-stage build for optimized production images
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime  
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Infrastructure as Code
- **Docker Compose** - Local development environment
- **Kubernetes** - Production container orchestration  
- **Terraform** - Infrastructure provisioning
- **Helm Charts** - Application deployment templates

### CI/CD Pipeline
```yaml
# GitHub Actions workflow
Deploy Pipeline:
  1. Code Quality Gates (ESLint, TypeScript, Tests)
  2. Security Scanning (CodeQL, dependency audit)
  3. Build & Test (Unit tests, integration tests, E2E tests)
  4. Staging Deployment (Automated deployment to staging)
  5. Production Deployment (Manual approval required)
  6. Health Verification (Automated smoke tests)
  7. Rollback Strategy (Automated rollback on failure)
```

## 📈 Scalability Architecture

### Horizontal Scaling Points
1. **API Layer** - Stateless containers behind load balancer
2. **Database** - Read replicas for query scaling
3. **Cache Layer** - Distributed Redis cluster
4. **File Storage** - CDN with global distribution
5. **Background Jobs** - Queue-based processing with workers

### Performance Targets
- **API Response Time**: <200ms (95th percentile)
- **Database Query Time**: <50ms (95th percentile)  
- **Page Load Time**: <2s (95th percentile)
- **System Uptime**: 99.9% (8.7 hours/year downtime)
- **Concurrent Users**: 10,000+ simultaneous sessions

---

**Document Maintainer**: Architecture Team  
**Review Cycle**: Quarterly  
**Next Review**: April 2025  
**Related Documents**: 
- [Operations Runbook](./OPERATIONS_RUNBOOK.md)
- [API Documentation](./API_REFERENCE.md)
- [Security Guide](./SECURITY_GUIDE.md)