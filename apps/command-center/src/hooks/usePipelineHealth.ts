import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface PipelineHealthMetrics {
  processingLag: number; // AVG(now() - processed_at) in minutes
  promotionLag: number; // AVG(promoted_at - processed_at) in minutes
  promotionSuccessRate: number; // COUNT(promoted)/COUNT(processed) percentage
  conflictSkipCount: number; // Conflicts from findExistingUnifiedPick
  writerAuditScore: number; // % of picks where writer='GradingAgent'
  singleWriterMode: boolean; // Feature flag status
  lastUpdated: string;
  timeframe: string;
  metadata?: {
    processedCount: number;
    promotedCount: number;
    totalUnifiedPicks: number;
    promoterWrittenPicks: number;
  };
}

export interface PipelineHealthSnapshot {
  id: string;
  processing_lag_minutes: number;
  promotion_lag_minutes: number;
  promotion_success_rate: number;
  conflict_skip_count: number;
  writer_audit_score: number;
  single_writer_mode: boolean;
  timeframe_hours: number;
  created_at: string;
}

interface UsePipelineHealthOptions {
  timeframe?: number; // hours
  refreshInterval?: number; // milliseconds
  enableRealtime?: boolean;
}

export function usePipelineHealth(options: UsePipelineHealthOptions = {}) {
  const {
    timeframe = 24,
    refreshInterval = 30000, // 30 seconds
    enableRealtime = true,
  } = options;

  const [metrics, setMetrics] = useState<PipelineHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PipelineHealthSnapshot[]>([]);

  const fetchPipelineHealth = useCallback(async () => {
    try {
      setError(null);

      // Try API endpoint first
      const response = await fetch(`/api/pipeline/health?hours=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        return;
      }

      // Fallback to direct database query if API fails
      if (supabase) {
        const startTime = new Date(Date.now() - timeframe * 60 * 60 * 1000).toISOString();

        // Processing Lag: AVG(now() - processed_at) for processed props
        const { data: processedProps } = await supabase
          .from('raw_props')
          .select('processed_at')
          .not('processed_at', 'is', null)
          .gte('processed_at', startTime);

        const processingLag =
          processedProps && processedProps.length > 0
            ? processedProps.reduce((sum, prop) => {
                const processedAt = prop.processed_at as string;
                if (!processedAt) return sum;

                const processedDate = new Date(processedAt);
                if (isNaN(processedDate.getTime())) return sum;

                const lag = (Date.now() - processedDate.getTime()) / (1000 * 60);
                return sum + lag;
              }, 0) / processedProps.length
            : 0;

        // Promotion Lag: AVG(promoted_at - processed_at) for promoted props
        const { data: promotedProps } = await supabase
          .from('raw_props')
          .select('processed_at, promoted_at')
          .not('processed_at', 'is', null)
          .not('promoted_at', 'is', null)
          .gte('promoted_at', startTime);

        const promotionLag =
          promotedProps && promotedProps.length > 0
            ? promotedProps.reduce((sum, prop) => {
                const promotedAt = prop.promoted_at as string;
                const processedAt = prop.processed_at as string;
                if (!promotedAt || !processedAt) return sum;

                const promotedDate = new Date(promotedAt);
                const processedDate = new Date(processedAt);
                if (isNaN(promotedDate.getTime()) || isNaN(processedDate.getTime())) return sum;

                const lag = (promotedDate.getTime() - processedDate.getTime()) / (1000 * 60);
                return sum + lag;
              }, 0) / promotedProps.length
            : 0;

        // Promotion Success Rate: COUNT(promoted)/COUNT(processed)
        const { count: processedCount } = await supabase
          .from('raw_props')
          .select('*', { count: 'exact', head: true })
          .not('processed_at', 'is', null)
          .gte('processed_at', startTime);

        const { count: promotedCount } = await supabase
          .from('raw_props')
          .select('*', { count: 'exact', head: true })
          .not('promoted_at', 'is', null)
          .gte('promoted_at', startTime);

        const promotionSuccessRate =
          processedCount && processedCount > 0 ? ((promotedCount || 0) / processedCount) * 100 : 0;

        // Writer Audit: % of unified_picks where writer source is promoter
        const { count: totalUnifiedPicks } = await supabase
          .from('unified_picks')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startTime);

        const { count: promoterWrittenPicks } = await supabase
          .from('unified_picks')
          .select('*', { count: 'exact', head: true })
          .eq('pick_source', 'promoted')
          .gte('created_at', startTime);

        const writerAuditScore =
          totalUnifiedPicks && totalUnifiedPicks > 0
            ? ((promoterWrittenPicks || 0) / totalUnifiedPicks) * 100
            : 0;

        // Get conflict count
        const { count: conflictCount } = await supabase
          .from('conflict_events')
          .select('*', { count: 'exact', head: true })
          .gte('occurred_at', startTime);

        // Get single-writer mode status
        const { data: configData } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'PIPELINE_SINGLE_WRITER')
          .single();

        const singleWriterMode = configData?.value === 'true';

        const pipelineHealth: PipelineHealthMetrics = {
          processingLag: Math.round(processingLag * 100) / 100,
          promotionLag: Math.round(promotionLag * 100) / 100,
          promotionSuccessRate: Math.round(promotionSuccessRate * 100) / 100,
          conflictSkipCount: conflictCount || 0,
          writerAuditScore: Math.round(writerAuditScore * 100) / 100,
          singleWriterMode,
          lastUpdated: new Date().toISOString(),
          timeframe: `${timeframe}h`,
          metadata: {
            processedCount: processedCount || 0,
            promotedCount: promotedCount || 0,
            totalUnifiedPicks: totalUnifiedPicks || 0,
            promoterWrittenPicks: promoterWrittenPicks || 0,
          },
        };

        setMetrics(pipelineHealth);
      } else {
        throw new Error('No data source available');
      }
    } catch (err) {
      console.error('Failed to fetch pipeline health:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      // Set fallback metrics
      setMetrics({
        processingLag: 0,
        promotionLag: 0,
        promotionSuccessRate: 0,
        conflictSkipCount: 0,
        writerAuditScore: 0,
        singleWriterMode: false,
        lastUpdated: new Date().toISOString(),
        timeframe: `${timeframe}h`,
      });
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  const fetchHealthHistory = useCallback(async (days: number = 7) => {
    try {
      if (!supabase) return;

      const { data, error } = await supabase
        .from('pipeline_health_snapshots')
        .select('*')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setHistory((data as unknown as PipelineHealthSnapshot[]) || []);
    } catch (err) {
      console.error('Failed to fetch health history:', err);
    }
  }, []);

  const captureHealthSnapshot = useCallback(async () => {
    try {
      if (!supabase) return null;

      // Call the database function to capture snapshot
      const { data, error } = await supabase.rpc('capture_pipeline_health_snapshot', {
        p_timeframe_hours: timeframe,
      });

      if (error) throw error;

      // Refresh current metrics and history
      await Promise.all([fetchPipelineHealth(), fetchHealthHistory()]);

      return data;
    } catch (err) {
      console.error('Failed to capture health snapshot:', err);
      return null;
    }
  }, [timeframe, fetchPipelineHealth, fetchHealthHistory]);

  const logConflictEvent = useCallback(
    async (rawPropId: string, reason?: string) => {
      try {
        // Log via API endpoint
        await fetch('/api/pipeline/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'conflict_skip',
            data: {
              raw_prop_id: rawPropId,
              reason,
              timestamp: new Date().toISOString(),
            },
          }),
        });

        // Refresh metrics
        await fetchPipelineHealth();
      } catch (err) {
        console.error('Failed to log conflict event:', err);
      }
    },
    [fetchPipelineHealth]
  );

  const logPromotionEvent = useCallback(
    async (rawPropId: string, success: boolean, reason?: string, processingTime?: number) => {
      try {
        // Log via API endpoint
        await fetch('/api/pipeline/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'promotion_attempt',
            data: {
              raw_prop_id: rawPropId,
              success,
              reason,
              processing_time: processingTime,
              timestamp: new Date().toISOString(),
            },
          }),
        });

        // Refresh metrics
        await fetchPipelineHealth();
      } catch (err) {
        console.error('Failed to log promotion event:', err);
      }
    },
    [fetchPipelineHealth]
  );

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchPipelineHealth(), fetchHealthHistory()]);
    };
    loadData();
  }, [fetchPipelineHealth, fetchHealthHistory]);

  // Polling for regular updates
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchPipelineHealth, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPipelineHealth, refreshInterval]);

  // Real-time subscriptions
  useEffect(() => {
    if (!enableRealtime || !supabase) return;

    const subscriptions: any[] = [];

    // Subscribe to conflict events
    const conflictsSub = supabase
      .channel('conflict_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conflict_events' }, () =>
        fetchPipelineHealth()
      )
      .subscribe();
    subscriptions.push(conflictsSub);

    // Subscribe to promotion events
    const promotionsSub = supabase
      .channel('promotion_events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'promotion_events' },
        () => fetchPipelineHealth()
      )
      .subscribe();
    subscriptions.push(promotionsSub);

    // Subscribe to system config changes
    const configSub = supabase
      .channel('system_config')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_config' }, () =>
        fetchPipelineHealth()
      )
      .subscribe();
    subscriptions.push(configSub);

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [enableRealtime, fetchPipelineHealth]);

  return {
    metrics,
    history,
    loading,
    error,
    refreshHealth: fetchPipelineHealth,
    refreshHistory: fetchHealthHistory,
    captureSnapshot: captureHealthSnapshot,
    logConflictEvent,
    logPromotionEvent,
  };
}

export default usePipelineHealth;
