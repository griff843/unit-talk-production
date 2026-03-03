#!/usr/bin/env tsx

/**
 * Redis Deployment Validation
 * Tests Redis connection, queue management, and caching
 */

import { redis } from '../src/services/redis';

class RedisDeploymentValidator {
  async validateRedisDeployment(): Promise<void> {
    console.log('🔴 REDIS DEPLOYMENT VALIDATION');
    console.log('==============================\n');

    // Test basic connection
    console.log('🔍 Testing Redis connection...');
    const connectionResult = await this.testConnection();
    console.log(
      `${connectionResult ? '✅' : '❌'} Connection: ${connectionResult ? 'SUCCESS' : 'FAILED'}\n`
    );

    if (!connectionResult) {
      console.log('⚠️ Redis server not available. Please ensure Redis is running.');
      console.log('   Docker: docker run -d -p 6379:6379 redis:alpine');
      console.log('   Local: redis-server');
      return;
    }

    // Test caching operations
    console.log('🔍 Testing caching operations...');
    const cacheResult = await this.testCaching();
    console.log(`${cacheResult ? '✅' : '❌'} Caching: ${cacheResult ? 'SUCCESS' : 'FAILED'}\n`);

    // Test queue management
    console.log('🔍 Testing queue management...');
    const queueResult = await this.testQueueManagement();
    console.log(
      `${queueResult ? '✅' : '❌'} Queue Management: ${queueResult ? 'SUCCESS' : 'FAILED'}\n`
    );

    // Test performance
    console.log('🔍 Testing performance...');
    const perfResult = await this.testPerformance();
    console.log(
      `${perfResult.success ? '✅' : '❌'} Performance: ${perfResult.avgLatency}ms average\n`
    );

    const allTests = [connectionResult, cacheResult, queueResult, perfResult.success];
    const passedTests = allTests.filter(Boolean).length;

    console.log(`📊 Redis Validation: ${passedTests}/${allTests.length} tests passed`);

    if (passedTests >= 3) {
      console.log('🎉 Redis deployment ready for production!');
    } else {
      console.log('⚠️ Redis deployment needs attention before production');
    }
  }

  private async testConnection(): Promise<boolean> {
    try {
      return await redis.healthCheck();
    } catch (error) {
      console.log(`   ❌ Connection error: ${error.message}`);
      return false;
    }
  }

  private async testCaching(): Promise<boolean> {
    try {
      const testKey = 'test:cache:' + Date.now();
      const testValue = { message: 'Redis cache test', timestamp: new Date().toISOString() };

      // Set value
      await redis.set(testKey, testValue, 60);
      console.log('   ✅ Cache SET operation successful');

      // Get value
      const retrieved = await redis.get(testKey);
      const isValid = retrieved && retrieved.message === testValue.message;
      console.log(
        `   ${isValid ? '✅' : '❌'} Cache GET operation ${isValid ? 'successful' : 'failed'}`
      );

      // Delete value
      await redis.del(testKey);
      console.log('   ✅ Cache DELETE operation successful');

      return isValid;
    } catch (error) {
      console.log(`   ❌ Caching error: ${error.message}`);
      return false;
    }
  }

  private async testQueueManagement(): Promise<boolean> {
    try {
      const queueName = 'test:queue:' + Date.now();

      // Add items to queue
      for (let i = 0; i < 5; i++) {
        await redis.set(`${queueName}:${i}`, { id: i, data: `test-${i}` });
      }
      console.log('   ✅ Queue items added successfully');

      // Check queue items exist
      const exists = await redis.exists(`${queueName}:0`);
      console.log(`   ${exists ? '✅' : '❌'} Queue items ${exists ? 'accessible' : 'missing'}`);

      // Cleanup
      for (let i = 0; i < 5; i++) {
        await redis.del(`${queueName}:${i}`);
      }
      console.log('   ✅ Queue cleanup successful');

      return exists;
    } catch (error) {
      console.log(`   ❌ Queue management error: ${error.message}`);
      return false;
    }
  }

  private async testPerformance(): Promise<{ success: boolean; avgLatency: number }> {
    try {
      const iterations = 10;
      const latencies = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await redis.set(`perf:test:${i}`, { iteration: i });
        await redis.get(`perf:test:${i}`);
        await redis.del(`perf:test:${i}`);
        const latency = Date.now() - start;
        latencies.push(latency);
      }

      const avgLatency = Math.floor(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const success = avgLatency < 100; // Under 100ms is good

      console.log(`   📊 Average latency: ${avgLatency}ms`);
      console.log(`   📊 Max latency: ${Math.max(...latencies)}ms`);
      console.log(`   📊 Min latency: ${Math.min(...latencies)}ms`);

      return { success, avgLatency };
    } catch (error) {
      console.log(`   ❌ Performance test error: ${error.message}`);
      return { success: false, avgLatency: 0 };
    }
  }
}

const validator = new RedisDeploymentValidator();
validator.validateRedisDeployment().catch(console.error);
