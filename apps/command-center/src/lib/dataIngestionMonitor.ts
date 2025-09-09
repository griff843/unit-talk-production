import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] as string;
const supabaseKey = (process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']) as string;

if (!supabaseUrl || !supabaseKey) { throw new Error('Missing Supabase env vars for DataIngestionMonitor'); }
const supabase = createClient(supabaseUrl, supabaseKey);

export interface DataIngestionStatus {
  source: string;
  expectedInterval: number; // minutes
  lastDataReceived: Date | null;
  isStale: boolean;
  minutesSinceLastData: number;
  recordsInLastHour: number;
  recordsInLast24Hours: number;
  status: 'healthy' | 'stale' | 'critical' | 'no_data';
  alertTriggered: boolean;
}

class DataIngestionMonitorService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCache = new Set<string>();

  // Expected data sources and their intervals
  private dataSources = {
    'optimal_api': {
      table: 'raw_props',
      expectedInterval: 1, // 1 minute during peak hours
      minRecordsPerHour: 100, // Minimum props expected per hour
      peakHours: [18, 19, 20, 21, 22, 23], // 6PM - 11PM EST
    },
    'odds_api': {
      table: 'raw_props', 
      expectedInterval: 2, // 2 minutes
      minRecordsPerHour: 50,
      peakHours: [18, 19, 20, 21, 22, 23],
    },
    'agent_processing': {
      table: 'unified_picks',
      expectedInterval: 5, // 5 minutes
      minRecordsPerHour: 10, // At least 10 picks processed per hour
      peakHours: [18, 19, 20, 21, 22, 23],
    }
  };

  /**
   * Check data ingestion health for all sources
   */
  async checkDataIngestionHealth(): Promise<DataIngestionStatus[]> {
    const results: DataIngestionStatus[] = [];
    const currentHour = new Date().getHours();

    for (const [source, config] of Object.entries(this.dataSources)) {
      try {
        const status = await this.checkSingleDataSource(source, config, currentHour);
        results.push(status);

        // Trigger alerts for critical issues
        if (status.status === 'critical' || (status.status === 'stale' && status.minutesSinceLastData > 10)) {
          await this.triggerDataIngestionAlert(status);
        }

      } catch (error) {
        console.error(`Failed to check data source ${source}:`, error);
        results.push({
          source,
          expectedInterval: config.expectedInterval,
          lastDataReceived: null,
          isStale: true,
          minutesSinceLastData: 999,
          recordsInLastHour: 0,
          recordsInLast24Hours: 0,
          status: 'critical',
          alertTriggered: false,
        });
      }
    }

    return results;
  }

  /**
   * Check individual data source health
   */
  private async checkSingleDataSource(
    source: string, 
    config: typeof this.dataSources[keyof typeof this.dataSources],
    currentHour: number
  ): Promise<DataIngestionStatus> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check when we last received data from this source
    let lastDataQuery = supabase
      .from(config.table)
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    // Add source filtering if applicable
    if (source.includes('api')) {
      lastDataQuery = lastDataQuery.eq('source', source.replace('_api', '_api'));
    } else if (source === 'agent_processing') {
      lastDataQuery = lastDataQuery.not('workflow_stage', 'is', null);
    }

    const { data: lastRecord, error: lastError } = await lastDataQuery.single();

    // Count records in last hour
    let hourCountQuery = supabase
      .from(config.table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    if (source.includes('api')) {
      hourCountQuery = hourCountQuery.eq('source', source.replace('_api', '_api'));
    } else if (source === 'agent_processing') {
      hourCountQuery = hourCountQuery.not('workflow_stage', 'is', null);
    }

    const { count: hourCount, error: hourError } = await hourCountQuery;

    // Count records in last 24 hours  
    let dayCountQuery = supabase
      .from(config.table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString());

    if (source.includes('api')) {
      dayCountQuery = dayCountQuery.eq('source', source.replace('_api', '_api'));
    } else if (source === 'agent_processing') {
      dayCountQuery = dayCountQuery.not('workflow_stage', 'is', null);
    }

    const { count: dayCount, error: dayError } = await dayCountQuery;

    const lastDataReceived = lastRecord && !lastError ? new Date(lastRecord.created_at) : null;
    const minutesSinceLastData = lastDataReceived 
      ? Math.floor((now.getTime() - lastDataReceived.getTime()) / (1000 * 60))
      : 999;

    const recordsInLastHour = hourCount || 0;
    const recordsInLast24Hours = dayCount || 0;

    // Determine if we're in peak hours (more stringent checks)
    const isPeakHour = config.peakHours.includes(currentHour);
    const expectedInterval = isPeakHour ? config.expectedInterval : config.expectedInterval * 2;

    // Determine status
    let status: DataIngestionStatus['status'];
    if (!lastDataReceived) {
      status = 'no_data';
    } else if (minutesSinceLastData > expectedInterval * 3) {
      status = 'critical';
    } else if (minutesSinceLastData > expectedInterval || recordsInLastHour < config.minRecordsPerHour / (isPeakHour ? 1 : 2)) {
      status = 'stale';
    } else {
      status = 'healthy';
    }

    return {
      source,
      expectedInterval,
      lastDataReceived,
      isStale: status !== 'healthy',
      minutesSinceLastData,
      recordsInLastHour,
      recordsInLast24Hours,
      status,
      alertTriggered: this.alertCache.has(`${source}_${status}`),
    };
  }

  /**
   * Trigger data ingestion alert
   */
  private async triggerDataIngestionAlert(status: DataIngestionStatus): Promise<void> {
    const alertKey = `${status.source}_${status.status}`;
    
    // Prevent spam - only alert once per hour for the same issue
    if (this.alertCache.has(alertKey)) {
      return;
    }

    this.alertCache.add(alertKey);
    setTimeout(() => this.alertCache.delete(alertKey), 60 * 60 * 1000); // Clear after 1 hour

    const alertData = {
      id: `ingestion_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'DATA_INGESTION_FAILURE',
      source: status.source,
      severity: status.status === 'critical' ? 'critical' : 'high',
      message: this.getAlertMessage(status),
      details: {
        lastDataReceived: status.lastDataReceived?.toISOString(),
        minutesSinceLastData: status.minutesSinceLastData,
        recordsInLastHour: status.recordsInLastHour,
        recordsInLast24Hours: status.recordsInLast24Hours,
        expectedInterval: status.expectedInterval,
        status: status.status,
      },
      timestamp: new Date().toISOString(),
    };

    console.error('🚨🚨🚨 DATA INGESTION FAILURE ALERT 🚨🚨🚨', alertData);

    try {
      // Send to Command Center alerts API
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData),
      });

      // Also log directly to database
      await supabase
        .from('system_logs')
        .insert([{
          level: 'error',
          message: alertData.message,
          metadata: alertData,
          source: 'data_ingestion_monitor',
          created_at: new Date().toISOString(),
        }]);

    } catch (error) {
      console.error('Failed to send data ingestion alert:', error);
      // Fallback logging
      console.error('FALLBACK DATA INGESTION ALERT:', alertData);
    }
  }

  /**
   * Generate appropriate alert message
   */
  private getAlertMessage(status: DataIngestionStatus): string {
    const source = status.source.replace('_', ' ').toUpperCase();
    
    switch (status.status) {
      case 'no_data':
        return `📭 NO DATA: ${source} has never received data - check API keys and connections`;
      case 'critical':
        return `🚨 CRITICAL: ${source} data missing for ${status.minutesSinceLastData} minutes (expected every ${status.expectedInterval} min)`;
      case 'stale':
        return `⚠️ STALE DATA: ${source} last updated ${status.minutesSinceLastData} minutes ago (${status.recordsInLastHour} records/hour)`;
      default:
        return `❓ UNKNOWN: ${source} data status unknown`;
    }
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 120000): void { // Default: 2 minutes
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log(`🔍 Starting data ingestion monitoring (interval: ${intervalMs}ms)`);
    
    // Initial check
    this.checkDataIngestionHealth().then(results => {
      console.log('📊 Data ingestion health check results:', results);
    });
    
    // Schedule regular checks
    this.monitoringInterval = setInterval(() => {
      this.checkDataIngestionHealth().then(results => {
        const criticalSources = results.filter(r => r.status === 'critical');
        if (criticalSources.length > 0) {
          console.warn(`⚠️ ${criticalSources.length} data sources in critical state:`, 
            criticalSources.map(s => s.source));
        }
      });
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Data ingestion monitoring stopped');
    }
  }

  /**
   * Get current data ingestion summary
   */
  async getIngestionSummary(): Promise<{
    totalSources: number;
    healthySources: number;
    staleSources: number;
    criticalSources: number;
    overallStatus: 'healthy' | 'degraded' | 'critical';
  }> {
    const results = await this.checkDataIngestionHealth();
    
    const totalSources = results.length;
    const healthySources = results.filter(r => r.status === 'healthy').length;
    const staleSources = results.filter(r => r.status === 'stale').length;
    const criticalSources = results.filter(r => r.status === 'critical' || r.status === 'no_data').length;

    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalSources > 0) {
      overallStatus = 'critical';
    } else if (staleSources > 0) {
      overallStatus = 'degraded';
    }

    return {
      totalSources,
      healthySources,
      staleSources,
      criticalSources,
      overallStatus,
    };
  }
}

export const dataIngestionMonitor = new DataIngestionMonitorService();