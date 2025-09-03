import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import autocannon from 'autocannon';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick, createMockCapper } from '../utils/testData';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

describe('Feature-Specific Load Testing', () => {
  // Test data
  const testUsers = Array(1000).fill(null).map((_, i) => createMockUser({
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

  describe('Pick Submission Load', () => {
    it('should handle concurrent single pick submissions', async () => {
      const picks = Array(500).fill(null).map((_, i) => ({
        url: `${process.env.APP_URL}/api/picks`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-token-${i}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createMockPick({
          capper_discord_id: testUsers[i].discord_id,
          pick_type: 'single'
        }))
      }));

      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 100,
        duration: 30,
        requests: picks
      });

      // Verify performance
      expect(result.errors).toBeLessThan(10);
      expect(result.timeouts).toBeLessThan(5);
      expect(result.latency.p95).toBeLessThan(2000); // 2 seconds
    });

    it('should handle concurrent parlay submissions', async () => {
      const parlays = Array(200).fill(null).map((_, i) => ({
        url: `${process.env.APP_URL}/api/picks`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-token-${i}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createMockPick({
          capper_discord_id: testUsers[i].discord_id,
          pick_type: 'parlay',
          legs: [
            { game: 'Game 1', selection: 'Team A', odds: -110 },
            { game: 'Game 2', selection: 'Team B', odds: -120 }
          ]
        }))
      }));

      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 50,
        duration: 30,
        requests: parlays
      });

      // Verify performance
      expect(result.errors).toBeLessThan(5);
      expect(result.timeouts).toBeLessThan(3);
      expect(result.latency.p95).toBeLessThan(3000); // 3 seconds
    });

    it('should handle pick validation under load', async () => {
      const validations = Array(1000).fill(null).map((_, i) => ({
        url: `${process.env.APP_URL}/api/picks/validate`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-token-${i}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          game: 'Lakers vs Warriors',
          selection: 'Lakers -5.5',
          odds: -110
        })
      }));

      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 200,
        duration: 30,
        requests: validations
      });

      // Verify performance
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.latency.p99).toBeLessThan(500); // 500ms
    });
  });

  describe('Dashboard Load', () => {
    it('should handle concurrent dashboard loads', async () => {
      const result = await autocannon({
        url: `${process.env.APP_URL}/dashboard`,
        connections: 500,
        duration: 30,
        workers: 4
      });

      // Verify performance
      expect(result.errors).toBeLessThan(10);
      expect(result.timeouts).toBeLessThan(5);
      expect(result.latency.p95).toBeLessThan(2000); // 2 seconds
      expect(result.requests.average).toBeGreaterThan(200);
    });

    it('should handle real-time updates', async () => {
      const wsConnections = Array(200).fill(null).map((_, i) => {
        const ws = new WebSocket(`${process.env.WS_URL}/dashboard?token=test-token-${i}`);
        return new Promise((resolve) => {
          ws.onopen = () => resolve(ws);
        });
      });

      const startTime = Date.now();
      const sockets = await Promise.all(wsConnections);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(sockets.length).toBe(200);

      // Test message broadcast
      const messagePromises = sockets.map(ws =>
        new Promise(resolve => {
          ws.onmessage = (event) => resolve(JSON.parse(event.data));
        })
      );

      // Trigger update
      await supabase.from('daily_picks').insert(createMockPick());

      const messages = await Promise.all(messagePromises);
      expect(messages.filter(m => m.type === 'pick_update')).toHaveLength(200);

      // Clean up
      sockets.forEach(ws => ws.close());
    });

    it('should handle concurrent chart rendering', async () => {
      const chartRequests = Array(300).fill(null).map((_, i) => ({
        url: `${process.env.APP_URL}/api/charts/performance`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-token-${i}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'line',
          metric: 'win_rate',
          timeframe: '30d'
        })
      }));

      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 100,
        duration: 30,
        requests: chartRequests
      });

      // Verify performance
      expect(result.errors).toBeLessThan(5);
      expect(result.timeouts).toBeLessThan(3);
      expect(result.latency.p95).toBeLessThan(3000); // 3 seconds
    });
  });

  describe('AI Analysis Load', () => {
    it('should handle concurrent AI pick analysis', async () => {
      const analysisRequests = Array(100).fill(null).map((_, i) => ({
        url: `${process.env.APP_URL}/api/ai/analyze-pick`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-token-${i}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          game: 'Lakers vs Warriors',
          selection: 'Lakers -5.5',
          odds: -110
        })
      }));

      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 50,
        duration: 60,
        requests: analysisRequests
      });

      // Verify performance
      expect(result.errors).toBeLessThan(5);
      expect(result.timeouts).toBeLessThan(3);
      expect(result.latency.p95).toBeLessThan(5000); // 5 seconds
    });

    it('should handle AI model fallback under load', async () => {
      const requests = Array(200).fill(null).map((_, i) => ({
        url: `${process.env.APP_URL}/api/ai/analyze-pick`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-token-${i}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          game: 'Lakers vs Warriors',
          selection: 'Lakers -5.5',
          odds: -110,
          force_error: i % 2 === 0 // Force primary model error for half the requests
        })
      }));

      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 50,
        duration: 60,
        requests
      });

      // Verify performance
      expect(result.errors).toBe(0); // All requests should succeed with fallback
      expect(result.timeouts).toBeLessThan(5);
      expect(result.latency.p95).toBeLessThan(8000); // 8 seconds (including fallback)
    });

    it('should handle concurrent insight generation', async () => {
      const insightRequests = Array(50).fill(null).map((_, i) => ({
        url: `${process.env.APP_URL}/api/ai/generate-insights`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer test-token-${i}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          capper_id: testUsers[i].discord_id,
          timeframe: '30d'
        })
      }));

      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 25,
        duration: 60,
        requests: insightRequests
      });

      // Verify performance
      expect(result.errors).toBeLessThan(3);
      expect(result.timeouts).toBeLessThan(2);
      expect(result.latency.p95).toBeLessThan(10000); // 10 seconds
    });
  });

  describe('Feature Interaction Load', () => {
    it('should handle mixed feature usage', async () => {
      const mixedRequests = [
        // Pick submissions
        ...Array(200).fill(null).map((_, i) => ({
          url: `${process.env.APP_URL}/api/picks`,
          method: 'POST',
          body: JSON.stringify(createMockPick())
        })),
        // Dashboard loads
        ...Array(300).fill(null).map(() => ({
          url: `${process.env.APP_URL}/dashboard`,
          method: 'GET'
        })),
        // AI analysis
        ...Array(50).fill(null).map(() => ({
          url: `${process.env.APP_URL}/api/ai/analyze-pick`,
          method: 'POST',
          body: JSON.stringify({
            game: 'Lakers vs Warriors',
            selection: 'Lakers -5.5'
          })
        }))
      ];

      const result = await autocannon({
        url: process.env.APP_URL!,
        connections: 200,
        duration: 60,
        requests: mixedRequests
      });

      // Verify performance
      expect(result.errors).toBeLessThan(20);
      expect(result.timeouts).toBeLessThan(10);
      expect(result.latency.p95).toBeLessThan(5000); // 5 seconds
    });

    it('should handle feature chain operations', async () => {
      const chainOperations = Array(50).fill(null).map(async (_, i) => {
        // Submit pick
        const pick = await fetch(`${process.env.APP_URL}/api/picks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer test-token-${i}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(createMockPick())
        });

        // Get AI analysis
        const analysis = await fetch(`${process.env.APP_URL}/api/ai/analyze-pick`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer test-token-${i}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(await pick.json())
        });

        // Update dashboard
        return fetch(`${process.env.APP_URL}/api/dashboard/refresh`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer test-token-${i}`
          }
        });
      });

      const startTime = Date.now();
      const results = await Promise.all(chainOperations);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(duration).toBeLessThan(15000); // 15 seconds
      expect(results.filter(r => !r.ok)).toHaveLength(0);
    });
  });
}); 