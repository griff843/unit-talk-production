import { createClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { logger } from '../shared/logger';
import { Pick } from '../types/pick';

import { DiscordAlertRouter, AlertData } from './DiscordAlertRouter';

/**
 * ScheduledPickProcessor - Handles daily 10 AM EST batch posting
 * 
 * Responsibilities:
 * - Query approved picks scheduled for posting
 * - Post picks to individual capper Discord threads
 * - Mark picks as posted to prevent duplicates
 * - Handle live picks for immediate posting
 * - Generate admin summary reports
 */
export class ScheduledPickProcessor {
  private supabase;
  
  constructor() {
    this.supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey);
  }

  /**
   * Main batch processing method - called by scheduler at 10 AM EST
   */
  async processDailyBatch(): Promise<void> {
    const batchLogger = logger.child({ 
      source: 'scheduled_pick_processor',
      batchTime: new Date().toISOString()
    });
    
    try {
      batchLogger.info('Starting daily pick batch processing');
      
      // Get all picks scheduled for posting
      const scheduledPicks = await this.getScheduledPicks();
      
      if (scheduledPicks.length === 0) {
        batchLogger.info('No picks scheduled for posting');
        return;
      }
      
      batchLogger.info(`Processing ${scheduledPicks.length} scheduled picks`);
      
      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };
      
      // Process each pick
      for (const pick of scheduledPicks) {
        try {
          await this.processIndividualPick(pick);
          results.successful++;
          
          batchLogger.info('Pick posted successfully', {
            pickId: pick.id,
            capper: (pick as any).capper,
            threadId: (pick as any).thread_id
          });
          
        } catch (error) {
          results.failed++;
          results.errors.push(`${(pick as any).capper}: ${error instanceof Error ? error.message : String(error)}`);
          
          batchLogger.error('Failed to process pick', {
            pickId: pick.id,
            capper: (pick as any).capper,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Send admin summary
      await this.sendAdminSummary(results, scheduledPicks.length);
      
      batchLogger.info('Daily pick batch processing completed', results);
      
    } catch (error) {
      batchLogger.error('Daily batch processing failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Send error alert to admin
      await this.sendErrorAlert('Daily Batch Processing Failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Process live picks immediately
   */
  async processLivePick(pickId: string): Promise<void> {
    const liveLogger = logger.child({ 
      source: 'live_pick_processor',
      pickId 
    });
    
    try {
      liveLogger.info('Processing live pick for immediate posting');
      
      const pick = await this.getPickById(pickId);
      if (!pick) {
        throw new Error(`Pick not found: ${pickId}`);
      }
      
      if ((pick as any).market_type !== 'live') {
        throw new Error(`Pick is not marked as live: ${pickId}`);
      }
      
      await this.processIndividualPick(pick);
      
      liveLogger.info('Live pick posted successfully', {
        capper: (pick as any).capper,
        threadId: (pick as any).thread_id
      });
      
    } catch (error) {
      liveLogger.error('Live pick processing failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      await this.sendErrorAlert('Live Pick Processing Failed', {
        pickId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Get picks scheduled for posting
   */
  private async getScheduledPicks(): Promise<Pick[]> {
    const now = new Date();
    
    const { data, error } = await this.supabase
      .from('daily_picks')
      .select('*')
      .in('status', ['approved', 'scheduled', 'live_ready'])
      .or(`scheduled_post_time.lte.${now.toISOString()},status.eq.live_ready`)
      .is('message_id', null); // Not yet posted
      
    if (error) {
      throw new Error(`Failed to fetch scheduled picks: ${error.message}`);
    }
    
    return data as Pick[];
  }

  /**
   * Get individual pick by ID
   */
  private async getPickById(pickId: string): Promise<Pick | null> {
    const { data, error } = await this.supabase
      .from('daily_picks')
      .select('*')
      .eq('id', pickId)
      .single();
      
    if (error) {
      logger.error('Failed to fetch pick', { pickId, error });
      return null;
    }
    
    return data as Pick;
  }

  /**
   * Process individual pick - post to Discord and update status
   */
  private async processIndividualPick(pick: Pick): Promise<void> {
    // Validate thread ID exists
    if (!(pick as any).thread_id) {
      throw new Error(`No thread ID configured for capper: ${(pick as any).capper}`);
    }
    
    // Route pick post to capper's dedicated thread via AlertRouter
    const alertData: AlertData = {
      pickId: pick.id,
      capper: (pick as any).capper,
      sport: (pick as any).sport,
      selection: (pick as any).legs.map((leg: any) => leg.selection).join(', '),
      odds: (pick as any).total_odds.toString(),
      units: (pick as any).total_units,
      confidence: (pick as any).confidence,
      systemGrade: (pick as any).tier || 'Ungraded',
      pickType: (pick as any).pick_type,
      isLive: (pick as any).market_type === 'live',
      timestamp: new Date().toISOString()
    };
    
    // Route to capper's thread
    await DiscordAlertRouter.routeAlert('pick_post', alertData);
    
    // Mark as posted (using placeholder message ID until Discord integration complete)
    const messageId = `posted_${Date.now()}`;
    await this.markPickAsPosted(pick.id, messageId);
  }



  /**
   * Mark pick as posted in database
   */
  private async markPickAsPosted(pickId: string, messageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('daily_picks')
      .update({ 
        status: 'posted',
        message_id: messageId,
        posted_at: new Date().toISOString()
      })
      .eq('id', pickId);
      
    if (error) {
      throw new Error(`Failed to update pick status: ${error.message}`);
    }
  }

  /**
   * Send admin summary of batch processing
   */
  private async sendAdminSummary(results: any, totalPicks: number): Promise<void> {
    const summary = {
      title: '📊 Daily Pick Batch Summary',
      description: `Processed ${totalPicks} picks at ${new Date().toLocaleTimeString()} EST`,
      fields: [
        {
          name: '✅ Successful',
          value: results.successful.toString(),
          inline: true
        },
        {
          name: '❌ Failed', 
          value: results.failed.toString(),
          inline: true
        },
        {
          name: '📈 Success Rate',
          value: `${Math.round((results.successful / totalPicks) * 100)}%`,
          inline: true
        }
      ],
      color: results.failed === 0 ? 0x00ff00 : 0xffaa00
    };
    
    if (results.errors.length > 0) {
      summary.fields.push({
        name: '🚨 Errors',
        value: results.errors.join('\n'),
        inline: false
      });
    }
    
    await this.sendToSystemAlerts(summary);
  }

  /**
   * Send error alert to system alerts channel
   */
  private async sendErrorAlert(title: string, details: any): Promise<void> {
    const alert = {
      title: `🚨 ${title}`,
      description: typeof details === 'string' ? details : JSON.stringify(details, null, 2),
      color: 0xff0000,
      timestamp: new Date().toISOString()
    };
    
    await this.sendToSystemAlerts(alert);
  }

  /**
   * Send message to system alerts channel
   * TODO: Integrate with Discord bot
   */
  private async sendToSystemAlerts(message: any): Promise<void> {
    logger.info('System alert placeholder', {
      channel: env.systemAlertsThreadId,
      message
    });
    
    // TODO: Integrate with Discord bot to send actual alert
  }
}