import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import autocannon from 'autocannon';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('Long-Running Stability Testing', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Extended Load Testing', () => {
    it('should maintain performance over extended period', async () => {
      const duration = 3600; // 1 hour
      const interval = 300; // 5 minutes
      const checkpoints = duration / interval;
      const metrics: any[] = [];

      for (let i = 0; i < checkpoints; i++) {
        const result = await autocannon({
          url: process.env.APP_URL!,
          connections: 100,
          duration: interval,
          workers: 4
        });

        metrics.push({
          timestamp: Date.now(),
          latency: result.latency,
          requests: result.requests,
          throughput: result.throughput,
          errors: result.errors,
          timeouts: result.timeouts
        });

        // Verify performance at each checkpoint
        expect(result.errors).toBeLessThan(100);
        expect(result.timeouts).toBeLessThan(50);
        expect(result.latency.p99).toBeLessThan(5000); // 5 seconds
      }

      // Verify performance consistency
      const latencies = metrics.map(m => m.latency.p99);
      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      const latencyVariance = maxLatency - minLatency;

      expect(latencyVariance).toBeLessThan(avgLatency * 0.5); // 50% variance max
    });

    it('should handle continuous data growth', async () => {
      const duration = 1800; // 30 minutes
      const interval = 60; // 1 minute
      const checkpoints = duration / interval;
      const metrics: any[] = [];

      for (let i = 0; i < checkpoints; i++) {
        // Add new data
        const newPicks = Array(100).fill(null).map(() => createMockPick());
        await supabase.from('daily_picks').insert(newPicks);

        // Measure query performance
        const startTime = Date.now();
        const { data, error } = await supabase
          .from('daily_picks')
          .select()
          .order('created_at', { ascending: false })
          .limit(1000);

        const queryTime = Date.now() - startTime;
        metrics.push({
          timestamp: Date.now(),
          queryTime,
          resultCount: data?.length || 0,
          error: error ? true : false
        });

        // Verify performance at each checkpoint
        expect(error).toBeNull();
        expect(queryTime).toBeLessThan(1000); // 1 second max

        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      }

      // Verify performance consistency
      const queryTimes = metrics.map(m => m.queryTime);
      const avgQueryTime = queryTimes.reduce((a, b) => a + b) / queryTimes.length;
      const maxQueryTime = Math.max(...queryTimes);
      const queryTimeIncrease = maxQueryTime - queryTimes[0];

      expect(queryTimeIncrease).toBeLessThan(avgQueryTime); // Linear growth max
    });
  });

  describe('Memory Leak Detection', () => {
    it('should maintain stable memory usage', async () => {
      const duration = 1800; // 30 minutes
      const interval = 60; // 1 minute
      const checkpoints = duration / interval;
      const memoryMetrics: any[] = [];

      for (let i = 0; i < checkpoints; i++) {
        // Perform memory-intensive operations
        const operations = Array(1000).fill(null).map(() => ({
          pick: createMockPick(),
          analysis: `Detailed analysis ${Math.random()}`,
          metrics: {
            confidence: Math.random(),
            risk: Math.random()
          }
        }));

        const memory = process.memoryUsage();
        memoryMetrics.push({
          timestamp: Date.now(),
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
          arrayBuffers: memory.arrayBuffers
        });

        // Clear operations
        operations.length = 0;
        global.gc && global.gc();

        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      }

      // Analyze memory growth
      const heapUsage = memoryMetrics.map(m => m.heapUsed);
      const initialHeap = heapUsage[0];
      const finalHeap = heapUsage[heapUsage.length - 1];
      const heapGrowth = finalHeap - initialHeap;
      const heapGrowthRate = heapGrowth / (duration / 60); // MB per minute

      expect(heapGrowthRate).toBeLessThan(1); // 1MB per minute max
    });

    it('should handle memory pressure cycles', async () => {
      const cycles = 10;
      const memoryMetrics: any[] = [];

      for (let i = 0; i < cycles; i++) {
        // Create memory pressure
        const largeData = Array(1000).fill(null).map(() => ({
          array: new Array(10000).fill('x'),
          object: { data: new Array(10000).fill('y') }
        }));

        const peakMemory = process.memoryUsage();
        memoryMetrics.push({
          cycle: i,
          phase: 'peak',
          heapUsed: peakMemory.heapUsed
        });

        // Clear memory
        largeData.length = 0;
        global.gc && global.gc();

        const recoveredMemory = process.memoryUsage();
        memoryMetrics.push({
          cycle: i,
          phase: 'recovered',
          heapUsed: recoveredMemory.heapUsed
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Analyze memory recovery
      const recoveries = memoryMetrics.filter(m => m.phase === 'recovered');
      const initialRecovery = recoveries[0].heapUsed;
      const finalRecovery = recoveries[recoveries.length - 1].heapUsed;
      const recoveryDrift = finalRecovery - initialRecovery;

      expect(recoveryDrift).toBeLessThan(10 * 1024 * 1024); // 10MB drift max
    });
  });

  describe('Connection Stability', () => {
    it('should maintain WebSocket connections', async () => {
      const duration = 1800; // 30 minutes
      const connections = Array(50).fill(null).map(() => {
        const ws = new WebSocket(`${process.env.WS_URL}?token=test-token`);
        return new Promise<WebSocket>((resolve) => {
          ws.onopen = () => resolve(ws);
        });
      });

      const sockets = await Promise.all(connections);
      const metrics: any[] = [];

      // Monitor connections
      const interval = setInterval(() => {
        const activeConnections = sockets.filter(ws => ws.readyState === WebSocket.OPEN);
        metrics.push({
          timestamp: Date.now(),
          activeCount: activeConnections.length
        });
      }, 1000);

      // Wait for duration
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
      clearInterval(interval);

      // Close connections
      await Promise.all(sockets.map(ws => ws.close()));

      // Analyze connection stability
      const connectionCounts = metrics.map(m => m.activeCount);
      const minConnections = Math.min(...connectionCounts);
      const maxConnections = Math.max(...connectionCounts);
      const connectionVariance = maxConnections - minConnections;

      expect(minConnections).toBe(50); // All connections should stay active
      expect(connectionVariance).toBe(0); // No connection drops
    });

    it('should handle connection recovery', async () => {
      const duration = 1800; // 30 minutes
      const interval = 300; // 5 minutes
      const checkpoints = duration / interval;
      const metrics: any[] = [];

      for (let i = 0; i < checkpoints; i++) {
        // Simulate connection failures
        const connections = Array(20).fill(null).map(async () => {
          try {
            const ws = new WebSocket(`${process.env.WS_URL}?token=test-token`);
            await new Promise((resolve, reject) => {
              ws.onopen = resolve;
              ws.onerror = reject;
              setTimeout(reject, 5000); // 5s timeout
            });
            return { success: true, ws };
          } catch {
            return { success: false };
          }
        });

        const results = await Promise.all(connections);
        metrics.push({
          timestamp: Date.now(),
          successCount: results.filter(r => r.success).length
        });

        // Close successful connections
        await Promise.all(
          results
            .filter((r): r is { success: true; ws: WebSocket } => r.success)
            .map(r => r.ws.close())
        );

        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      }

      // Analyze connection reliability
      const successRates = metrics.map(m => m.successCount / 20);
      const avgSuccessRate = successRates.reduce((a, b) => a + b) / successRates.length;

      expect(avgSuccessRate).toBeGreaterThan(0.9); // 90% success rate
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data integrity under load', async () => {
      const duration = 1800; // 30 minutes
      const interval = 60; // 1 minute
      const checkpoints = duration / interval;
      const metrics: any[] = [];

      for (let i = 0; i < checkpoints; i++) {
        // Create test data
        const testPick = createMockPick();
        const { data: createdPick } = await supabase
          .from('daily_picks')
          .insert(testPick)
          .select()
          .single();

        // Perform concurrent operations
        const operations = await Promise.all([
          // Read
          supabase.from('daily_picks').select().eq('id', createdPick!.id),
          // Update
          supabase
            .from('daily_picks')
            .update({ status: 'graded' })
            .eq('id', createdPick!.id),
          // Delete
          supabase.from('daily_picks').delete().eq('id', createdPick!.id)
        ]);

        metrics.push({
          timestamp: Date.now(),
          success: operations.every(op => !op.error),
          errors: operations.filter(op => op.error).length
        });

        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      }

      // Analyze data consistency
      const errorRate = metrics.filter(m => !m.success).length / metrics.length;
      expect(errorRate).toBeLessThan(0.01); // 1% error rate max
    });

    it('should handle concurrent modifications', async () => {
      const duration = 1800; // 30 minutes
      const interval = 60; // 1 minute
      const checkpoints = duration / interval;
      const metrics: any[] = [];

      for (let i = 0; i < checkpoints; i++) {
        // Create test data
        const testPick = createMockPick();
        const { data: createdPick } = await supabase
          .from('daily_picks')
          .insert(testPick)
          .select()
          .single();

        // Perform concurrent modifications
        const modifications = Array(10).fill(null).map((_, j) =>
          supabase
            .from('daily_picks')
            .update({ status: `status-${j}` })
            .eq('id', createdPick!.id)
            .select()
        );

        const results = await Promise.all(modifications);
        metrics.push({
          timestamp: Date.now(),
          conflicts: results.filter(r => r.error?.code === '23505').length,
          errors: results.filter(r => r.error && r.error.code !== '23505').length
        });

        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      }

      // Analyze concurrency handling
      const errorRate = metrics.reduce((sum, m) => sum + m.errors, 0) / metrics.length;
      expect(errorRate).toBeLessThan(0.1); // 10% error rate max
    });
  });
}); 