# CLAUDE.md - Unit Talk Command Center

This file provides guidance to Claude Code (claude.ai/code) when working with
the Unit Talk Command Center application.

## ⚠️ MANDATORY: READ PRODUCTION CHARTER FIRST

**🚨 CRITICAL INSTRUCTION FOR ALL AI AGENTS 🚨**

Before working on the Command Center, you **MUST** read and comply with:

1. **[Production Charter v3.0](../../docs/PRODUCTION_CHARTER.md)** - The binding
   contract for all development and operations
2. **[System Alignment Spec](../../docs/SYSTEM_ALIGNMENT_SPEC.yml)** -
   Machine-readable governance rules

**Key Command Center Requirements (Charter v3.0 Compliance):**

- ✅ **Canonical-First Monitoring**: Display `picks` + `pick_publish` tables as
  authoritative data sources
- ✅ **Real-time Pick Feed**: Live updates from canonical picks table with
  workflow stage tracking
- ✅ **Lifecycle Controls**: Workflow management for draft → review → approved →
  published stages
- ✅ **Self-Healing Visibility**: Display PostgREST reload status and automatic
  fallback behavior
- ✅ **Health Integration**: Consume `/api/health` and
  `/api/domain/picks/preflight` endpoints
- ✅ **Multi-tenant Support**: Respect tenant context for all data displays
- ✅ **Observability**: Display OpenTelemetry spans, SLO metrics, and audit
  trails

**This Charter v3.0 supersedes all other instructions. Non-compliance is a
blocking issue.**

---

## 🎮 Application Overview

The Unit Talk Command Center is a comprehensive operational dashboard and
control interface for managing the entire sports betting intelligence platform.
It serves as the central hub for system monitoring, agent orchestration, user
management, and real-time operational control.

**🟢 DEPLOYMENT STATUS: READY FOR VERIFICATION** (Last updated: 2026-01-18)

Connected to Unit Talk v3.0.0 unified database. Build health and integration
status require verification commands below.

### 📊 Architecture Audit Results (Verified 2026-01-18)

**Command Center Status**: ⏳ **REQUIRES VERIFICATION**

**Verification Checklist** (run these commands to update status):

```bash
# 1. TypeScript Compilation
docker-compose exec command-center npm run type-check 2>&1 | tee logs/cc-typecheck-$(date +%Y%m%d).log

# 2. Production Build
docker-compose exec command-center npm run build 2>&1 | tee logs/cc-build-$(date +%Y%m%d).log

# 3. E2E Tests
docker-compose exec command-center npm run test:e2e 2>&1 | tee logs/cc-e2e-$(date +%Y%m%d).log

# 4. Dev Server Health
docker-compose up -d command-center && docker-compose logs command-center | grep "Ready"
```

**Component Health** (requires verification):

- ⏳ **TypeScript Compilation**: Claims "zero errors" - run verification command
  #1
- ⏳ **RBAC System**: Claims "fixed" - requires integration test
- ⏳ **Telemetry Integration**: Claims "working" - requires runtime verification
- ⏳ **Database Type Safety**: Claims "resolved" - run verification command #2
- ⏳ **Temporal Monitoring**: Claims "implemented" - requires manual testing
- ✅ **Live Data Integration**: Real capper data (Griff843, Vicgo, Sauced,
  MoneyReef, Squirrel) - **VERIFIED**
- ⏳ **v3.0.0 Compliance**: Integration with `unified_picks` table - requires
  schema check
- ⏳ **Production Build**: Claims "no warnings" - run verification command #2
- ⏳ **Performance**: Claims "sub-second response" - requires load testing
  evidence

**Status Legend**:

- ✅ VERIFIED: Evidence provided with timestamp
- ⏳ UNVERIFIED: Claim made but lacks verification evidence
- ❌ FAILING: Tested and found broken

### Key Features ✅ PRODUCTION READY

- **Real-Time System Monitoring**: Live dashboard connected to Unit Talk
  production agent systems
