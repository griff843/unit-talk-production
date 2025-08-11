'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Wifi,
  Server,
  Database,
  Zap,
  Shield,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

interface System {
  health: 'healthy' | 'warning' | 'critical';
  uptime: number;
  responseTime: number;
  activeUsers: number;
  alerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

interface SystemHealthProps {
  system: System;
}

export function SystemHealth({ system }: SystemHealthProps) {
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'critical':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500">Healthy</Badge>;
      case 'warning':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500">Warning</Badge>
        );
      case 'critical':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500">Critical</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500">Unknown</Badge>;
    }
  };

  const formatUptime = (uptime: number) => {
    return `${uptime.toFixed(2)}%`;
  };

  const formatResponseTime = (responseTime: number) => {
    return `${responseTime}ms`;
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Activity className="h-5 w-5 text-green-500" />
          <span>System Health</span>
          {getHealthBadge(system.health)}
        </CardTitle>
        <CardDescription className="text-gray-400">
          Real-time system monitoring and status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Status */}
        <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-gray-800">
          <div className="flex items-center space-x-3">
            {getHealthIcon(system.health)}
            <div>
              <div className="text-sm font-semibold text-white">System Status</div>
              <div className={`text-xs ${getHealthColor(system.health)}`}>
                {system.health.charAt(0).toUpperCase() + system.health.slice(1)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white">{formatUptime(system.uptime)}</div>
            <div className="text-xs text-gray-400">Uptime</div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-black/20 rounded-lg border border-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <Zap className="h-3 w-3 text-blue-400" />
              <span className="text-xs text-gray-400">Response</span>
            </div>
            <div className="text-sm font-semibold text-white">
              {formatResponseTime(system.responseTime)}
            </div>
            <div className="text-xs text-gray-500">Average</div>
          </div>
          <div className="text-center p-3 bg-black/20 rounded-lg border border-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <Users className="h-3 w-3 text-green-400" />
              <span className="text-xs text-gray-400">Active</span>
            </div>
            <div className="text-sm font-semibold text-white">{system.activeUsers}</div>
            <div className="text-xs text-gray-500">Users</div>
          </div>
        </div>

        {/* System Components */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Server className="h-4 w-4 text-blue-500" />
            <span>System Components</span>
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-black/20 rounded border border-gray-800">
              <div className="flex items-center space-x-2">
                <Database className="h-3 w-3 text-green-400" />
                <span className="text-sm text-gray-300">Database</span>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500 text-xs">
                Online
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-black/20 rounded border border-gray-800">
              <div className="flex items-center space-x-2">
                <Wifi className="h-3 w-3 text-green-400" />
                <span className="text-sm text-gray-300">API Gateway</span>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500 text-xs">
                Online
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-black/20 rounded border border-gray-800">
              <div className="flex items-center space-x-2">
                <Shield className="h-3 w-3 text-green-400" />
                <span className="text-sm text-gray-300">Security</span>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500 text-xs">
                Active
              </Badge>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {system.alerts.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span>Recent Alerts</span>
            </h4>
            <div className="space-y-2">
              {system.alerts.slice(0, 3).map(alert => (
                <Alert key={alert.id} className="bg-black/20 border-gray-800">
                  <div className="flex items-start space-x-2">
                    {alert.type === 'error' && <XCircle className="h-4 w-4 text-red-400 mt-0.5" />}
                    {alert.type === 'warning' && (
                      <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />
                    )}
                    {alert.type === 'info' && (
                      <CheckCircle className="h-4 w-4 text-blue-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <AlertDescription className="text-sm text-gray-300">
                        {alert.message}
                      </AlertDescription>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimeAgo(alert.timestamp)}
                      </div>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Performance Trend */}
        <div className="p-3 bg-black/20 rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-400">Performance Trend</span>
            </div>
            <span className="text-xs text-green-400">+2.3%</span>
          </div>
          <Progress value={85} className="h-2" />
          <div className="text-xs text-gray-500 mt-1">System efficiency over last 24 hours</div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-400">Operational</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span className="text-gray-400">Monitoring</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span className="text-gray-400">Secure</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
