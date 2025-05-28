import { SupabaseClient } from '@supabase/supabase-js';
import {
  AgentStatus,
  AgentConfig,
  AgentCommand,
  HealthCheckResult,
  BaseAgentDependencies
} from '../../types/agent';
import { BaseAgent } from '../BaseAgent';
import { Logger } from '../../utils/logger';
import {
  Contest,
  Leaderboard,
  PrizePool,
  FairPlayReport,
  ContestEvent
} from './types';
import { ContestManager } from './contests';
import { LeaderboardManager } from './leaderboards';
import { FairPlayMonitor } from './fairplay';
import { Metrics } from '../../types/shared';

/**
 * ContestAgent manages contests, leaderboards, prize distribution, and fair-play enforcement
 */
export class ContestAgent extends BaseAgent {
  private contestManager: ContestManager;
  private leaderboardManager: LeaderboardManager;
  private fairPlayMonitor: FairPlayMonitor;

  constructor(dependencies: BaseAgentDependencies) {
    super(dependencies);
    this.contestManager = new ContestManager(this.supabase, this.config);
    this.leaderboardManager = new LeaderboardManager(this.supabase, this.config);
    this.fairPlayMonitor = new FairPlayMonitor(this.supabase, this.config);
  }

  protected async initialize(): Promise<void> {
    await this.contestManager.initialize();
    await this.leaderboardManager.initialize();
    await this.fairPlayMonitor.initialize();
  }

  protected async cleanup(): Promise<void> {
    await this.contestManager.cleanup();
    await this.leaderboardManager.cleanup();
    await this.fairPlayMonitor.cleanup();
  }

  protected async checkHealth(): Promise<HealthCheckResult> {
    const contestHealth = await this.contestManager.checkHealth();
    const leaderboardHealth = await this.leaderboardManager.checkHealth();
    const fairPlayHealth = await this.fairPlayMonitor.checkHealth();

    const status = [contestHealth, leaderboardHealth, fairPlayHealth].every(h => h.status === 'healthy')
      ? 'healthy'
      : 'degraded';

    return {
      status,
      details: {
        errors: [],
        warnings: [],
        info: {
          contests: contestHealth,
          leaderboards: leaderboardHealth,
          fairPlay: fairPlayHealth
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  protected async collectMetrics(): Promise<Metrics> {
    const contestMetrics = await this.contestManager.getMetrics();
    const leaderboardMetrics = await this.leaderboardManager.getMetrics();
    const fairPlayMetrics = await this.fairPlayMonitor.getMetrics();

    return {
      errorCount: contestMetrics.errors + leaderboardMetrics.errors + fairPlayMetrics.errors,
      warningCount: contestMetrics.warnings + leaderboardMetrics.warnings + fairPlayMetrics.warnings,
      successCount: contestMetrics.successes + leaderboardMetrics.successes + fairPlayMetrics.successes,
      contests: contestMetrics,
      leaderboards: leaderboardMetrics,
      fairPlay: fairPlayMetrics
    };
  }

  public async handleCommand(command: AgentCommand): Promise<void> {
    switch (command.type) {
      case 'CREATE_CONTEST':
        await this.contestManager.createContest(command.payload);
        break;
      case 'UPDATE_LEADERBOARD':
        await this.leaderboardManager.updateLeaderboard(command.payload);
        break;
      case 'CHECK_FAIR_PLAY':
        await this.fairPlayMonitor.checkViolations(command.payload);
        break;
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }
}
