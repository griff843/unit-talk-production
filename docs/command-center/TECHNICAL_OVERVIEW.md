# Command Center Technical Overview

**Engineering Implementation Guide**  
**Branch:** `cmd-center-toggles/2025-08-12`  
**Architecture:** Next.js 14 + Supabase + PostgreSQL

This document provides detailed technical specifications for the Command Center toggle system implementation, including code patterns, database design, and integration details.

## 🏗️ System Architecture

### High-Level Architecture

```mermaid
graph TB
    UI[Command Center UI] --> API[Next.js API Routes]
    API --> RBAC[RBAC Middleware]
    API --> SERVER[Server Utilities]
    SERVER --> DB[(PostgreSQL)]
    ALERT[Alertmanager] --> WEBHOOK[Webhook Endpoint]
    WEBHOOK --> SERVER
    DB --> AUDIT[Audit Trail]
    DB --> FLAGS[System Flags]
    DB --> INCIDENTS[Incident Management]
```

### Component Layers

**1. Frontend Layer (Next.js 14 App Router)**
- React components with TypeScript
- Real-time state management
- Optimistic UI updates
- Error boundary handling

**2. API Layer (Next.js Route Handlers)**
- RESTful endpoints with Zod validation
- RBAC middleware integration
- Comprehensive error handling
- Audit logging integration

**3. Business Logic Layer (Server Utilities)**
- System flag management functions
- Publishing enforcement helpers
- Database abstraction utilities
- Audit trail management

**4. Data Layer (PostgreSQL + Supabase)**
- Atomic database operations
- Row-level security policies
- Database functions for complex operations
- Comprehensive audit trail storage

## 📊 Database Schema Design

### Core Tables

#### `app_system_config`
```sql
CREATE TABLE app_system_config (
    key text PRIMARY KEY,                    -- Flag identifier (e.g., 'SAFE_MODE')
    value jsonb NOT NULL,                    -- Boolean flag value as JSON
    updated_at timestamptz DEFAULT now(),    -- Auto-updated timestamp
    updated_by text                          -- Actor who made the change
);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_app_system_config_updated_at
    BEFORE UPDATE ON app_system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### `app_audit_log`
```sql
CREATE TABLE app_audit_log (
    id BIGSERIAL PRIMARY KEY,               -- Unique audit entry ID
    occurred_at timestamptz DEFAULT now(),  -- Event timestamp
    actor text NOT NULL,                    -- User or system identifier
    action text NOT NULL,                   -- Action performed
    target text NOT NULL,                   -- Target of the action
    meta jsonb DEFAULT '{}',                -- Additional metadata
    user_id text,                           -- Supabase user ID
    ip_address text,                        -- Client IP address
    user_agent text                         -- Client user agent
);

-- Performance indexes
CREATE INDEX idx_app_audit_log_occurred_at ON app_audit_log(occurred_at DESC);
CREATE INDEX idx_app_audit_log_actor ON app_audit_log(actor);
CREATE INDEX idx_app_audit_log_action ON app_audit_log(action);
```

#### `app_incidents`
```sql
CREATE TABLE app_incidents (
    id BIGSERIAL PRIMARY KEY,
    title text NOT NULL,
    description text,
    severity text CHECK (severity IN ('warning', 'critical')),
    source text NOT NULL,                   -- 'alertmanager', 'manual', etc.
    status text DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at timestamptz DEFAULT now(),
    resolved_at timestamptz,
    resolution_notes text,
    meta jsonb DEFAULT '{}'                 -- Additional incident data
);

-- Performance indexes
CREATE INDEX idx_app_incidents_status ON app_incidents(status);
CREATE INDEX idx_app_incidents_severity ON app_incidents(severity);
CREATE INDEX idx_app_incidents_created_at ON app_incidents(created_at DESC);
```

### Database Functions

#### `get_system_flag(flag_key text) RETURNS boolean`
```sql
CREATE OR REPLACE FUNCTION get_system_flag(flag_key text)
RETURNS boolean AS $$
DECLARE
    flag_value boolean;
BEGIN
    SELECT (value)::boolean INTO flag_value
    FROM app_system_config
    WHERE key = flag_key;
    
    -- Return false if flag doesn't exist (safe default)
    IF flag_value IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN flag_value;
