import React from 'react';
import { 
  safeReadJson, 
  getArtifactMtime, 
  formatAgo, 
  type TemporalHealthArtifact 
} from '@/lib/artifacts';
import { StatusPill } from '@/components/StatusPill';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Server, Activity, Globe, Network } from 'lucide-react';

export default async function TemporalPage() {
  // Read Temporal health artifact
  const temporalHealth = await safeReadJson<TemporalHealthArtifact>('temporal-health.json');
  const lastChecked = await getArtifactMtime('temporal-health.json');
  
  // Determine states - support both old and new shapes
  const httpOk = temporalHealth?.httpOk ?? temporalHealth?.ok ?? false;
  const grpcOk = temporalHealth?.grpcOk ?? temporalHealth?.ok ?? false;
  
  // Overall health state
  let overallState: 'ok' | 'degraded' | 'down' = 'down';
  if (httpOk && grpcOk) {
    overallState = 'ok';
  } else if (httpOk || grpcOk) {
    overallState = 'degraded';
  }
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with overall status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Temporal Health</h1>
          <p className="text-muted-foreground mt-2">
            Monitor Temporal workflow system connectivity and performance
          </p>
        </div>
        <StatusPill 
          state={overallState} 
          label={overallState === 'ok' ? 'Operational' : overallState === 'degraded' ? 'Partial' : 'Offline'}
        />
      </div>

      {/* No data warning */}
      {!temporalHealth && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">No Temporal Health Data</CardTitle>
            <CardDescription className="text-amber-700">
              Run <code className="px-2 py-1 bg-amber-100 rounded">npm run ops:health</code> to generate health artifacts
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Connection Status Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* HTTP Connection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">HTTP Connection</CardTitle>
              </div>
              <StatusPill 
                state={httpOk ? 'ok' : 'down'} 
                label={httpOk ? 'Connected' : 'Disconnected'}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Web UI and HTTP API connectivity
            </p>
          </CardContent>
        </Card>

        {/* gRPC Connection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">gRPC Connection</CardTitle>
              </div>
              <StatusPill 
                state={grpcOk ? 'ok' : 'down'} 
                label={grpcOk ? 'Connected' : 'Disconnected'}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Workflow execution and worker connectivity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Server Details */}
      {temporalHealth && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Server Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Server Version */}
              {temporalHealth.serverVersion && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Version</p>
                  <p className="text-lg font-mono">{temporalHealth.serverVersion}</p>
                </div>
              )}
              
              {/* Namespace */}
              {temporalHealth.namespace && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Namespace</p>
                  <Badge variant="outline" className="mt-1">
                    {temporalHealth.namespace}
                  </Badge>
                </div>
              )}
              
              {/* Round Trip Time */}
              {temporalHealth.roundTripMs !== undefined && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Round Trip</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg font-mono">{temporalHealth.roundTripMs}ms</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Checked Footer */}
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Last checked: {formatAgo(lastChecked)}</span>
      </div>
    </div>
  );
}