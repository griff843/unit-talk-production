import { Client } from 'discord.js';
import { capperService } from './services/capperService';
import { DailyPickPublisher } from './services/dailyPickPublisher';
import { logger } from './shared/logger';

export interface CapperSystemConfig {
  discordClient: Client;
  publishingChannelId: string;
  enabled: boolean;
}

export class CapperSystem {
  private config: CapperSystemConfig;
  private publisher: DailyPickPublisher;
  private initialized: boolean = false;

  constructor(config: CapperSystemConfig) {
    this.config = config;
    this.publisher = new DailyPickPublisher(config.discordClient, config.publishingChannelId);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Capper System');

      if (!this.config.enabled) {
        logger.info('Capper System is disabled');
        return;
      }

      // Test database connection
      const dbConnected = await capperService.testConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }

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

  async publishDailyPicks(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Capper System not initialized');
    }

    await this.publisher.publishDailyPicks();
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
      publisher: this.publisher.getStatus(),
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