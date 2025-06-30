import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { createServer, Server } from 'http';
import { RecapError } from '../../types/picks';

/**
 * PrometheusMetrics - Exposes recap metrics for monitoring
 * Provides comprehensive metrics for production monitoring
 */
export class PrometheusMetrics {
  private server?: Server;
  private port: number;
  
  // Metrics
  private recapsSentCounter: Counter<string>;
  private recapsFailedCounter: Counter<string>;
  private microRecapsCounter: Counter<string>;
  private slashCommandsCounter: Counter<string>;
  private notionSyncsCounter: Counter<string>;
  private processingTimeHistogram: Histogram<string>;
  private activeRecapsGauge: Gauge<string>;
  private roiWatcherGauge: Gauge<string>;

  constructor(port: number = 3001) {
    this.port = port;
    
    // Initialize metrics
    this.recapsSentCounter = new Counter({
      name: 'recap_agent_recaps_sent_total',
      help: 'Total number of recaps sent successfully',
      labelNames: ['period', 'type']
    });

    this.recapsFailedCounter = new Counter({
      name: 'recap_agent_recaps_failed_total',
      help: 'Total number of failed recap attempts',
      labelNames: ['period', 'error_type']
    });

    this.microRecapsCounter = new Counter({
      name: 'recap_agent_micro_recaps_total',
      help: 'Total number of micro-recaps sent',
      labelNames: ['trigger']
    });

    this.slashCommandsCounter = new Counter({
      name: 'recap_agent_slash_commands_total',
      help: 'Total number of slash commands processed',
      labelNames: ['command', 'period']
    });

    this.notionSyncsCounter = new Counter({
      name: 'recap_agent_notion_syncs_total',
      help: 'Total number of Notion syncs completed',
      labelNames: ['period', 'status']
    });

    this.processingTimeHistogram = new Histogram({
      name: 'recap_agent_processing_duration_seconds',
      help: 'Time spent processing recaps',
      labelNames: ['period', 'operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.activeRecapsGauge = new Gauge({
      name: 'recap_agent_active_recaps',
      help: 'Number of recaps currently being processed',
      labelNames: ['period']
    });

    this.roiWatcherGauge = new Gauge({
      name: 'recap_agent_roi_watcher_state',
      help: 'Current ROI watcher state',
      labelNames: ['metric']
    });

    // Collect default Node.js metrics
    collectDefaultMetrics({ prefix: 'recap_agent_' });
  }

  /**
   * Initialize metrics server
   */
  async initialize(): Promise<void> {
    try {
      this.server = createServer(async (req, res) => {
        if (req.url === '/metrics') {
          res.setHeader('Content-Type', register.contentType);
          const metrics = await register.metrics();
          res.end(metrics);
        } else if (req.url === '/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
        } else {
          res.statusCode = 404;
          res.end('Not Found');
        }
      });

      this.server.listen(this.port, () => {
        console.log(`Prometheus metrics server listening on port ${this.port}`);
      });

    } catch (error) {
      throw new RecapError({
        code: 'METRICS_INIT_FAILED',
        message: `Failed to initialize metrics server: ${error}`,
        timestamp: new Date().toISOString(),
        severity: 'medium'
      });
    }
  }

  /**
   * Increment recaps sent counter
   */
  incrementRecapsSent(period: string, type: string = 'scheduled'): void {
    this.recapsSentCounter.inc({ period, type });
  }

  /**
   * Increment recaps failed counter
   */
  incrementRecapsFailed(period: string = 'unknown', errorType: string = 'unknown'): void {
    this.recapsFailedCounter.inc({ period, error_type: errorType });
  }

  /**
   * Increment micro-recaps counter
   */
  incrementMicroRecaps(trigger: string = 'unknown'): void {
    this.microRecapsCounter.inc({ trigger });
  }

  /**
   * Increment slash commands counter
   */
  incrementSlashCommands(command: string = 'recap', period: string = 'unknown'): void {
    this.slashCommandsCounter.inc({ command, period });
  }

  /**
   * Increment Notion syncs counter
   */
  incrementNotionSyncs(period: string, status: string = 'success'): void {
    this.notionSyncsCounter.inc({ period, status });
  }

  /**
   * Record processing time
   */
  recordProcessingTime(durationMs: number, period: string = 'unknown', operation: string = 'recap'): void {
    this.processingTimeHistogram.observe({ period, operation }, durationMs / 1000);
  }

  /**
   * Set active recaps gauge
   */
  setActiveRecaps(count: number, period: string): void {
    this.activeRecapsGauge.set({ period }, count);
  }

  /**
   * Update ROI watcher state
   */
  updateRoiWatcherState(currentRoi: number, threshold: number, lastCheck: Date): void {
    this.roiWatcherGauge.set({ metric: 'current_roi' }, currentRoi);
    this.roiWatcherGauge.set({ metric: 'threshold' }, threshold);
    this.roiWatcherGauge.set({ metric: 'last_check_timestamp' }, lastCheck.getTime());
  }

  /**
   * Get current metrics as JSON
   */
  async getMetrics(): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    return {
      timestamp: new Date().toISOString(),
      metrics: metrics.reduce((acc: any, metric: any) => {
        acc[metric.name] = metric;
        return acc;
      }, {})
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    register.resetMetrics();
  }

  /**
   * Get metrics summary for health checks
   */
  async getMetricsSummary(): Promise<any> {
    const metrics = await this.getMetrics();
    
    return {
      recapsSent: this.getMetricValue(metrics, 'recap_agent_recaps_sent_total'),
      recapsFailed: this.getMetricValue(metrics, 'recap_agent_recaps_failed_total'),
      microRecaps: this.getMetricValue(metrics, 'recap_agent_micro_recaps_total'),
      slashCommands: this.getMetricValue(metrics, 'recap_agent_slash_commands_total'),
      notionSyncs: this.getMetricValue(metrics, 'recap_agent_notion_syncs_total'),
      avgProcessingTime: this.getMetricValue(metrics, 'recap_agent_processing_duration_seconds'),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Helper to extract metric values
   */
  private getMetricValue(metrics: any, metricName: string): number {
    const metric = metrics.metrics[metricName];
    if (!metric || !metric.values) return 0;
    
    return metric.values.reduce((sum: number, value: any) => sum + (value.value || 0), 0);
  }

  /**
   * Create custom metric
   */
  createCustomCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
    return new Counter({
      name: `recap_agent_${name}`,
      help,
      labelNames
    });
  }

  /**
   * Create custom histogram
   */
  createCustomHistogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): Histogram<string> {
    return new Histogram({
      name: `recap_agent_${name}`,
      help,
      labelNames,
      ...(buckets && { buckets })
    });
  }

  /**
   * Create custom gauge
   */
  createCustomGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
    return new Gauge({
      name: `recap_agent_${name}`,
      help,
      labelNames
    });
  }

  /**
   * Export metrics for external monitoring
   */
  async exportMetrics(): Promise<string> {
    return await register.metrics();
  }

  /**
   * Get server status
   */
  getServerStatus(): any {
    return {
      running: !!this.server,
      port: this.port,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('Prometheus metrics server stopped');
          resolve();
        });
      });
    }
  }
}