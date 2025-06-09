import { BaseAgent } from '../BaseAgent/index';
import { 
  BaseAgentConfig, 
  BaseAgentDependencies, 
  HealthStatus, 
  BaseMetrics 
} from '../BaseAgent/types';
import { startMetricsServer, errorCounter, durationHistogram } from '../../services/metricsServer';
import { Counter, Gauge } from 'prom-client';

// Define ReferralAgent-specific metrics
const referralCounter = new Counter({
  name: 'referral_agent_referrals_total',
  help: 'Total number of referrals processed',
  labelNames: ['status', 'channel']
});

const activeReferralsGauge = new Gauge({
  name: 'referral_agent_active_referrals',
  help: 'Number of currently active referrals'
});

const conversionRateGauge = new Gauge({
  name: 'referral_agent_conversion_rate',
  help: 'Conversion rate of referrals (completed/total)'
});

let instance: ReferralAgent | null = null;

// Types
export type ReferralStatus = 'pending' | 'completed' | 'invalid' | 'duplicate' | 'rewarded';

export interface ReferralPayload {
  inviterId: string; // user who is inviting
  inviteeId: string; // user being invited
  channel: 'discord' | 'web' | 'other';
  referralCode?: string; // unique referral code/invite link
  meta?: Record<string, any>;
}

export interface ReferralEvent {
  id?: string;
  inviterId: string;
  inviteeId: string;
  eventType: 'created' | 'converted' | 'rewarded' | 'invalid' | 'audit';
  timestamp: string;
  meta?: Record<string, any>;
}

export interface ReferralMetrics {
  inviterId: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  rewardsIssued: number;
  contestPoints?: number;
  breakdown?: {
    [status in ReferralStatus]?: number;
  };
}

export interface ReferralAgentMetrics extends BaseMetrics {
  'custom.totalReferrals': number;
  'custom.completedReferrals': number;
  'custom.conversionRate': number;
  'custom.processingErrors': number;
}

export class ReferralAgent extends BaseAgent {
  private metricsStarted: boolean = false;
  private totalReferrals: number = 0;
  private completedReferrals: number = 0;
  private processingErrors: number = 0;
  private lastRunTimestamp: number = 0;
  private errorList: Error[] = [];

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    this.deps.logger.info('Initializing ReferralAgent...');
    
