import 'dotenv/config';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';
import { RecapService } from './recapService';
import { RecapFormatter } from './recapFormatter';
import { NotionSyncService } from './notionSyncService';
import { SlashCommandHandler } from './slashCommandHandler';
import { PrometheusMetrics } from './prometheusMetrics';
import { WebhookClient, EmbedBuilder } from 'discord.js';
import { RecapConfig, RecapMetrics, MicroRecapData } from '../../types/picks';
import { RecapStateManager, RecapState } from './recapStateManager';
import { Logger } from '../../shared/logger/types';

/**
 * Production-ready RecapAgent with comprehensive features
 * Handles automated recap generation, real-time monitoring, and integrations
 */
export class RecapAgent extends BaseAgent {
  private recapService: RecapService;
  private recapFormatter: RecapFormatter;
  private notionSync?: NotionSyncService;
  private slashHandler?: SlashCommandHandler;
  private prometheusMetrics?: PrometheusMetrics;
  private discordClient?: WebhookClient;
  private recapConfig: RecapConfig;
  private recapMetrics: RecapMetrics;
  private roiWatcherInterval?: NodeJS.Timeout;

  // Add missing properties
  private stateManager: RecapStateManager;
  private recapState: RecapState;

  // Schedule configuration (cron format) - used for scheduling recaps
  private readonly RECAP_SCHEDULE = {
    daily: '0 9 * * *',    // 9 AM daily
    weekly: '0 10 * * 1',  // 10 AM Monday
    monthly: '0 11 1 * *'  // 11 AM 1st of month
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Initialize configuration from environment
    this.recapConfig = {
      legendFooter: process.env.LEGEND_FOOTER === 'true',
      microRecap: process.env.MICRO_RECAP === 'true',
      notionSync: process.env.NOTION_SYNC === 'true',
      clvDelta: process.env.CLV_DELTA === 'true',
      streakSparkline: process.env.STREAK_SPARKLINE === 'true',
      roiThreshold: parseFloat(process.env.ROI_THRESHOLD || '5.0'),
      microRecapCooldown: parseInt(process.env.MICRO_RECAP_COOLDOWN || '60'),
      discordWebhook: process.env.DISCORD_RECAP_WEBHOOK,
      slashCommands: process.env.SLASH_COMMANDS === 'true',
      notionToken: process.env.NOTION_TOKEN,
      notionDatabaseId: process.env.NOTION_RECAP_DATABASE_ID,
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      metricsPort: parseInt(process.env.METRICS_PORT || '3001')
    };

    // Initialize metrics
    this.recapMetrics = {
      recapsSent: 0,
      recapsFailed: 0,
      microRecapsSent: 0,
      avgProcessingTimeMs: 0,
      dailyRecaps: 0,
      weeklyRecaps: 0,
      monthlyRecaps: 0,
      notionSyncs: 0,
      slashCommandsUsed: 0
    };

    // Initialize services
    this.recapService = new RecapService(this.recapConfig);
    this.recapFormatter = new RecapFormatter(this.recapConfig);

    // Create logger adapter for RecapStateManager
    const loggerAdapter: Logger = {
      debug: (msg: string | object, ...args: unknown[]) => {
        if (typeof msg === 'string') {
          this.deps.logger.debug(msg, args[0] as Record<string, unknown>);
        } else {
          this.deps.logger.debug(args[0] as string, msg as Record<string, unknown>);
        }
      },
      info: (msg: string | object, ...args: unknown[]) => {
        if (typeof msg === 'string') {
          this.deps.logger.info(msg, args[0] as Record<string, unknown>);
        } else {
          this.deps.logger.info(args[0] as string, msg as Record<string, unknown>);
        }
      },
      warn: (msg: string | object, ...args: unknown[]) => {
        if (typeof msg === 'string') {
          this.deps.logger.warn(msg, args[0] as Record<string, unknown>);
        } else {
          this.deps.logger.warn(args[0] as string, msg as Record<string, unknown>);
        }
      },
      error: (msg: string | object, ...args: unknown[]) => {
        if (typeof msg === 'string') {
          this.deps.logger.error(msg, args[0] as Record<string, unknown>);
        } else {
          this.deps.logger.error(args[0] as string, msg as Record<string, unknown>);
        }
      },
      child: (bindings: Record<string, unknown>) => {
        const childLogger = this.deps.logger.child(bindings);
        return {
          debug: (msg: string | object, ...args: unknown[]) => {
            if (typeof msg === 'string') {
              childLogger.debug(msg, args[0] as Record<string, unknown>);
            } else {
              childLogger.debug(args[0] as string, msg as Record<string, unknown>);
            }
          },
          info: (msg: string | object, ...args: unknown[]) => {
            if (typeof msg === 'string') {
              childLogger.info(msg, args[0] as Record<string, unknown>);
            } else {
              childLogger.info(args[0] as string, msg as Record<string, unknown>);
            }
          },
          warn: (msg: string | object, ...args: unknown[]) => {
            if (typeof msg === 'string') {
              childLogger.warn(msg, args[0] as Record<string, unknown>);
            } else {
              childLogger.warn(args[0] as string, msg as Record<string, unknown>);
            }
          },
          error: (msg: string | object, ...args: unknown[]) => {
            if (typeof msg === 'string') {
              childLogger.error(msg, args[0] as Record<string, unknown>);
            } else {
              childLogger.error(args[0] as string, msg as Record<string, unknown>);
            }
          },
          child: (bindings: Record<string, unknown>) => childLogger.child(bindings) as unknown as Logger,
          setLevel: () => {} // Not implemented
        } as Logger;
      },
      setLevel: () => {} // Not implemented
    };

    this.stateManager = new RecapStateManager(this.deps.supabase, loggerAdapter, {
      version: parseInt(process.env.RECAP_STATE_VERSION || '1')
    });

    // Initialize default recap state
    this.recapState = {
      manualTriggers: {
        daily: 0,
        weekly: 0,
        monthly: 0
      }
    };

    // Initialize Discord client
    if (this.recapConfig.discordWebhook) {
      this.discordClient = new WebhookClient({ url: this.recapConfig.discordWebhook });
    }

    // Initialize optional services
    if (this.recapConfig.notionSync && this.recapConfig.notionToken && this.recapConfig.notionDatabaseId) {
      this.notionSync = new NotionSyncService(this.recapConfig.notionToken, this.recapConfig.notionDatabaseId);
    }

    if (this.recapConfig.slashCommands) {
      this.slashHandler = new SlashCommandHandler(this);
    }

    if (this.recapConfig.metricsEnabled) {
      this.prometheusMetrics = new PrometheusMetrics(this.recapConfig.metricsPort);
    }

    // Load persisted recap state for idempotency
    this.loadRecapState()
      .then(state => {
        this.recapState = state;
        this.logger.debug('Loaded recap state', { state: JSON.stringify(state) });
      })
      .catch(err => this.logger.warn('Unable to load recap state', { error: err.message }));
  }

