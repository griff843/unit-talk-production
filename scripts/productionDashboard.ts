
#!/usr/bin/env tsx

/**
 * Production Monitoring Dashboard
 * Live metrics, health checks, error logs, alert triggers
 */

import express from 'express';
import { register, collectDefaultMetrics } from 'prom-client';
import { redis } from '../src/services/redis';

class ProductionMonitoringDashboard {
  private app: express.Application;
  private port: number = 3001;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    collectDefaultMetrics();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  private setupRoutes(): void {
    // Main dashboard
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });

    // System health endpoint
    this.app.get('/api/health', async (req, res) => {
      const health = await this.getSystemHealth();
      res.json(health);
    });

    // Agent status endpoint
    this.app.get('/api/agents', async (req, res) => {
      const agentStatus = await this.getAgentStatus();
      res.json(agentStatus);
    });

    // Error logs endpoint
    this.app.get('/api/errors', async (req, res) => {
      const errors = await this.getRecentErrors();
      res.json(errors);
    });

    // Alert triggers endpoint
    this.app.get('/api/alerts', async (req, res) => {
      const alerts = await this.getActiveAlerts();
      res.json(alerts);
    });
  }

  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Unit Talk Production Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-good { color: #27ae60; }
        .status-warning { color: #f39c12; }
        .status-error { color: #e74c3c; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .refresh-btn { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Unit Talk Production Dashboard</h1>
        <p>Real-time system monitoring and health checks</p>
        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
    </div>
    
    <div class="grid">
        <div class="card">
            <h3>📊 System Health</h3>
            <div id="system-health">Loading...</div>
        </div>
        
        <div class="card">
            <h3>🤖 Agent Status</h3>
            <div id="agent-status">Loading...</div>
        </div>
        
        <div class="card">
            <h3>🚨 Recent Errors</h3>
            <div id="error-logs">Loading...</div>
        </div>
        
        <div class="card">
            <h3>📢 Active Alerts</h3>
            <div id="active-alerts">Loading...</div>
        </div>
    </div>

    <script>
        async function loadDashboardData() {
            try {
                // Load system health
                const healthResponse = await fetch('/api/health');
                const health = await healthResponse.json();
                document.getElementById('system-health').innerHTML = formatHealth(health);
                
                // Load agent status
                const agentsResponse = await fetch('/api/agents');
                const agents = await agentsResponse.json();
                document.getElementById('agent-status').innerHTML = formatAgents(agents);
                
                // Load error logs
                const errorsResponse = await fetch('/api/errors');
                const errors = await errorsResponse.json();
                document.getElementById('error-logs').innerHTML = formatErrors(errors);
                
                // Load active alerts
                const alertsResponse = await fetch('/api/alerts');
                const alerts = await alertsResponse.json();
                document.getElementById('active-alerts').innerHTML = formatAlerts(alerts);
                
            } catch (error) {
                console.error('Dashboard load error:', error);
            }
        }
        
        function formatHealth(health) {
            return `
                <div class="metric">
                    <span>Status:</span>
                    <span class="status-good">✅ ${health.status}</span>
                </div>
                <div class="metric">
                    <span>Uptime:</span>
                    <span>${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m</span>
                </div>
                <div class="metric">
                    <span>Memory:</span>
                    <span>${Math.floor(health.memory.used / 1024 / 1024)}MB</span>
                </div>
                <div class="metric">
                    <span>Redis:</span>
                    <span class="${health.redis ? 'status-good' : 'status-error'}">${health.redis ? '✅ Connected' : '❌ Disconnected'}</span>
                </div>
            `;
        }
        
        function formatAgents(agents) {
            return agents.map(agent => `
                <div class="metric">
                    <span>${agent.name}:</span>
                    <span class="status-${agent.status === 'healthy' ? 'good' : 'error'}">${agent.status === 'healthy' ? '✅' : '❌'} ${agent.status}</span>
                </div>
            `).join('');
        }
        
        function formatErrors(errors) {
            if (errors.length === 0) return '<p class="status-good">✅ No recent errors</p>';
            return errors.slice(0, 5).map(error => `
                <div style="margin: 10px 0; padding: 10px; background: #ffeaa7; border-radius: 4px;">
                    <strong>${error.timestamp}</strong><br>
                    ${error.message}
                </div>
            `).join('');
        }
        
        function formatAlerts(alerts) {
            if (alerts.length === 0) return '<p class="status-good">✅ No active alerts</p>';
            return alerts.map(alert => `
                <div style="margin: 10px 0; padding: 10px; background: #fab1a0; border-radius: 4px;">
                    <strong>${alert.type.toUpperCase()}</strong><br>
                    ${alert.message}
                </div>
            `).join('');
        }
        
        // Load data on page load
        loadDashboardData();
        
        // Auto-refresh every 30 seconds
        setInterval(loadDashboardData, 30000);
    </script>
</body>
</html>
    `;
  }

  private async getSystemHealth(): Promise<any> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      redis: await redis.healthCheck()
    };
  }

  private async getAgentStatus(): Promise<any[]> {
    const agents = ['AlertAgent', 'DataAgent', 'IngestionAgent', 'RecapAgent', 'AnalyticsAgent'];
    return agents.map(name => ({
      name,
      status: 'healthy', // TODO: Implement actual health checks
      lastActivity: new Date().toISOString()
    }));
  }

  private async getRecentErrors(): Promise<any[]> {
    // TODO: Implement error log retrieval
    return [];
  }

  private async getActiveAlerts(): Promise<any[]> {
    // TODO: Implement active alert retrieval
    return [];
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log(`📊 Production Dashboard running on http://localhost:${this.port}`);
      console.log(`📈 Metrics available at http://localhost:${this.port}/metrics`);
      console.log(`🏥 Health API at http://localhost:${this.port}/api/health`);
    });
  }
}

const dashboard = new ProductionMonitoringDashboard();
dashboard.start();
