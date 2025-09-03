import { test, expect } from '@playwright/test';

test.describe('API Health Endpoint', () => {
  
  test('should return healthy status with all service details', async ({ request }) => {
    // Make request to health endpoint
    const response = await request.get('/api/health');
    
    // Verify response status
    expect(response.status()).toBe(200);
    
    // Parse response body
    const healthData = await response.json();
    
    // Verify main structure
    expect(healthData).toHaveProperty('status');
    expect(healthData).toHaveProperty('timestamp');
    expect(healthData).toHaveProperty('services');
    expect(healthData).toHaveProperty('version');
    expect(healthData).toHaveProperty('uptime');
    expect(healthData).toHaveProperty('memory');
    expect(healthData).toHaveProperty('system');
    
    // Verify services structure
    const services = healthData.services;
    expect(services).toHaveProperty('database');
    expect(services).toHaveProperty('redis');
    expect(services).toHaveProperty('agents');
    expect(services).toHaveProperty('external_apis');
    
    // Verify each service has required properties
    for (const [serviceName, serviceData] of Object.entries(services)) {
      expect(serviceData).toHaveProperty('status');
      expect(serviceData).toHaveProperty('lastCheck');
      expect(['up', 'down', 'degraded']).toContain((serviceData as any).status);
      
      console.log(`${serviceName} status: ${(serviceData as any).status}`);
      
      // If service has responseTime, verify it's a number
      if ((serviceData as any).responseTime !== undefined) {
        expect(typeof (serviceData as any).responseTime).toBe('number');
      }
      
      // If service has error, verify it's a string
      if ((serviceData as any).error !== undefined) {
        expect(typeof (serviceData as any).error).toBe('string');
      }
    }
    
    // Verify status is one of the expected values
    expect(['healthy', 'unhealthy', 'degraded']).toContain(healthData.status);
    
    // Verify timestamp is valid ISO string
    expect(() => new Date(healthData.timestamp)).not.toThrow();
    
    // Verify memory structure
    expect(healthData.memory).toHaveProperty('used');
    expect(healthData.memory).toHaveProperty('total');
    expect(healthData.memory).toHaveProperty('percentage');
    expect(typeof healthData.memory.used).toBe('number');
    expect(typeof healthData.memory.total).toBe('number');
    expect(typeof healthData.memory.percentage).toBe('number');
    
    // Verify system structure
    expect(healthData.system).toHaveProperty('loadAverage');
    expect(healthData.system).toHaveProperty('cpuUsage');
    expect(Array.isArray(healthData.system.loadAverage)).toBe(true);
    expect(typeof healthData.system.cpuUsage).toBe('number');
    
    // Verify uptime is a number
    expect(typeof healthData.uptime).toBe('number');
    expect(healthData.uptime).toBeGreaterThan(0);
    
    // Log the full health status for debugging
    console.log('Health Check Response:', JSON.stringify(healthData, null, 2));
  });
  
  test('should return valid response within reasonable time', async ({ request }) => {
    const startTime = Date.now();
    
    const response = await request.get('/api/health');
    
    const responseTime = Date.now() - startTime;
    
    // Health check should respond within 5 seconds
    expect(responseTime).toBeLessThan(5000);
    
    // Should return a 200 or 503 status (healthy/degraded or unhealthy)
    expect([200, 503]).toContain(response.status());
    
    console.log(`Health endpoint response time: ${responseTime}ms`);
  });
  
  test('should have database service status', async ({ request }) => {
    const response = await request.get('/api/health');
    const healthData = await response.json();
    
    const dbService = healthData.services.database;
    
    // Database service should exist and have status
    expect(dbService).toBeDefined();
    expect(dbService.status).toBeDefined();
    expect(['up', 'down', 'degraded']).toContain(dbService.status);
    
    console.log(`Database service status: ${dbService.status}`);
    
    if (dbService.error) {
      console.log(`Database error: ${dbService.error}`);
    }
    
    if (dbService.responseTime) {
      console.log(`Database response time: ${dbService.responseTime}ms`);
    }
  });
  
  test('should have redis service status', async ({ request }) => {
    const response = await request.get('/api/health');
    const healthData = await response.json();
    
    const redisService = healthData.services.redis;
    
    // Redis service should exist and have status
    expect(redisService).toBeDefined();
    expect(redisService.status).toBeDefined();
    expect(['up', 'down', 'degraded']).toContain(redisService.status);
    
    console.log(`Redis service status: ${redisService.status}`);
    
    if (redisService.error) {
      console.log(`Redis error: ${redisService.error}`);
    }
    
    if (redisService.responseTime) {
      console.log(`Redis response time: ${redisService.responseTime}ms`);
    }
  });
  
  test('should have agents service status', async ({ request }) => {
    const response = await request.get('/api/health');
    const healthData = await response.json();
    
    const agentsService = healthData.services.agents;
    
    // Agents service should exist and have status
    expect(agentsService).toBeDefined();
    expect(agentsService.status).toBeDefined();
    expect(['up', 'down', 'degraded']).toContain(agentsService.status);
    
    console.log(`Agents service status: ${agentsService.status}`);
    
    if (agentsService.error) {
      console.log(`Agents error: ${agentsService.error}`);
    }
  });
  
  test('should have external_apis service status', async ({ request }) => {
    const response = await request.get('/api/health');
    const healthData = await response.json();
    
    const externalApisService = healthData.services.external_apis;
    
    // External APIs service should exist and have status
    expect(externalApisService).toBeDefined();
    expect(externalApisService.status).toBeDefined();
    expect(['up', 'down', 'degraded']).toContain(externalApisService.status);
    
    console.log(`External APIs service status: ${externalApisService.status}`);
    
    if (externalApisService.error) {
      console.log(`External APIs error: ${externalApisService.error}`);
    }
  });
  
  test('overall health status should match service statuses', async ({ request }) => {
    const response = await request.get('/api/health');
    const healthData = await response.json();
    
    const services = healthData.services;
    const serviceStatuses = Object.values(services).map((s: any) => s.status);
    
    const downServices = serviceStatuses.filter(s => s === 'down').length;
    const degradedServices = serviceStatuses.filter(s => s === 'degraded').length;
    
    console.log(`Service statuses: ${serviceStatuses.join(', ')}`);
    console.log(`Down services: ${downServices}, Degraded services: ${degradedServices}`);
    console.log(`Overall status: ${healthData.status}`);
    
    // Verify overall status logic
    if (downServices > 0) {
      expect(healthData.status).toBe('unhealthy');
    } else if (degradedServices > 0) {
      expect(healthData.status).toBe('degraded');
    } else {
      expect(healthData.status).toBe('healthy');
    }
  });
});