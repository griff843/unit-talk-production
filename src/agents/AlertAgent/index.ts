import 'dotenv/config';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';
import { buildAlertEmbed } from './embedBuilder';
import { getAdviceForPick } from './adviceEngine';
import { sendDiscordAlert } from './integrations/discord';
// import { postToNotion } from '../../services/notion';
// import { updateRetoolTag } from '../../services/retool';
import { logAlertRecord } from './log';
import { startMetricsServer } from '../../services/metricsServer';

interface AlertMetrics extends BaseMetrics {
  alertsSent: number;
  alertsFailed: number;
  duplicatesSkipped: number;
  avgProcessingTimeMs: number;
  llmCallsCount: number;
  llmFailures: number;
}

export class AlertAgent extends BaseAgent {
  private alertMetrics: AlertMetrics;
  private rateLimiter: Map<string, number> = new Map(); // service -> last call timestamp
  private readonly RATE_LIMITS: Record<string, number> = {
    discord: 2000, // 2 seconds between calls (30/min limit)
    openai: 100,   // 100ms between calls
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    this.alertMetrics = {
      ...this.metrics,
      alertsSent: 0,
      alertsFailed: 0,
      duplicatesSkipped: 0,
      avgProcessingTimeMs: 0,
      llmCallsCount: 0,
      llmFailures: 0,
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🚀 AlertAgent initializing...');
    
    // Ensure alerts log table exists and is accessible
    const { error } = await this.supabase
      .from('unit_talk_alerts_log')
      .select('count')
      .limit(1);
    
    if (error) {
      this.logger.warn('⚠️ Alert logging table not accessible', { error: error.message });
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 AlertAgent cleanup complete');
    this.rateLimiter.clear();
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.alertMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    };
  }

  public async checkHealth(): Promise<HealthStatus> {
    const checks = [];

    // Check Supabase connectivity
    try {
      await this.supabase.from('final_picks').select('count').limit(1);
      checks.push({ service: 'supabase', status: 'healthy' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'supabase', status: 'unhealthy', error: errorMessage });
    }

    // Check OpenAI connectivity (basic)
    try {
      const hasApiKey = !!process.env.OPENAI_API_KEY;
      checks.push({
        service: 'openai',
        status: hasApiKey ? 'healthy' : 'unhealthy',
        error: hasApiKey ? undefined : 'Missing API key'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'openai', status: 'unhealthy', error: errorMessage });
    }

    const isHealthy = checks.every(check => check.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.alertMetrics,
      }
    };
  }

  public async startMetricsServer(): Promise<void> {
    const port = this.config.metrics?.port || 9005;
    startMetricsServer(port);
    this.logger.info(`📊 Metrics server started on port ${port}`);
  }

  private async enforceRateLimit(service: string): Promise<void> {
    const limit = this.RATE_LIMITS[service] as number | undefined;
    if (!limit) return;

    const lastCall = this.rateLimiter.get(service) || 0;
    const timeSinceLastCall = Date.now() - lastCall;

    if (timeSinceLastCall < limit) {
      const waitTime = limit - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.set(service, Date.now());
  }

  private async isAlertAlreadySent(pick: any): Promise<boolean> {
    // Check database for persistent deduplication
    const { data, error } = await this.supabase
      .from('unit_talk_alerts_log')
      .select('bet_id')
      .eq('bet_id', pick.id)
      .eq('player', pick.player_name)
      .eq('market', pick.market_type)
      .eq('line', pick.line)
      .limit(1);

    if (error) {
      this.logger.warn('⚠️ Failed to check alert history, proceeding with send', { 
        pickId: pick.id, 
        error: error.message 
      });
      return false;
    }

    return data && data.length > 0;
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt === maxRetries) break;

        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.warn(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: lastError.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  protected async process(): Promise<void> {
    this.logger.info('🚨 Starting AlertAgent cycle...');
    const cycleStartTime = Date.now();

    const { data: picks, error } = await this.supabase
      .from('final_picks')
      .select('*')
      .eq('play_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50); // Reduced from 100 for better performance

    if (error || !picks) {
      this.logger.error('❌ Failed to fetch final picks for alerts', { error });
      this.alertMetrics.errorCount++;
      return;
    }

    this.logger.info(`📋 Processing ${picks.length} pending picks`);

    for (const pick of picks) {
      const pickStartTime = Date.now();
      
      try {
        // Check for duplicates using persistent storage
        if (await this.isAlertAlreadySent(pick)) {
          this.alertMetrics.duplicatesSkipped++;
          this.logger.debug(`⏭️ Skipping duplicate alert for pick [${pick.id}]`);
          continue;
        }

        // Rate limit OpenAI calls
        await this.enforceRateLimit('openai');
        
        // Get advice with retry logic
        const advice = await this.retryWithBackoff(async () => {
          this.alertMetrics.llmCallsCount++;
          return await getAdviceForPick(pick);
        });

        const embed = buildAlertEmbed(pick, advice);

        // Rate limit Discord calls
        await this.enforceRateLimit('discord');

        // Send alerts with retry logic
        await this.retryWithBackoff(async () => {
          await Promise.all([
            sendDiscordAlert(embed),
            // postToNotion(pick, advice), // Commented out until service is available
            // updateRetoolTag(pick.id, 'alerted'), // Commented out until service is available
          ]);
        });

        // Log the alert for deduplication and analytics
        await logAlertRecord(this.supabase, pick, advice);

        this.alertMetrics.alertsSent++;
        this.alertMetrics.successCount++;
        
        const processingTime = Date.now() - pickStartTime;
        this.alertMetrics.avgProcessingTimeMs = 
          (this.alertMetrics.avgProcessingTimeMs + processingTime) / 2;

        this.logger.info(`✅ Alert sent for pick [${pick.id}] - ${pick.player_name} (${processingTime}ms)`);

      } catch (err) {
        this.alertMetrics.alertsFailed++;
        this.alertMetrics.errorCount++;

        const error = err instanceof Error ? err : new Error('Unknown error');
        if (error.message?.includes('openai') || error.message?.includes('OpenAI')) {
          this.alertMetrics.llmFailures++;
        }

        this.logger.error(`❌ Failed to process pick [${pick.id}]`, {
          error: error.message,
          stack: error.stack,
          pickId: pick.id,
          playerName: pick.player_name,
          pickData: {
            id: pick.id,
            player: pick.player_name,
            market: pick.market_type,
            tier: pick.tier
          }
        });
      }
    }

    const totalCycleTime = Date.now() - cycleStartTime;
    this.alertMetrics.processingTimeMs = totalCycleTime;

    this.logger.info(`🏁 AlertAgent cycle complete`, {
      totalPicks: picks?.length || 0,
      alertsSent: this.alertMetrics.alertsSent,
      duplicatesSkipped: this.alertMetrics.duplicatesSkipped,
      failures: this.alertMetrics.alertsFailed,
      cycleTimeMs: totalCycleTime
    });
  }
}