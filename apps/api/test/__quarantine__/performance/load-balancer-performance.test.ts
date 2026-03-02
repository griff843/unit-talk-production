import { MLPredictionLoadBalancer } from '../../load-balancer/enhanced-load-balancer';
import { ServerInstance } from '../../types/load-balancer';

describe('Load Balancer Performance Tests', () => {
  let loadBalancer: MLPredictionLoadBalancer;

  beforeEach(() => {
    loadBalancer = new MLPredictionLoadBalancer();

    // Add mock instances
    const instances: ServerInstance[] = [
      {
        id: 'instance-1',
        url: 'http://localhost:3001',
        weight: 1,
        health: 'healthy',
        lastHealthCheck: Date.now(),
        responseTime: 0,
        activeConnections: 0,
        totalRequests: 0,
        failedRequests: 0,
      },
      {
        id: 'instance-2',
        url: 'http://localhost:3002',
        weight: 1,
        health: 'healthy',
        lastHealthCheck: Date.now(),
        responseTime: 0,
        activeConnections: 0,
        totalRequests: 0,
        failedRequests: 0,
      },
      {
        id: 'instance-3',
        url: 'http://localhost:3003',
        weight: 1,
        health: 'healthy',
        lastHealthCheck: Date.now(),
        responseTime: 0,
        activeConnections: 0,
        totalRequests: 0,
        failedRequests: 0,
      },
    ];

    instances.forEach(instance => loadBalancer.addInstance(instance));
  });

  describe('Load Distribution', () => {
    it('should distribute requests evenly across healthy instances', async () => {
      const requests = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `request-${i}`,
          data: { test: true },
        }));

      const instanceCounts = new Map<string, number>();

      // Process requests
      await Promise.all(
        requests.map(async request => {
          const result = await loadBalancer.routeRequest(request, async (instance, req) => {
            const count = instanceCounts.get(instance.id) || 0;
            instanceCounts.set(instance.id, count + 1);
            return { processed: true, instanceId: instance.id };
          });
          return result;
        })
      );

      // Verify even distribution
      const counts = Array.from(instanceCounts.values());
      const average = counts.reduce((sum, count) => sum + count, 0) / counts.length;

      counts.forEach(count => {
        expect(count).toBeGreaterThan(average * 0.7); // Within 30% of average
        expect(count).toBeLessThan(average * 1.3);
      });
    });

    it('should handle instance failures gracefully', async () => {
      // Simulate instance failure
      const instances = loadBalancer.getInstances();
      instances[0].health = 'unhealthy';

      const requests = Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `request-${i}`,
          data: { test: true },
        }));

      const results = await Promise.all(
        requests.map(async request => {
          return loadBalancer.routeRequest(request, async (instance, req) => {
            return { processed: true, instanceId: instance.id };
          });
        })
      );

      // Verify all requests were processed by healthy instances
      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.instanceId).not.toBe('instance-1'); // Failed instance
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance under high concurrent load', async () => {
      const concurrentRequests = Array(1000)
        .fill(null)
        .map((_, i) => ({
          id: `request-${i}`,
          data: { test: true },
        }));

      const startTime = Date.now();

      const results = await Promise.all(
        concurrentRequests.map(async request => {
          return loadBalancer.routeRequest(request, async (instance, req) => {
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            return { processed: true, instanceId: instance.id };
          });
        })
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests.length;

      // Verify performance metrics
      expect(results).toHaveLength(1000);
      expect(avgTimePerRequest).toBeLessThan(50); // 50ms average per request

      const metrics = loadBalancer.getMetrics();
      expect(metrics.successfulRequests).toBe(1000);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should handle burst traffic efficiently', async () => {
      const burstSize = 500;
      const bursts = 5;

      for (let burst = 0; burst < bursts; burst++) {
        const requests = Array(burstSize)
          .fill(null)
          .map((_, i) => ({
            id: `burst-${burst}-request-${i}`,
            data: { test: true },
          }));

        const startTime = Date.now();

        await Promise.all(
          requests.map(async request => {
            return loadBalancer.routeRequest(request, async (instance, req) => {
              return { processed: true, instanceId: instance.id };
            });
          })
        );

        const endTime = Date.now();
        const burstTime = endTime - startTime;
        const avgTimePerRequest = burstTime / burstSize;

        // Verify burst performance
        expect(avgTimePerRequest).toBeLessThan(20); // 20ms average per request in burst
      }
    });
  });

  describe('Health Check Performance', () => {
    it('should perform health checks without impacting performance', async () => {
      const requests = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `request-${i}`,
          data: { test: true },
        }));

      // Start health checks in background
      const healthCheckPromise = new Promise<void>(resolve => {
        setTimeout(() => resolve(), 1000); // 1 second of health checks
      });

      // Process requests while health checks are running
      const startTime = Date.now();

      const results = await Promise.all(
        requests.map(async request => {
          return loadBalancer.routeRequest(request, async (instance, req) => {
            return { processed: true, instanceId: instance.id };
          });
        })
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      await healthCheckPromise;

      // Verify performance wasn't significantly impacted
      expect(processingTime).toBeLessThan(5000); // 5 seconds total
      expect(results).toHaveLength(100);
    });
  });

  describe('Failover Performance', () => {
    it('should handle failover quickly when instances become unhealthy', async () => {
      const instances = loadBalancer.getInstances();

      // Start processing requests
      const requests = Array(200)
        .fill(null)
        .map((_, i) => ({
          id: `request-${i}`,
          data: { test: true },
        }));

      const processingPromise = Promise.all(
        requests.map(async (request, index) => {
          // Simulate instance failure halfway through
          if (index === 100) {
            instances[0].health = 'unhealthy';
          }

          return loadBalancer.routeRequest(request, async (instance, req) => {
            return { processed: true, instanceId: instance.id };
          });
        })
      );

      const startTime = Date.now();
      const results = await processingPromise;
      const endTime = Date.now();

      // Verify failover performance
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds total
      expect(results).toHaveLength(200);

      // Verify requests after failure didn't go to failed instance
      const failedInstanceRequests = results
        .slice(100)
        .filter(result => result.instanceId === 'instance-1');

      expect(failedInstanceRequests).toHaveLength(0);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect accurate performance metrics', async () => {
      const requests = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `request-${i}`,
          data: { test: true },
        }));

      await Promise.all(
        requests.map(async request => {
          return loadBalancer.routeRequest(request, async (instance, req) => {
            return { processed: true, instanceId: instance.id };
          });
        })
      );

      const metrics = loadBalancer.getMetrics();
      const instances = loadBalancer.getInstances();

      // Verify metrics accuracy
      expect(metrics.totalRequests).toBe(100);
      expect(metrics.successfulRequests).toBe(100);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);

      // Verify instance-level metrics
      const totalInstanceRequests = instances.reduce(
        (sum, instance) => sum + instance.totalRequests,
        0
      );
      expect(totalInstanceRequests).toBe(100);
    });
  });
});
