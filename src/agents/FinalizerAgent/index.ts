import { BaseAgent } from '../BaseAgent/index';
import { 
  BaseAgentConfig, 
  BaseAgentDependencies, 
  HealthStatus, 
  BaseMetrics 
} from '../BaseAgent/types';
import { startMetricsServer, finalizedCounter, errorCounter, durationHistogram } from '../../services/metricsServer';

let instance: FinalizerAgent | null = null;

export interface FinalizationMetrics extends BaseMetrics {
  'custom.picksFinalized': number;
  'custom.picksRejected': number;
  'custom.publishingErrors': number;
}

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
    this.deps.logger.info('Initializing FinalizerAgent...');
    
    try {
      // Start metrics server if not already started
      if (!this.metricsStarted) {
        startMetricsServer(9003); // Dedicated port for finalizer agent metrics
        this.metricsStarted = true;
      }
      
      await this.validateDependencies();
      this.deps.logger.info('FinalizerAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize FinalizerAgent:', error);
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const tables = ['graded_picks', 'final_picks', 'published_picks'];
    
    for (const table of tables) {
      const { error } = await this.deps.supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Failed to access ${table} table: ${error.message}`);
      }
    }
  }

  protected async process(): Promise<void> {
    const stopTimer = durationHistogram.startTimer({ phase: 'finalization' });
    this.lastRunTimestamp = Date.now();
    this.processingErrors = [];
    
    try {
      this.deps.logger.info('🚀 FinalizerAgent started processing');
      
      // Reset counters for this processing cycle
      this.picksFinalized = 0;
      this.picksRejected = 0;
      this.publishingErrors = 0;
      
      // Fetch graded picks ready for finalization
      const { data: gradedPicks, error } = await this.deps.supabase
        .from('graded_picks')
        .select('*')
        .eq('status', 'graded')
        .is('finalized_at', null)
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (error) {
        throw new Error(`Failed to fetch graded picks: ${error.message}`);
      }
      
      this.deps.logger.info(`Found ${gradedPicks?.length || 0} graded picks ready for finalization`);
      
      // Process each graded pick
      for (const pick of gradedPicks || []) {
        try {
          // Check if pick meets finalization criteria
          if (await this.meetsFinalizationCriteria(pick)) {
            // Finalize the pick
            await this.finalizePick(pick);
            this.picksFinalized++;
            finalizedCounter.inc();
          } else {
            // Mark as rejected
            await this.rejectPick(pick);
            this.picksRejected++;
          }
        } catch (error) {
          this.deps.errorHandler.handleError(error, 'Finalization process');
          errorCounter.inc();
          this.publishingErrors++;
          
          if (error instanceof Error) {
            this.processingErrors.push(error);
          } else {
            this.processingErrors.push(new Error('Unknown error in finalization process'));
          }
        }
      }
      
      this.deps.logger.info('✅ FinalizerAgent processing complete', {
        finalized: this.picksFinalized,
        rejected: this.picksRejected,
        errors: this.publishingErrors
      });
    } catch (error) {
      this.deps.logger.error('FinalizerAgent process error:', error);
      errorCounter.inc();
      
      if (error instanceof Error) {
        this.processingErrors.push(error);
      }
      
      throw error;
    } finally {
      stopTimer();
    }
  }

  private async meetsFinalizationCriteria(pick: any): Promise<boolean> {
    // Implement criteria checks here
    // For example:
    
    // 1. Check if the pick has a valid composite score
    if (!pick.composite_score || isNaN(pick.composite_score)) {
      this.deps.logger.warn(`Pick ${pick.id} rejected: Invalid composite score`);
      return false;
    }
    
    // 2. Check if the pick has a valid tier
    if (!pick.tier || !['S', 'A', 'B', 'C', 'D', 'F'].includes(pick.tier)) {
      this.deps.logger.warn(`Pick ${pick.id} rejected: Invalid tier`);
      return false;
    }
    
    // 3. Check if all required fields are present
    const requiredFields = ['player_name', 'team_id', 'stat_type', 'line_value', 'pick_type'];
    for (const field of requiredFields) {
      if (!pick[field]) {
        this.deps.logger.warn(`Pick ${pick.id} rejected: Missing required field ${field}`);
        return false;
      }
    }
    
    // 4. Check if the pick is recent enough (within last 7 days)
    const pickDate = new Date(pick.created_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (pickDate < sevenDaysAgo) {
      this.deps.logger.warn(`Pick ${pick.id} rejected: Too old`);
      return false;
    }
    
    // 5. Check if the pick meets minimum quality threshold
    if (pick.composite_score < 12) { // Minimum threshold for publication
      this.deps.logger.warn(`Pick ${pick.id} rejected: Below quality threshold`);
      return false;
    }
    
    return true;
  }

  private async finalizePick(pick: any): Promise<void> {
    // 1. Update the pick status in graded_picks
    const { error: updateError } = await this.deps.supabase
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
      created_at: new Date().toISOString(),
      published: false
    };
    
    const { error: insertError } = await this.deps.supabase
      .from('final_picks')
      .insert([finalPick]);
    
    if (insertError) {
      throw new Error(`Failed to insert final pick: ${insertError.message}`);
    }
    
    // 3. Attempt to publish the pick
    try {
      await this.publishPick(finalPick);
    } catch (error) {
      this.deps.logger.error(`Failed to publish pick ${pick.id}:`, error);
      this.publishingErrors++;
      // Don't throw here, we want to continue processing other picks
    }
    
    this.deps.logger.info(`Successfully finalized pick ${pick.id}`, {
      player: pick.player_name,
      stat: pick.stat_type,
      tier: pick.tier
    });
  }

  private async rejectPick(pick: any): Promise<void> {
    // Update the pick status to rejected
    const { error } = await this.deps.supabase
      .from('graded_picks')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString()
      })
      .eq('id', pick.id);
    
    if (error) {
      throw new Error(`Failed to mark pick as rejected: ${error.message}`);
    }
    
    this.deps.logger.info(`Marked pick ${pick.id} as rejected`, {
      player: pick.player_name,
      stat: pick.stat_type
    });
  }

  private async publishPick(finalPick: any): Promise<void> {
    // Insert into published_picks table
    const publishedPick = {
      final_pick_id: finalPick.id,
      player_name: finalPick.player_name,
      team_id: finalPick.team_id,
      stat_type: finalPick.stat_type,
      line_value: finalPick.line_value,
      pick_type: finalPick.pick_type,
      tier: finalPick.tier,
      published_at: new Date().toISOString()
    };
    
    const { error: publishError } = await this.deps.supabase
      .from('published_picks')
      .insert([publishedPick]);
    
    if (publishError) {
      throw new Error(`Failed to publish pick: ${publishError.message}`);
    }
    
    // Update final_picks to mark as published
    const { error: updateError } = await this.deps.supabase
      .from('final_picks')
      .update({ published: true, published_at: new Date().toISOString() })
      .eq('id', finalPick.id);
    
    if (updateError) {
      throw new Error(`Failed to update final pick publication status: ${updateError.message}`);
    }
    
    this.deps.logger.info(`Successfully published pick`, {
      player: finalPick.player_name,
      stat: finalPick.stat_type,
      tier: finalPick.tier
    });
  }

  protected async cleanup(): Promise<void> {
    this.deps.logger.info('Performing FinalizerAgent cleanup');
    // Any cleanup logic here (close connections, etc.)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    try {
      // Check database connectivity
      const { error } = await this.deps.supabase
        .from('graded_picks')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          details: {
            error: error.message,
            component: 'database'
          }
        };
      }

      // Check if we've processed recently (within last 24 hours)
      const isRecentRun = Date.now() - this.lastRunTimestamp < 24 * 60 * 60 * 1000;
      
      // Check for excessive errors in last run
      const hasExcessiveErrors = this.processingErrors.length > 5;

      if (!isRecentRun) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'No recent processing run',
            lastRun: new Date(this.lastRunTimestamp).toISOString()
          }
        };
      }

      if (hasExcessiveErrors) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Excessive errors in last run',
            errorCount: this.processingErrors.length
          }
        };
      }

      // Check for pending picks that might be stuck
      const { data: pendingPicksCount } = await this.deps.supabase
        .from('graded_picks')
        .select('id', { count: 'exact' })
        .eq('status', 'graded')
        .is('finalized_at', null)
        .gte('created_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());
        
      const hasManyPendingPicks = pendingPicksCount && pendingPicksCount > 50;
      
      if (hasManyPendingPicks) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Large backlog of pending picks',
            pendingCount: pendingPicksCount
          }
        };
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          lastRun: new Date(this.lastRunTimestamp).toISOString(),
          picksFinalized: this.picksFinalized,
          picksRejected: this.picksRejected
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          component: 'health-check'
        }
      };
    }
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // Get stats from the database for the last 24 hours
    const { data: recentFinalizedPicks } = await this.deps.supabase
      .from('final_picks')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
    const { data: recentRejectedPicks } = await this.deps.supabase
      .from('graded_picks')
      .select('id')
      .eq('status', 'rejected')
      .gte('rejected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      successCount: this.picksFinalized,
      errorCount: this.processingErrors.length,
      warningCount: this.picksRejected,
      processingTimeMs: Date.now() - this.lastRunTimestamp,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      'custom.picksFinalized': this.picksFinalized,
      'custom.picksRejected': this.picksRejected,
      'custom.publishingErrors': this.publishingErrors,
      'custom.recentFinalizedCount': recentFinalizedPicks?.length || 0,
      'custom.recentRejectedCount': recentRejectedPicks?.length || 0
    };
  }

  // Public API for manual finalization
  public async finalizePickById(pickId: string): Promise<boolean> {
    try {
      const { data: pick, error } = await this.deps.supabase
        .from('graded_picks')
        .select('*')
        .eq('id', pickId)
        .single();
        
      if (error || !pick) {
        this.deps.logger.error(`Failed to find pick ${pickId}:`, error);
        return false;
      }
      
      if (await this.meetsFinalizationCriteria(pick)) {
        await this.finalizePick(pick);
        return true;
      } else {
        await this.rejectPick(pick);
        return false;
      }
    } catch (error) {
      this.deps.logger.error(`Failed to manually finalize pick ${pickId}:`, error);
      return false;
    }
  }

  // Public API
  public static getInstance(dependencies: BaseAgentDependencies): FinalizerAgent {
    if (!instance) {
      const config: BaseAgentConfig = {
        name: 'FinalizerAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: {
          enabled: true,
          interval: 60
        },
        health: {
          enabled: true,
          interval: 30
        },
        retry: {
          maxRetries: 3,
          backoffMs: 200,
          maxBackoffMs: 5000
        }
      };
      instance = new FinalizerAgent(config, dependencies);
    }
    return instance;
  }
}

// Legacy script execution for backwards compatibility
if (require.main === module) {
  async function runFinalizerAgent() {
    try {
      const deps: BaseAgentDependencies = {
        supabase: (await import('../../services/supabaseClient')).supabase,
        logger: (await import('../../services/logging')).logger,
        errorHandler: {
          handleError: (await import('../../utils/errorHandler')).handleError
        }
      };
      
      const agent = FinalizerAgent.getInstance(deps);
      await agent.start();
    } catch (error) {
      console.error('Failed to run FinalizerAgent:', error);
    }
  }
  
  runFinalizerAgent();
}
