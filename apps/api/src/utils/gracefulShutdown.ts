/**
 * Graceful Shutdown Manager
 * Ensures clean shutdown of all services, connections, and resources
 * Prevents data corruption during deployments and restarts
 */

import { createLogger } from './logger';

const logger = createLogger('GracefulShutdown');

export interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout: number;
  priority: number; // Lower number = higher priority
}

export interface ShutdownConfig {
  gracePeriodMs: number;
  forceExitTimeoutMs: number;
  enableHealthCheckDuringShutdown: boolean;
}

export class GracefulShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownStartTime = 0;
  private config: ShutdownConfig;

  constructor(config: Partial<ShutdownConfig> = {}) {
    this.config = {
      gracePeriodMs: 30000,        // 30 seconds grace period
      forceExitTimeoutMs: 45000,   // 45 seconds force exit
      enableHealthCheckDuringShutdown: true,
      ...config
    };

    this.setupSignalHandlers();
  }

  /**
   * Register a shutdown handler
   */
  registerHandler(handler: ShutdownHandler): void {
    this.handlers.push(handler);
    
    // Sort by priority (lower number = higher priority)
    this.handlers.sort((a, b) => a.priority - b.priority);
    
    logger.info('Registered shutdown handler', {
      name: handler.name,
      priority: handler.priority,
      timeout: handler.timeout
    });
  }

  /**
   * Register multiple handlers at once
   */
  registerHandlers(handlers: ShutdownHandler[]): void {
    handlers.forEach(handler => this.registerHandler(handler));
  }

  /**
   * Check if system is shutting down
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get shutdown progress information
   */
  getShutdownProgress(): {
    isShuttingDown: boolean;
    elapsedMs: number;
    remainingMs: number;
    handlersRemaining: number;
  } {
    const elapsedMs = this.isShuttingDown ? Date.now() - this.shutdownStartTime : 0;
    const remainingMs = Math.max(0, this.config.gracePeriodMs - elapsedMs);
    
    return {
      isShuttingDown: this.isShuttingDown,
      elapsedMs,
      remainingMs,
      handlersRemaining: this.handlers.length
    };
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Handle SIGTERM (Docker, Kubernetes, systemd)
    process.on('SIGTERM', () => {
      logger.info('📡 Received SIGTERM signal');
      this.initiateShutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('📡 Received SIGINT signal');
      this.initiateShutdown('SIGINT');
    });

    // Handle SIGUSR2 (nodemon restart)
    process.on('SIGUSR2', () => {
      logger.info('📡 Received SIGUSR2 signal (nodemon restart)');
      this.initiateShutdown('SIGUSR2');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught exception, initiating emergency shutdown', error);
      this.initiateShutdown('UNCAUGHT_EXCEPTION', true);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled promise rejection, initiating emergency shutdown', {
        reason,
        promise
      });
      this.initiateShutdown('UNHANDLED_REJECTION', true);
    });
  }

  /**
   * Initiate graceful shutdown
   */
  private async initiateShutdown(signal: string, emergency = false): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('⚠️ Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();

    logger.info('🛑 Initiating graceful shutdown', {
      signal,
      emergency,
      handlersCount: this.handlers.length,
      gracePeriodMs: this.config.gracePeriodMs
    });

    // Set force exit timeout
    const forceExitTimer = setTimeout(() => {
      logger.error('💥 Force exit timeout reached, terminating process');
      process.exit(1);
    }, this.config.forceExitTimeoutMs);

    try {
      // Execute shutdown handlers
      await this.executeShutdownHandlers(emergency);
      
      logger.info('✅ Graceful shutdown completed successfully');
      
      // Clear force exit timer
      clearTimeout(forceExitTimer);
      
      // Exit gracefully
      process.exit(0);
      
    } catch (error) {
      logger.error('❌ Error during graceful shutdown', error);
      
      // Clear force exit timer
      clearTimeout(forceExitTimer);
      
      // Exit with error code
      process.exit(1);
    }
  }

  /**
   * Execute all shutdown handlers
   */
  private async executeShutdownHandlers(emergency: boolean): Promise<void> {
    const startTime = Date.now();
    const results: Array<{ name: string; success: boolean; duration: number; error?: Error }> = [];

    logger.info('🔄 Executing shutdown handlers', {
      count: this.handlers.length,
      emergency
    });

    // Execute handlers in priority order
    for (const handler of this.handlers) {
      const handlerStartTime = Date.now();
      
      try {
        logger.info(`⏳ Executing shutdown handler: ${handler.name}`);
        
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Handler timeout after ${handler.timeout}ms`));
          }, handler.timeout);
        });

        // Race between handler execution and timeout
        await Promise.race([
          handler.handler(),
          timeoutPromise
        ]);

        const duration = Date.now() - handlerStartTime;
        results.push({ name: handler.name, success: true, duration });
        
        logger.info(`✅ Shutdown handler completed: ${handler.name} (${duration}ms)`);

      } catch (error) {
        const duration = Date.now() - handlerStartTime;
        const handlerError = error instanceof Error ? error : new Error(String(error));
        
        results.push({ 
          name: handler.name, 
          success: false, 
          duration, 
          error: handlerError 
        });

        if (emergency) {
          logger.error(`❌ Shutdown handler failed (emergency mode): ${handler.name}`, handlerError);
        } else {
          logger.error(`❌ Shutdown handler failed: ${handler.name}`, handlerError);
          // In non-emergency mode, continue with other handlers
        }
      }

      // Check if we're running out of time
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.gracePeriodMs * 0.8) { // 80% of grace period
        logger.warn('⚠️ Shutdown taking longer than expected, may need to skip remaining handlers');
        break;
      }
    }

    // Log summary
    const totalDuration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info('📊 Shutdown handlers summary', {
      totalHandlers: this.handlers.length,
      successful,
      failed,
      totalDurationMs: totalDuration,
      results: results.map(r => ({
        name: r.name,
        success: r.success,
        duration: r.duration
      }))
    });

    if (failed > 0 && !emergency) {
      throw new Error(`${failed} shutdown handlers failed`);
    }
  }

  /**
   * Create standard shutdown handlers for common services
   */
  static createStandardHandlers(): ShutdownHandler[] {
    return [
      // HTTP Server shutdown
      {
        name: 'http-server',
        priority: 1,
        timeout: 10000,
        handler: async () => {
          // This will be implemented by the application
          logger.info('HTTP server shutdown handler - implement in application');
        }
      },

      // Database connections
      {
        name: 'database-connections',
        priority: 2,
        timeout: 5000,
        handler: async () => {
          logger.info('Database connections shutdown handler - implement in application');
        }
      },

      // Background jobs and workers
      {
        name: 'background-workers',
        priority: 3,
        timeout: 15000,
        handler: async () => {
          logger.info('Background workers shutdown handler - implement in application');
        }
      },

      // Cache and memory cleanup
      {
        name: 'cache-cleanup',
        priority: 4,
        timeout: 3000,
        handler: async () => {
          logger.info('Cache cleanup shutdown handler - implement in application');
        }
      },

      // File system cleanup
      {
        name: 'filesystem-cleanup',
        priority: 5,
        timeout: 2000,
        handler: async () => {
          logger.info('Filesystem cleanup shutdown handler - implement in application');
        }
      }
    ];
  }

  /**
   * Health check endpoint for load balancers during shutdown
   */
  getHealthStatus(): {
    status: 'healthy' | 'shutting_down' | 'unhealthy';
    shutdownProgress?: ReturnType<GracefulShutdownManager['getShutdownProgress']>;
  } {
    if (!this.isShuttingDown) {
      return { status: 'healthy' };
    }

    if (this.config.enableHealthCheckDuringShutdown) {
      return {
        status: 'shutting_down',
        shutdownProgress: this.getShutdownProgress()
      };
    }

    return { status: 'unhealthy' };
  }
}

// Export singleton instance
let gracefulShutdownManager: GracefulShutdownManager | null = null;

export function initializeGracefulShutdown(config?: Partial<ShutdownConfig>): GracefulShutdownManager {
  if (!gracefulShutdownManager) {
    gracefulShutdownManager = new GracefulShutdownManager(config);
  }
  return gracefulShutdownManager;
}

export function getGracefulShutdown(): GracefulShutdownManager | null {
  return gracefulShutdownManager;
}
