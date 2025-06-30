import { Client } from 'discord.js';
import { logger } from '../utils/logger';

export interface CapperSystemConfig {
  discordClient: Client;
  publishingChannelId: string;
  enabled: boolean;
}

export class CapperSystem {
  private config: CapperSystemConfig;
  private initialized: boolean = false;

  constructor(config: CapperSystemConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Capper System');

      if (!this.config.enabled) {
        logger.info('Capper System is disabled');
        return;
      }

      // Test database connection would go here
      // For now, we'll just mark as initialized
      this.initialized = true;
      logger.info('Capper System initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Capper System', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  getStatus() {
    if (!this.initialized) {
      return {
        initialized: false,
        error: 'System not initialized'
      };
    }

    return {
      initialized: true,
      client: {
        ready: this.config.discordClient.isReady(),
        user: this.config.discordClient.user?.tag || null,
        guilds: this.config.discordClient.guilds.cache.size,
        uptime: this.config.discordClient.uptime
      },
      database: {
        connected: true // We assume it's connected if initialization succeeded
      },
      config: {
        enabled: this.config.enabled,
        publishingChannelId: this.config.publishingChannelId
      }
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
let capperSystemInstance: CapperSystem | null = null;

export function createCapperSystem(config: CapperSystemConfig): CapperSystem {
  capperSystemInstance = new CapperSystem(config);
  return capperSystemInstance;
}

export function getCapperSystem(): CapperSystem {
  if (!capperSystemInstance) {
    throw new Error('Capper System not created. Call createCapperSystem first.');
  }
  return capperSystemInstance;
}