- **Live Agent Health Monitoring**: Real-time subscriptions to `agent_health`
  and `agent_metrics` tables
- **Pick Management Workflow**: Full approval/denial system with Supabase
  database persistence
- **v3.0.0 Unified Data Integration**: Connected to `unified_picks`,
- **Event Stream Monitoring**: Real-time production pipeline events with
  filtering
- **Replay Capabilities**: Event replay for operational recovery and debugging
- **Pipeline Health Monitoring**: Comprehensive metrics for all pipeline
  components `raw_props`, and `agent_logs` tables
- **Production Mode Display**: Shows "Production" status with real capper names
  (Griff843, Vicgo, Sauced, etc.)
- **Operational Controls**: Live agent start/stop/restart commands with database
  updates
- **Real-Time Notifications**: Instant toast alerts for agent status changes and
  system events
- **Performance Analytics**: Live metrics from production agent systems
- **Emergency Controls**: System-wide emergency stop and rollback capabilities

### v3.0.0 Unified Database Structure

**Core Production Tables**:

- **`unified_picks`**: Central pick management table replacing fragmented
  `daily_picks` structure
  - Primary capper relationship: `user_id` → `users.id` via
    `unified_picks_user_id_fkey`
  - Workflow stages: draft, pending_review, approved, rejected, published
  - Complete pick lifecycle from placement to settlement
- **`users`**: Unified user management with capper identification
  - Real production cappers: Griff843, Vicgo, Sauced, MoneyReef, Squirrel
  - Tier system: A, B, C with capper_tier classification
- **`raw_props`**: Market data and proposition analytics (stat_type,
  player_name, line, odds)
- **`agent_health`**: Real-time agent status monitoring
- **`agent_metrics`**: Performance data (success rates, response times,
  operation counts)
- **`agent_logs`**: Live activity tracking and audit trails

### Critical Database Relationships

```typescript
// Correct Supabase relationship syntax for v3.0.0
const { data: picks } = await supabase.from('unified_picks').select(`
    id, user_id, selection, odds, workflow_stage,
    users!unified_picks_user_id_fkey (username, discord_id, tier, capper_tier),
    raw_props (stat_type, player_name, line, over_odds, under_odds)
  `);
```

### Database Transformation Notes

- **Reduced from 77 to 45 tables** in v3.0.0 for optimal performance
- **No compatibility views or workarounds** - direct v3.0.0 integration only
- **Column mapping changes**: `prop_type` → `stat_type`, `name` → `player_name`,
  `league` → `sport`
- **Foreign key relationships**: Multiple user relationships require explicit
  foreign key names

## 🛠️ Development Commands

**Development Model**: Hybrid (See [Root CLAUDE.md](../../CLAUDE.md) for
complete guidance)

### Docker Mode (RECOMMENDED - Full Stack Integration)

```bash
# Start all services (includes database, Redis, Temporal)
cd ../.. && ./dev.sh start

# Verify Command Center is running
docker-compose ps command-center

# Database operations
docker-compose exec command-center npm run db:status
docker-compose exec command-center npm run db:migrate

# Type & Build verification
docker-compose exec command-center npm run type-check
docker-compose exec command-center npm run build

# E2E testing
docker-compose exec command-center npm run test:e2e

# View logs
docker-compose logs -f command-center
```

### Local Mode (Rapid UI Iteration - Limited Functionality)

⚠️ **Limitations**: No backend API, database, or Temporal. Use only for:

- UI component development
- TypeScript type checking
- Linting
- Visual testing (with mocked data)

```bash
# Local development server (fast hot reload)
npm run dev

# Local type checking
npm run type-check

# Local linting
npm run lint

# Local build (no backend connectivity)
npm run build
```

**Before Pull Requests**: Always verify in Docker mode with full integration
tests.

### Testing Commands

**Docker Mode (Recommended - Full Integration):**

