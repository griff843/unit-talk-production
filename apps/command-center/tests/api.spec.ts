import { test, expect } from '@playwright/test';

test.describe('Command Center API Endpoints', () => {
  test('health endpoint should return system status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('services');
    
    // Verify services structure
    expect(data.services).toHaveProperty('database');
    expect(data.services).toHaveProperty('redis');
    expect(data.services).toHaveProperty('agents');
  });

  test('agents endpoint should return agent list', async ({ request }) => {
    const response = await request.get('/api/agents');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    
    // If agents exist, verify structure
    if (data.length > 0) {
      const agent = data[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('lastHealthCheck');
    }
  });

  test('system metrics endpoint should return metrics', async ({ request }) => {
    const response = await request.get('/api/system/metrics');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('system');
    expect(data).toHaveProperty('process');
    expect(data).toHaveProperty('network');
    
    // Verify system metrics
    expect(data.system).toHaveProperty('cpu');
    expect(data.system).toHaveProperty('memory');
    expect(data.system).toHaveProperty('disk');
  });

  test('analytics endpoint should return dashboard data', async ({ request }) => {
    const response = await request.get('/api/analytics');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('overview');
    expect(data).toHaveProperty('usersByTier');
    expect(data).toHaveProperty('picksByStatus');
    
    // Verify overview structure
    expect(data.overview).toHaveProperty('totalUsers');
    expect(data.overview).toHaveProperty('activeUsers');
    expect(data.overview).toHaveProperty('totalPicks');
    expect(data.overview).toHaveProperty('totalRevenue');
  });

  test('redis status endpoint should return cache status', async ({ request }) => {
    const response = await request.get('/api/redis');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('connected');
    expect(data).toHaveProperty('info');
    
    // Should handle graceful fallback
    if (!data.connected) {
      expect(data).toHaveProperty('fallbackMode');
      expect(data.fallbackMode).toBe(true);
    }
  });

  test('stream endpoint should support SSE', async ({ request }) => {
    // Test that SSE endpoint exists and responds
    const response = await request.get('/api/stream', {
      headers: {
        'Accept': 'text/event-stream'
      }
    });
    
    // SSE endpoints return 200 with text/event-stream
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/event-stream');
  });
});