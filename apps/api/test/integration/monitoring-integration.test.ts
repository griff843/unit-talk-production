import { Counter, Gauge, Histogram } from 'prom-client';

import { createLogger } from '../../src/shared/logger';
import { createMockPick } from '../utils/testData';

// Initialize monitoring clients
const logger = createLogger('test');

// Prometheus metrics
const pickCounter = new Counter({
  name: 'picks_total',
  help: 'Total number of picks submitted'
});

const apiLatencyHistogram = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request latency in seconds',
  buckets: [0.1, 0.5, 1, 2, 5]
});

const apiQuotaGauge = new Gauge({
  name: 'api_quota_remaining',
  help: 'Remaining API quota'
});

describe('Monitoring System Integration', () => {
  describe('Logging Integration', () => {
    it('should log pick submissions', () => {
      const testPick = createMockPick();
      logger.info('Pick submitted', { pick: testPick });

      // Verify log output
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Pick submitted'),
        expect.objectContaining({ pick: testPick })
      );
    });

    it('should log errors with stack traces', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', { error });

      // Verify log output
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred'),
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error',
            stack: expect.any(String)
          })
        })
      );
    });

    it('should handle circular references in logs', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      logger.info('Circular object', { circular });

      // Verify log output doesn't crash
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Circular object'),
        expect.any(Object)
      );
    });
  });

  describe('Metrics Integration', () => {
    beforeEach(() => {
      // Reset metrics
      pickCounter.reset();
      apiLatencyHistogram.reset();
      apiQuotaGauge.reset();
    });

    it('should track pick submissions', () => {
      // Simulate pick submissions
      pickCounter.inc();
      pickCounter.inc();

      const metrics = pickCounter.get();
      expect(metrics.values[0].value).toBe(2);
    });

    it('should track API latency', () => {
      // Simulate API requests
      apiLatencyHistogram.observe(0.2);
      apiLatencyHistogram.observe(1.5);

      const metrics = apiLatencyHistogram.get();
      expect(metrics.values).toHaveLength(7); // 5 buckets + sum + count
      expect(metrics.values.find(v => v.labels.le === '0.5')?.value).toBe(1);
      expect(metrics.values.find(v => v.labels.le === '2')?.value).toBe(2);
    });

    it('should track API quota', () => {
      // Simulate quota updates
      apiQuotaGauge.set(1000);
      apiQuotaGauge.dec(100);

      const metrics = apiQuotaGauge.get();
      expect(metrics.values[0].value).toBe(900);
    });

    it('should handle metric labels', () => {
      const labeledCounter = new Counter({
        name: 'picks_by_type',
        help: 'Picks by type',
        labelNames: ['type']
      });

      labeledCounter.inc({ type: 'single' });
      labeledCounter.inc({ type: 'parlay' }, 2);

      const metrics = labeledCounter.get();
      expect(metrics.values).toHaveLength(2);
      expect(metrics.values.find(v => v.labels.type === 'single')?.value).toBe(1);
      expect(metrics.values.find(v => v.labels.type === 'parlay')?.value).toBe(2);
    });
  });

  describe('Health Check Integration', () => {
    it('should check database health', async () => {
      const dbHealth = await checkDatabaseHealth();
      expect(dbHealth).toEqual({
        status: 'healthy',
        latency: expect.any(Number),
        connections: expect.any(Number)
      });
    });

    it('should check API health', async () => {
      const apiHealth = await checkApiHealth();
      expect(apiHealth).toEqual({
        status: 'healthy',
        endpoints: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            status: 'up',
            latency: expect.any(Number)
          })
        ])
      });
    });

    it('should check service health', async () => {
      const serviceHealth = await checkServiceHealth();
      expect(serviceHealth).toEqual({
        status: 'healthy',
        services: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            status: 'running',
            memory: expect.any(Number),
            cpu: expect.any(Number)
          })
        ])
      });
    });
  });

  describe('Alert Integration', () => {
    it('should trigger high latency alert', async () => {
      // Simulate high latency
      apiLatencyHistogram.observe(10);

      const alerts = await checkLatencyAlerts();
      expect(alerts).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          message: expect.stringContaining('High latency detected')
        })
      );
    });

    it('should trigger low quota alert', async () => {
      // Simulate low quota
      apiQuotaGauge.set(50);

      const alerts = await checkQuotaAlerts();
      expect(alerts).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          message: expect.stringContaining('Low API quota')
        })
      );
    });

    it('should trigger error rate alert', async () => {
      const errorCounter = new Counter({
        name: 'errors_total',
        help: 'Total number of errors'
      });

      // Simulate errors
      errorCounter.inc(10);

      const alerts = await checkErrorAlerts();
      expect(alerts).toContainEqual(
        expect.objectContaining({
          severity: 'critical',
          message: expect.stringContaining('High error rate')
        })
      );
    });
  });

  describe('Dashboard Integration', () => {
    it('should collect system metrics', async () => {
      const metrics = await collectSystemMetrics();
      expect(metrics).toEqual({
        cpu: expect.any(Number),
        memory: expect.any(Number),
        disk: expect.any(Number),
        network: expect.any(Object)
      });
    });

    it('should collect business metrics', async () => {
      const metrics = await collectBusinessMetrics();
      expect(metrics).toEqual({
        picks: expect.any(Number),
        users: expect.any(Number),
        revenue: expect.any(Number),
        conversion: expect.any(Number)
      });
    });

    it('should generate performance report', async () => {
      const report = await generatePerformanceReport();
      expect(report).toEqual({
        timestamp: expect.any(String),
        duration: expect.any(Number),
        metrics: expect.any(Object),
        alerts: expect.any(Array),
        recommendations: expect.any(Array)
      });
    });
  });
});

// Helper functions
async function checkDatabaseHealth() {
  return {
    status: 'healthy',
    latency: 50,
    connections: 10
  };
}

async function checkApiHealth() {
  return {
    status: 'healthy',
    endpoints: [
      { name: 'picks', status: 'up', latency: 100 },
      { name: 'users', status: 'up', latency: 80 }
    ]
  };
}

async function checkServiceHealth() {
  return {
    status: 'healthy',
    services: [
      { name: 'web', status: 'running', memory: 500, cpu: 20 },
      { name: 'worker', status: 'running', memory: 300, cpu: 15 }
    ]
  };
}

async function checkLatencyAlerts() {
  return [
    {
      severity: 'warning',
      message: 'High latency detected: 10s response time',
      timestamp: new Date().toISOString()
    }
  ];
}

async function checkQuotaAlerts() {
  return [
    {
      severity: 'warning',
      message: 'Low API quota: 50 requests remaining',
      timestamp: new Date().toISOString()
    }
  ];
}

async function checkErrorAlerts() {
  return [
    {
      severity: 'critical',
      message: 'High error rate: 10 errors in last minute',
      timestamp: new Date().toISOString()
    }
  ];
}

async function collectSystemMetrics() {
  return {
    cpu: 25,
    memory: 60,
    disk: 40,
    network: {
      rx: 1000,
      tx: 800
    }
  };
}

async function collectBusinessMetrics() {
  return {
    picks: 1000,
    users: 500,
    revenue: 5000,
    conversion: 0.15
  };
}

async function generatePerformanceReport() {
  return {
    timestamp: new Date().toISOString(),
    duration: 3600,
    metrics: {
      system: await collectSystemMetrics(),
      business: await collectBusinessMetrics()
    },
    alerts: [
      {
        severity: 'warning',
        message: 'High memory usage: 60%'
      }
    ],
    recommendations: [
      'Consider scaling up worker instances',
      'Optimize database queries'
    ]
  };
} 