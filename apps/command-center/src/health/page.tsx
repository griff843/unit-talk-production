import React from 'react';
import { 
  safeReadJson, 
  getArtifactMtime, 
  formatAgo,
  type HealthApiArtifact,
  type HealthWorkerArtifact,
  type DbPreflightArtifact,
  type TemporalHealthArtifact
} from '@/lib/artifacts';
import { StatusPill } from '@/components/StatusPill';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Database, 
  Server, 
  Workflow,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { TenantBadge } from '@/components/TenantBadge';
import { ProbeButton } from './ProbeButton';

interface HealthTile {
  title: string;
  icon: React.ReactNode;
  status: 'ok' | 'degraded' | 'down';
  details: string;
  lastChecked: Date | null;
  metrics?: Record<string, string | number>;
}

export default async function HealthPage() {
  // RBAC check
  const { tenant } = await requireAuth();

  // Read all health artifacts
  const [apiHealth, workerHealth, dbPreflight, temporalHealth] = await Promise.all([
    safeReadJson<HealthApiArtifact>('health-api.json'),
    safeReadJson<HealthWorkerArtifact>('health-worker.json'),
    safeReadJson<DbPreflightArtifact>('db-preflight.json'),
    safeReadJson<TemporalHealthArtifact>('temporal-health.json')
  ]);
  
  // Get modification times
  const [apiMtime, workerMtime, dbMtime, temporalMtime] = await Promise.all([
    getArtifactMtime('health-api.json'),
    getArtifactMtime('health-worker.json'),
    getArtifactMtime('db-preflight.json'),
    getArtifactMtime('temporal-health.json')
  ]);
  
  // Build health tiles
  const healthTiles: HealthTile[] = [
    {
      title: 'API Service',
      icon: <Server className="h-5 w-5" />,
      status: (apiHealth?.httpOk ?? apiHealth?.ok) ? 'ok' : 'down',
      details: (apiHealth?.httpOk ?? apiHealth?.ok) 
        ? `Version ${apiHealth?.version || 'unknown'}, Uptime: ${apiHealth?.uptime ? Math.floor(apiHealth.uptime / 3600) + 'h' : 'unknown'}`
        : 'API service is not responding',
      lastChecked: apiMtime,
      metrics: apiHealth ? {
        'Version': apiHealth.version || 'N/A',
        'Uptime': apiHealth.uptime ? `${Math.floor(apiHealth.uptime / 3600)}h` : 'N/A'
      } : undefined
    },
    {
      title: 'Worker Service',
      icon: <Activity className="h-5 w-5" />,
      status: workerHealth?.ok ? 'ok' : 'down',
      details: workerHealth?.ok
        ? `${workerHealth.workers?.length || 0} workers active`
        : 'Worker service is not responding',
      lastChecked: workerMtime,
      metrics: workerHealth ? {
        'Active Workers': workerHealth.workers?.length || 0,
        'Last Check': workerHealth.timestamp || 'N/A'
      } : undefined
    },
    {
      title: 'Database',
      icon: <Database className="h-5 w-5" />,
      status: dbPreflight?.ok ? 'ok' : 'down',
      details: dbPreflight?.ok
        ? `${dbPreflight.counts?.users || 0} users, ${dbPreflight.counts?.picks || 0} picks`
        : 'Database connection failed',
      lastChecked: dbMtime,
      metrics: dbPreflight?.counts ? {
        'Users': dbPreflight.counts.users || 0,
        'Picks': dbPreflight.counts.picks || 0,
        'Props': dbPreflight.counts.props || 0,
        'Version': dbPreflight.version || 'N/A'
      } : undefined
    },
    {
      title: 'Temporal',
      icon: <Workflow className="h-5 w-5" />,
      status: determineTemporalStatus(temporalHealth),
      details: formatTemporalDetails(temporalHealth),
      lastChecked: temporalMtime,
      metrics: temporalHealth ? {
        'HTTP': temporalHealth.httpOk ?? temporalHealth.ok ? 'Connected' : 'Down',
        'gRPC': temporalHealth.grpcOk ?? temporalHealth.ok ? 'Connected' : 'Down',
        'Version': temporalHealth.serverVersion || 'N/A',
        'Namespace': temporalHealth.namespace || 'default'
      } : undefined
    }
  ];
  
  // Calculate overall health
  const healthySystems = healthTiles.filter(t => t.status === 'ok').length;
  const degradedSystems = healthTiles.filter(t => t.status === 'degraded').length;
  const downSystems = healthTiles.filter(t => t.status === 'down').length;
  
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
  if (downSystems > 0) overallStatus = 'down';
  else if (degradedSystems > 0) overallStatus = 'degraded';
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with tenant badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground mt-2">
            Unified health monitoring for all platform services
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProbeButton />
          <TenantBadge tenant={tenant} />
          <StatusPill 
            state={overallStatus} 
            label={`${healthySystems}/${healthTiles.length} Healthy`}
          />
        </div>
      </div>

      {/* Overall Status Summary */}
      <Card className={overallStatus === 'ok' ? 'border-green-200' : overallStatus === 'degraded' ? 'border-yellow-200' : 'border-red-200'}>
        <CardHeader>
          <div className="flex items-center gap-2">
            {overallStatus === 'ok' ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : overallStatus === 'degraded' ? (
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <CardTitle>
              {overallStatus === 'ok' 
                ? 'All Systems Operational' 
                : overallStatus === 'degraded'
                ? 'Partial Service Degradation'
                : 'System Issues Detected'}
            </CardTitle>
          </div>
          <CardDescription>
            {healthySystems} healthy, {degradedSystems} degraded, {downSystems} down
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Health Tiles Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {healthTiles.map((tile) => (
          <Card key={tile.title}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tile.icon}
                  <CardTitle className="text-base">{tile.title}</CardTitle>
                </div>
                <StatusPill 
                  state={tile.status} 
                  label={tile.status === 'ok' ? 'Healthy' : tile.status === 'degraded' ? 'Degraded' : 'Down'}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{tile.details}</p>
              
              {/* Metrics */}
              {tile.metrics && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  {Object.entries(tile.metrics).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="text-muted-foreground">{key}:</span>{' '}
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Last Checked */}
              <div className="text-xs text-muted-foreground">
                Last checked: {formatAgo(tile.lastChecked)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Refresh Instructions */}
      <Card className="bg-muted/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Refresh Health Data</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            To update health artifacts, run the following command:
          </p>
          <code className="block p-3 bg-background rounded border font-mono text-sm">
            npm run ops:health
          </code>
          <p className="text-xs text-muted-foreground mt-3">
            This will execute all health probes and update the artifacts displayed on this page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function determineTemporalStatus(health: TemporalHealthArtifact | null): 'ok' | 'degraded' | 'down' {
  if (!health) return 'down';
  
  const httpOk = health.httpOk ?? health.ok ?? false;
  const grpcOk = health.grpcOk ?? health.ok ?? false;
  
  if (httpOk && grpcOk) return 'ok';
  if (httpOk || grpcOk) return 'degraded';
  return 'down';
}

function formatTemporalDetails(health: TemporalHealthArtifact | null): string {
  if (!health) return 'Temporal service is not responding';
  
  const httpOk = health.httpOk ?? health.ok ?? false;
  const grpcOk = health.grpcOk ?? health.ok ?? false;
  
  if (httpOk && grpcOk) {
    return `All connections healthy, ${health.roundTripMs || 'N/A'}ms latency`;
  }
  
  const issues = [];
  if (!httpOk) issues.push('HTTP down');
  if (!grpcOk) issues.push('gRPC down');
  
  return issues.join(', ');
}