END;
$$ LANGUAGE plpgsql;
```

#### `set_system_flag(...) RETURNS BIGINT`
```sql
CREATE OR REPLACE FUNCTION set_system_flag(
    flag_key text,
    flag_value boolean,
    p_actor text,
    p_user_id text DEFAULT NULL,
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    old_value boolean;
    audit_id BIGINT;
BEGIN
    -- Get current value for audit trail
    SELECT get_system_flag(flag_key) INTO old_value;
    
    -- Update the flag (upsert)
    INSERT INTO app_system_config (key, value, updated_by)
    VALUES (flag_key, flag_value::jsonb, p_actor)
    ON CONFLICT (key) 
    DO UPDATE SET 
        value = flag_value::jsonb,
        updated_by = p_actor,
        updated_at = now();
    
    -- Write comprehensive audit log
    SELECT write_audit_log(
        p_actor,
        'system_flag_changed',
        flag_key,
        jsonb_build_object(
            'flag', flag_key,
            'old_value', old_value,
            'new_value', flag_value,
            'timestamp', now()
        ),
        p_user_id,
        p_ip_address,
        p_user_agent
    ) INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql;
```

#### `create_incident_auto_safemode(...) RETURNS BIGINT`
```sql
CREATE OR REPLACE FUNCTION create_incident_auto_safemode(
    p_title text,
    p_description text,
    p_severity text,
    p_source text,
    p_actor text DEFAULT 'alertmanager',
    p_meta jsonb DEFAULT '{}'
) RETURNS BIGINT AS $$
DECLARE
    incident_id BIGINT;
    audit_id BIGINT;
BEGIN
    -- Create incident record
    INSERT INTO app_incidents (title, description, severity, source, meta)
    VALUES (p_title, p_description, p_severity, p_source, p_meta)
    RETURNING id INTO incident_id;
    
    -- Auto-activate Safe Mode for critical incidents
    IF p_severity = 'critical' THEN
        SELECT set_system_flag(
            'SAFE_MODE',
            true,
            p_actor,
            NULL, NULL, NULL  -- System-triggered, no user context
        ) INTO audit_id;
        
        -- Log the auto-activation with incident context
        PERFORM write_audit_log(
            p_actor,
            'auto_safe_mode_activated',
            'SAFE_MODE',
            jsonb_build_object(
                'incident_id', incident_id,
                'reason', 'critical_alert_received',
                'title', p_title,
                'severity', p_severity
            )
        );
    END IF;
    
    RETURN incident_id;
END;
$$ LANGUAGE plpgsql;
```

## 🔧 Backend Implementation

### Server Utilities (`server/systemConfig.ts`)

#### Core Flag Management
```typescript
export type FlagKey = 'SAFE_MODE' | 'SYSTEM_FREEZE' | 'SHADOW_MODE' | 
                      'PUBLISH_TO_DISCORD' | 'PUBLISH_TO_NOTION';

export interface SystemFlags {
  SAFE_MODE: boolean;
  SYSTEM_FREEZE: boolean;
  SHADOW_MODE: boolean;
  PUBLISH_TO_DISCORD: boolean;
  PUBLISH_TO_NOTION: boolean;
}

// Atomic flag retrieval with safe defaults
export async function getSystemFlags(): Promise<SystemFlags> {
  const supabase = createServerClient();
  
  try {
    const { data, error } = await supabase
      .from('app_system_config')
      .select('key, value');

    if (error) {
      console.error('Failed to fetch system flags:', error);
      // Return safe defaults if database unavailable
      return {
        SAFE_MODE: true,      // Safe default: block operations
        SYSTEM_FREEZE: false,
        SHADOW_MODE: true,    // Safe default: prevent publishing
        PUBLISH_TO_DISCORD: false,
        PUBLISH_TO_NOTION: false,
      };
    }

    // Convert array to typed object with defaults
    const flags = data?.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {}) as SystemFlags;

    return {
      SAFE_MODE: flags?.SAFE_MODE ?? false,
      SYSTEM_FREEZE: flags?.SYSTEM_FREEZE ?? false,
      SHADOW_MODE: flags?.SHADOW_MODE ?? true,
      PUBLISH_TO_DISCORD: flags?.PUBLISH_TO_DISCORD ?? false,
      PUBLISH_TO_NOTION: flags?.PUBLISH_TO_NOTION ?? false,
    };
  } catch (error) {
    console.error('Error fetching system flags:', error);
    // Return safe defaults on any error
    return {
      SAFE_MODE: true,
      SYSTEM_FREEZE: false,
      SHADOW_MODE: true,
      PUBLISH_TO_DISCORD: false,
      PUBLISH_TO_NOTION: false,
    };
  }
}
```

#### Business Logic Enforcement Helpers
```typescript
// Promotion enforcement (deployment pipelines)
export async function isPromotionAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();
  return !flags.SAFE_MODE && !flags.SYSTEM_FREEZE;
}