```bash
# Run all tests with full integration
docker-compose exec command-center npm test

# Watch mode for development
docker-compose exec command-center npm run test:watch

# Coverage reports
docker-compose exec command-center npm run test:coverage

# E2E tests with Playwright (requires backend services)
docker-compose exec command-center npm run test:e2e

# System integration tests (requires full stack)
docker-compose exec command-center npm run test:system
```

**Local Mode (Unit Tests Only - No Backend):**

```bash
# Run unit tests locally (no integration/E2E)
npm test

# Watch mode
npm run test:watch

# Coverage reports
npm run test:coverage

# ⚠️ E2E and system tests will fail - use Docker mode
```

### Quality Assurance

**Docker Mode (Recommended):**

```bash
# Code quality checks
docker-compose exec command-center npm run lint
docker-compose exec command-center npm run lint:fix
docker-compose exec command-center npm run format

# Security testing (requires backend)
docker-compose exec command-center npm run test:security

# Performance testing (requires full stack)
docker-compose exec command-center npm run test:performance

# Load testing (requires full stack)
docker-compose exec command-center npm run test:load
```

**Local Mode (Limited - Syntax Only):**

```bash
# Code quality checks (syntax only)
npm run lint
npm run lint:fix
npm run format

# ⚠️ Security, performance, load tests require Docker mode
```

## 🏗️ Architecture

### Next.js 14 with Real-Time Production Architecture

Built for high-performance real-time operations with live Unit Talk production
integration:

```
app/
├── dashboard/               # Main dashboard
│   ├── overview/           # System overview
│   ├── agents/             # Agent management
│   ├── users/              # User administration
│   ├── analytics/          # Advanced analytics
│   └── settings/           # System configuration
├── api/                    # API routes
│   ├── agents/             # Agent control endpoints
│   ├── system/             # System management
│   ├── users/              # User management
│   └── websocket/          # Real-time WebSocket handlers
└── components/             # Reusable components
    ├── monitoring/         # Monitoring components
    ├── controls/           # Control interfaces
    └── charts/             # Data visualization
```

### Technology Stack

**Frontend Framework**:

- Next.js 14 with App Router
- React 18 with Concurrent Features
- TypeScript for comprehensive type safety
- Tailwind CSS with custom utilities

**v3.0.0 Production Integration**:

- Supabase real-time subscriptions to Unit Talk v3.0.0 unified database
- Live data streaming from `agent_health`, `agent_metrics`, `unified_picks`
  tables
- Direct integration with no compatibility layers or workarounds
- Redis caching for performance optimization
- Graceful fallback to polling when real-time unavailable

**Real-Time Communication**:

- Supabase real-time subscriptions for live data updates
- React Query for server state management and caching
- Toast notifications for instant user feedback
- Connection status monitoring with automatic reconnection
- Server-Sent Events (SSE) for production pipeline event streaming

**State Management**:

- Zustand for global application state
- React Query for server state synchronization
- WebSocket state management patterns
- Real-time data reconciliation

**Data Visualization**:

- D3.js for complex visualizations
- Recharts for standard charts
- Custom real-time chart components
- Interactive dashboard layouts

### Production Database Integration

**v3.0.0 Live Data Connections**:

```typescript
// Real agent monitoring from production
const { data: healthData } = await client
  .from('agent_health')
  .select('agent, status, details, created_at')
  .order('created_at', { ascending: false });

// v3.0.0 canonical pick management workflow
const { data: pickData } = await client
  .from('unified_picks') // ✅ CANONICAL TABLE (per Root CLAUDE.md)
  .select(
    `
    id, user_id, selection, odds, workflow_stage, confidence, self_score, professional_score,
    users!unified_picks_user_id_fkey (username, tier),
    props (sport, league, player_name, stat_type, line)
  `
  )
  .order('created_at', { ascending: false });
```

### Canonical UI Components (Charter v3.0)

**RealtimePickFeed Component** (`src/components/picks/RealtimePickFeed.tsx`):

