// src/agents/BaseAgent/index.ts

import { EventEmitter } from 'events';
import {
  BaseAgentConfigSchema,
  BaseAgentConfig,
  BaseMetrics,
  HealthStatus,
  BaseAgentDependencies,
  AgentStatus
} from './types';

export abstract class BaseAgent extends EventEmitter {
  protected config: BaseAgentConfig;
  protected status: AgentStatus = 'idle';
  protected metrics: BaseMetrics;
  private dependencies: BaseAgentDependencies;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super();
    
    // Validate config using Zod schema
    this.config = BaseAgentConfigSchema.parse(config);
    this.dependencies = deps;
    
    // Initialize metrics
    this.metrics = {
      agentName: this.config.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0
    };
  }

  // Protected getters for child classes to access dependencies
  protected get supabase() {
    return this.dependencies.supabase;
  }

  protected get logger() {
    return this.dependencies.logger;
  }

  protected get errorHandler() {
    return this.dependencies.errorHandler;
  }

  // Abstract methods that child classes must implement
  protected abstract initialize(): Promise<void>;
  protected abstract process(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract collectMetrics(): Promise<BaseMetrics>;
  public abstract checkHealth(): Promise<HealthStatus>;

  // Main execution method
  public async run(): Promise<void> {
    try {
      this.status = 'initializing';
      this.emit('statusChange', this.status);
      
      await this.initialize();
      
      this.status = 'running';
      this.emit('statusChange', this.status);
      
      const startTime = Date.now();
      await this.process();
      
      // Update processing time
      this.metrics.processingTimeMs = Date.now() - startTime;
      this.metrics.memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // Collect final metrics
      this.metrics = await this.collectMetrics();
      
      this.status = 'stopping';
      this.emit('statusChange', this.status);
      
      await this.cleanup();
      
      this.status = 'stopped';
      this.emit('statusChange', this.status);
      
    } catch (error) {
      this.status = 'error';
      this.emit('statusChange', this.status);
      this.emit('error', error);
      throw error;
    }
  }

  // Utility methods
  public getStatus(): AgentStatus {
    return this.status;
  }

  public getMetrics(): BaseMetrics {
    return { ...this.metrics };
  }

  public getConfig(): BaseAgentConfig {
    return { ...this.config };
  }

  // Health check wrapper with error handling
  public async performHealthCheck(): Promise<HealthStatus> {
    try {
      return await this.checkHealth();
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    if (this.status === 'running') {
      this.status = 'stopping';
      this.emit('statusChange', this.status);
      await this.cleanup();
      this.status = 'stopped';
      this.emit('statusChange', this.status);
    }
  }
}

// Export types for use by other agents
export type {
  BaseAgentConfig,
  BaseAgentDependencies,
  BaseMetrics,
  HealthStatus,
  AgentStatus,
  BaseAgentConfigSchema
} from './types';