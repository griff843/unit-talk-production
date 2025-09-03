'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Square,
  RotateCcw,
  Settings,
  Zap,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  Timer,
  Gauge,
  Target,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface OperationalControlsProps {
  className?: string;
}

interface ServiceControl {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  description: string;
  critical: boolean;
  lastAction?: Date;
}

export function OperationalControls({ className = '' }: OperationalControlsProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceControl[]>([
    {
      id: 'grading-pipeline',
      name: 'Grading Pipeline',
      status: 'running',
      description: 'Professional prop grading and scoring',
      critical: true,
      lastAction: new Date(Date.now() - 300000), // 5 minutes ago
    },
    {
      id: 'agents-orchestrator',
      name: 'Agent Orchestrator',
      status: 'running',
      description: 'All 5 production agents coordination',
      critical: true,
      lastAction: new Date(Date.now() - 120000), // 2 minutes ago
    },
    {
      id: 'live-alerts',
      name: 'Live Alert System',
      status: 'running',
      description: 'Real-time Discord and notification alerts',
      critical: false,
      lastAction: new Date(Date.now() - 60000), // 1 minute ago
    },
    {
      id: 'data-ingestion',
      name: 'Data Ingestion',
      status: 'running',
      description: 'Optimal API + Odds API dual-source pipeline',
      critical: true,
      lastAction: new Date(Date.now() - 180000), // 3 minutes ago
    },
  ]);

  const [systemActions, setSystemActions] = useState([
    {
      id: 'trigger-grading',
      name: 'Trigger Manual Grading',
      description: 'Process remaining ungraded props immediately',
      icon: Target,
      variant: 'default' as const,
      critical: false,
    },
    {
      id: 'force-sync',
      name: 'Force Database Sync',
      description: 'Synchronize all tables and refresh caches',
      icon: Database,
      variant: 'outline' as const,
      critical: false,
    },
    {
      id: 'restart-agents',
      name: 'Restart All Agents',
      description: 'Graceful restart of entire agent system',
      icon: RotateCcw,
      variant: 'outline' as const,
      critical: true,
    },
    {
      id: 'emergency-stop',
      name: 'Emergency Stop',
      description: 'Immediately halt all system operations',
      icon: AlertTriangle,
      variant: 'destructive' as const,
      critical: true,
    },
  ]);

  const handleServiceAction = async (serviceId: string, action: 'start' | 'stop' | 'restart') => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    // Update service status optimistically
    setServices(prev =>
      prev.map(s =>
        s.id === serviceId
          ? {
              ...s,
              status: action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'starting',
            }
          : s
      )
    );

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update to final status
      const newStatus = action === 'stop' ? 'stopped' : 'running';
      setServices(prev =>
        prev.map(s =>
          s.id === serviceId ? { ...s, status: newStatus, lastAction: new Date() } : s
        )
      );

      toast({
        title: 'Service Action Completed',
        description: `${service.name} ${action} completed successfully`,
      });
    } catch (error) {
      setServices(prev => prev.map(s => (s.id === serviceId ? { ...s, status: 'error' } : s)));

      toast({
        title: 'Service Action Failed',
        description: `Failed to ${action} ${service.name}`,
        variant: 'destructive',
      });
    }
  };

  const handleSystemAction = async (actionId: string) => {
    const action = systemActions.find(a => a.id === actionId);
    if (!action) return;

    // Show confirmation for critical actions
    if (action.critical) {
      const confirmed = window.confirm(
        `Are you sure you want to ${action.name.toLowerCase()}? This action may impact system availability.`
      );
      if (!confirmed) return;
    }

    try {
      // Simulate API call based on action type
      await new Promise(resolve => setTimeout(resolve, action.critical ? 3000 : 1500));

      toast({
        title: 'System Action Completed',
        description: `${action.name} executed successfully`,
      });

      // If it's a restart action, update all services
      if (actionId === 'restart-agents') {
        setServices(prev =>
          prev.map(s => ({
            ...s,
            status: 'running' as const,
            lastAction: new Date(),
          }))
        );
      }
    } catch (error) {
      toast({
        title: 'System Action Failed',
        description: `Failed to execute ${action.name}`,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: ServiceControl['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'stopped':
        return <Square className="w-4 h-4 text-gray-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'starting':
      case 'stopping':
        return <Timer className="w-4 h-4 text-yellow-500 animate-spin" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ServiceControl['status']) => {
    const variants = {
      running: 'bg-green-100 text-green-800',
      stopped: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800',
      starting: 'bg-yellow-100 text-yellow-800',
      stopping: 'bg-orange-100 text-orange-800',
    };
    return variants[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Service Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Gauge className="w-5 h-5 mr-2" />
            Service Control Center
          </CardTitle>
          <CardDescription>
            Direct operational control over critical system services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map(service => (
              <div
                key={service.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/20"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium">{service.name}</p>
                      {service.critical && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-red-50 text-red-700 border-red-200"
                        >
                          Critical
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                    {service.lastAction && (
                      <p className="text-xs text-muted-foreground">
                        Last action: {service.lastAction.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge className={getStatusBadge(service.status)}>
                    {service.status.toUpperCase()}
                  </Badge>

                  <div className="flex space-x-1">
                    {service.status === 'stopped' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleServiceAction(service.id, 'start')}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    )}

                    {service.status === 'running' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleServiceAction(service.id, 'restart')}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleServiceAction(service.id, 'stop')}
                        >
                          <Square className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            System Actions
          </CardTitle>
          <CardDescription>Execute system-wide operations and maintenance tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {systemActions.map(action => (
              <Button
                key={action.id}
                variant={action.variant}
                className="justify-start h-auto p-4"
                onClick={() => handleSystemAction(action.id)}
              >
                <action.icon className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium flex items-center">
                    {action.name}
                    {action.critical && <AlertTriangle className="w-3 h-3 ml-2 text-orange-500" />}
                  </div>
                  <div className="text-sm opacity-80">{action.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            System Status Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg border bg-green-50">
              <div className="text-2xl font-bold text-green-800">
                {services.filter(s => s.status === 'running').length}
              </div>
              <div className="text-sm text-green-600">Services Running</div>
            </div>

            <div className="text-center p-4 rounded-lg border bg-yellow-50">
              <div className="text-2xl font-bold text-yellow-800">
                {services.filter(s => s.critical).length}
              </div>
              <div className="text-sm text-yellow-600">Critical Services</div>
            </div>

            <div className="text-center p-4 rounded-lg border bg-blue-50">
              <div className="text-2xl font-bold text-blue-800">
                {Math.round(
                  (services.filter(s => s.status === 'running').length / services.length) * 100
                )}
                %
              </div>
              <div className="text-sm text-blue-600">System Health</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