Production-grade real-time pick monitoring with:

- **Live Updates**: WebSocket subscriptions + 5-second polling fallback
- **Advanced Filtering**: League, workflow stage, capper, date range filters
- **Workflow Tracking**: Visual badges for draft → pending_review → approved →
  published stages
- **Self-Score Display**: Shows both confidence and optional user
  self-assessment
- **Quick Actions**: Approve, reject, publish buttons based on current workflow
  stage
- **Performance**: 50-pick limit with optimistic updates and query invalidation

**Integration**:

```typescript
import { RealtimePickFeed } from '@/components/picks/RealtimePickFeed';

export function PicksDashboard() {
  return (
    <div className="space-y-6">
      <RealtimePickFeed />
    </div>
  );
}
```

**PickLifecycleControls Component**
(`src/components/picks/PickLifecycleControls.tsx`):

Production-grade workflow management for individual picks:

- **Workflow Timeline**: Visual progress indicator showing current stage
- **Available Actions**: Context-sensitive buttons for valid state transitions
- **Audit Trail**: Automatic audit_events logging for all workflow changes
- **Reason Requirement**: Mandatory notes for reject/unpublish actions
- **State Transitions**:
  - Draft → Pending Review (Submit for Review)
  - Pending Review → Approved (Approve)
  - Pending Review → Rejected (Reject, requires note)
  - Approved → Published (Publish)
  - Approved → Pending Review (Return to Review, requires note)
  - Published → Approved (Unpublish, requires note)

**Integration**:

````typescript
import { PickLifecycleControls } from '@/components/picks/PickLifecycleControls';

export function PickDetailPage({ pickId }: { pickId: string }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <PickDetailCard pickId={pickId} />
      <PickLifecycleControls pickId={pickId} />
    </div>
  );
}

**v3.0.0 Real-Time Subscriptions**:

```typescript
// Live agent health monitoring
subscriptions.subscribeToAgentHealth(payload => {
  // Update agent status in real-time
  const { agent, status, details } = payload.new;
  updateAgentStatus(agent, status, details);
});

// v3.0.0 unified pick approval workflow
subscriptions.subscribeToTable('unified_picks', payload => {
  // Instant UI updates when picks are approved/denied
  // Real-time workflow_stage changes (pending_review → approved)
  const { user_id, workflow_stage, selection } = payload.new;
  updatePickStatus(payload.new);

  // Show real capper names in real-time
  if (payload.eventType === 'INSERT') {
    toast.success(
      `New pick from ${payload.new.users?.username || 'Unknown Capper'}`
    );
  }
});
````

### System Monitoring Architecture

**Production Metrics Collection**:

```typescript
interface SystemMetrics {
  timestamp: number;
  agents: {
    [agentId: string]: {
      status: 'active' | 'inactive' | 'error';
      performance: PerformanceMetrics;
      health: HealthStatus;
    };
  };
  system: {
    cpu: number;
    memory: number;
    disk: number;
    network: NetworkMetrics;
  };
  business: {
    activeUsers: number;
    picksProcessed: number;
    alertsSent: number;
    revenue: number;
  };
}

export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    ws.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.type === 'system-metrics') {
        setMetrics(data.payload);
      }
    };

    return () => ws.close();
  }, []);

  return metrics;
}
```

## 💻 Development Guidelines

### 🚨 CRITICAL Development Rules

**MANDATORY WORKFLOW**: Never skip these steps when making changes:

**1. Pre-Change Database Sync** (⏳ Run to verify):

```bash
# Docker Mode (Recommended)
docker-compose exec command-center npm run db:status && npm run db:migrate

# Local Mode (Database operations require Docker)
⚠️ Database migrations must run in Docker
```

**2. Build Verification** (⏳ Run to verify):

```bash
# Docker Mode
docker-compose exec command-center npm run build 2>&1 | tee logs/cc-build-$(date +%Y%m%d).log

