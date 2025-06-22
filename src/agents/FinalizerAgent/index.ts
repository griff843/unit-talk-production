import { BaseAgent } from '../BaseAgent/index';
import { 
  BaseAgentConfig, 
  BaseAgentDependencies, 
  HealthStatus, 
  BaseMetrics 
} from '../BaseAgent/types';
import { startMetricsServer } from '../../services/metricsServer';

let instance: FinalizerAgent | null = null;

export interface FinalizationMetrics extends BaseMetrics {
  'custom.picksFinalized': number;
  'custom.picksRejected': number;
  'custom.publishingErrors': number;
}

/**
 * Production-grade FinalizerAgent for finalizing graded picks
 * Handles the final stage of the pick lifecycle - moving graded picks to final_picks
 * and publishing them to external channels
 */
export class FinalizerAgent extends BaseAgent {
  private metricsStarted: boolean = false;
  private picksFinalized: number = 0;
  private picksRejected: number = 0;
  private publishingErrors: number = 0;
  private lastRunTimestamp: number = 0;
  private processingErrors: Error[] = [];

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing FinalizerAgent...');
    
    try {
      // Start metrics server if not already started
      if (!this.metricsStarted && this.config.metrics.enabled) {
        const port = this.config.metrics.port || 9003;
        startMetricsServer(port);
        this.metricsStarted = true;
      }
      
      await this.validateDependencies();
      this.logger.info('FinalizerAgent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize FinalizerAgent:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const tables = ['graded_picks', 'final_picks', 'published_picks'];
    
    for (const table of tables) {
      const { error } = await this.supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Failed to access ${table} table: ${error.message}`);
      }
    }
  }

  protected async process(): Promise<void> {
    this.lastRunTimestamp = Date.now();
    this.processingErrors = [];
    
    try {
      this.logger.info('🚀 FinalizerAgent started processing');
      
      // Reset counters for this processing cycle
      this.picksFinalized = 0;
      this.picksRejected = 0;
      this.publishingErrors = 0;
      
      // Fetch graded picks ready for finalization
      const { data: gradedPicks, error } = await this.supabase
        .from('graded_picks')
        .select('*')
        .eq('status', 'graded')
        .is('finalized_at', null)
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (error) {
        throw new Error(`Failed to fetch graded picks: ${error.message}`);
      }
      
      this.logger.info(`Found ${gradedPicks?.length || 0} graded picks ready for finalization`);
      
      // Process each graded pick
      for (const pick of gradedPicks || []) {
        try {
          // Check if pick meets finalization criteria
          if (await this.meetsFinalizationCriteria(pick)) {
            // Finalize the pick
            await this.finalizePick(pick);
            this.picksFinalized++;
          } else {
            // Mark as rejected
            await this.rejectPick(pick);
            this.picksRejected++;
          }
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.handleError(error as Error, {
              context: 'Finalization process',
              pickId: pick.id
            });
          }
          this.publishingErrors++;
          
          if (error instanceof Error) {
            this.processingErrors.push(error);
          } else {
            this.processingErrors.push(new Error('Unknown error in finalization process'));
          }
        }
      }
      
      this.logger.info('✅ FinalizerAgent processing complete', {
        finalized: this.picksFinalized,
        rejected: this.picksRejected,
        errors: this.publishingErrors
      });
    } catch (error) {
      this.logger.error('FinalizerAgent process error:', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof Error) {
        this.processingErrors.push(error);
      }
      
      throw error;
    }
  }

  private async meetsFinalizationCriteria(pick: any): Promise<boolean> {
    // 1. Check if the pick has a valid composite score
    if (!pick.composite_score || isNaN(pick.composite_score)) {
      this.logger.warn(`Pick ${pick.id} rejected: Invalid composite score`);
      return false;
    }
    
    // 2. Check if the pick has a valid tier
    if (!pick.tier || !['S', 'A', 'B', 'C', 'D', 'F'].includes(pick.tier)) {
      this.logger.warn(`Pick ${pick.id} rejected: Invalid tier`);
      return false;
    }
    
    // 3. Check if all required fields are present
    const requiredFields = ['player_name', 'team_id', 'stat_type', 'line_value', 'pick_type'];
    for (const field of requiredFields) {
      if (!pick[field]) {
        this.logger.warn(`Pick ${pick.id} rejected: Missing required field ${field}`);
        return false;
      }
    }
    
    // 4. Check if the pick is recent enough (within last 7 days)
    const pickDate = new Date(pick.created_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (pickDate < sevenDaysAgo) {
      this.logger.warn(`Pick ${pick.id} rejected: Too old`);
      return false;
    }
    
    // 5. Check if the pick meets minimum quality threshold
    if (pick.composite_score < 12) { // Minimum threshold for publication
      this.logger.warn(`Pick ${pick.id} rejected: Below quality threshold`);
      return false;
    }
    
    return true;
  }

  private async finalizePick(pick: any): Promise<void> {
    // 1. Update the pick status in graded_picks
    const { error: updateError } = await this.supabase
      .from('graded_picks')
      .update({
        status: 'finalized',
        finalized_at: new Date().toISOString()
      })
      .eq('id', pick.id);
    
    if (updateError) {
      throw new Error(`Failed to update pick status: ${updateError.message}`);
    }
    
    // 2. Insert into final_picks table
    const finalPick = {
      graded_pick_id: pick.id,
      player_name: pick.player_name,
      team_id: pick.team_id,
      opponent_team_id: pick.opponent_team_id,
      stat_type: pick.stat_type,
      line_value: pick.line_value,
      pick_type: pick.pick_type,
      composite_score: pick.composite_score,
      tier: pick.tier,
      confidence: pick.confidence,
      expected_value: pick.expected_value,
      game_date: pick.game_date,
      created_at: new Date().toISOString(),
      status: 'ready_for_publishing'
    };
    
    const { error: insertError } = await this.supabase
      .from('final_picks')
      .insert(finalPick);
    
    if (insertError) {
      throw new Error(`Failed to insert final pick: ${insertError.message}`);
    }
    
    // 3. Optionally publish to external channels
    if (this.shouldPublishExternally(pick)) {
      await this.publishToExternalChannels(finalPick);
    }
    
    this.logger.debug(`Pick ${pick.id} finalized successfully`);
  }

  private async rejectPick(pick: any): Promise<void> {
    const { error } = await this.supabase
      .from('graded_picks')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: 'Failed finalization criteria'
      })
      .eq('id', pick.id);
    
    if (error) {
      throw new Error(`Failed to reject pick: ${error.message}`);
    }
    
    this.logger.debug(`Pick ${pick.id} rejected`);
  }

  private shouldPublishExternally(pick: any): boolean {
    // Only publish high-quality picks externally
    return pick.tier && ['S', 'A'].includes(pick.tier) && pick.composite_score >= 15;
  }

  private async publishToExternalChannels(finalPick: any): Promise<void> {
    try {
      // Insert into published_picks table
      const publishedPick = {
        final_pick_id: finalPick.graded_pick_id,
        published_at: new Date().toISOString(),
        channels: ['discord', 'twitter'], // Configure as needed
        status: 'published'
      };
      
      const { error } = await this.supabase
        .from('published_picks')
        .insert(publishedPick);
      
      if (error) {
        throw new Error(`Failed to record publication: ${error.message}`);
      }
      
      this.logger.info(`Pick ${finalPick.graded_pick_id} published to external channels`);
    } catch (error) {
      this.logger.error(`Failed to publish pick ${finalPick.graded_pick_id}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 FinalizerAgent cleanup complete');
    // Reset state
    this.picksFinalized = 0;
    this.picksRejected = 0;
    this.publishingErrors = 0;
    this.processingErrors = [];
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    const baseMetrics = {
      agentName: this.config.name,
      successCount: this.picksFinalized,
      errorCount: this.publishingErrors,
      warningCount: this.picksRejected,
      processingTimeMs: this.lastRunTimestamp ? Date.now() - this.lastRunTimestamp : 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };

    const customMetrics: FinalizationMetrics = {
      ...baseMetrics,
      'custom.picksFinalized': this.picksFinalized,
      'custom.picksRejected': this.picksRejected,
      'custom.publishingErrors': this.publishingErrors
    };

    return customMetrics;
  }

  public async checkHealth(): Promise<HealthStatus> {
    const checks: any[] = [];
    
    try {
      // Check database connectivity
      await this.supabase.from('graded_picks').select('count').limit(1);
      checks.push({ service: 'supabase', status: 'healthy' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'supabase', status: 'unhealthy', error: errorMessage });
    }
    
    // Check recent processing errors
    const recentErrors = this.processingErrors.filter(
      _ => Date.now() - this.lastRunTimestamp < 300000 // Last 5 minutes
    );
    
    const hasRecentErrors = recentErrors.length > 0;
    const isHealthy = checks.every(check => check.status === 'healthy') && !hasRecentErrors;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        checks,
        recentErrors: recentErrors.length,
        lastProcessingTime: this.lastRunTimestamp,
        metrics: {
          finalized: this.picksFinalized,
          rejected: this.picksRejected,
          errors: this.publishingErrors
        }
      }
    };
  }

  // Static factory method for singleton pattern
  public static getInstance(config: BaseAgentConfig, deps: BaseAgentDependencies): FinalizerAgent {
    if (!instance) {
      instance = new FinalizerAgent(config, deps);
    }
    return instance;
  }
}

export default FinalizerAgent;