  /**
   * Initialize the RecapAgent and all services
   */
  protected async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing RecapAgent...');

      // Initialize core service
      await this.recapService.initialize();

      // Initialize state table if needed
      await this.stateManager.initializeStateTable();

      // Initialize optional services
      if (this.notionSync) {
        await this.notionSync.initialize();
        this.logger.info('Notion sync service initialized');
      }

      if (this.slashHandler) {
        await this.slashHandler.initialize();
        this.logger.info('Slash command handler initialized');
      }

      if (this.prometheusMetrics) {
        await this.prometheusMetrics.initialize();
        this.logger.info('Prometheus metrics initialized');
      }

      // Start real-time ROI monitoring if enabled
      if (this.recapConfig.microRecap) {
        this.startRoiWatcher();
        this.logger.info('ROI watcher started');
      }

      this.logger.info('RecapAgent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize RecapAgent:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Main processing loop - handles scheduled recaps
   */
  protected async process(): Promise<void> {
    /**
     * The RecapAgent no longer runs time-based logic directly.
     * All scheduling is delegated to Temporal cron workflows
     * (see workflows/recap-workflows.ts).  This `process` method
     * is kept to satisfy the BaseAgent contract and will be a
     * no-op other than performing micro-recap checks when enabled.
     */
    try {
      if (this.recapConfig.microRecap) {
        await this.checkMicroRecapTriggers();
      }
    } catch (error) {
      this.logger.error('Error in RecapAgent process:', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.recapMetrics.recapsFailed++;
      this.prometheusMetrics?.incrementRecapsFailed();
    }
  }

  /**
   * Health check for all services
   */
  public async checkHealth(): Promise<HealthStatus> {
    const checks = [];

    try {
      // Check RecapService
      await this.recapService.testConnection();
      checks.push({ service: 'recap-service', status: 'healthy' });
    } catch (error) {
      checks.push({
        service: 'recap-service',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Check Discord webhook
    if (this.recapConfig.discordWebhook) {
      try {
        // Simple webhook test (you might want to implement a proper test)
        checks.push({ service: 'discord-webhook', status: 'healthy' });
      } catch (error) {
        checks.push({
          service: 'discord-webhook',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Check Notion sync
    if (this.notionSync) {
      try {
        await this.notionSync.testConnection();
        checks.push({ service: 'notion-sync', status: 'healthy' });
      } catch (error) {
        checks.push({ 
          service: 'notion-sync', 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Check state persistence
    try {
      await this.stateManager.loadState();
      checks.push({ service: 'state-persistence', status: 'healthy' });
    } catch (error) {
      checks.push({
        service: 'state-persistence',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const isHealthy = checks.every(check => check.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.recapMetrics,
        config: {
          legendFooter: this.recapConfig.legendFooter,
          microRecap: this.recapConfig.microRecap,
          notionSync: this.recapConfig.notionSync,
          slashCommands: this.recapConfig.slashCommands
        }
      }
    };
  }

  /**
   * Collect and return metrics
   */
  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      agentName: 'RecapAgent',
      successCount: this.metrics.successCount || 0,
      errorCount: this.metrics.errorCount || 0,
      warningCount: this.metrics.warningCount || 0,
      processingTimeMs: this.metrics.processingTimeMs || 0,
      memoryUsageMb: this.metrics.memoryUsageMb || 0
    };
  }

  /**
   * Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    if (this.roiWatcherInterval) {
      clearInterval(this.roiWatcherInterval);
    }

    if (this.prometheusMetrics) {
      await this.prometheusMetrics.cleanup();
    }

    if (this.slashHandler) {
      await this.slashHandler.cleanup();
    }

    this.logger.info('RecapAgent cleanup completed');
  }

  /**
   * Load recap state from persistent storage
   * Used by Temporal workflows for idempotency
   */
  async loadRecapState(): Promise<RecapState> {
    try {
      // Initialize state table if needed
      await this.stateManager.initializeStateTable();
      
      // Load state
      const state = await this.stateManager.loadState();
      this.recapState = state;
      return state;
    } catch (error) {
      this.logger.error('Failed to load recap state', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        manualTriggers: { daily: 0, weekly: 0, monthly: 0 }
      };
    }
  }

  /**
   * Persist recap state to storage
   * Used by Temporal workflows to maintain state across restarts
   */
  async persistRecapState(state: RecapState): Promise<boolean> {
    try {
      const success = await this.stateManager.persistState(state);
      if (success) {
        this.recapState = state;
      }
      return success;
    } catch (error) {
      this.logger.error('Failed to persist recap state', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Update micro-recap cooldown
   */
  async updateMicroRecapCooldown(cooldownMinutes?: number): Promise<boolean> {
    return this.stateManager.updateMicroRecapCooldown(cooldownMinutes || this.recapConfig.microRecapCooldown);
  }

  /**
   * Check if micro-recap is in cooldown period
   */
  async isMicroRecapInCooldown(): Promise<boolean> {
    return this.stateManager.isMicroRecapInCooldown();
  }

  /**
   * Record a recap run
   */
  async recordRecapRun(type: 'daily' | 'weekly' | 'monthly', date?: string): Promise<boolean> {
    return this.stateManager.recordRecapRun(type, date);
  }

  /**
   * Trigger daily recap manually or via schedule
   */
  async triggerDailyRecap(date?: string): Promise<void> {
    const startTime = Date.now();
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      this.logger.info(`Generating daily recap for ${targetDate}`);

      // Get recap data
      const summary = await this.recapService.getDailyRecapData(targetDate);
      if (!summary) {
        this.logger.warn(`No data found for daily recap on ${targetDate}`);
        return;
      }

      // Get parlay data
      const parlayGroups = await this.recapService.getParlayGroups(targetDate);

      // Build Discord embed
      const embed = this.recapFormatter.buildDailyRecapEmbed(summary, parlayGroups);

      // Send to Discord
      if (!this.recapConfig.discordWebhook) {
        this.logger.warn('Discord webhook not configured, skipping Discord send');
        return;
      }
      if (this.discordClient) {
        await this.discordClient.send({ embeds: [embed] });
        this.logger.info('Daily recap sent to Discord');
      }

      // Sync to Notion if enabled
      if (this.notionSync) {
        await this.notionSync.syncRecap({
          title: `Daily Recap - ${targetDate}`,
          date: targetDate,
          period: 'daily',
          summary,
          embedData: embed.toJSON(),
          createdAt: new Date().toISOString()
        });
        this.recapMetrics.notionSyncs++;
      }

      // Record this run in persistent state
      await this.recordRecapRun('daily', targetDate);

      // Update metrics
      this.recapMetrics.recapsSent++;
      this.recapMetrics.dailyRecaps++;
      this.metrics.processingTimeMs = Date.now() - startTime;

      if (this.prometheusMetrics) {
        this.prometheusMetrics.incrementRecapsSent('daily');
        this.prometheusMetrics.recordProcessingTime(Date.now() - startTime);
      }

      this.logger.info(`Daily recap completed in ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error('Failed to generate daily recap:', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.recapMetrics.recapsFailed++;

      if (this.prometheusMetrics) {
        this.prometheusMetrics.incrementRecapsFailed();
      }

      throw error;
    }
  }

  /**
   * Trigger weekly recap manually or via schedule
   */
  async triggerWeeklyRecap(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info('Generating weekly recap');

      // Calculate week range (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek + 1); // Monday
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // Sunday

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get recap data
      const summary = await this.recapService.getWeeklyRecapData(startDateStr, endDateStr);
      if (!summary) {
        this.logger.warn('No data found for weekly recap');
        return;
      }

      // Get parlay data
      const parlayGroups = await this.recapService.getParlayGroups(startDateStr, endDateStr);

      // Build Discord embed
      const embed = this.recapFormatter.buildWeeklyRecapEmbed(summary, parlayGroups);

      // Send to Discord
      if (!this.recapConfig.discordWebhook) {
        this.logger.warn('Discord webhook not configured, skipping Discord send');
        return;
      }
      if (this.discordClient) {
        await this.discordClient.send({ embeds: [embed] });
        this.logger.info('Weekly recap sent to Discord');
      }

      // Sync to Notion if enabled
      if (this.notionSync) {
        await this.notionSync.syncRecap({
          title: `Weekly Recap - ${startDateStr} to ${endDateStr}`,
          date: startDateStr,
          period: 'weekly',
          summary,
          embedData: embed.toJSON(),
          createdAt: new Date().toISOString()
        });
        this.recapMetrics.notionSyncs++;
      }

      // Record this run in persistent state
      await this.recordRecapRun('weekly');

      // Update metrics
      if (this.notionSync) {
        this.recapMetrics.notionSyncs++;
      }

      this.recapMetrics.recapsSent++;
      this.recapMetrics.weeklyRecaps++;
      this.metrics.processingTimeMs = Date.now() - startTime;

      if (this.prometheusMetrics) {
        this.prometheusMetrics.incrementRecapsSent('weekly');
        this.prometheusMetrics.recordProcessingTime(Date.now() - startTime);
      }

      this.logger.info(`Weekly recap completed in ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error('Failed to generate weekly recap:', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.recapMetrics.recapsFailed++;

      if (this.prometheusMetrics) {
        this.prometheusMetrics.incrementRecapsFailed();
      }

      throw error;
    }
  }

  /**
   * Trigger monthly recap manually or via schedule
   */
  async triggerMonthlyRecap(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info('Generating monthly recap');

      // Calculate month range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of last month
      const endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get recap data
      const summary = await this.recapService.getMonthlyRecapData(startDateStr, endDateStr);
      if (!summary) {
        this.logger.warn('No data found for monthly recap');
        return;
      }

      // Get parlay data
      const parlayGroups = await this.recapService.getParlayGroups(startDateStr, endDateStr);

      // Build Discord embed
      const embed = this.recapFormatter.buildMonthlyRecapEmbed(summary, parlayGroups);

      // Send to Discord
      if (!this.recapConfig.discordWebhook) {
        this.logger.warn('Discord webhook not configured, skipping Discord send');
        return;
      }
      if (this.discordClient) {
        await this.discordClient.send({ embeds: [embed] });
        this.logger.info('Monthly recap sent to Discord');
      }

      // Sync to Notion if enabled
      if (this.notionSync) {
        await this.notionSync.syncRecap({
          title: `Monthly Recap - ${startDateStr} to ${endDateStr}`,
          date: startDateStr,
          period: 'monthly',
          summary,
          embedData: embed.toJSON(),
          createdAt: new Date().toISOString()
        });
        this.recapMetrics.notionSyncs++;
      }

      // Record this run in persistent state
      await this.recordRecapRun('monthly');

      // Update metrics
      this.recapMetrics.recapsSent++;
      this.recapMetrics.monthlyRecaps++;
      this.metrics.processingTimeMs = Date.now() - startTime;

      if (this.prometheusMetrics) {
        this.prometheusMetrics.incrementRecapsSent('monthly');
        this.prometheusMetrics.recordProcessingTime(Date.now() - startTime);
      }

      this.logger.info(`Monthly recap completed in ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error('Failed to generate monthly recap:', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.recapMetrics.recapsFailed++;

      if (this.prometheusMetrics) {
        this.prometheusMetrics.incrementRecapsFailed();
      }

      throw error;
    }
  }

  /**
   * Trigger micro-recap for instant notifications
   */
  async triggerMicroRecap(microData: MicroRecapData): Promise<void> {
    if (!this.getRecapConfig().microRecap) {
      return;
    }

    try {
      this.logger.info(`Triggering micro-recap: ${microData.trigger}`);

      // Build micro-recap embed
      const embed = this.recapFormatter.buildMicroRecapEmbed(microData);

      // Send to Discord
      if (!this.recapConfig.discordWebhook) {
        this.logger.warn('Discord webhook not configured, skipping Discord send');
        return;
      }
      if (this.discordClient) {
        await this.discordClient.send({ embeds: [embed] });
        this.logger.info('Micro-recap sent to Discord');
      }

      // Update cooldown state
      await this.updateMicroRecapCooldown();

      // Update metrics
      this.recapMetrics.microRecapsSent = (this.recapMetrics.microRecapsSent || 0) + 1;

      if (this.prometheusMetrics) {
        this.prometheusMetrics.incrementMicroRecaps();
      }

    } catch (error) {
      this.logger.error('Failed to send micro-recap:', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.recapMetrics.recapsFailed++;
      if (!this.metrics.errorCount) this.metrics.errorCount = 0;
      this.metrics.errorCount++;
    }
  }

  /**
   * Handle slash command requests
   */
  async handleSlashCommand(options: any): Promise<EmbedBuilder> {
    if (!this.slashHandler) {
      throw new Error('Slash commands not enabled');
    }

    this.recapMetrics.slashCommandsUsed = (this.recapMetrics.slashCommandsUsed || 0) + 1;

    if (this.prometheusMetrics) {
      this.prometheusMetrics.incrementSlashCommands();
    }

    return await this.slashHandler.handleCommand(options);
  }

  /**
   * Start real-time ROI monitoring
   */
  private startRoiWatcher(): void {
    // Check every 5 minutes
    this.roiWatcherInterval = setInterval(async () => {
      try {
        await this.checkMicroRecapTriggers();
      } catch (error) {
        this.logger.error('ROI watcher error:', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Check for micro-recap triggers
   */
  private async checkMicroRecapTriggers(): Promise<void> {
    try {
      // Check if we're in cooldown
      if (await this.isMicroRecapInCooldown()) {
        this.logger.debug('Micro-recap in cooldown, skipping check');
        return;
      }

      // Check ROI threshold
      const roiMicroRecap = await this.recapService.checkRoiThreshold();
      if (roiMicroRecap) {
        await this.triggerMicroRecap(roiMicroRecap);
        return;
      }

      // Check last pick graded
      const lastPickMicroRecap = await this.recapService.checkLastPickGraded();
      if (lastPickMicroRecap) {
        await this.triggerMicroRecap(lastPickMicroRecap);
      }
    } catch (error) {
      this.logger.error('Micro-recap trigger check failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Override base class methods to return proper types
  getConfig(): BaseAgentConfig {
    return this.config;
  }

  getMetrics(): BaseMetrics {
    return this.metrics;
  }

  // Getters for recap-specific access
  getRecapConfig(): RecapConfig {
    return { ...this.recapConfig };
  }

  getRecapMetrics(): RecapMetrics {
    return { ...this.recapMetrics };
  }

  getRecapService(): RecapService {
    return this.recapService;
  }

  getRecapFormatter(): RecapFormatter {
    return this.recapFormatter;
  }
}
