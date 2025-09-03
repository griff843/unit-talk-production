/**
 * Advanced Connection Pool Manager
 * Optimizes database connections for high-performance production workloads
 * Implements dynamic scaling, health monitoring, and performance optimization
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConnectionPoolManager');

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  healthCheckIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  enableMetrics: boolean;
  enableAutoScaling: boolean;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  peakConnections: number;
  lastHealthCheck: string;
}

interface PooledConnection {
  id: string;
  client: SupabaseClient;
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
  requestCount: number;
  errorCount: number;
}

export class ConnectionPoolManager {
  private config: ConnectionPoolConfig;
  private connections: Map<string, PooledConnection> = new Map();
  private waitingQueue: Array<{
    resolve: (client: SupabaseClient) => void;
    reject: (error: Error) => void;
    timestamp: Date;
  }> = [];
  private metrics: ConnectionMetrics;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      minConnections: 5,
      maxConnections: 50,
      acquireTimeoutMs: 30000,
      idleTimeoutMs: 300000, // 5 minutes
      healthCheckIntervalMs: 60000, // 1 minute
      maxRetries: 3,
      retryDelayMs: 1000,
      enableMetrics: true,
      enableAutoScaling: true,
      scaleUpThreshold: 0.8, // Scale up when 80% of connections are active
      scaleDownThreshold: 0.3, // Scale down when less than 30% are active
      ...config
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTimeMs: 0,
      peakConnections: 0,
      lastHealthCheck: new Date().toISOString()
    };

    this.initialize();
  }

  /**
   * Initialize the connection pool
   */
  private async initialize(): Promise<void> {
    logger.info('🚀 Initializing connection pool', {
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections
    });

    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      await this.createConnection();
    }

    // Start health monitoring
    this.startHealthMonitoring();

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    logger.info('✅ Connection pool initialized', {
      totalConnections: this.connections.size
    });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquireConnection(): Promise<SupabaseClient> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Find available connection
      const availableConnection = this.findAvailableConnection();
      
      if (availableConnection) {
        availableConnection.isActive = true;
        availableConnection.lastUsed = new Date();
        availableConnection.requestCount++;
        
        this.updateMetrics();
        this.metrics.successfulRequests++;
        
        return availableConnection.client;
      }

      // No available connections - try to create new one
      if (this.connections.size < this.config.maxConnections) {
        const newConnection = await this.createConnection();
        newConnection.isActive = true;
        
        this.updateMetrics();
        this.metrics.successfulRequests++;
        
        return newConnection.client;
      }

      // Pool is full - wait for available connection
      return await this.waitForConnection();

    } catch (error) {
      this.metrics.failedRequests++;
      const responseTime = Date.now() - startTime;
      this.updateAvgResponseTime(responseTime);
      
      logger.error('❌ Failed to acquire connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTimeMs: responseTime
      });
      
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(client: SupabaseClient): void {
    const connection = this.findConnectionByClient(client);
    
    if (connection) {
      connection.isActive = false;
      connection.lastUsed = new Date();
      
      // Process waiting queue
      if (this.waitingQueue.length > 0) {
        const waiter = this.waitingQueue.shift();
        if (waiter) {
          connection.isActive = true;
          waiter.resolve(client);
        }
      }
      
      this.updateMetrics();
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<PooledConnection> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-connection-pool': 'true'
        }
      }
    });

    const connection: PooledConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      client,
      isActive: false,
      lastUsed: new Date(),
      createdAt: new Date(),
      requestCount: 0,
      errorCount: 0
    };

    this.connections.set(connection.id, connection);
    
    logger.debug('➕ Created new connection', {
      connectionId: connection.id,
      totalConnections: this.connections.size
    });

    return connection;
  }

  /**
   * Find available connection
   */
  private findAvailableConnection(): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (!connection.isActive) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Find connection by client
   */
  private findConnectionByClient(client: SupabaseClient): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.client === client) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Wait for available connection
   */
  private async waitForConnection(): Promise<SupabaseClient> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMs);

      this.waitingQueue.push({
        resolve: (client) => {
          clearTimeout(timeout);
          resolve(client);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: new Date()
      });

      this.metrics.waitingRequests = this.waitingQueue.length;
    });
  }

  /**
   * Update connection metrics
   */
  private updateMetrics(): void {
    let activeCount = 0;
    let idleCount = 0;

    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        activeCount++;
      } else {
        idleCount++;
      }
    }

    this.metrics.totalConnections = this.connections.size;
    this.metrics.activeConnections = activeCount;
    this.metrics.idleConnections = idleCount;
    this.metrics.waitingRequests = this.waitingQueue.length;

    if (this.metrics.totalConnections > this.metrics.peakConnections) {
      this.metrics.peakConnections = this.metrics.totalConnections;
    }

    // Auto-scaling logic
    if (this.config.enableAutoScaling) {
      this.performAutoScaling();
    }
  }

  /**
   * Perform auto-scaling based on usage patterns
   */
  private performAutoScaling(): void {
    const utilizationRate = this.metrics.activeConnections / this.metrics.totalConnections;

    // Scale up if utilization is high
    if (utilizationRate > this.config.scaleUpThreshold && 
        this.metrics.totalConnections < this.config.maxConnections) {
      
      const connectionsToAdd = Math.min(
        Math.ceil(this.metrics.totalConnections * 0.2), // Add 20% more
        this.config.maxConnections - this.metrics.totalConnections
      );

      logger.info('📈 Scaling up connection pool', {
        currentConnections: this.metrics.totalConnections,
        utilizationRate: utilizationRate.toFixed(2),
        connectionsToAdd
      });

      for (let i = 0; i < connectionsToAdd; i++) {
        this.createConnection().catch(error => {
          logger.error('❌ Failed to create connection during scale-up', error);
        });
      }
    }

    // Scale down if utilization is low
    if (utilizationRate < this.config.scaleDownThreshold && 
        this.metrics.totalConnections > this.config.minConnections) {
      
      this.scaleDownConnections();
    }
  }

  /**
   * Scale down idle connections
   */
  private scaleDownConnections(): void {
    const connectionsToRemove = Math.floor(
      (this.metrics.totalConnections - this.config.minConnections) * 0.1 // Remove 10%
    );

    if (connectionsToRemove > 0) {
      logger.info('📉 Scaling down connection pool', {
        currentConnections: this.metrics.totalConnections,
        connectionsToRemove
      });

      let removed = 0;
      for (const [id, connection] of this.connections.entries()) {
        if (!connection.isActive && removed < connectionsToRemove) {
          this.connections.delete(id);
          removed++;
        }
      }
    }
  }

  /**
   * Update average response time
   */
  private updateAvgResponseTime(responseTime: number): void {
    if (this.metrics.avgResponseTimeMs === 0) {
      this.metrics.avgResponseTimeMs = responseTime;
    } else {
      this.metrics.avgResponseTimeMs = 
        (this.metrics.avgResponseTimeMs + responseTime) / 2;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.performHealthCheck();
      }
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    logger.debug('🔍 Performing connection health check');

    const healthPromises = Array.from(this.connections.entries()).map(
      async ([id, connection]) => {
        try {
          // Simple health check query
          await connection.client.from('users').select('count').limit(1);
          return { id, healthy: true };
        } catch (error) {
          connection.errorCount++;
          logger.warn('⚠️ Unhealthy connection detected', {
            connectionId: id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return { id, healthy: false };
        }
      }
    );

    const results = await Promise.allSettled(healthPromises);
    const unhealthyConnections = results
      .filter(r => r.status === 'fulfilled' && !r.value.healthy)
      .map(r => (r as PromiseFulfilledResult<any>).value.id);

    // Remove unhealthy connections
    for (const id of unhealthyConnections) {
      this.connections.delete(id);
    }

    // Ensure minimum connections
    while (this.connections.size < this.config.minConnections) {
      await this.createConnection();
    }

    this.metrics.lastHealthCheck = new Date().toISOString();
    this.updateMetrics();
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        this.logMetrics();
      }
    }, 60000); // Log metrics every minute
  }

  /**
   * Log current metrics
   */
  private logMetrics(): void {
    logger.info('📊 Connection pool metrics', this.metrics);
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectionMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    logger.info('🛑 Shutting down connection pool');

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    // Reject waiting requests
    for (const waiter of this.waitingQueue) {
      waiter.reject(new Error('Connection pool is shutting down'));
    }
    // Clear array without using .clear() which doesn't exist on arrays
    this.waitingQueue.length = 0;

    // Close all connections
    this.connections.clear();

    logger.info('✅ Connection pool shutdown complete');
  }
}

// Export singleton instance
let connectionPoolManager: ConnectionPoolManager | null = null;

export function initializeConnectionPool(config?: Partial<ConnectionPoolConfig>): ConnectionPoolManager {
  if (!connectionPoolManager) {
    connectionPoolManager = new ConnectionPoolManager(config);
  }
  return connectionPoolManager;
}

export function getConnectionPool(): ConnectionPoolManager | null {
  return connectionPoolManager;
}
