import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentDependencies, HealthCheckResult, BaseMetrics, BaseAgentConfig } from '../BaseAgent/types';
import { ErrorHandler } from '../../utils/errorHandling';
// import { ContestAgentConfig } from './types';
import { ContestManager } from './contests';
import { LeaderboardManager } from './leaderboards';
import { FairPlayMonitor } from './fairplay';

interface AgentCommand {
  type: string;
  payload?: any;
  timestamp?: string;
  id?: string;
}

/**
 * ContestAgent manages contests, leaderboards, prize distribution, and fair-play enforcement
 */
export class ContestAgent extends BaseAgent {
  private contestManager: ContestManager;
  private leaderboardManager: LeaderboardManager;
  private fairPlayMonitor: FairPlayMonitor;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    // Initialize agent-specific properties here
    const supabase = this.requireSupabase();
    this.contestManager = new ContestManager(
      supabase,
      deps.logger,
      new ErrorHandler('ContestManager', supabase),
      {
        ...config,
        name: config.name || 'ContestAgent',
        version: config.version || '1.0.0',
        enabled: config.enabled ?? true,
        logLevel: config.logLevel || 'info',
        metrics: {
          enabled: config.metrics?.enabled ?? true,
          interval: config.metrics?.interval ?? 30000,
          port: config.metrics?.port,
          endpoint: config.metrics?.endpoint
        },
        health: config.health ? {
          enabled: config.health.enabled ?? true,
          interval: config.health.interval ?? 30000,
          timeout: config.health.timeout ?? 5000,
          checkDb: config.health.checkDb ?? true,
          checkExternal: config.health.checkExternal ?? true,
          endpoint: config.health.endpoint
        } : undefined,
        retry: config.retry ? {
          enabled: config.retry.enabled ?? true,
          maxRetries: config.retry.maxRetries ?? 3,
          backoffMs: config.retry.backoffMs ?? 1000,
          maxBackoffMs: config.retry.maxBackoffMs ?? 30000,
          exponential: config.retry.exponential ?? true,
          jitter: config.retry.jitter ?? true,
          maxAttempts: config.retry.maxRetries ?? 3,
          backoff: config.retry.backoffMs ?? 1000
        } : undefined
      }
    );
    this.leaderboardManager = new LeaderboardManager(config as any, deps as any);
    this.fairPlayMonitor = new FairPlayMonitor(supabase, config as any);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ContestAgent...');
    await this.initializeResources();
  }

  protected async initializeResources(): Promise<void> {
    await this.contestManager.initialize();
    await this.leaderboardManager.initialize();
    await this.fairPlayMonitor.initialize();
  }

  protected async process(): Promise<void> {
    this.logger.info('Processing ContestAgent...');
    // Update leaderboards
    await this.leaderboardManager.updateLeaderboards();
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up ContestAgent...');
    await this.contestManager.cleanup();
    await this.leaderboardManager.cleanup();
    await this.fairPlayMonitor.cleanup();
  }

  public async checkHealth(): Promise<HealthCheckResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check contest manager health
      const contestHealth = await this.contestManager.checkHealth();
      if ((contestHealth as {status: string}).status !== 'healthy') {
        warnings.push('Contest manager is unhealthy');
      }

      // Check leaderboard manager health
      const leaderboardHealth = await this.leaderboardManager.checkHealth();
      if ((leaderboardHealth as {status: string}).status !== 'healthy') {
        warnings.push('Leaderboard manager is unhealthy');
      }

      // Check fair play monitor health
      const fairPlayHealth = await this.fairPlayMonitor.checkHealth();
      if ((fairPlayHealth as {status: string}).status !== 'healthy') {
        warnings.push('Fair play monitor is unhealthy');
      }

      const allHealthy = warnings.length === 0;
      const status = allHealthy ? 'healthy' : 'degraded';

      return {
        status,
        timestamp: new Date().toISOString(),
        details: {
          errors,
          warnings,
          info: {
            contestManager: contestHealth,
            leaderboardManager: leaderboardHealth,
            fairPlayMonitor: fairPlayHealth
          }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings: [],
          info: {}
        }
      };
    }
  }

  public async collectMetrics(): Promise<BaseMetrics & { contests?: any; leaderboards?: any; fairPlay?: any }> {
    const contestMetrics = this.contestManager.getMetrics();
    const leaderboardMetrics = this.leaderboardManager.getMetrics();
    const fairPlayMetrics = this.fairPlayMonitor.getMetrics();

    return {
      agentName: 'ContestAgent',
      successCount: (contestMetrics as any).successCount || 0,
      errorCount: (contestMetrics as any).errorCount || 0,
      warningCount: (contestMetrics as any).warningCount || 0,
      processingTimeMs: (contestMetrics as any).processingTimeMs || 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      contests: contestMetrics,
      leaderboards: leaderboardMetrics,
      fairPlay: fairPlayMetrics
    };
  }

  protected async processCommand(command: AgentCommand): Promise<void> {
    switch (command.type) {
      case 'CREATE_CONTEST':
        this.logger.info('Creating contest', { payload: command.payload });
        await this.contestManager.createContest(command.payload);
        break;
      case 'UPDATE_LEADERBOARD':
        this.logger.info('Updating leaderboard', { payload: command.payload });
        await this.leaderboardManager.updateLeaderboards();
        break;
      case 'CHECK_FAIR_PLAY':
        this.logger.info('Fair play check requested', { payload: command.payload });
        // Fair play monitoring is handled automatically
        break;
      default:
        this.logger.warn('Unknown command type', { command });
    }
  }
}