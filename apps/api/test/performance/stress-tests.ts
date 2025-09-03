import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import autocannon from 'autocannon';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('System Stress Testing', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Memory Limits', () => {
    it('should handle large data sets', async () => {
      // Create large dataset
      const users = Array(10000).fill(null).map((_, i) => createMockUser({
        discord_id: `test-user-${i}`,
        discord_username: `TestUser${i}`
      }));

      const startMemory = process.memoryUsage();
      
      // Insert in batches
      const batchSize = 1000;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        await supabase.from('users').insert(batch);
      }

      const endMemory = process.memoryUsage();
      const memoryIncrease = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;

      // Verify memory usage
      expect(memoryIncrease).toBeLessThan(200); // 200MB increase max

      // Clean up
      await supabase.from('users').delete().eq('discord_id', 'like', 'test-user-%');
    });

    it('should handle memory-intensive operations', async () => {
      // Generate large dataset
      const picks = Array(5000).fill(null).map(() => createMockPick());

      // Memory-intensive operations
      const startMemory = process.memoryUsage();

      // Aggregate statistics
      const stats = picks.reduce((acc, pick) => {
        acc.totalUnits = (acc.totalUnits || 0) + pick.total_units;
        acc.picks = (acc.picks || 0) + 1;
        acc.results = acc.results || {};
        acc.results[pick.result] = (acc.results[pick.result] || 0) + 1;
        return acc;
      }, {});

      // Generate reports
      const reports = picks.map(pick => ({
        ...pick,
        analysis: `Detailed analysis for pick ${pick.id}...`,
        metrics: {
          winProbability: Math.random(),
          confidence: Math.random(),
          riskScore: Math.random()
        }
      }));

      const endMemory = process.memoryUsage();
      const memoryIncrease = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;

      // Verify memory usage
      expect(memoryIncrease).toBeLessThan(100); // 100MB increase max
    });
  });

  describe('CPU Limits', () => {
    it('should handle CPU-intensive calculations', async () => {
      const startUsage = process.cpuUsage();

      // CPU-intensive task
      const calculations = Array(1000000).fill(null).map(() => {
        const num = Math.random() * 1000;
        return Math.sqrt(Math.pow(num, 2) + Math.pow(num, 3));
      });

      const endUsage = process.cpuUsage(startUsage);
      const cpuTime = (endUsage.user + endUsage.system) / 1000000; // seconds

      // Verify CPU usage
      expect(cpuTime).toBeLessThan(5); // 5 seconds max
    });

    it('should handle concurrent CPU-intensive tasks', async () => {
      const startUsage = process.cpuUsage();

      // Multiple CPU-intensive tasks
      const tasks = Array(4).fill(null).map(() =>
        new Promise(resolve => {
          const results = [];
          for (let i = 0; i < 250000; i++) {
            const num = Math.random() * 1000;
            results.push(Math.sqrt(Math.pow(num, 2) + Math.pow(num, 3)));
          }
          resolve(results);
        })
      );

      await Promise.all(tasks);

      const endUsage = process.cpuUsage(startUsage);
      const cpuTime = (endUsage.user + endUsage.system) / 1000000; // seconds

      // Verify CPU usage
      expect(cpuTime).toBeLessThan(10); // 10 seconds max
    });
  });

  describe('Database Limits', () => {
    it('should handle connection pool exhaustion', async () => {
      // Create many concurrent connections
      const connections = Array(100).fill(null).map(() =>
        createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!
        )
      );

      const queries = connections.map(client =>
        client.from('users').select().limit(1)
      );

      const startTime = Date.now();
      const results = await Promise.all(queries);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(results.filter(r => r.error)).toHaveLength(0);
    });

    it('should handle large result sets', async () => {
      // Insert test data
      const testPicks = Array(10000).fill(null).map(() => createMockPick());
      await supabase.from('daily_picks').insert(testPicks);

      const startMemory = process.memoryUsage();

      // Fetch and process large result set
      const { data: picks, error } = await supabase
        .from('daily_picks')
        .select()
        .order('created_at', { ascending: false });

      const endMemory = process.memoryUsage();
      const memoryIncrease = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;

      // Verify performance
      expect(error).toBeNull();
      expect(picks).toHaveLength(10000);
      expect(memoryIncrease).toBeLessThan(50); // 50MB increase max

      // Clean up
      await supabase.from('daily_picks').delete().eq('id', 'in', picks!.map(p => p.id));
    });
  });

  describe('Network Limits', () => {
    it('should handle network saturation', async () => {
      // Generate large payload
      const largePayload = {
        data: Array(1000).fill('x').join(''),
        metadata: {
          timestamp: Date.now(),
          type: 'stress-test'
        }
      };

      // Send many concurrent requests
      const requests = Array(100).fill(null).map(() =>
        fetch(`${process.env.APP_URL}/api/test/echo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(largePayload)
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(10000); // 10 seconds max
      expect(responses.filter(r => !r.ok)).toHaveLength(0);
    });

    it('should handle network latency', async () => {
      // Simulate high-latency environment
      const results = await Promise.all(Array(50).fill(null).map(async () => {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000)); // Random delay
        const response = await fetch(`${process.env.APP_URL}/api/health`);
        const duration = Date.now() - startTime;
        return { duration, ok: response.ok };
      }));

      // Verify performance
      const failedRequests = results.filter(r => !r.ok).length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      expect(failedRequests).toBe(0);
      expect(avgDuration).toBeLessThan(2000); // 2 seconds average
    });
  });

  describe('Rate Limiting', () => {
    it('should handle API rate limiting', async () => {
      const result = await autocannon({
        url: `${process.env.APP_URL}/api/picks`,
        connections: 100,
        duration: 10,
        requests: [
          {
            method: 'GET',
            path: '/api/picks',
            headers: {
              'Authorization': `Bearer ${process.env.TEST_TOKEN}`
            }
          }
        ]
      });

      // Verify rate limiting
      expect(result.non2xx).toBeGreaterThan(0); // Some requests should be rate limited
      expect(result['4xx']).toBeGreaterThan(0); // Should get 429 responses
    });

    it('should handle database rate limiting', async () => {
      const operations = Array(1000).fill(null).map(() =>
        supabase.from('users').select().limit(1)
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - startTime;

      // Verify rate limiting
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(duration).toBeLessThan(30000); // 30 seconds max
      expect(succeeded).toBeGreaterThan(0);
      expect(failed).toBeGreaterThan(0);
    });
  });

  describe('Recovery Testing', () => {
    it('should recover from memory pressure', async () => {
      const initialMemory = process.memoryUsage();

      // Create memory pressure
      const largeArrays = Array(100).fill(null).map(() =>
        new Array(1000000).fill('x')
      );

      const underPressureMemory = process.memoryUsage();
      const memoryIncrease = (underPressureMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      // Clear memory
      largeArrays.length = 0;
      global.gc && global.gc();

      const recoveredMemory = process.memoryUsage();
      const memoryRecovered = (underPressureMemory.heapUsed - recoveredMemory.heapUsed) / 1024 / 1024;

      // Verify recovery
      expect(memoryIncrease).toBeGreaterThan(100); // Should have increased
      expect(memoryRecovered).toBeGreaterThan(50); // Should have recovered
    });

    it('should recover from connection exhaustion', async () => {
      // Exhaust connections
      const clients = Array(200).fill(null).map(() =>
        createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!
        )
      );

      // Try operations
      const results1 = await Promise.allSettled(
        clients.map(client => client.from('users').select().limit(1))
      );

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Try again
      const results2 = await Promise.allSettled(
        clients.map(client => client.from('users').select().limit(1))
      );

      // Verify recovery
      const failed1 = results1.filter(r => r.status === 'rejected').length;
      const failed2 = results2.filter(r => r.status === 'rejected').length;

      expect(failed1).toBeGreaterThan(0); // Some should fail initially
      expect(failed2).toBeLessThan(failed1); // Should recover
    });
  });
}); 