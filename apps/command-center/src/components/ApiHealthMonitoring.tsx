// @ts-nocheck
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, ExternalLink, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useApiHealthMonitoring, ApiHealthStatus } from '@/lib/apiHealthMonitoring';

const ApiStatusBadge: React.FC<{ status: ApiHealthStatus['status'] }> = ({ status }) => {
  const statusConfig = {
    healthy: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-500' },
    degraded: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-500' },
    down: { variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-500' },
    unknown: { variant: 'secondary' as const, icon: Clock, color: 'text-gray-500' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className={`w-3 h-3 ${config.color}`} />
      {status.toUpperCase()}
    </Badge>
  );
};

const ApiCard: React.FC<{ 
  api: ApiHealthStatus; 
  onRefresh: (apiName: string) => void;
}> = ({ api, onRefresh }) => {
  const getQuotaColor = (percent?: number): string => {
    if (!percent) return 'bg-gray-200';
    if (percent >= 95) return 'bg-red-500';
    if (percent >= 90) return 'bg-orange-500';
    if (percent >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getResponseTimeColor = (responseTime: number): string => {
    if (responseTime < 1000) return 'text-green-600';
    if (responseTime < 3000) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className={`${api.status === 'down' ? 'border-red-200 bg-red-50/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {api.name}
          </CardTitle>
          <ApiStatusBadge status={api.status} />
        </div>
        {api.details?.cost && (
          <div className="flex items-center text-sm text-gray-600">
            <DollarSign className="w-4 h-4 mr-1" />
            {api.details.cost}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Description */}
        {api.details?.description && (
          <p className="text-sm text-gray-600">{api.details.description}</p>
        )}

        {/* Response Time */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Response Time:</span>
          <span className={`text-sm font-mono ${getResponseTimeColor(api.responseTime)}`}>
            {api.responseTime}ms
          </span>
        </div>

        {/* Quota Usage */}
        {api.quotaPercent !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Quota Usage:</span>
              <span className="text-sm font-mono">
                {api.quotaUsed || 0} / {api.quotaLimit || 0} ({api.quotaPercent.toFixed(1)}%)
              </span>
            </div>
            <Progress 
              value={api.quotaPercent} 
              className={`w-full h-2 ${getQuotaColor(api.quotaPercent)}`} 
            />
            {api.quotaPercent >= 90 && (
              <div className="flex items-center text-sm text-red-600">
                <AlertTriangle className="w-4 h-4 mr-1" />
                High quota usage warning
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {api.errorMessage && (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
              {api.errorMessage}
            </div>
          </div>
        )}

        {/* Last Check */}
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Last Check:</span>
          <span>{api.lastCheck.toLocaleTimeString()}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onRefresh(api.name)}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Check Now
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(api.endpoint, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const ApiHealthMonitoring: React.FC = () => {
  const {
    statuses,
    summary,
    loading,
    lastUpdate,
    refreshAll,
    checkSingleAPI,
  } = useApiHealthMonitoring();

  const handleRefreshAll = async () => {
    try {
      await refreshAll();
      toast.success('API health status refreshed');
    } catch (error) {
      toast.error(`Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefreshSingle = async (apiName: string) => {
    try {
      await checkSingleAPI(apiName);
      toast.success(`${apiName} status refreshed`);
    } catch (error) {
      toast.error(`Failed to refresh ${apiName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {summary?.healthyAPIs || 0}
            </div>
            <p className="text-xs text-gray-500">Healthy APIs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {summary?.degradedAPIs || 0}
            </div>
            <p className="text-xs text-gray-500">Degraded</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {summary?.downAPIs || 0}
            </div>
            <p className="text-xs text-gray-500">Down</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {summary ? Math.round(summary.averageResponseTime) : 0}ms
            </div>
            <p className="text-xs text-gray-500">Avg Response</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {summary && summary.criticalQuotaAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Critical Quota Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.criticalQuotaAlerts.map((alert, index) => (
                <li key={index} className="text-sm text-red-700 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {alert}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">External API Health</h2>
          {lastUpdate && (
            <p className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <Button
          variant="outline"
          onClick={handleRefreshAll}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      {/* API Cards */}
      {loading && statuses.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Checking API health...</span>
        </div>
      ) : statuses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No APIs configured for monitoring</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statuses.map((api) => (
            <ApiCard
              key={api.name}
              api={api}
              onRefresh={handleRefreshSingle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ApiHealthMonitoring;