    try {
      // Start metrics server if not already started
      if (!this.metricsStarted) {
        startMetricsServer(9005); // Dedicated port for referral agent metrics
        this.metricsStarted = true;
      }
      
      await this.validateDependencies();
      await this.loadInitialMetrics();
      this.deps.logger.info('ReferralAgent initialized successfully');
    } catch (error) {
      this.deps.logger.error('Failed to initialize ReferralAgent:', error);
      if (error instanceof Error) {
        this.errorList.push(error);
        this.processingErrors++;
      }
      throw error;
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const tables = ['referrals', 'referral_events', 'users'];
    
    for (const table of tables) {
      try {
        const { error } = await this.deps.supabase
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          throw new Error(`Failed to access ${table} table: ${error.message}`);
        }
      } catch (error) {
        this.deps.logger.error(`Database validation failed for table ${table}:`, error);
        throw new Error(`Database dependency validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async loadInitialMetrics(): Promise<void> {
    try {
      // Load current referral counts
      const { data: recentReferrals, error: referralsError } = await this.deps.supabase
        .from('referrals')
        .select('status')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (referralsError) throw referralsError;
      
      this.totalReferrals = recentReferrals?.length || 0;
      this.completedReferrals = recentReferrals?.filter(r => r.status === 'completed' || r.status === 'rewarded').length || 0;
      
      // Update gauges
      activeReferralsGauge.set(this.totalReferrals);
      
      if (this.totalReferrals > 0) {
        conversionRateGauge.set(this.completedReferrals / this.totalReferrals);
      }

      this.deps.logger.info('Initial metrics loaded', {
        totalReferrals: this.totalReferrals,
        completedReferrals: this.completedReferrals
      });
    } catch (error) {
      this.deps.logger.warn('Failed to load initial metrics:', error);
      // Non-fatal error, continue initialization
    }
  }

  protected async process(): Promise<void> {
    const stopTimer = durationHistogram.startTimer({ phase: 'referral_processing' });
    this.lastRunTimestamp = Date.now();
    this.errorList = [];
    
    try {
      this.deps.logger.info('Starting ReferralAgent processing cycle');
      
      // Check for pending referrals that need updates
      await this.checkPendingReferrals();
      
      // Process any rewards that need to be issued
      await this.processRewards();
      
      this.deps.logger.info('ReferralAgent processing cycle completed', {
        totalReferrals: this.totalReferrals,
        completedReferrals: this.completedReferrals
      });
    } catch (error) {
      this.deps.logger.error('Error in ReferralAgent process:', error);
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      throw error;
    } finally {
      stopTimer();
    }
  }

  private async checkPendingReferrals(): Promise<void> {
    // Find pending referrals that might need status updates
    const { data: pendingReferrals, error } = await this.deps.supabase
      .from('referrals')
      .select('id, inviter_id, invitee_id, created_at')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      throw new Error(`Failed to fetch pending referrals: ${error.message}`);
    }

    this.deps.logger.info(`Found ${pendingReferrals?.length || 0} pending referrals to check`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const referral of pendingReferrals || []) {
      try {
        // Check if invitee has completed onboarding
        const { data: inviteeData, error: inviteeError } = await this.deps.supabase
          .from('users')
          .select('onboarding_completed')
          .eq('id', referral.invitee_id)
          .single();

        if (inviteeError) throw inviteeError;

        if (inviteeData?.onboarding_completed) {
          // Update referral status to completed
          await this.updateReferralStatus(referral.invitee_id, 'completed');
          updatedCount++;
        }
      } catch (error) {
        errorCount++;
        errorCounter.inc();
        this.processingErrors++;
        
        if (error instanceof Error) {
          this.errorList.push(error);
        }
        
        this.deps.logger.error(`Failed to process referral ${referral.id}:`, error);
      }
    }
    
    this.deps.logger.info('Pending referrals checked', {
      checked: pendingReferrals?.length || 0,
      updated: updatedCount,
      errors: errorCount
    });
  }

  private async processRewards(): Promise<void> {
    // Find completed referrals that need rewards
    const { data: completedReferrals, error } = await this.deps.supabase
      .from('referrals')
      .select('id, inviter_id, invitee_id')
      .eq('status', 'completed');

    if (error) {
      throw new Error(`Failed to fetch completed referrals: ${error.message}`);
    }

    this.deps.logger.info(`Found ${completedReferrals?.length || 0} completed referrals for rewards`);

    let rewardedCount = 0;
    let errorCount = 0;

    for (const referral of completedReferrals || []) {
      try {
        // Issue reward to inviter
        await this.issueReward(referral.inviter_id, referral.id);
        
        // Update referral status to rewarded
        await this.deps.supabase
          .from('referrals')
          .update({ 
            status: 'rewarded',
            rewarded_at: new Date().toISOString()
          })
          .eq('id', referral.id);
        
        // Log reward event
        await this.logEvent({
          inviterId: referral.inviter_id,
          inviteeId: referral.invitee_id,
          eventType: 'rewarded',
          timestamp: new Date().toISOString(),
          meta: { referralId: referral.id }
        });
        
        rewardedCount++;
        referralCounter.inc({ status: 'rewarded', channel: 'all' });
      } catch (error) {
        errorCount++;
        errorCounter.inc();
        this.processingErrors++;
        
        if (error instanceof Error) {
          this.errorList.push(error);
        }
        
        this.deps.logger.error(`Failed to process reward for referral ${referral.id}:`, error);
      }
    }
    
    this.deps.logger.info('Rewards processed', {
      processed: completedReferrals?.length || 0,
      rewarded: rewardedCount,
      errors: errorCount
    });
  }

  private async issueReward(inviterId: string, referralId: string): Promise<void> {
    // Implement reward logic here
    this.deps.logger.info(`Issuing reward to user ${inviterId} for referral ${referralId}`);
    
    // Example: Add points or credits to user account
    const { error } = await this.deps.supabase.rpc('add_user_credits', {
      user_id: inviterId,
      amount: 100, // Example reward amount
      source: 'referral',
      reference_id: referralId
    });
    
    if (error) {
      throw new Error(`Failed to issue reward: ${error.message}`);
    }
  }

  protected async cleanup(): Promise<void> {
    try {
      // Clean up any stale referrals
      const { data, error } = await this.deps.supabase
        .from('referrals')
        .update({ status: 'invalid' })
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .select('id');
      
      if (error) throw error;
      
      this.deps.logger.info(`ReferralAgent cleanup completed. Marked ${data?.length || 0} stale referrals as invalid.`);
    } catch (error) {
      this.deps.logger.error('Error during ReferralAgent cleanup:', error);
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      throw error;
    }
  }

  protected async checkHealth(): Promise<HealthStatus> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check database connectivity
      const { error } = await this.deps.supabase
        .from('referrals')
        .select('id')
        .limit(1);

      if (error) {
        errors.push(`Database connectivity issue: ${error.message}`);
      }
      
      // Check if we've run recently (within last 24 hours)
      const isRecentRun = Date.now() - this.lastRunTimestamp < 24 * 60 * 60 * 1000;
      if (!isRecentRun) {
        warnings.push(`No recent processing run. Last run: ${new Date(this.lastRunTimestamp).toISOString()}`);
      }
      
      // Check error rate
      if (this.processingErrors > 10) {
        warnings.push(`High error rate detected: ${this.processingErrors} errors`);
      }
      
      // Check conversion rate
      const conversionRate = this.totalReferrals > 0 ? this.completedReferrals / this.totalReferrals : 0;
      if (conversionRate < 0.1 && this.totalReferrals > 50) {
        warnings.push(`Low conversion rate: ${(conversionRate * 100).toFixed(1)}%`);
      }
      
      // Determine overall health status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (errors.length > 0) {
        status = 'unhealthy';
      } else if (warnings.length > 0) {
        status = 'degraded';
      }
      
      return {
        status,
        timestamp: new Date().toISOString(),
        details: { 
          errors,
          warnings,
          metrics: {
            totalReferrals: this.totalReferrals,
            completedReferrals: this.completedReferrals,
            conversionRate: conversionRate,
            processingErrors: this.processingErrors,
            lastRunTimestamp: this.lastRunTimestamp ? new Date(this.lastRunTimestamp).toISOString() : null
          }
        }
      };
    } catch (error) {
      this.deps.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { 
          errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      };
    }
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    try {
      // Get latest stats from the database
      const { data, error } = await this.deps.supabase.rpc('get_referral_summary_metrics');

      if (error) throw error;

      const totalReferrals = data?.total_referrals || 0;
      const completedReferrals = data?.completed_referrals || 0;
      const conversionRate = totalReferrals > 0 ? completedReferrals / totalReferrals : 0;

      // Update class properties
      this.totalReferrals = totalReferrals;
      this.completedReferrals = completedReferrals;

      // Update gauges
      activeReferralsGauge.set(totalReferrals);
      conversionRateGauge.set(conversionRate);

      // Calculate processing time (if available)
      const processingTimeMs = this.lastRunTimestamp ? Date.now() - this.lastRunTimestamp : 0;

      return {
        successCount: completedReferrals,
        errorCount: this.processingErrors,
        warningCount: 0,
        processingTimeMs,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
        'custom.totalReferrals': totalReferrals,
        'custom.completedReferrals': completedReferrals,
        'custom.conversionRate': conversionRate,
        'custom.processingErrors': this.processingErrors
      };
    } catch (error) {
      this.deps.logger.error('Failed to collect metrics:', error);
      
      // Return basic metrics even if collection fails
      return {
        successCount: this.completedReferrals,
        errorCount: this.processingErrors,
        warningCount: 0,
        processingTimeMs: 0,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
        'custom.totalReferrals': this.totalReferrals,
        'custom.completedReferrals': this.completedReferrals,
        'custom.conversionRate': this.totalReferrals > 0 ? this.completedReferrals / this.totalReferrals : 0,
        'custom.processingErrors': this.processingErrors
      };
    }
  }

  // Public methods from the test file
  /** Generates a unique, human-friendly referral code */
  private generateReferralCode(userId: string): string {
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${userId.split('-')[0]}-${random}`;
  }

  /** Get existing or create new referral code for inviter */
  public async getOrCreateReferralCode(inviterId: string): Promise<string> {
    const stopTimer = durationHistogram.startTimer({ phase: 'get_referral_code' });
    
    try {
      // Check if inviter already has a referral code
      const { data, error } = await this.deps.supabase
        .from('referrals')
        .select('referral_code')
        .eq('inviter_id', inviterId)
        .limit(1);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        return data[0].referral_code;
      }
      
      // Generate and store a new code
      const code = this.generateReferralCode(inviterId);
      
      const { error: insertError } = await this.deps.supabase
        .from('referrals')
        .insert([{
          inviter_id: inviterId,
          referral_code: code,
          channel: 'system',
          status: 'pending',
          created_at: new Date().toISOString(),
          meta: { autoGenerated: true }
        }]);
        
      if (insertError) throw insertError;
      
      this.deps.logger.info(`Created new referral code for user ${inviterId}: ${code}`);
      return code;
    } catch (error) {
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      this.deps.logger.error(`Failed to get/create referral code for user ${inviterId}:`, error);
      throw error;
    } finally {
      stopTimer();
    }
  }

  /** Record a new referral event (inviter invites invitee) */
  public async recordReferral(payload: ReferralPayload): Promise<{ success: boolean; eventId?: string }> {
    const stopTimer = durationHistogram.startTimer({ phase: 'record_referral' });
    
    try {
      // 1. Check if referral already exists
      const { data: existing } = await this.deps.supabase
        .from('referrals')
        .select('id')
        .eq('inviter_id', payload.inviterId)
        .eq('invitee_id', payload.inviteeId);

      if (existing && existing.length > 0) {
        this.deps.logger.warn('Duplicate referral attempt', payload);
        referralCounter.inc({ status: 'duplicate', channel: payload.channel });
        return { success: false };
      }

      // 2. Insert new referral
      const { data, error } = await this.deps.supabase
        .from('referrals')
        .insert([{
          inviter_id: payload.inviterId,
          invitee_id: payload.inviteeId,
          channel: payload.channel,
          referral_code: payload.referralCode,
          status: 'pending',
          created_at: new Date().toISOString(),
          meta: payload.meta || {},
        }])
        .select();

      if (error) throw error;

      // 3. Log the event
      const eventId = await this.logEvent({
        inviterId: payload.inviterId,
        inviteeId: payload.inviteeId,
        eventType: 'created',
        timestamp: new Date().toISOString(),
        meta: { referralId: data?.[0]?.id, channel: payload.channel }
      });

      this.totalReferrals++;
      activeReferralsGauge.inc();
      referralCounter.inc({ status: 'created', channel: payload.channel });
      
      this.deps.logger.info('Referral recorded', { 
        id: data?.[0]?.id, 
        inviterId: payload.inviterId,
        inviteeId: payload.inviteeId,
        channel: payload.channel
      });

      return { success: true, eventId };
    } catch (error) {
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      this.deps.logger.error('Failed to record referral:', error);
      throw error;
    } finally {
      stopTimer();
    }
  }

  /** Update referral status when invitee completes onboarding (or contest rules) */
  public async updateReferralStatus(inviteeId: string, status: ReferralStatus): Promise<boolean> {
    const stopTimer = durationHistogram.startTimer({ phase: 'update_status' });
    
    try {
      const { data, error } = await this.deps.supabase
        .from('referrals')
        .update({ 
          status, 
          completed_at: status === 'completed' ? new Date().toISOString() : undefined 
        })
        .eq('invitee_id', inviteeId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) return false;

      // Update metrics if status is completed
      if (status === 'completed') {
        this.completedReferrals++;
        referralCounter.inc({ status: 'completed', channel: data[0].channel || 'unknown' });
        
        if (this.totalReferrals > 0) {
          conversionRateGauge.set(this.completedReferrals / this.totalReferrals);
        }
        
        // Log the event
        await this.logEvent({
          inviterId: data[0].inviter_id,
          inviteeId: inviteeId,
          eventType: 'converted',
          timestamp: new Date().toISOString(),
          meta: { referralId: data[0].id }
        });
      }

      this.deps.logger.info('Referral status updated', { 
        inviteeId, 
        status,
        inviterId: data[0].inviter_id
      });
      
      return true;
    } catch (error) {
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      this.deps.logger.error(`Failed to update referral status for invitee ${inviteeId}:`, error);
      throw error;
    } finally {
      stopTimer();
    }
  }

  /** Get all referral stats for a user (for dashboard, contest, etc) */
  public async getReferralStats(userId: string): Promise<ReferralMetrics> {
    const stopTimer = durationHistogram.startTimer({ phase: 'get_stats' });
    
    try {
      // Aggregate by user (inviter)
      const { data, error } = await this.deps.supabase.rpc('get_referral_metrics', { user_id: userId });
      
      if (error) throw error;
      
      this.deps.logger.info(`Retrieved referral stats for user ${userId}`);
      return data as ReferralMetrics;
    } catch (error) {
      errorCounter.inc();
      this.processingErrors++;
      
      if (error instanceof Error) {
        this.errorList.push(error);
      }
      
      this.deps.logger.error(`Failed to get referral stats for user ${userId}:`, error);
      throw error;
    } finally {
      stopTimer();
    }
  }

  /** Log and expose referral events for contest agent, audits, etc */
  public async logEvent(event: ReferralEvent): Promise<string> {
    try {
      const timestamp = event.timestamp || new Date().toISOString();
      const eventWithTimestamp = { ...event, timestamp };
      
      const { data, error } = await this.deps.supabase
        .from('referral_events')
        .insert([eventWithTimestamp])
        .select('id');
      
      if (error) throw error;
      
      const eventId = data?.[0]?.id;
      this.deps.logger.info('Referral event logged', { ...event, eventId });
      
      return eventId;
    } catch (error) {
      this.deps.logger.error('Failed to log referral event:', error);
      throw error;
    }
  }

  // Public API
  public static getInstance(dependencies: BaseAgentDependencies): ReferralAgent {
    if (!instance) {
      const config: BaseAgentConfig = {
        name: 'ReferralAgent',
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
      instance = new ReferralAgent(config, dependencies);
    }
    return instance;
  }
}

export function initializeReferralAgent(dependencies: BaseAgentDependencies): ReferralAgent {
  const config: BaseAgentConfig = {
    name: 'ReferralAgent',
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
  return new ReferralAgent(config, dependencies);
}

// Legacy function export for backwards compatibility
export async function processReferral(payload: ReferralPayload): Promise<{ success: boolean; eventId?: string }> {
  const deps: BaseAgentDependencies = {
    supabase: (await import('../../services/supabaseClient')).supabase,
    logger: console as any,
    errorHandler: null as any
  };
  
  const agent = ReferralAgent.getInstance(deps);
  await agent.initialize();
  return await agent.recordReferral(payload);
}
