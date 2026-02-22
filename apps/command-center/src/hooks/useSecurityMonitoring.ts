import { useState, useEffect, useCallback } from 'react';

import { supabase } from '@/lib/supabase';

// Using 'any' cast to avoid type mismatch with security_events table
// (App uses extended type enum, DB has limited enum)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbClient = supabase as any;

export interface SecurityAlert {
  id: string;
  type:
    | 'bypass_attempt'
    | 'professional_processing_violation'
    | 'unauthorized_access'
    | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  userId?: string;
  agentName?: string;
  pickId?: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SecurityMetrics {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  bypassAttempts: number;
  processingViolations: number;
  complianceRate: number;
  lastIncident?: string;
  systemStatus: 'secure' | 'warning' | 'critical';
}

// Mock data for development
const mockSecurityAlerts: SecurityAlert[] = [
  {
    id: 'alert-1',
    type: 'professional_processing_violation',
    severity: 'high',
    message: 'Pick attempted to bypass professional processing pipeline',
    details: {
      pickId: 'pick-123',
      capper: 'TestUser',
      attemptedAction: 'direct_grade_submission',
      blockedAt: 'GradingAgent validation layer',
    },
    pickId: 'pick-123',
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    resolved: false,
  },
  {
    id: 'alert-2',
    type: 'bypass_attempt',
    severity: 'critical',
    message: 'Multiple attempts to circumvent professional processing detected',
    details: {
      userId: 'user-456',
      attempts: 3,
      methods: ['API direct call', 'Database manipulation', 'Agent override'],
      blocked: true,
    },
    userId: 'user-456',
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    resolved: false,
  },
  {
    id: 'alert-3',
    type: 'suspicious_activity',
    severity: 'medium',
    message: 'Unusual pick submission pattern detected',
    details: {
      pattern: 'High frequency submissions outside normal hours',
      confidence: 0.85,
      riskScore: 7.2,
    },
    timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
    resolved: true,
    resolvedAt: new Date(Date.now() - 3600000).toISOString(),
    resolvedBy: 'admin',
  },
];

export function useSecurityMonitoring() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const calculateMetrics = useCallback((alertsData: SecurityAlert[]) => {
    // Calculate metrics based on provided alerts data
    const totalAlerts = alertsData.length;
    const activeAlerts = alertsData.filter(a => !a.resolved).length;
    const resolvedAlerts = alertsData.filter(a => a.resolved).length;
    const bypassAttempts = alertsData.filter(a => a.type === 'bypass_attempt').length;
    const processingViolations = alertsData.filter(
      a => a.type === 'professional_processing_violation'
    ).length;

    const complianceRate =
      totalAlerts > 0
        ? ((totalAlerts - bypassAttempts - processingViolations) / totalAlerts) * 100
        : 100;

    const criticalAlerts = alertsData.filter(a => a.severity === 'critical' && !a.resolved).length;
    const highAlerts = alertsData.filter(a => a.severity === 'high' && !a.resolved).length;

    const systemStatus: SecurityMetrics['systemStatus'] =
      criticalAlerts > 0 ? 'critical' : highAlerts > 0 || activeAlerts > 5 ? 'warning' : 'secure';

    const lastIncident = alertsData.find(a => !a.resolved)?.timestamp;

    return {
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      bypassAttempts,
      processingViolations,
      complianceRate: Math.round(complianceRate * 100) / 100,
      lastIncident,
      systemStatus,
    };
  }, []);

  const fetchSecurityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching security data...');

      if (!dbClient) {
        console.log('⚠️ Supabase client not available, using mock data');
        setAlerts(mockSecurityAlerts);
        setMetrics(calculateMetrics(mockSecurityAlerts));
        return;
      }