# Local Mode
npm run build 2>&1 | tee logs/cc-build-$(date +%Y%m%d).log
```

**3. Development Server Testing** (⏳ Run to verify):

```bash
# Docker Mode (Full Stack)
docker-compose up command-center
# Check logs: docker-compose logs -f command-center

# Local Mode (UI Only)
npm run dev
# ⚠️ Backend APIs will not work
```

**4. Playwright E2E Verification** (⏳ Run to verify):

```bash
# Docker Mode ONLY (requires full stack)
docker-compose exec command-center npm run test:e2e 2>&1 | tee logs/cc-e2e-$(date +%Y%m%d).log

# ⚠️ E2E tests cannot run in Local Mode
```

**5. Post-Change Validation**: Repeat steps 1-4 after completing changes

**Verification Status**: Run commands above to establish current build status
with timestamped evidence.

### Production Pipeline API Endpoints

**Event Stream Endpoints**:

- `GET /api/events` - Fetch pipeline events with filtering
- `GET /api/stream` - Server-Sent Events for real-time streaming
- `POST /api/replay` - Trigger event replay operations
- `DELETE /api/replay/:id` - Cancel ongoing replay operations

**Monitoring Endpoints**:

- `GET /api/monitoring/pipeline` - Complete pipeline metrics
- `GET /api/health` - Enhanced health checks with pipeline status
- `GET /api/exposure/snapshot` - Real-time exposure monitoring

**Control Endpoints**:

- `POST /api/admin/freeze` - Emergency pipeline freeze
- `POST /api/admin/safe-mode` - Activate safe mode operations

### Command Center Patterns

**Dashboard Components**:

```typescript
interface DashboardTileProps {
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  status?: 'healthy' | 'warning' | 'critical';
  onClick?: () => void;
}

export function DashboardTile({
  title,
  value,
  trend,
  status = 'healthy',
  onClick,
}: DashboardTileProps) {
  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  };

  return (
    <div
      className={cn(
        'p-6 rounded-lg border cursor-pointer transition-all',
        'hover:shadow-lg hover:scale-105',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className={cn('w-3 h-3 rounded-full', statusColors[status])} />
      </div>

      <div className="mt-2">
        <span className="text-3xl font-bold">{value}</span>
        {trend && (
          <TrendIndicator trend={trend} className="ml-2" />
        )}
      </div>
    </div>
  );
}
```

**Agent Control Interface**:

```typescript
interface AgentControlPanelProps {
  agents: Agent[];
  onStart: (agentId: string) => void;
  onStop: (agentId: string) => void;
  onRestart: (agentId: string) => void;
  onConfigure: (agentId: string) => void;
}

export function AgentControlPanel({
  agents,
  onStart,
  onStop,
  onRestart,
  onConfigure,
}: AgentControlPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Agent Control</h2>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            selected={selectedAgent === agent.id}
            onSelect={() => setSelectedAgent(agent.id)}
            onStart={() => onStart(agent.id)}
            onStop={() => onStop(agent.id)}
            onRestart={() => onRestart(agent.id)}
            onConfigure={() => onConfigure(agent.id)}
          />
        ))}
      </div>

      {selectedAgent && (
        <AgentDetailPanel
          agentId={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
```

### Real-Time Data Management

**WebSocket Integration**:

```typescript
class CommandCenterWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Command Center WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = event => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      console.log('Command Center WebSocket disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = error => {
      console.error('Command Center WebSocket error:', error);
    };
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'system-metrics':
        EventBus.emit('system-metrics', data.payload);
        break;
      case 'agent-status':
        EventBus.emit('agent-status', data.payload);
        break;
      case 'alert':
        EventBus.emit('system-alert', data.payload);
        break;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(
        () => {
          this.reconnectAttempts++;
          this.connect(process.env.NEXT_PUBLIC_WS_URL!);
        },
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
      );
    }
  }

  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }
}

