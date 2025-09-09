/**
 * Redis Client for Command Center
 * Provides caching, session management, and real-time data storage
 */

import { createClient, RedisClientType } from 'redis';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface SessionData {
  userId: string;
  connectionId: string;
  lastActivity: number;
  metadata: Record<string, any>;
}

class RedisManager {
  private client: RedisClientType | null = null;
  private connected = false;
  private connecting = false;
  private connectionRetries = 0;
  private maxRetries = 5;
  private _connectionPool: RedisClientType[] = [];
  private _poolSize = 5;
  private _activeConnections = 0;

  constructor() {
    if (typeof window === 'undefined') {
      // Only initialize Redis on server-side
      this.initializeClient();
    }
  }

  private async initializeClient() {
    if (this.connecting || this.connected) return;

    this.connecting = true;

    try {
      const redisUrl = process.env['REDIS_URL'] || 'redis://unit-talk-redis:6379';
      console.log('🔗 Connecting to Redis:', redisUrl.replace(/\/\/[^@]*@/, '//****@'));

      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
        },
      });

      this.client.on('error', err => {
        console.error('❌ Redis Client Error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('🔗 Redis connecting...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis connected and ready');
        this.connected = true;
        this.connectionRetries = 0;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis connection ended');
        this.connected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.connected = false;
      this.connectionRetries++;

      if (this.connectionRetries < this.maxRetries) {
        console.log(
          `🔄 Retrying Redis connection (${this.connectionRetries}/${this.maxRetries})...`
        );
        setTimeout(() => {
          this.connecting = false;
          this.initializeClient();
        }, 2000 * this.connectionRetries);
      }
    } finally {
      this.connecting = false;
    }
  }

  async ensureConnection(): Promise<boolean> {
    if (this.connected && this.client) return true;

    if (!this.connecting) {
      await this.initializeClient();
    }

    // Wait a moment for connection to establish
    for (let i = 0; i < 10; i++) {
      if (this.connected) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * Connection Pool Management - Currently unused, reserved for future implementation
   */
  // private async _getPooledConnection(): Promise<RedisClientType | null> {
  //   // If we have available connections in pool, use them
  //   if (this.connectionPool.length > 0) {
  //     const connection = this.connectionPool.pop()!;
  //     this.activeConnections++;
  //     return connection;
  //   }

  //   // If we're at pool capacity, wait for an available connection
  //   if (this.activeConnections >= this.poolSize) {
  //     return new Promise(resolve => {
  //       const checkForConnection = () => {
  //         if (this.connectionPool.length > 0) {
  //           const connection = this.connectionPool.pop()!;
  //           this.activeConnections++;
  //           resolve(connection);
  //         } else {
  //           setTimeout(checkForConnection, 10);
  //         }
  //       };
  //       checkForConnection();
  //     });
  //   }

  //   // Create new connection if under pool limit
  //   if (!(await this.ensureConnection())) {
  //     return null;
  //   }

  //   this.activeConnections++;
  //   return this.client;
  // }

  // private _releaseConnection(connection: RedisClientType) {
  //   this.connectionPool.push(connection);
  //   this.activeConnections--;
  // }

  /**
   * Cache Management
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      if (!(await this.ensureConnection())) {
        console.warn('⚠️ Redis not available, skipping cache set');
        return false;
      }

      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: ttlSeconds,
      };

      await this.client!.setEx(key, ttlSeconds, JSON.stringify(entry));
      return true;
    } catch (error) {
      console.error(`❌ Redis SET failed for key ${key}:`, error);
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!(await this.ensureConnection())) {
        console.warn('⚠️ Redis not available, skipping cache get');
        return null;
      }

      const cached = await this.client!.get(key);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);

      // Check if entry has expired (extra safety)
      const now = Date.now();
      const age = (now - entry.timestamp) / 1000;

      if (age > entry.ttl) {
        await this.del(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`❌ Redis GET failed for key ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!(await this.ensureConnection())) return false;

      await this.client!.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Redis DEL failed for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!(await this.ensureConnection())) return false;

      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`❌ Redis EXISTS failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Session Management
   */
  async createSession(
    sessionId: string,
    userId: string,
    connectionId: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const sessionData: SessionData = {
      userId,
      connectionId,
      lastActivity: Date.now(),
      metadata,
    };

    return await this.set(`session:${sessionId}`, sessionData, 3600); // 1 hour TTL
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    return await this.get<SessionData>(`session:${sessionId}`);
  }

  async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;

      session.lastActivity = Date.now();
      return await this.set(`session:${sessionId}`, session, 3600);
    } catch (error) {
      console.error(`❌ Failed to update session activity for ${sessionId}:`, error);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return await this.del(`session:${sessionId}`);
  }

  /**
   * Agent Status Caching
   */
  async cacheAgentStatus(agentName: string, status: any): Promise<boolean> {
    return await this.set(`agent:${agentName}`, status, 300); // 5 minutes TTL
  }

  async getCachedAgentStatus(agentName: string): Promise<any | null> {
    return await this.get(`agent:${agentName}`);
  }

  /**
   * System Metrics Caching
   */
  async cacheSystemMetrics(metrics: any): Promise<boolean> {
    return await this.set('system:metrics', metrics, 60); // 1 minute TTL
  }

  async getCachedSystemMetrics(): Promise<any | null> {
    return await this.get('system:metrics');
  }

  /**
   * Real-time Data Management
   */
  async addToStream(streamKey: string, data: any): Promise<boolean> {
    try {
      if (!(await this.ensureConnection())) return false;

      // Add to stream with automatic timestamp
      const id = `${Date.now()}-0`;
      await this.client!.xAdd(streamKey, id, data);

      // Keep only last 1000 entries
      await this.client!.xTrim(streamKey, 'MAXLEN', 1000);

      return true;
    } catch (error) {
      console.error(`❌ Failed to add to stream ${streamKey}:`, error);
      return false;
    }
  }

  async getStreamData(streamKey: string, count: number = 10): Promise<any[]> {
    try {
      if (!(await this.ensureConnection())) return [];

      const result = await this.client!.xRevRange(streamKey, '+', '-', {
        COUNT: count,
      });

      return result.map(entry => ({
        id: entry.id,
        timestamp: parseInt(entry.id.split('-')[0] || '0'),
        data: entry.message,
      }));
    } catch (error) {
      console.error(`❌ Failed to get stream data from ${streamKey}:`, error);
      return [];
    }
  }

  /**
   * Connection Management
   */
  async ping(): Promise<boolean> {
    try {
      if (!(await this.ensureConnection())) return false;

      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('❌ Redis ping failed:', error);
      return false;
    }
  }

  async getConnectionInfo(): Promise<{ connected: boolean; retries: number; client: boolean }> {
    return {
      connected: this.connected,
      retries: this.connectionRetries,
      client: !!this.client,
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('🔌 Redis disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting Redis:', error);
      }

      this.client = null;
      this.connected = false;
    }
  }

  /**
   * Cache Patterns for API Responses
   */
  async cacheAPIResponse(
    endpoint: string,
    params: Record<string, any>,
    data: any,
    ttl: number = 300
  ): Promise<boolean> {
    const cacheKey = this.generateCacheKey(endpoint, params);
    return await this.set(cacheKey, data, ttl);
  }

  async getCachedAPIResponse(endpoint: string, params: Record<string, any>): Promise<any | null> {
    const cacheKey = this.generateCacheKey(endpoint, params);
    return await this.get(cacheKey);
  }

  private generateCacheKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    return `api:${endpoint}:${Buffer.from(sortedParams).toString('base64')}`;
  }
}

// Create singleton instance
export const redisClient = new RedisManager();

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    console.log('🧹 Shutting down Redis connection...');
    await redisClient.disconnect();
  });

  process.on('SIGTERM', async () => {
    console.log('🧹 Shutting down Redis connection...');
    await redisClient.disconnect();
  });
}

export { RedisManager };
export type { CacheEntry, SessionData };
