import { register, collectDefaultMetrics, Gauge, Counter, Histogram, Summary } from 'prom-client';
import { logger } from '../services/logging';
import * as http from 'http';

// Collect default Node.js metrics
collectDefaultMetrics();

// Custom metrics for Unit Talk platform
export class UnitTalkMetrics {
  // Agent-specific metrics
  public readonly agentProcessingTime = new Histogram({
    name: 'unit_talk_agent_processing_duration_seconds',
    help: 'Time spent processing by each agent',
    labelNames: ['agent_name', 'operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  });

  public readonly agentErrors = new Counter({
    name: 'unit_talk_agent_errors_total',
    help: 'Total number of agent errors',
    labelNames: ['agent_name', 'error_type']
  });

  public readonly agentHealthStatus = new Gauge({
    name: 'unit_talk_agent_health_status',
    help: 'Health status of agents (1 = healthy, 0 = unhealthy)',
    labelNames: ['agent_name', 'service']
  });

  // Alert-specific metrics
  public readonly alertsSent = new Counter({
    name: 'unit_talk_alerts_sent_total',
    help: 'Total number of alerts sent',
    labelNames: ['channel', 'tier', 'advice_type']
  });

  public readonly alertsProcessingTime = new Histogram({
    name: 'unit_talk_alerts_processing_duration_seconds',
    help: 'Time spent processing alerts',
    buckets: [0.5, 1, 2, 5, 10, 30, 60]
  });

  public readonly alertsSkipped = new Counter({
    name: 'unit_talk_alerts_skipped_total',
    help: 'Total number of alerts skipped',
    labelNames: ['reason']
  });

  // AI/ML metrics
  public readonly aiModelRequests = new Counter({
    name: 'unit_talk_ai_model_requests_total',
    help: 'Total number of AI model requests',
    labelNames: ['model_id', 'provider', 'status']
  });

  public readonly aiModelLatency = new Histogram({
    name: 'unit_talk_ai_model_latency_seconds',
    help: 'AI model response latency',
    labelNames: ['model_id', 'provider'],
    buckets: [0.5, 1, 2, 5, 10, 30]
  });

  public readonly aiModelAccuracy = new Gauge({
    name: 'unit_talk_ai_model_accuracy',
    help: 'AI model accuracy score',
    labelNames: ['model_id', 'provider']
  });

  public readonly aiModelCost = new Counter({
    name: 'unit_talk_ai_model_cost_total',
    help: 'Total cost of AI model usage',
    labelNames: ['model_id', 'provider']
  });

  // Business metrics
  public readonly picksProcessed = new Counter({
    name: 'unit_talk_picks_processed_total',
    help: 'Total number of picks processed',
    labelNames: ['tier', 'market_type', 'status']
  });

  public readonly pickAccuracy = new Gauge({
    name: 'unit_talk_pick_accuracy',
    help: 'Pick accuracy by tier and time period',
    labelNames: ['tier', 'time_period']
  });

  public readonly userEngagement = new Gauge({
    name: 'unit_talk_user_engagement',
    help: 'User engagement metrics',
    labelNames: ['metric_type', 'time_period']
  });

  public readonly revenueMetrics = new Gauge({
    name: 'unit_talk_revenue',
    help: 'Revenue metrics',
    labelNames: ['metric_type', 'time_period']
  });

  // System metrics
  public readonly databaseConnections = new Gauge({
    name: 'unit_talk_database_connections',
    help: 'Number of active database connections',
    labelNames: ['database']
  });

  public readonly queueSize = new Gauge({
    name: 'unit_talk_queue_size',
    help: 'Size of processing queues',
    labelNames: ['queue_name']
  });

  public readonly rateLimitHits = new Counter({
    name: 'unit_talk_rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['service', 'endpoint']
  });

  // Performance tracking
  public readonly performanceSummary = new Summary({
    name: 'unit_talk_performance_summary',
    help: 'Performance summary statistics',
    labelNames: ['operation', 'component'],
    percentiles: [0.5, 0.9, 0.95, 0.99]
  });

  // Record agent processing time
  recordAgentProcessing(agentName: string, operation: string, duration: number): void {
    this.agentProcessingTime
      .labels(agentName, operation)
      .observe(duration);
  }

  // Record agent error
  recordAgentError(agentName: string, errorType: string): void {
    this.agentErrors
      .labels(agentName, errorType)
      .inc();
  }

  // Update agent health status
  updateAgentHealth(agentName: string, service: string, isHealthy: boolean): void {
    this.agentHealthStatus
      .labels(agentName, service)
      .set(isHealthy ? 1 : 0);
  }

  // Record alert sent
  recordAlertSent(channel: string, tier: string, adviceType: string): void {
    this.alertsSent
      .labels(channel, tier, adviceType)
      .inc();
  }

  // Record AI model request
  recordAIModelRequest(modelId: string, provider: string, status: string, latency?: number, cost?: number): void {
    this.aiModelRequests
      .labels(modelId, provider, status)
      .inc();

    if (latency !== undefined) {
      this.aiModelLatency
        .labels(modelId, provider)
        .observe(latency);
    }

    if (cost !== undefined) {
      this.aiModelCost
        .labels(modelId, provider)
        .inc(cost);
    }
  }

  // Update AI model accuracy
  updateAIModelAccuracy(modelId: string, provider: string, accuracy: number): void {
    this.aiModelAccuracy
      .labels(modelId, provider)
      .set(accuracy);
  }

  // Record pick processing
  recordPickProcessed(tier: string, marketType: string, status: string): void {
    this.picksProcessed
      .labels(tier, marketType, status)
      .inc();
  }

  // Update business metrics
  updateBusinessMetric(metricType: string, timePeriod: string, value: number): void {
    this.userEngagement
      .labels(metricType, timePeriod)
      .set(value);
  }

  // Record performance summary
  recordPerformance(operation: string, component: string, duration: number): void {
    this.performanceSummary
      .labels(operation, component)
      .observe(duration);
  }
}

// Global metrics instance
export const metrics = new UnitTalkMetrics();

// Enhanced Dashboard with real-time monitoring
export class EnhancedDashboard {
  private server: http.Server | null = null;
  private port: number;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3001) {
    this.port = port;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer(async (req, res) => {
          const url = req.url || '/';
          
          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
          }

          try {
            if (url === '/metrics') {
              res.setHeader('Content-Type', register.contentType);
              const metricsData = await register.metrics();
              res.writeHead(200);
              res.end(metricsData);
            } else if (url === '/health') {
              res.setHeader('Content-Type', 'application/json');
              const healthData = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0'
              };
              res.writeHead(200);
              res.end(JSON.stringify(healthData, null, 2));
            } else if (url === '/dashboard') {
              res.setHeader('Content-Type', 'application/json');
              const dashboardData = await this.getDashboardData();
              res.writeHead(200);
              res.end(JSON.stringify(dashboardData, null, 2));
            } else if (url === '/') {
              res.setHeader('Content-Type', 'text/html');
              res.writeHead(200);
              res.end(this.getDashboardHTML());
            } else {
              res.writeHead(404);
              res.end('Not Found');
            }
          } catch (error) {
            logger.error('Dashboard request error:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
          }
        });

        this.server.listen(this.port, () => {
          logger.info(`Enhanced Dashboard started on port ${this.port}`);
          logger.info(`Dashboard URL: http://localhost:${this.port}`);
          logger.info(`Metrics URL: http://localhost:${this.port}/metrics`);
          
          // Start periodic metric updates
          this.startPeriodicUpdates();
          
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      if (this.server) {
        this.server.close(() => {
          logger.info('Enhanced Dashboard stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async getDashboardData(): Promise<any> {
    const metricsData = await register.getMetricsAsJSON();
    
    return {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      metrics: this.processMetricsData(metricsData),
      summary: {
        totalAgents: this.getMetricValue(metricsData, 'unit_talk_agent_health_status'),
        totalAlerts: this.getMetricValue(metricsData, 'unit_talk_alerts_sent_total'),
        totalPicks: this.getMetricValue(metricsData, 'unit_talk_picks_processed_total'),
        avgProcessingTime: this.getMetricValue(metricsData, 'unit_talk_agent_processing_duration_seconds')
      }
    };
  }

  private processMetricsData(metricsData: any[]): any {
    return metricsData.reduce((acc, metric) => {
      acc[metric.name] = {
        help: metric.help,
        type: metric.type,
        values: metric.values || []
      };
      return acc;
    }, {});
  }

  private getMetricValue(metricsData: any[], metricName: string): number {
    const metric = metricsData.find(m => m.name === metricName);
    if (!metric || !metric.values || metric.values.length === 0) return 0;
    
    return metric.values.reduce((sum: number, val: any) => sum + (val.value || 0), 0);
  }

  private getDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Unit Talk Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #2c3e50; }
        .metric-value { font-size: 24px; font-weight: bold; color: #27ae60; }
        .status-healthy { color: #27ae60; }
        .status-unhealthy { color: #e74c3c; }
        .nav { margin-bottom: 20px; }
        .nav a { margin-right: 15px; padding: 8px 16px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; }
        .nav a:hover { background: #2980b9; }
    </style>
    <script>
        async function loadDashboard() {
            try {
                const response = await fetch('/dashboard');
                const data = await response.json();
                updateDashboard(data);
            } catch (error) {
                console.error('Failed to load dashboard:', error);
            }
        }
        
        function updateDashboard(data) {
            document.getElementById('uptime').textContent = Math.floor(data.system.uptime) + 's';
            document.getElementById('memory').textContent = Math.floor(data.system.memory.used / 1024 / 1024) + 'MB';
            document.getElementById('alerts').textContent = data.summary.totalAlerts || 0;
            document.getElementById('picks').textContent = data.summary.totalPicks || 0;
        }
        
        setInterval(loadDashboard, 30000); // Refresh every 30 seconds
        window.onload = loadDashboard;
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Unit Talk Dashboard</h1>
            <p>Real-time monitoring and analytics for the Unit Talk platform</p>
        </div>
        
        <div class="nav">
            <a href="/dashboard">Dashboard</a>
            <a href="/health">Health</a>
            <a href="/metrics">Metrics</a>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">System Uptime</div>
                <div class="metric-value" id="uptime">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Memory Usage</div>
                <div class="metric-value" id="memory">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Total Alerts Sent</div>
                <div class="metric-value" id="alerts">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Picks Processed</div>
                <div class="metric-value" id="picks">Loading...</div>
            </div>
        </div>
        
        <div style="margin-top: 40px; text-align: center; color: #7f8c8d;">
            <p>Dashboard auto-refreshes every 30 seconds</p>
            <p>For detailed metrics, visit <a href="/metrics">/metrics</a></p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private startPeriodicUpdates(): void {
    // Update metrics every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);
  }

  private updateSystemMetrics(): void {
    // Update system-level metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // These would typically be gauges that get updated
    logger.debug('System metrics updated', {
      memory: memUsage,
      cpu: cpuUsage,
      uptime: process.uptime()
    });
  }
}

// Export the enhanced dashboard instance
export const dashboard = new EnhancedDashboard();