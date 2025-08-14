'use client';

import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Zap,
  Database,
  Heart,
  Clock,
  Wifi,
  TrendingUp,
  Activity,
  RefreshCw,
  Settings,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pause,
  Play,
  StopCircle,
  Inbox,
  Send
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { OutboxPanel } from '@/components/outbox/OutboxPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useHealthTiles, useHealthTileStatus, useFormattedHealthTiles, getHealthStatusColor, getHealthTooltips } from '@/lib/hooks/useHealthTiles';

// Types for system configuration
interface SystemConfig {
  SAFE_MODE: boolean;
  SYSTEM_FREEZE: boolean;
  SHADOW_MODE: boolean;
  PUBLISH_TO_DISCORD: boolean;
  PUBLISH_TO_NOTION: boolean;
}

// Remove the old HealthTiles interface - now using CanonicalHealthTiles from the hook

interface Incident {
  id: number;
  severity: 'warning' | 'critical';
  source: string;
  title: string;
  created_at: string;
  resolved_at: string | null;
}

interface FinalImmutabilityCheck {
  overall_status: 'healthy' | 'warning' | 'critical';
  health_score: number;
  violations: {
    last_24_hours: number;
  };
}

interface ShadowDiff {
  shadow_mode_active: boolean;
  would_publish: {
    total_picks: number;
    discord_picks: number;
    notion_picks: number;
  };
}

