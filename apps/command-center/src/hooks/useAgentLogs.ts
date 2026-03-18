'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { subscriptions, getSupabaseClient } from '@/lib/supabase';

export interface AgentLog {
  id: string;
  timestamp: Date;
  agent: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * Hook for fetching and managing real-time agent logs from the agent_logs table
 * Connects to Unit Talk production database for live log streaming
 */
export function useAgentLogs(limit = 50) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);

  // Map database log levels to our interface
  const mapLogLevel = (level: string): AgentLog['level'] => {
    switch (level?.toLowerCase()) {
      case 'info':
        return 'info';
      case 'warn':
      case 'warning':
        return 'warn';
      case 'error':
      case 'fatal':
        return 'error';
      case 'debug':
        return 'debug';
      default:
        return 'info';
    }
  };

  // Transform database log to AgentLog interface
  const transformDbLogToAgentLog = (dbLog: any): AgentLog => ({
    id: dbLog.id,
    timestamp: new Date(dbLog.created_at),
    agent: dbLog.agent || dbLog.agent_name || 'Unknown',
    level: mapLogLevel(dbLog.level || dbLog.log_level),
    message: dbLog.message || dbLog.log_message || '',
    correlationId: dbLog.correlation_id || dbLog.request_id || undefined,
    metadata: dbLog.metadata || dbLog.context || {},
    created_at: dbLog.created_at,
  });

  // Handle real-time log updates
  const handleLogUpdate = (payload: any) => {
    console.log('🔄 Real-time agent log update:', payload);

    if (payload.new) {
      const newLog = transformDbLogToAgentLog(payload.new);

      setLogs(prev => {
        // Add new log to the beginning and maintain limit
        const updatedLogs = [newLog, ...prev].slice(0, limit);
        return updatedLogs;
      });

      setLastUpdate(new Date());

      // Show toast for error logs
      if (newLog.level === 'error') {
        toast.error(`${newLog.agent}: ${newLog.message}`, {
          description: newLog.correlationId ? `ID: ${newLog.correlationId}` : undefined,
        });
      }
    }
  };

  // Load initial agent logs from database (fail-closed, no mock fallbacks)
  const loadLogs = async () => {
    try {
      console.log('[CC] Loading agent logs from database...');

      const client = getSupabaseClient();

      // Fetch real agent logs from database
      const { data, error: queryError } = await client
        .from('agent_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (queryError) {
        console.warn('[CC] Failed to load agent logs:', queryError.message);
        setLogs([]);
        setError(new Error(queryError.message));
      } else {
        const transformedLogs = (data || []).map(transformDbLogToAgentLog);
        console.log(`[CC] Loaded ${transformedLogs.length} agent logs from database`);
        setLogs(transformedLogs);
      }
    } catch (err) {
      console.error('[CC] Failed to load agent logs:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setLogs([]);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    let subscription: any = null;
    let mounted = true;

    const initializeLogs = async () => {
      if (!mounted) return;

      // Load initial data
      await loadLogs();

      if (!realTimeEnabled || !mounted) return;

      // Set up real-time subscription
      try {
        console.log('🔌 Setting up real-time agent logs subscription...');
        subscription = subscriptions.subscribeToAgentLogs(handleLogUpdate);

        if (subscription) {
          console.log('✅ Agent logs real-time subscription established');
          toast.success('Live agent logs connected', {
            description: 'Real-time log streaming active',
          });
        }
      } catch (error) {
        console.error('❌ Failed to setup real-time logs subscription:', error);
        toast.error('Real-time logs unavailable', {
          description: 'Using polling fallback mode',
        });
      }
    };

    initializeLogs();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
        console.log('🔌 Agent logs subscription cleaned up');
      }
    };
  }, [realTimeEnabled, limit]);

  // Manual refresh function
  const refreshLogs = async () => {
    setLoading(true);
    await loadLogs();
  };

  // Filter logs by agent
  const getLogsByAgent = (agentName: string) => {
    return logs.filter(log => log.agent === agentName);
  };

  // Filter logs by level
  const getLogsByLevel = (level: AgentLog['level']) => {
    return logs.filter(log => log.level === level);
  };

  // Get recent error logs
  const getRecentErrors = () => {
    return logs.filter(log => log.level === 'error').slice(0, 10);
  };

  return {
    logs,
    loading,
    error,
    lastUpdate,
    realTimeEnabled,
    refreshLogs,
    getLogsByAgent,
    getLogsByLevel,
    getRecentErrors,
    toggleRealTime: () => setRealTimeEnabled(!realTimeEnabled),
  };
}
