#!/usr/bin/env tsx

/**
 * Production Redis Setup
 * Creates Redis instance configuration for production deployment
 */

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

class ProductionRedisSetup {
  async setupRedisConfig(): Promise<void> {
    console.log('🔧 PRODUCTION REDIS SETUP');
    console.log('=========================\n');

    // Create docker-compose.redis.yml for Redis service
    const redisCompose = `version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: unit-talk-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    environment:
      - REDIS_REPLICATION_MODE=master
    networks:
      - unit-talk-network

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: unit-talk-redis-ui
    restart: unless-stopped
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    networks:
      - unit-talk-network
    depends_on:
      - redis

volumes:
  redis_data:
    driver: local

networks:
  unit-talk-network:
    driver: bridge`;

    writeFileSync('docker-compose.redis.yml', redisCompose);
    console.log('✅ Created docker-compose.redis.yml');

    // Create Redis configuration file
    const redisConfig = `# Redis production configuration
bind 0.0.0.0
port 6379

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
requirepass ${process.env.REDIS_PASSWORD || 'unit-talk-redis-prod'}

# Performance
maxmemory 512mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Networking
tcp-keepalive 300
timeout 0

# Append only file
appendonly yes
appendfsync everysec

# Disable dangerous commands
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command CONFIG ""
rename-command SHUTDOWN SHUTDOWN_UNIT_TALK

# Client output buffer limits
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# Memory optimization
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64`;

    writeFileSync('redis.conf', redisConfig);
    console.log('✅ Created redis.conf');

    // Create Redis service wrapper
    const redisService = `import Redis from 'ioredis';
import { logger } from '../shared/logger';

export class ProductionRedisService {
  private static instance: ProductionRedisService;
  private redis: Redis;
  private isConnected: boolean = false;

  private constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      keyPrefix: 'unit-talk:',
    });

    this.setupEventListeners();
  }

  public static getInstance(): ProductionRedisService {
    if (!ProductionRedisService.instance) {
      ProductionRedisService.instance = new ProductionRedisService();
    }
    return ProductionRedisService.instance;
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      this.isConnected = true;
      logger.info('Redis production service connected');
    } catch (error) {
      logger.error('Failed to connect to Redis', { error: error.message });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      return false;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      logger.error('Redis SET operation failed', { key, error: error.message });
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      logger.error('Redis GET operation failed', { key, error: error.message });
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Redis DEL operation failed', { key, error: error.message });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS operation failed', { key, error: error.message });
      throw error;
    }
  }

  async getMemoryUsage(): Promise<{ used: number; peak: number }> {
    try {
      const info = await this.redis.info('memory');
      const usedMatch = info.match(/used_memory:(\\d+)/);
      const peakMatch = info.match(/used_memory_peak:(\\d+)/);
      
      return {
        used: usedMatch ? parseInt(usedMatch[1]) : 0,
        peak: peakMatch ? parseInt(peakMatch[1]) : 0
      };
    } catch (error) {
      logger.error('Failed to get Redis memory usage', { error: error.message });
      return { used: 0, peak: 0 };
    }
  }

  async getStats(): Promise<any> {
    try {
      const info = await this.redis.info('stats');
      return {
        totalConnections: this.extractInfo(info, 'total_connections_received'),
        totalCommands: this.extractInfo(info, 'total_commands_processed'),
        instantaneousOps: this.extractInfo(info, 'instantaneous_ops_per_sec'),
        keyspaceHits: this.extractInfo(info, 'keyspace_hits'),
        keyspaceMisses: this.extractInfo(info, 'keyspace_misses')
      };
    } catch (error) {
      logger.error('Failed to get Redis stats', { error: error.message });
      return {};
    }
  }

  private extractInfo(info: string, key: string): number {
    const match = info.match(new RegExp(\`\${key}:(\\\\d+)\`));
    return match ? parseInt(match[1]) : 0;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.disconnect();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

export const productionRedis = ProductionRedisService.getInstance();`;

    const serviceDir = 'src/services';
    const servicePath = join(serviceDir, 'productionRedis.ts');
    writeFileSync(servicePath, redisService);
    console.log('✅ Created production Redis service');

    // Create startup script
    const startupScript = `#!/bin/bash

echo "🚀 Starting Unit Talk Redis Infrastructure..."

# Start Redis with Docker Compose
echo "📊 Starting Redis service..."
docker-compose -f docker-compose.redis.yml up -d

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 10

# Test Redis connection
echo "🔍 Testing Redis connection..."
docker exec unit-talk-redis redis-cli ping

echo "✅ Redis infrastructure ready!"
echo "📊 Redis UI available at: http://localhost:8081"
echo "🔧 Redis connection: redis://localhost:6379"`;

    writeFileSync('scripts/start-redis.sh', startupScript);
    console.log('✅ Created Redis startup script');

    // Update environment variables
    this.updateEnvironmentConfig();

    console.log('\n🎉 REDIS SETUP COMPLETED!');
    console.log('');
    console.log('🚀 To start Redis:');
    console.log('   npm run redis:start');
    console.log('');
    console.log('📊 Redis UI:');
    console.log('   http://localhost:8081');
    console.log('');
    console.log('🔗 Connection:');
    console.log('   redis://localhost:6379');
  }

  private updateEnvironmentConfig(): void {
    const envAdditions = `
# Redis Configuration (Production)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=unit-talk-redis-prod
REDIS_KEY_PREFIX=unit-talk:
REDIS_MAX_MEMORY=512mb`;

    // Note: In production, these should be properly configured
    console.log('📝 Add to your .env file:');
    console.log(envAdditions);
  }

  async startRedisWithDockerCompose(): Promise<void> {
    console.log('🐳 Starting Redis with Docker Compose...');
    
    try {
      const { execSync } = await import('child_process');
      
      // Start Redis service
      execSync('docker-compose -f docker-compose.redis.yml up -d', {
        stdio: 'inherit'
      });
      
      console.log('✅ Redis started successfully!');
      
      // Wait and test connection
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test connection
      const testResult = execSync('docker exec unit-talk-redis redis-cli ping', {
        encoding: 'utf8'
      });
      
      if (testResult.trim() === 'PONG') {
        console.log('✅ Redis connection test successful!');
      } else {
        console.log('⚠️ Redis connection test failed');
      }
      
    } catch (error) {
      console.error('❌ Failed to start Redis:', error.message);
      console.log('');
      console.log('💡 Alternative: Install Redis locally');
      console.log('   Windows: https://redis.io/docs/getting-started/installation/install-redis-on-windows/');
      console.log('   Mac: brew install redis');
      console.log('   Linux: sudo apt-get install redis-server');
    }
  }
}

async function main() {
  const redisSetup = new ProductionRedisSetup();
  await redisSetup.setupRedisConfig();
  
  // Optionally start Redis
  const shouldStart = process.argv.includes('--start');
  if (shouldStart) {
    await redisSetup.startRedisWithDockerCompose();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Redis setup failed:', error);
    process.exit(1);
  });
}

export { ProductionRedisSetup };