const SafetyToggles = ({ config, onToggle, loading, disabled }: {
  config: SystemConfig | null;
  onToggle: (key: keyof SystemConfig, value: boolean) => void;
  loading: boolean;
  disabled?: boolean;
}) => {
  const toggles = [
    { 
      key: 'SAFE_MODE' as keyof SystemConfig, 
      label: 'Safe Mode', 
      description: 'Blocks all promotions and external publishing',
      icon: Shield,
      variant: 'destructive' as const,
    },
    { 
      key: 'SYSTEM_FREEZE' as keyof SystemConfig, 
      label: 'System Freeze', 
      description: 'Halts all ingestion and workflow schedules',
      icon: StopCircle,
      variant: 'destructive' as const,
    },
    { 
      key: 'SHADOW_MODE' as keyof SystemConfig, 
      label: 'Shadow Mode', 
      description: 'Grading runs but publishing is suppressed',
      icon: Eye,
      variant: 'secondary' as const,
    },
    { 
      key: 'PUBLISH_TO_DISCORD' as keyof SystemConfig, 
      label: 'Discord Publishing', 
      description: 'Allow publishing picks to Discord channels',
      icon: Wifi,
      variant: 'default' as const,
    },
    { 
      key: 'PUBLISH_TO_NOTION' as keyof SystemConfig, 
      label: 'Notion Publishing', 
      description: 'Allow publishing picks to Notion workspace',
      icon: Database,
      variant: 'default' as const,
    },
  ];

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Safety Toggles
        </CardTitle>
        <CardDescription>
          Control system-wide safety and publishing settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {toggles.map(({ key, label, description, icon: Icon, variant }) => (
          <div key={key} className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
            <div className="flex items-center space-x-3">
              <Icon className="w-5 h-5 text-muted-foreground" />
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
              disabled={loading || disabled}
              data-testid={`toggle-${key}`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const HealthTilesCard = () => {
  const { data: tiles, isLoading, error } = useHealthTiles();
  const tileStatus = useHealthTileStatus(tiles);
  const formattedTiles = useFormattedHealthTiles(tiles);
  const tooltips = getHealthTooltips();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            SLO & Burn Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mr-2" />
            <span className="text-muted-foreground">Loading health data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            SLO & Burn Rate
            <Badge variant="outline" className="ml-2">Error</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Failed to load health data
          </div>
        </CardContent>
      </Card>
    );
  }

  const healthMetrics = [
    {
      label: 'Feed Freshness',
      value: formattedTiles.feedFreshness,
      status: tileStatus.feedStatus,
      icon: Clock,
      tooltip: tooltips.feedFreshness,
    },
    {
      label: 'Temporal Backlog',
      value: formattedTiles.backlogAge,
      status: tileStatus.backlogStatus,
      icon: Activity,
      tooltip: tooltips.backlogAge,
    },
    {
      label: 'Canary Status', 
      value: tiles?.canaryLastSeenAt ? formattedTiles.canaryAge : 'Inactive',
      status: tileStatus.canaryStatus,
      icon: Heart,
      tooltip: tooltips.canary,
    },
    {
      label: 'Failure Rate',
      value: formattedTiles.burnRate,
      status: tileStatus.burnRateStatus,
      icon: TrendingUp,
      tooltip: tooltips.burnRate,
    },
    {
      label: 'Provider Spend',
      value: `${formattedTiles.creditsPerMin}/min`,
      status: tileStatus.providerStatus,
      icon: Zap,
      subtitle: formattedTiles.budgetPercent,
      tooltip: tooltips.provider,
    },
    {
      label: 'DLQ Count',
      value: formattedTiles.dlqCount,
      status: tileStatus.dlqStatus,
      icon: AlertTriangle,
      tooltip: tooltips.dlq,
    },
    {
      label: 'Outbox Pending',
      value: tiles?.outboxPendingCount?.toString() || '0',
      status: (tiles?.outboxPendingCount || 0) > 100 ? 'critical' : 
              (tiles?.outboxPendingCount || 0) > 10 ? 'warning' : 'healthy',
      icon: Inbox,
      tooltip: 'Number of events waiting to be delivered to external systems',
    },
    {
      label: 'Outbox Failed',
      value: tiles?.outboxFailedCount?.toString() || '0',
      status: (tiles?.outboxFailedCount || 0) > 50 ? 'critical' : 
              (tiles?.outboxFailedCount || 0) > 5 ? 'warning' : 'healthy',
      icon: Send,
      tooltip: 'Number of events that failed delivery and need retry or investigation',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          SLO & Burn Rate
          {tiles?.source && (
            <Badge 
              variant={tiles.source === 'live' ? 'default' : 'outline'} 
              className="ml-2"
              title={tooltips.source}
            >
              {tiles.source === 'live' ? 'Live Data' : 'Fallback Data'}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Real-time system health and performance indicators
          {tiles?.timestamp && (
            <span className="block text-xs mt-1">
              Last updated: {new Date(tiles.timestamp).toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {healthMetrics.map(({ label, value, status, icon: Icon, subtitle, tooltip }) => (
            <div 
              key={label}
              className="text-center p-3 rounded-lg border"
              data-testid={`health-tile-${label.toLowerCase().replace(/\s+/g, '-')}`}
              title={tooltip}
            >
              <Icon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <div 
                className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${getHealthStatusColor(status as any)}`}
                data-testid="tile-value"
              >
                {value}
              </div>
              <div 
                className={`w-2 h-2 rounded-full mx-auto mt-2 ${getHealthStatusColor(status as any).includes('green') ? 'bg-green-500' : getHealthStatusColor(status as any).includes('yellow') ? 'bg-yellow-500' : 'bg-red-500'}`}
                data-testid="status-indicator"
              />
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const IncidentsCard = ({ incidents }: { incidents: Incident[] | null }) => {
  if (!incidents) return null;

  const recentIncidents = incidents.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          Recent Incidents
        </CardTitle>
        <CardDescription>
          Latest system incidents and alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentIncidents.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground">No recent incidents</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentIncidents.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-3">
                  {incident.severity === 'critical' ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{incident.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(incident.created_at).toLocaleString()} • {incident.source}
                    </p>
                  </div>
                </div>
                <Badge variant={incident.resolved_at ? 'default' : 'destructive'}>
                  {incident.resolved_at ? 'Resolved' : 'Active'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const DataTrustCard = ({ immutability, shadowDiff }: {
  immutability: FinalImmutabilityCheck | null;
  shadowDiff: ShadowDiff | null;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          Data Trust Widgets
        </CardTitle>
        <CardDescription>
          Data integrity and shadow mode analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Final Immutability Check */}
        <div 
          className="p-4 rounded-lg border bg-muted/20"
          data-testid="immutability-check-widget"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Final Pick Immutability</h4>
            {immutability && (
              <Badge 
                variant={
                  immutability.overall_status === 'healthy' ? 'default' :
                  immutability.overall_status === 'warning' ? 'secondary' : 'destructive'
                }
                data-testid="check-status"
              >
                {immutability.overall_status}
              </Badge>
            )}
          </div>
          {immutability ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Health Score</span>
                <span className="font-medium">{immutability.health_score}/100</span>
              </div>
              <Progress value={immutability.health_score} />
              <p className="text-xs text-muted-foreground">
                {immutability.violations.last_24_hours} violations in last 24h (should be 0)
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                data-testid="run-immutability-check"
              >
                Run Check
              </Button>
            </div>
          ) : (
            <div data-testid="check-loading">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          )}
        </div>

        {/* Shadow vs Live Diff */}
        <div 
          className="p-4 rounded-lg border bg-muted/20"
          data-testid="shadow-diff-widget"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Shadow vs Live Diff</h4>
            {shadowDiff && (
              <Badge variant={shadowDiff.shadow_mode_active ? 'secondary' : 'default'}>
                {shadowDiff.shadow_mode_active ? 'Shadow Active' : 'Live Mode'}
              </Badge>
            )}
          </div>
          {shadowDiff ? (
            <div className="space-y-2" data-testid="diff-metrics">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <div className="font-medium">{shadowDiff.would_publish.total_picks}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{shadowDiff.would_publish.discord_picks}</div>
                  <div className="text-xs text-muted-foreground">Discord</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{shadowDiff.would_publish.notion_picks}</div>
                  <div className="text-xs text-muted-foreground">Notion</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Items that would publish if shadow mode disabled
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function CommandCenterPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [immutability, setImmutability] = useState<FinalImmutabilityCheck | null>(null);
  const [shadowDiff, setShadowDiff] = useState<ShadowDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setConfigError(null);
    
    try {
      // Fetch data in parallel (excluding health tiles - now handled by useHealthTiles hook)
      const [
        configResponse,
        incidentsResponse,
        immutabilityResponse,
        shadowDiffResponse,
      ] = await Promise.all([
        fetch('/api/ops/system-config'),
        fetch('/api/ops/incidents?limit=20'),
        fetch('/api/ops/trust/final-immutability'),
        fetch('/api/ops/trust/shadow-diff'),
      ]);

      // Handle configuration response, including 501 Not Configured
      if (configResponse.ok) {
        setConfig(await configResponse.json());
      } else if (configResponse.status === 501) {
        const errorData = await configResponse.json();
        setConfigError(errorData.message || 'System not configured properly');
      } else {
        console.error('Config response error:', configResponse.status);
      }

      if (incidentsResponse.ok) {
        const incidentsData = await incidentsResponse.json();
        setIncidents(incidentsData.incidents || []);
      }

      if (immutabilityResponse.ok) {
        setImmutability(await immutabilityResponse.json());
      }

      if (shadowDiffResponse.ok) {
        setShadowDiff(await shadowDiffResponse.json());
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

  const handleToggle = async (key: keyof SystemConfig, value: boolean) => {
    if (configError) {
      toast({
        title: 'Configuration Error',
        description: 'Cannot modify settings while system is not properly configured',
        variant: 'destructive',
      });
      return;
    }

    setToggleLoading(true);
    try {
      const response = await fetch('/api/ops/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (response.ok) {
        const result = await response.json();
        setConfig(prev => prev ? { ...prev, [key]: value } : null);
        
        toast({
          title: 'Success',
          description: `${key.replace('_', ' ')} ${value ? 'enabled' : 'disabled'}`,
        });

        // Show audit ID in console for debugging
        if (result.audit_logged) {
          console.log('Config change logged to audit trail');
        }
      } else if (response.status === 501) {
        const errorData = await response.json();
        setConfigError(errorData.message || 'System not configured properly');
        toast({
          title: 'Configuration Required',
          description: 'System configuration is incomplete',
          variant: 'destructive',
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update configuration',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error toggling config:', error);
      toast({
        title: 'Error',
        description: 'Failed to update configuration',
        variant: 'destructive',
      });
    } finally {
      setToggleLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh data every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw 
            className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" 
            data-testid="loading-spinner"
          />
          <p className="text-sm text-muted-foreground">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="command-center-dashboard" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Command Center</h1>
          <p className="text-muted-foreground">
            System operations, safety controls, and real-time monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button data-testid="refresh-dashboard-button" variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button data-testid="settings-button" variant="outline" size="sm" asChild>
            <a href="/command-center/incidents">
              <Users className="w-4 h-4 mr-2" />
              View All Incidents
            </a>
          </Button>
        </div>
      </div>

      {/* Configuration Error Alert */}
      {configError && (
        <Alert className="border-orange-200 bg-orange-50" data-testid="config-error-banner">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>System Configuration Required</strong> - {configError}
          </AlertDescription>
        </Alert>
      )}

      {/* System Status Alert */}
      {config?.SAFE_MODE && (
        <Alert className="border-red-200 bg-red-50">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Safe Mode is Active</strong> - All promotions and external publishing are blocked.
          </AlertDescription>
        </Alert>
      )}

      {config?.SYSTEM_FREEZE && (
        <Alert className="border-red-200 bg-red-50">
          <StopCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>System Freeze is Active</strong> - All ingestion and workflow schedules are halted.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Safety Toggles */}
        <SafetyToggles 
          config={config} 
          onToggle={handleToggle} 
          loading={toggleLoading}
          disabled={!!configError}
        />

        {/* Health Tiles */}
        <HealthTilesCard />

        {/* Outbox Panel */}
        <div className="lg:col-span-1">
          <OutboxPanel />
        </div>

        {/* Incidents */}
        <IncidentsCard incidents={incidents} />

        {/* Data Trust */}
        <DataTrustCard immutability={immutability} shadowDiff={shadowDiff} />
      </div>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Environment</p>
              <p className="font-medium">Production</p>
            </div>
            <div>
              <p className="text-muted-foreground">Database</p>
              <p className="font-medium">v3.0.0 Unified</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="font-medium">{new Date().toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Version</p>
              <p className="font-medium">Command Center v1.0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}