export const commandCenterWS = new CommandCenterWebSocket();
```

**System Control Actions**:

```typescript
export function useSystemControls() {
  const queryClient = useQueryClient();

  const restartAgent = useMutation({
    mutationFn: (agentId: string) =>
      fetch(`/api/agents/${agentId}/restart`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent restarted successfully');
    },
    onError: error => {
      toast.error(`Failed to restart agent: ${error.message}`);
    },
  });

  const emergencyStop = useMutation({
    mutationFn: () => fetch('/api/system/emergency-stop', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Emergency stop activated');
    },
  });

  const updateSystemConfig = useMutation({
    mutationFn: (config: SystemConfig) =>
      fetch('/api/system/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      toast.success('System configuration updated');
    },
  });

  return {
    restartAgent,
    emergencyStop,
    updateSystemConfig,
  };
}
```

## 📊 Advanced Analytics Integration

### Custom Chart Components

```typescript
interface SystemPerformanceChartProps {
  data: SystemMetrics[];
  timeRange: '1h' | '24h' | '7d' | '30d';
  metric: 'cpu' | 'memory' | 'network' | 'business';
}

export function SystemPerformanceChart({
  data,
  timeRange,
  metric,
}: SystemPerformanceChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      timestamp: new Date(point.timestamp).toISOString(),
      value: point.system[metric],
    }));
  }, [data, metric]);

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => format(new Date(value), 'HH:mm')}
          />
          <YAxis />
          <Tooltip
            labelFormatter={(value) =>
              format(new Date(value), 'MMM dd, HH:mm')
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Interactive Dashboards

```typescript
export function InteractiveDashboard() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('cpu');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  const metrics = useSystemMetrics();
  const historicalData = useQuery({
    queryKey: ['system-metrics', timeRange],
    queryFn: () => fetchHistoricalMetrics(timeRange),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        selectedMetric={selectedMetric}
        onMetricChange={setSelectedMetric}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SystemPerformanceChart
            data={historicalData.data || []}
            timeRange={timeRange}
            metric={selectedMetric}
          />
        </div>

        <div className="space-y-4">
          <MetricsSummary metrics={metrics} />
          <AgentStatusSummary />
          <SystemAlerts />
        </div>
      </div>

      {drillDown && (
        <DrillDownPanel
          data={drillDown}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}
```

## 🔐 Security & Access Control

### Role-Based Access Control

```typescript
enum Permission {
  VIEW_DASHBOARD = 'view:dashboard',
  CONTROL_AGENTS = 'control:agents',
  MANAGE_USERS = 'manage:users',
  SYSTEM_CONFIG = 'system:config',
  EMERGENCY_CONTROLS = 'emergency:controls',
}

interface User {
  id: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: Permission[];
}

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = useCallback((permission: Permission) => {
    return user?.permissions.includes(permission) ?? false;
  }, [user]);

  const requiresPermission = useCallback((permission: Permission) => {
    if (!hasPermission(permission)) {
      throw new Error(`Insufficient permissions: ${permission}`);
    }
  }, [hasPermission]);

  return { hasPermission, requiresPermission };
}

// Usage in components
export function AgentControlPanel() {
  const { hasPermission } = usePermissions();

  if (!hasPermission(Permission.CONTROL_AGENTS)) {
    return <UnauthorizedMessage />;
  }

  return <AgentControls />;
}
```

### Audit Logging

```typescript
interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

export function useAuditLogger() {
  const logAction = useCallback(
    async (
      action: string,
      resource: string,
      metadata?: Record<string, any>
    ) => {
      const event: Omit<AuditEvent, 'id' | 'timestamp'> = {
        userId: getCurrentUserId(),
        action,
        resource,
        metadata: metadata || {},
        ipAddress: await getClientIP(),
        userAgent: navigator.userAgent,
      };

      await fetch('/api/audit/log', {
        method: 'POST',
        body: JSON.stringify(event),
      });
    },
    []
  );

  return { logAction };
}
```

## 🚨 Emergency Procedures

### System Emergency Controls

```typescript
export function EmergencyControlPanel() {
  const { requiresPermission } = usePermissions();
  const { emergencyStop, evacuateUsers, rollbackDeployment } = useEmergencyControls();

  const handleEmergencyStop = async () => {
    requiresPermission(Permission.EMERGENCY_CONTROLS);

    const confirmed = await confirmAction({
      title: 'Emergency System Stop',
      message: 'This will immediately stop all system operations. Continue?',
      confirmText: 'EMERGENCY STOP',
    });

    if (confirmed) {
      await emergencyStop.mutateAsync();
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-red-800 mb-4">
        Emergency Controls
      </h3>

      <div className="space-y-3">
        <Button
          variant="destructive"
          onClick={handleEmergencyStop}
          disabled={emergencyStop.isLoading}
        >
          {emergencyStop.isLoading ? 'Stopping...' : 'Emergency Stop'}
        </Button>

        <Button
          variant="outline"
          onClick={() => evacuateUsers.mutate()}
          disabled={evacuateUsers.isLoading}
        >
          Evacuate All Users
        </Button>

        <Button
          variant="outline"
          onClick={() => rollbackDeployment.mutate()}
          disabled={rollbackDeployment.isLoading}
        >
          Rollback Last Deployment
        </Button>
      </div>
    </div>
  );
}
```

## 🏆 Excellence Standards

**CRITICAL MANDATE**: Always deliver best-in-class results. No shortcuts. No
compromises.

**Quality Requirements**:

- **Real-Time Performance**: Sub-100ms response times for all controls
- **Reliability**: 99.99% uptime with automatic failover capabilities
- **Security**: Zero-trust architecture with comprehensive audit trails
- **Scalability**: Support for monitoring 1000+ concurrent operations
- **User Experience**: Intuitive controls with confirmation dialogs for
  destructive actions

**Implementation Philosophy** (Verification Required):

**Run these verification commands to establish current status:**

```bash
# 1. Database workflows
docker-compose exec command-center npm run db:status 2>&1 | tee logs/cc-db-status-$(date +%Y%m%d).log

# 2. Build verification
docker-compose exec command-center npm run build 2>&1 | tee logs/cc-build-$(date +%Y%m%d).log

# 3. Test verification
docker-compose exec command-center npm run test:e2e 2>&1 | tee logs/cc-e2e-$(date +%Y%m%d).log

# 4. TypeScript compilation
docker-compose exec command-center npm run type-check 2>&1 | tee logs/cc-typecheck-$(date +%Y%m%d).log
```

**Quality Standards:**

- **Database-First Development**: All schema changes via migrations (verify with
  db:status)
- **Build-First Deployment**: Clean builds required (verify with npm run build)
- **Test-First Verification**: E2E tests passing (verify with test:e2e)
- **TypeScript Excellence**: Zero compilation errors (verify with type-check)
- **Integration Excellence**: RBAC, telemetry, database integrations operational
- **Production Standards**: All critical fixes implemented

**Operational Requirements (Non-Negotiable):**

- Operational safety is paramount - all destructive actions require confirmation
- Real-time data must be accurate and consistent across all views
- Security controls cannot be bypassed under any circumstances
- System performance monitoring must be comprehensive and actionable
- Emergency procedures must be clearly defined and easily accessible

## 📚 Additional Resources

- **[System Architecture Documentation](../../docs/architecture/)** - Platform
  architecture
- **[Operational Procedures](../../docs/operations/)** - Standard operating
  procedures
- **[Security Protocols](../../docs/security/)** - Security and compliance
  documentation
- **[Emergency Procedures](../../docs/emergency/)** - Emergency response
  procedures

---

**Application Owner**: Platform Operations Team  
**Last Updated**: Current  
**Next Review**: Weekly operational review[byterover-mcp]

# important

always use byterover-retrive-knowledge tool to get the related context before
any tasks always use byterover-store-knowledge to store all the critical
informations after sucessful tasks