// Ingestion control (data pipelines)
export async function isIngestionAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();
  return !flags.SYSTEM_FREEZE;
}

// Publishing enforcement with multi-flag validation
export async function isDiscordPublishingAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();
  return !flags.SAFE_MODE && 
         !flags.SYSTEM_FREEZE && 
         flags.PUBLISH_TO_DISCORD && 
         !flags.SHADOW_MODE;
}

export async function isNotionPublishingAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();
  return !flags.SAFE_MODE && 
         !flags.SYSTEM_FREEZE && 
         flags.PUBLISH_TO_NOTION && 
         !flags.SHADOW_MODE;
}
```

#### Atomic Flag Updates with Audit
```typescript
export async function setSystemFlag(
  key: FlagKey,
  value: boolean,
  actor: string,
  metadata?: {
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
  }
): Promise<{ success: boolean; audit_id?: number; error?: string }> {
  const supabase = createServerClient();
  
  try {
    // Use database function for atomic operation
    const { data, error } = await supabase.rpc('set_system_flag', {
      flag_key: key,
      flag_value: value,
      p_actor: actor,
      p_user_id: metadata?.user_id || null,
      p_ip_address: metadata?.ip_address || null,
      p_user_agent: metadata?.user_agent || null,
    });

    if (error) {
      console.error('Failed to set system flag:', error);
      return { success: false, error: error.message };
    }

    return { success: true, audit_id: data };
  } catch (error) {
    console.error('Error setting system flag:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
```

### RBAC Middleware (`app/api/_lib/rbac.ts`)

#### Role-Based Permission System
```typescript
export type UserRole = 'admin' | 'ops' | 'viewer';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

// Permission matrix - defines what each role can do
const PERMISSIONS = {
  admin: ['read', 'toggle', 'resolve', 'rollback', 'test', 'audit'],
  ops: ['read', 'toggle', 'resolve', 'audit'],
  viewer: ['read'],
} as const;

export function hasPermission(userRole: UserRole, action: string): boolean {
  return PERMISSIONS[userRole]?.includes(action) || false;
}
```

#### Authentication and Authorization Flow
```typescript
export async function requirePermission(
  request: NextRequest,
  requiredAction: string
): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
  
  // 1. Extract and validate user from Supabase session
  const { user, error } = await getUserRole(request);
  
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  // 2. Check role-based permissions
  if (!hasPermission(user.role, requiredAction)) {
    // 3. Log unauthorized access attempt with full context
    await writeAudit({
      actor: user.email,
      action: 'unauthorized_access_attempt',
      target: requiredAction,
      meta: {
        user_role: user.role,
        required_action: requiredAction,
        ip_address: request.headers.get('x-forwarded-for'),
        user_agent: request.headers.get('user-agent'),
      },
      user_id: user.id,
      ip_address: request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return { 
      success: false, 
      error: `Insufficient permissions - ${getRequiredRoleForAction(requiredAction)} role required` 
    };
  }

  return { success: true, user };
}
```

#### Automatic Audit Logging
```typescript
export async function auditApiAction(
  user: AuthenticatedUser,
  action: string,
  target: string,
  meta: Record<string, any> = {},
  request?: NextRequest
) {
  const clientMeta = request ? getClientMetadata(request) : {};
  
  return await writeAudit({
    actor: user.email,
    action,
    target,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
      user_role: user.role,
    },
    user_id: user.id,
    ...clientMeta,
  });
}
```

### API Route Implementation

#### System Configuration Endpoint (`/api/ops/system-config`)
```typescript
// GET - Retrieve all system flags
export async function GET(request: NextRequest) {
  try {
    // 1. Verify user has read permissions
    const { success, user, error } = await requirePermission(request, 'read');
    
    if (!success || !user) {
      return createUnauthorizedResponse(error || 'Authentication required', 401);
    }

    // 2. Fetch system flags with safe defaults
    const flags = await getSystemFlags();

    // 3. Log access for audit trail
    await auditApiAction(user, 'system_config_read', 'system_configuration', {}, request);

    return NextResponse.json(flags);
  } catch (error) {
    console.error('System config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Toggle system flags
export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request
    const body = await request.json();
    const { key, value } = ToggleRequestSchema.parse(body);

    // 2. Determine required permission level
    let requiredAction = 'toggle';
    if (['SYSTEM_FREEZE'].includes(key)) {
      requiredAction = 'rollback'; // Admin-only for critical flags
    }

    // 3. Verify permissions
    const { success, user, error } = await requirePermission(request, requiredAction);
    
    if (!success || !user) {
      return createUnauthorizedResponse(error || 'Authentication required', 403);
    }

    // 4. Extract client metadata for audit
    const clientMeta = getClientMetadata(request);

    // 5. Atomically update flag with audit logging
    const result = await setSystemFlag(key as FlagKey, value, user.email, {
      user_id: user.id,
      ...clientMeta,
    });

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to update system flag' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      key, 
      value,
      audit_id: result.audit_id,
      message: `${key.replace('_', ' ')} ${value ? 'enabled' : 'disabled'}`,
    });

  } catch (error) {
    console.error('System config toggle error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request format',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Health Monitoring Implementation

#### Health Tiles Endpoint (`/api/ops/health/tiles`)
```typescript
interface HealthTiles {
  feedFreshnessSeconds: number;
  temporalBacklogAgeSeconds: number;
  canaryLastSeenAt: string | null;
  failureBurnRateLevel: 'green' | 'yellow' | 'red';
  providerCreditsPerMin: number;
  percentOfDailyBudget: number;
  dlqCount: number;
}

// Calculate feed freshness from multiple sources
async function getFeedFreshness(supabase: any): Promise<number> {
  try {
    // Primary: Check agent health heartbeat
    const { data, error } = await supabase
      .from('agent_health')
      .select('last_heartbeat')
      .eq('agent_name', 'feed_agent')
      .order('last_heartbeat', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      // Fallback: Check raw props ingestion timestamp
      const { data: propsData, error: propsError } = await supabase
        .from('raw_props')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (propsError || !propsData || propsData.length === 0) {
        return 3600; // Default 1 hour if no data available
      }

      const lastIngest = new Date(propsData[0].created_at);
      return Math.floor((Date.now() - lastIngest.getTime()) / 1000);
    }

    const lastHeartbeat = new Date(data[0].last_heartbeat);
    return Math.floor((Date.now() - lastHeartbeat.getTime()) / 1000);
  } catch (error) {
    console.error('Error calculating feed freshness:', error);
    return 3600; // Safe default
  }
}

// Calculate Temporal workflow backlog age
async function getTemporalBacklogAge(supabase: any): Promise<number> {
  try {
    // Find oldest ungraded pick as proxy for workflow backlog
    const { data, error } = await supabase
      .from('unified_picks')
      .select('created_at')
      .is('graded_at', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 0; // No backlog
    }

    const oldestUngraded = new Date(data[0].created_at);
    return Math.floor((Date.now() - oldestUngraded.getTime()) / 1000);
  } catch (error) {
    console.error('Error calculating Temporal backlog age:', error);
    return 300; // Default 5 minutes
  }
}
```

### Alertmanager Integration

#### Webhook Handler (`/api/alerts/alertmanager`)
```typescript
// Critical alert detection logic
function shouldTriggerSafeMode(alert: any): boolean {
  const { labels, annotations } = alert;
  
  const criticalConditions = [
    // High error rates
    labels.alertname === 'HighErrorRate' && parseFloat(labels.error_rate || '0') > 0.1,
    
    // Infrastructure failures
    labels.alertname === 'DatabaseDown',
    labels.alertname === 'ServiceDown' && labels.service === 'api',
    labels.alertname === 'TemporalDown',
    
    // Resource exhaustion
    labels.alertname === 'HighMemoryUsage' && parseFloat(labels.usage || '0') > 90,
    labels.alertname === 'HighCPUUsage' && parseFloat(labels.usage || '0') > 95,
    
    // Data integrity issues
    labels.alertname === 'DataCorruption',
    labels.alertname === 'PickValidationFailure',
    
    // Explicit triggers
    labels.severity === 'critical',
    annotations.safe_mode === 'true',
  ];

  return criticalConditions.some(condition => condition);
}

// Incident creation with auto-Safe Mode
async function createIncidentFromAlert(alert: any): Promise<number | null> {
  try {
    const { labels, annotations, status } = alert;
    
    const severity: 'warning' | 'critical' = 
      (labels.severity === 'critical' || shouldTriggerSafeMode(alert)) ? 'critical' : 'warning';

    // Use database function for atomic incident creation + Safe Mode activation
    const result = await createIncidentAutoSafeMode({
      title: annotations.summary || labels.alertname || 'Unknown Alert',
      description: annotations.description || `Alert: ${labels.alertname}`,
      severity,
      source: 'alertmanager',
      actor: 'system/alertmanager',
      meta: {
        alert_name: labels.alertname,
        labels,
        annotations,
        alert_status: status,
        starts_at: alert.startsAt,
        ends_at: alert.endsAt,
        generator_url: alert.generatorURL,
        fingerprint: alert.fingerprint,
        received_at: new Date().toISOString(),
      },
    });

    return result.incident_id || null;
  } catch (error) {
    console.error('Error creating incident from alert:', error);
    return null;
  }
}
```

## 🎨 Frontend Implementation

### Component Architecture

#### Safety Toggles Component
```typescript
const SafetyToggles = ({ config, onToggle, loading }: {
  config: SystemFlags | null;
  onToggle: (key: keyof SystemFlags, value: boolean) => void;
  loading: boolean;
}) => {
  const toggles = [
    { 
      key: 'SAFE_MODE' as keyof SystemFlags, 
      label: 'Safe Mode', 
      description: 'Blocks all promotions and external publishing',
      icon: Shield,
      variant: 'destructive' as const,
    },
    { 
      key: 'SYSTEM_FREEZE' as keyof SystemFlags, 
      label: 'System Freeze', 
      description: 'Halts all ingestion and workflow schedules',
      icon: StopCircle,
      variant: 'destructive' as const,
    },
    // ... additional toggles
  ];

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Safety Toggles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {toggles.map(({ key, label, description, icon: Icon, variant }) => (
          <div key={key} className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center space-x-3">
              <Icon className="w-5 h-5" />
              <div>
                <div className="flex items-center space-x-2">
                  <p className="font-medium">{label}</p>
                  <Badge variant={config?.[key] ? variant : 'outline'}>
                    {config?.[key] ? 'ON' : 'OFF'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              checked={config?.[key] || false}
              onCheckedChange={(checked) => onToggle(key, checked)}
              disabled={loading}
              data-testid={`toggle-${key}`}  // E2E test compatibility
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
```

#### Health Tiles Component
```typescript
const HealthTilesCard = ({ tiles }: { tiles: HealthTiles | null }) => {
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const getStatusColor = (level: string) => {
    switch (level) {
      case 'green': return 'text-green-600 bg-green-100';
      case 'yellow': return 'text-yellow-600 bg-yellow-100';
      case 'red': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const healthMetrics = [
    {
      label: 'Feed Freshness',
      value: formatDuration(tiles.feedFreshnessSeconds),
      status: tiles.feedFreshnessSeconds < 300 ? 'green' : 
              tiles.feedFreshnessSeconds < 900 ? 'yellow' : 'red',
      icon: Clock,
    },
    // ... additional metrics
  ];

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {healthMetrics.map(({ label, value, status, icon: Icon }) => (
            <div 
              key={label} 
              className="text-center p-3 rounded-lg border"
              data-testid={`health-tile-${label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon className="w-6 h-6 mx-auto mb-2" />
              <div 
                className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}
                data-testid="tile-value"
              >
                {value}
              </div>
              <div 
                className={`w-2 h-2 rounded-full mx-auto mt-2 ${
                  status === 'green' ? 'bg-green-500' : 
                  status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                data-testid="status-indicator"
              />
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
```

#### State Management and API Integration
```typescript
export default function CommandCenterPage() {
  const [config, setConfig] = useState<SystemFlags | null>(null);
  const [healthTiles, setHealthTiles] = useState<HealthTiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const { toast } = useToast();

  // Parallel data fetching with error handling
  const fetchData = async () => {
    try {
      const [configResponse, healthResponse] = await Promise.all([
        fetch('/api/ops/system-config'),
        fetch('/api/ops/health/tiles'),
      ]);

      if (configResponse.ok) {
        setConfig(await configResponse.json());
      }

      if (healthResponse.ok) {
        setHealthTiles(await healthResponse.json());
      }

    } catch (error) {
      console.error('Error fetching Command Center data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Command Center data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Optimistic updates with rollback on error
  const handleToggle = async (key: keyof SystemFlags, value: boolean) => {
    setToggleLoading(true);
    
    // Optimistic update
    const previousConfig = config;
    setConfig(prev => prev ? { ...prev, [key]: value } : null);
    
    try {
      const response = await fetch('/api/ops/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: 'Success',
          description: `${key.replace('_', ' ')} ${value ? 'enabled' : 'disabled'}`,
        });

        // Log audit information for debugging
        if (result.audit_id) {
          console.log('Flag change audited:', result.audit_id);
        }
      } else {
        // Rollback optimistic update on error
        setConfig(previousConfig);
        
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update configuration',
          variant: 'destructive',
        });
      }
    } catch (error) {
      // Rollback optimistic update on network error
      setConfig(previousConfig);
      
      console.error('Error toggling system config:', error);
      toast({
        title: 'Error',
        description: 'Failed to update configuration',
        variant: 'destructive',
      });
    } finally {
      setToggleLoading(false);
    }
  };

  // Initial data load and periodic refresh
  useEffect(() => {
    fetchData();
    
    // Refresh health data every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <SafetyToggles config={config} onToggle={handleToggle} loading={toggleLoading} />
      <HealthTilesCard tiles={healthTiles} />
      {/* Additional components */}
    </div>
  );
}
```

## 🧪 Testing Strategy

### E2E Test Architecture

#### Test Structure
```
tests/e2e/
├── command-center.spec.ts          # Main functionality tests
├── rbac-enforcement.spec.ts        # Role-based access control
├── system-flags-enforcement.spec.ts # Backend enforcement
├── test-helpers.ts                 # Shared utilities
├── global-setup.ts                 # Test environment setup
├── global-teardown.ts              # Cleanup procedures
└── playwright.config.ts            # Test configuration
```

#### Test Helper Functions
```typescript
// Authentication mocking for different roles
export async function authenticateAs(page: Page, role: 'admin' | 'ops' | 'viewer') {
  await page.route('**/api/ops/**', async (route) => {
    // Mock authentication header
    const headers = {
      ...route.request().headers(),
      'x-user-role': role,
      'x-user-id': `test-${role}-user`,
      'x-user-email': `${role}@test.com`,
    };
    
    await route.continue({ headers });
  });
}

// System config API mocking
export async function mockSystemConfigAPI(page: Page, config: Partial<SystemFlags>) {
  await page.route('**/api/ops/system-config', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          SAFE_MODE: false,
          SYSTEM_FREEZE: false,
          SHADOW_MODE: true,
          PUBLISH_TO_DISCORD: false,
          PUBLISH_TO_NOTION: false,
          ...config,
        }),
      });
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          key: body.key,
          value: body.value,
          audit_id: Math.floor(Math.random() * 1000),
          message: `${body.key} ${body.value ? 'enabled' : 'disabled'}`,
        }),
      });
    }
  });
}

// Toggle interaction helpers
export async function clickToggleAndWait(page: Page, toggleKey: string) {
  const toggle = page.getByTestId(`toggle-${toggleKey}`);
  await toggle.click();
  
  // Wait for API call to complete
  await page.waitForResponse(response => 
    response.url().includes('/api/ops/system-config') && 
    response.request().method() === 'POST'
  );
}

export async function assertToggleState(page: Page, toggleKey: string, expectedState: boolean) {
  const toggle = page.getByTestId(`toggle-${toggleKey}`);
  const isChecked = await toggle.isChecked();
  expect(isChecked).toBe(expectedState);
}
```

#### Comprehensive Test Coverage
```typescript
test.describe('Command Center Safety Toggles', () => {
  test('should display all 5 safety toggles with correct labels', async ({ page }) => {
    await authenticateAs(page, 'admin');
    await mockSystemConfigAPI(page, {});
    
    await page.goto('/command-center');
    
    // Verify all toggles are present
    const expectedToggles = ['SAFE_MODE', 'SYSTEM_FREEZE', 'SHADOW_MODE', 'PUBLISH_TO_DISCORD', 'PUBLISH_TO_NOTION'];
    
    for (const toggle of expectedToggles) {
      await expect(page.getByTestId(`toggle-${toggle}`)).toBeVisible();
    }
  });

  test('should successfully toggle Safe Mode with admin permissions', async ({ page }) => {
    await authenticateAs(page, 'admin');
    await mockSystemConfigAPI(page, { SAFE_MODE: false });
    
    await page.goto('/command-center');
    
    // Initially OFF
    await assertToggleState(page, 'SAFE_MODE', false);
    
    // Toggle ON
    await clickToggleAndWait(page, 'SAFE_MODE');
    
    // Verify success toast
    await expect(page.getByText('Safe Mode enabled')).toBeVisible();
  });

  test('should block System Freeze toggle for non-admin users', async ({ page }) => {
    await authenticateAs(page, 'ops');
    
    // Mock API to return 403 for SYSTEM_FREEZE toggle
    await page.route('**/api/ops/system-config', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        if (body.key === 'SYSTEM_FREEZE') {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Insufficient permissions - Admin role required',
            }),
          });
          return;
        }
      }
      await route.continue();
    });
    
    await page.goto('/command-center');
    
    await clickToggleAndWait(page, 'SYSTEM_FREEZE');
    
    // Verify error toast
    await expect(page.getByText('Insufficient permissions')).toBeVisible();
  });
});
```

### Performance Testing

#### Load Testing Configuration
```typescript
// Performance budget configuration
const PERFORMANCE_BUDGETS = {
  pageLoad: 3000,        // 3 second page load
  apiResponse: 200,      // 200ms API response
  toggleOperation: 500,  // 500ms toggle operation
  healthTileUpdate: 1000, // 1 second health refresh
};

test('should meet performance budgets', async ({ page }) => {
  await authenticateAs(page, 'admin');
  
  const startTime = Date.now();
  await page.goto('/command-center');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;
  
  expect(loadTime).toBeLessThan(PERFORMANCE_BUDGETS.pageLoad);
  
  // Test toggle performance
  const toggleStart = Date.now();
  await clickToggleAndWait(page, 'SAFE_MODE');
  const toggleTime = Date.now() - toggleStart;
  
  expect(toggleTime).toBeLessThan(PERFORMANCE_BUDGETS.toggleOperation);
});
```

## 🚀 Deployment Configuration

### CI/CD Pipeline (`.github/workflows/cc-e2e.yml`)

#### Quality Gates
```yaml
quality-gate:
  runs-on: ubuntu-latest
  needs: e2e-tests
  if: always()
  
  steps:
    - name: Check E2E test results
      run: |
        if [[ "${{ needs.e2e-tests.result }}" != "success" ]]; then
          echo "❌ E2E tests failed - blocking merge"
          exit 1
        else
          echo "✅ All E2E tests passed - ready for merge"
        fi
```

#### Test Environment Setup
```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Setup database
    run: npm run db:migrate
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres

  - name: Run E2E tests
    run: npm run test:e2e
    env:
      CI: true
      NEXT_PUBLIC_APP_URL: http://localhost:3015
```

### Production Deployment Checklist

**Pre-deployment:**
- [ ] Database migration applied successfully
- [ ] E2E tests passing in CI/CD
- [ ] Performance validation complete
- [ ] Security review completed
- [ ] RBAC permissions validated

**Deployment:**
- [ ] Deploy database migration
- [ ] Deploy backend API changes
- [ ] Deploy frontend updates
- [ ] Validate health tiles show correct data
- [ ] Test toggle functionality with appropriate roles
- [ ] Verify Alertmanager webhook integration

**Post-deployment:**
- [ ] Monitor system flag operations
- [ ] Verify audit trail capture
- [ ] Test critical alert auto-incident creation
- [ ] Validate backend enforcement in publishers
- [ ] Monitor performance metrics

---

**Document Maintainer:** Engineering Team  
**Architecture Version:** 1.0.0  
**Last Technical Review:** Implementation Date  
**Next Architecture Review:** Quarterly