      // Try to fetch real security events
      const { data: securityEvents, error: securityError } = await dbClient
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!securityError && securityEvents) {
        console.log(`✅ Successfully fetched ${securityEvents.length} security events`);

        // Transform security events to security alerts format
        const transformedAlerts: SecurityAlert[] = securityEvents.map(event => ({
          id: String(event.id || ''),
          type: (event.type || 'suspicious_activity') as SecurityAlert['type'],
          severity: (event.severity || 'medium') as SecurityAlert['severity'],
          message: String(event.description || 'No description'),
          details: (typeof event.metadata === 'object' && event.metadata !== null
            ? event.metadata
            : {}) as Record<string, unknown>,
          userId: event.user_id ? String(event.user_id) : undefined,
          timestamp: String(event.created_at || new Date().toISOString()),
          resolved: Boolean(event.resolved_at),
          resolvedAt: event.resolved_at ? String(event.resolved_at) : undefined,
        }));

        setAlerts(transformedAlerts);
        setMetrics(calculateMetrics(transformedAlerts));
      } else {
        console.log('⚠️ Security events query failed, using mock data:', securityError?.message);
        // Fallback to mock data
        setAlerts(mockSecurityAlerts);
        setMetrics(calculateMetrics(mockSecurityAlerts));
      }
    } catch (err) {
      console.error('❌ Failed to fetch security data:', err);
      setError(err as Error);
      // Use mock data on error
      setAlerts(mockSecurityAlerts);
      setMetrics(calculateMetrics(mockSecurityAlerts));
    } finally {
      setLoading(false);
    }
  }, [calculateMetrics]);

  const resolveAlert = useCallback(async (alertId: string, resolvedBy: string) => {
    try {
      const client = dbClient;
      if (client) {
        const { error } = await client
          .from('security_events')
          .update({
            resolved_at: new Date().toISOString(),
            metadata: { resolved_by: resolvedBy },
          })
          .eq('id', alertId);

        if (error) throw error;
      }

      // Update local state
      setAlerts(prev =>
        prev.map(alert =>
          alert.id === alertId
            ? {
                ...alert,
                resolved: true,
                resolvedAt: new Date().toISOString(),
                resolvedBy,
              }
            : alert
        )
      );
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      throw err;
    }
  }, []);

  const createAlert = useCallback(
    async (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved'>) => {
      try {
        const client = dbClient;
        if (client) {
          const { data, error } = await client
            .from('security_events')
            .insert({
              type: alert.type,
              severity: alert.severity,
              description: alert.message,
              metadata: alert.details,
              user_id: alert.userId,
            })
            .select()
            .single();

          if (error) throw error;

          // Add to local state
          const newAlert: SecurityAlert = {
            ...alert,
            id: String(data.id),
            timestamp: String(data.created_at),
            resolved: false,
          };

          setAlerts(prev => [newAlert, ...prev]);
          return newAlert;
        }
      } catch (err) {
        console.error('Failed to create alert:', err);
        throw err;
      }
    },
    []
  );

  // Real-time subscription for new security events
  useEffect(() => {
    if (!dbClient) {
      console.log('⚠️ Supabase not available, skipping security events subscription');
      return;
    }

    console.log('🔌 Setting up security events real-time subscription...');

    const subscription = dbClient
      .channel('security_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_events' },
        payload => {
          console.log('🚨 New security event received:', payload);

          const newAlert: SecurityAlert = {
            id: payload.new.id,
            type: payload.new.type,
            severity: payload.new.severity,
            message: payload.new.description,
            details: payload.new.metadata || {},
            userId: payload.new.user_id,
            timestamp: payload.new.created_at,
            resolved: false,
          };

          setAlerts(prev => {
            const updated = [newAlert, ...prev];
            // Recalculate metrics with new alert
            setMetrics(calculateMetrics(updated));
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up security events subscription');
      subscription.unsubscribe();
    };
  }, [calculateMetrics]);

  useEffect(() => {
    fetchSecurityData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchSecurityData, 30000);

    return () => clearInterval(interval);
  }, [fetchSecurityData]);

  return {
    alerts,
    metrics,
    loading,
    error,
    resolveAlert,
    createAlert,
    refetch: fetchSecurityData,
  };
}
