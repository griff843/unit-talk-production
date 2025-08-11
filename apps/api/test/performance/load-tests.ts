import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import autocannon from 'autocannon';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick, createMockCapper } from '../utils/testData';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

describe('Load Testing', () => {
  // Test data
  const testUsers = Array(2000).fill(null).map((_, i) => createMockUser({
    discord_id: `test-user-${i}`,
    discord_username: `TestUser${i}`,
    tier: i % 3 === 0 ? 'vip_plus' : i % 2 === 0 ? 'vip' : 'free'
  }));

  beforeAll(async () => {
    // Create test users
    await supabase.from('users').insert(testUsers);
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('users').delete().eq('discord_id', 'like', 'test-user-%');
  });

  describe('Concurrent User Load', () => {
    it('should handle 100 concurrent users (baseline)', async () => {
      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 100,
        duration: 10,
        workers: 2
      });

      // Verify performance metrics
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.latency.p99).toBeLessThan(1000); // 1 second
      expect(result.requests.average).toBeGreaterThan(50);
    });

    it('should handle 500 concurrent users (target)', async () => {
      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 500,
        duration: 30,
        workers: 4,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      // Verify performance metrics
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.latency.p95).toBeLessThan(2000); // 2 seconds
      expect(result.requests.average).toBeGreaterThan(200);
    });

    it('should handle 1000 concurrent users (peak)', async () => {
      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 1000,
        duration: 60,
        workers: 8,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      // Verify performance metrics
      expect(result.errors).toBeLessThan(10);
      expect(result.timeouts).toBeLessThan(5);
      expect(result.latency.p90).toBeLessThan(3000); // 3 seconds
      expect(result.requests.average).toBeGreaterThan(400);
    });

    it('should handle 2000 concurrent users (stress)', async () => {
      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 2000,
        duration: 120,
        workers: 12,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      // Verify performance metrics
      expect(result.errors).toBeLessThan(50);
      expect(result.timeouts).toBeLessThan(20);
      expect(result.latency.p75).toBeLessThan(5000); // 5 seconds
      expect(result.requests.average).toBeGreaterThan(800);
    });
  });

  describe('Database Load', () => {
    it('should handle concurrent database operations', async () => {
      const operations = Array(1000).fill(null).map((_, i) => {
        const userId = testUsers[i % testUsers.length].discord_id;
        return supabase.from('users')
          .select()
          .eq('discord_id', userId)
          .single();
      });

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(results.filter(r => r.error)).toHaveLength(0);
    });

    it('should handle concurrent write operations', async () => {
      const picks = Array(500).fill(null).map((_, i) => createMockPick({
        capper_discord_id: testUsers[i % testUsers.length].discord_id
      }));

      const startTime = Date.now();
      const { data, error } = await supabase.from('daily_picks').insert(picks);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(3000); // 3 seconds
      expect(error).toBeNull();
      expect(data).toHaveLength(picks.length);
    });
  });

  describe('API Load', () => {
    it('should handle concurrent API requests', async () => {
      const endpoints = [
        '/api/picks',
        '/api/users/profile',
        '/api/analytics/performance'
      ];

      const requests = Array(300).fill(null).map((_, i) => {
        const endpoint = endpoints[i % endpoints.length];
        return fetch(`${process.env.APP_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer test-token-${i % testUsers.length}`
          }
        });
      });

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(responses.filter(r => !r.ok)).toHaveLength(0);
    });

    it('should handle concurrent WebSocket connections', async () => {
      const connections = Array(200).fill(null).map((_, i) => {
        const ws = new WebSocket(`${process.env.WS_URL}?token=test-token-${i}`);
        return new Promise((resolve) => {
          ws.onopen = () => resolve(ws);
        });
      });

      const startTime = Date.now();
      const sockets = await Promise.all(connections);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(sockets.length).toBe(200);

      // Clean up
      sockets.forEach(ws => ws.close());
    });
  });

  describe('Cache Performance', () => {
    it('should improve performance with caching', async () => {
      // First request (uncached)
      const uncachedStart = Date.now();
      const uncachedResponse = await fetch(`${process.env.APP_URL}/api/analytics/summary`);
      const uncachedDuration = Date.now() - uncachedStart;

      // Second request (cached)
      const cachedStart = Date.now();
      const cachedResponse = await fetch(`${process.env.APP_URL}/api/analytics/summary`);
      const cachedDuration = Date.now() - cachedStart;

      // Verify cache improvement
      expect(cachedDuration).toBeLessThan(uncachedDuration * 0.5);
      expect(uncachedResponse.headers.get('x-cache')).toBe('MISS');
      expect(cachedResponse.headers.get('x-cache')).toBe('HIT');
    });

    it('should handle cache invalidation under load', async () => {
      const operations = Array(100).fill(null).map(async (_, i) => {
        // Write operation to trigger cache invalidation
        await supabase.from('daily_picks').insert(createMockPick({
          capper_discord_id: testUsers[i % testUsers.length].discord_id
        }));

        // Read operation that should get fresh data
        const response = await fetch(`${process.env.APP_URL}/api/picks/latest`);
        return response;
      });

      const startTime = Date.now();
      const responses = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(15000); // 15 seconds
      expect(responses.filter(r => !r.ok)).toHaveLength(0);
    });
  });

  describe('Resource Monitoring', () => {
    it('should monitor CPU usage under load', async () => {
      const startUsage = process.cpuUsage();
      
      // Generate load
      await autocannon({
        url: process.env.APP_URL!,
        connections: 500,
        duration: 30
      });

      const endUsage = process.cpuUsage(startUsage);
      const cpuPercent = (endUsage.user + endUsage.system) / 1000000;

      // Verify CPU usage
      expect(cpuPercent).toBeLessThan(80);
    });

    it('should monitor memory usage under load', async () => {
      const startMemory = process.memoryUsage();

      // Generate load
      await autocannon({
        url: process.env.APP_URL!,
        connections: 500,
        duration: 30
      });

      const endMemory = process.memoryUsage();
      const memoryIncrease = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;

      // Verify memory usage
      expect(memoryIncrease).toBeLessThan(500); // 500MB increase max
    });

    it('should monitor connection pool under load', async () => {
      const operations = Array(1000).fill(null).map(() =>
        supabase.from('users').select().limit(1)
      );

      const startTime = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Get pool stats
      const { data: poolStats } = await supabase.rpc('get_pool_stats');

      // Verify pool performance
      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(poolStats.total_connections).toBeLessThan(100);
      expect(poolStats.idle_connections).toBeGreaterThan(0);
    });
  });
}); 