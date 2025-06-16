#!/usr/bin/env tsx

/**
 * Simple System Health Monitor
 * Provides basic health checks and system status
 */

import express from 'express';
import { logger } from '../src/services/logging';

const app = express();
const PORT = process.env.MONITOR_PORT || 3001;

interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  details?: any;
}

class SimpleHealthMonitor {
  private healthChecks: Map<string, HealthStatus> = new Map();

  async checkAgentHealth(agentName: string): Promise<HealthStatus> {
    try {
      // Basic health check - can be expanded
      const status: HealthStatus = {
        service: agentName,
        status: 'healthy',
        lastCheck: new Date(),
        details: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid
        }
      };
      
      this.healthChecks.set(agentName, status);
      return status;
    } catch (error) {
      const status: HealthStatus = {
        service: agentName,
        status: 'unhealthy',
        lastCheck: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
      
      this.healthChecks.set(agentName, status);
      return status;
    }
  }

  getSystemStatus() {
    const services = Array.from(this.healthChecks.values());
    const healthy = services.filter(s => s.status === 'healthy').length;
    const total = services.length;
    
    return {
      overall: healthy === total ? 'healthy' : healthy > 0 ? 'degraded' : 'unhealthy',
      services,
      summary: {
        total,
        healthy,
        degraded: services.filter(s => s.status === 'degraded').length,
        unhealthy: services.filter(s => s.status === 'unhealthy').length
      },
      timestamp: new Date()
    };
  }
}

const monitor = new SimpleHealthMonitor();

// Routes
app.get('/health', (req, res) => {
  const status = monitor.getSystemStatus();
  res.json(status);
});

app.get('/health/:service', async (req, res) => {
  const { service } = req.params;
  const status = await monitor.checkAgentHealth(service);
  res.json(status);
});

app.get('/', (req, res) => {
  res.json({
    name: 'Unit Talk Production v3 - Health Monitor',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET /health - System health overview',
      'GET /health/:service - Individual service health',
      'GET / - This information'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🏥 Health Monitor running on port ${PORT}`);
  console.log(`🏥 Health Monitor Dashboard: http://localhost:${PORT}`);
  console.log(`📊 System Health: http://localhost:${PORT}/health`);
  
  // Initial health checks
  const coreAgents = [
    'AlertAgent',
    'AnalyticsAgent', 
    'DataAgent',
    'FeedAgent',
    'GradingAgent',
    'IngestionAgent',
    'NotificationAgent'
  ];
  
  coreAgents.forEach(agent => {
    monitor.checkAgentHealth(agent);
  });
});

export { monitor };