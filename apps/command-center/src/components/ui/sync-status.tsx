'use client';

import { RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SyncStatusProps {
  className?: string;
}

export function SyncStatus({ className }: SyncStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setLastSync(new Date());
      } else {
        setIsConnected(false);
        setError(result.error || 'Connection failed');
      }
    } catch (err) {
      setIsConnected(false);
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
    if (isConnected) return 'default';
    return 'outline';
  };

  const getStatusText = () => {
    if (error) return 'Connection Error';
    if (isConnected) return 'Live Data';
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="h-3 w-3" />;
    if (isConnected) return <Wifi className="h-3 w-3" />;
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
  const [status, setStatus] = useState<'connected' | 'error'>('error');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/sync?source=agents');
        const result = await response.json();

        if (result.success) {
          setStatus('connected');
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
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTooltipText = () => {
    switch (status) {
      case 'connected':
        return 'Connected to database';
      case 'error':
        return 'Database connection error';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" title={getTooltipText()}>
      <div className={cn('w-2 h-2 rounded-full', getIndicatorClass())} />
      <span className="hidden sm:inline">{status === 'connected' ? 'Production' : 'Offline'}</span>
    </div>
  );
}
