'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Database, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusProps {
  className?: string;
}

export function SyncStatus({ className }: SyncStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(true);

  const checkConnection = async () => {
    try {
      setIsSyncing(true);
      setError(null);

      const response = await fetch('/api/sync?source=agents', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setIsConnected(true);
        setUsingMockData(false);
        setLastSync(new Date());
      } else {
        setIsConnected(false);
        setUsingMockData(result.usingMockData || true);
        if (result.message) {
          console.log('Sync status:', result.message);
        }
      }
    } catch (err) {
      setIsConnected(false);
      setUsingMockData(true);
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const manualSync = async () => {
    await checkConnection();
  };

  useEffect(() => {
    // Check connection on mount
    checkConnection();

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (error) return 'destructive';
    if (isConnected && !usingMockData) return 'default';
    if (usingMockData) return 'secondary';
    return 'outline';
  };

  const getStatusText = () => {
    if (error) return 'Connection Error';
    if (isConnected && !usingMockData) return 'Live Data';
    if (usingMockData) return 'Mock Data';
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="h-3 w-3" />;
    if (isConnected && !usingMockData) return <Wifi className="h-3 w-3" />;
    if (usingMockData) return <Database className="h-3 w-3" />;
    return <WifiOff className="h-3 w-3" />;
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant={getStatusColor()} className="flex items-center gap-1">
        {getStatusIcon()}
        {getStatusText()}
      </Badge>

      <Button
        variant="ghost"
        size="sm"
        onClick={manualSync}
        disabled={isSyncing}
        className="h-6 px-2"
      >
        <RefreshCw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
      </Button>

      {lastSync && (
        <span className="text-xs text-muted-foreground">
          Last sync: {lastSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

// Connection status indicator for the header
export function ConnectionIndicator() {
  const [status, setStatus] = useState<'connected' | 'mock' | 'error'>('mock');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/sync?source=agents');
        const result = await response.json();

        if (result.success && !result.usingMockData) {
          setStatus('connected');
        } else if (result.usingMockData) {
          setStatus('mock');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const getIndicatorClass = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'mock':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTooltipText = () => {
    switch (status) {
      case 'connected':
        return 'Connected to Unit Talk Production';
      case 'mock':
        return 'Using mock data - production unavailable';
      case 'error':
        return 'Connection error';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" title={getTooltipText()}>
      <div className={cn('w-2 h-2 rounded-full', getIndicatorClass())} />
      <span className="hidden sm:inline">
        {status === 'connected' ? 'Production' : status === 'mock' ? 'Demo' : 'Offline'}
      </span>
    </div>
  );
}
