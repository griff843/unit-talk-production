import { Client, GuildMember, User } from 'discord.js';
import { SupabaseService } from './supabase';

/**
 * Analytics event interface
 */
export interface AnalyticsEvent {
  id: string;
  event_type: string;
  user_id: string;
  metadata: Record<string, any>;
  timestamp: string;
  session_id: string;
}

/**
 * User journey step interface
 */
export interface UserJourneyStep {
  action: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * User journey interface
 */
export interface UserJourney {
  id: string;
  user_id: string;
  steps: UserJourneyStep[];
  completed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Onboarding analytics interface
 */
export interface OnboardingAnalytics {
  totalStarts: number;
  totalCompletions: number;
  totalAbandonments: number;
  completionRate: number;
  abandonmentRate: number;
  avgCompletionTime: number;
  flowTypeBreakdown: Record<string, number>;
  stepBreakdown: Record<string, number>;
  dailyBreakdown: Record<string, { starts: number; completions: number }>;
  timeframe: 'day' | 'week' | 'month';
}

/**
 * Advanced Analytics Service for comprehensive tracking and reporting
 */
export class AdvancedAnalyticsService {
  private client: Client;
  private supabaseService: SupabaseService;
  private eventBuffer: AnalyticsEvent[] = [];
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds

  constructor(client: Client, supabaseService: SupabaseService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.startBufferFlush();
  }

  /**
   * Log an analytics event (alias for trackEvent for backward compatibility)
   */
  async logEvent(eventType: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent(eventType, userId, metadata);
  }

  /**
   * Track an analytics event
   */
  async trackEvent(eventType: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const event: AnalyticsEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        event_type: eventType,
        user_id: userId,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
        session_id: this.generateSessionId(userId)
      };

      this.eventBuffer.push(event);

      // Flush buffer if it's full
      if (this.eventBuffer.length >= this.BUFFER_SIZE) {
        await this.flushEventBuffer();
      }

      console.log(`📊 Analytics: ${eventType} for user ${userId}`);
    } catch (error) {
      console.error('❌ Error tracking analytics event:', error);
    }
  }

  /**
   * Flush event buffer to database
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const eventsToFlush = [...this.eventBuffer];
      this.eventBuffer = [];

      const { error } = await this.supabaseService.client
        .from('analytics_events')
        .insert(eventsToFlush);

      if (error) {
        console.error('❌ Error flushing analytics events:', error);
        // Re-add events to buffer on error
        this.eventBuffer.unshift(...eventsToFlush);
      } else {
        console.log(`✅ Flushed ${eventsToFlush.length} analytics events to database`);
      }
    } catch (error) {
      console.error('❌ Error in flushEventBuffer:', error);
    }
  }

  /**
   * Start automatic buffer flushing
   */
  private startBufferFlush(): void {
    this.bufferFlushInterval = setInterval(async () => {
      await this.flushEventBuffer();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop automatic buffer flushing
   */
  public stopBufferFlush(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }
  }

  /**
   * Track onboarding start
   */
  async trackOnboardingStart(userId: string, flowType: string): Promise<void> {
    await this.trackEvent('onboarding_start', userId, {
      flow_type: flowType,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track onboarding step completion
   */
  async trackOnboardingStep(userId: string, stepName: string, flowType: string): Promise<void> {
    await this.trackEvent('onboarding_step_complete', userId, {
      step_name: stepName,
      flow_type: flowType,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track onboarding completion
   */
  async trackOnboardingComplete(userId: string, flowType: string, completionTime: number): Promise<void> {
    await this.trackEvent('onboarding_complete', userId, {
      flow_type: flowType,
      completion_time_ms: completionTime,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track onboarding abandonment
   */
  async trackOnboardingAbandonment(userId: string, flowType: string, lastStep: string): Promise<void> {
    await this.trackEvent('onboarding_abandoned', userId, {
      flow_type: flowType,
      last_step: lastStep,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track DM delivery attempt
   */
  async trackDMDelivery(userId: string, success: boolean, errorReason?: string): Promise<void> {
    await this.trackEvent('dm_delivery_attempt', userId, {
      success,
      error_reason: errorReason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track preference selection
   */
  async trackPreferenceSelection(userId: string, preferenceType: string, value: any): Promise<void> {
    await this.trackEvent('preference_selected', userId, {
      preference_type: preferenceType,
      value,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track role assignment
   */
  async trackRoleAssignment(userId: string, roleId: string, roleName: string): Promise<void> {
    await this.trackEvent('role_assigned', userId, {
      role_id: roleId,
      role_name: roleName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get comprehensive onboarding analytics
   */
  async getOnboardingAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<OnboardingAnalytics> {
    try {
      const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);

      // Get onboarding events
      const { data: events, error } = await this.supabaseService.client
        .from('analytics_events')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .in('event_type', ['onboarding_start', 'onboarding_complete', 'onboarding_abandoned', 'onboarding_step_complete']);

      if (error) {
        console.error('❌ Error fetching onboarding analytics:', error);
        throw error;
      }

      // Process events
      const starts = events?.filter(e => e.event_type === 'onboarding_start') || [];
      const completions = events?.filter(e => e.event_type === 'onboarding_complete') || [];
      const abandonments = events?.filter(e => e.event_type === 'onboarding_abandoned') || [];
      const steps = events?.filter(e => e.event_type === 'onboarding_step_complete') || [];

      // Calculate metrics
      const totalStarts = starts.length;
      const totalCompletions = completions.length;
      const totalAbandonments = abandonments.length;
      const completionRate = totalStarts > 0 ? (totalCompletions / totalStarts) * 100 : 0;
      const abandonmentRate = totalStarts > 0 ? (totalAbandonments / totalStarts) * 100 : 0;

      // Calculate average completion time
      const completionTimes = completions
        .map(c => c.metadata?.completion_time_ms)
        .filter(t => typeof t === 'number') as number[];
      const avgCompletionTime = completionTimes.length > 0 
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length 
        : 0;

      // Flow type breakdown
      const flowTypeBreakdown = starts.reduce((acc: Record<string, number>, event) => {
        const flowType = event.metadata?.flow_type || 'unknown';
        acc[flowType] = (acc[flowType] || 0) + 1;
        return acc;
      }, {});

      // Step completion breakdown
      const stepBreakdown = steps.reduce((acc: Record<string, number>, event) => {
        const stepName = event.metadata?.step_name || 'unknown';
        acc[stepName] = (acc[stepName] || 0) + 1;
        return acc;
      }, {});

      // Daily breakdown
      const dailyBreakdown = starts.reduce((acc: Record<string, { starts: number; completions: number }>, event) => {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        if (!acc[date]) acc[date] = { starts: 0, completions: 0 };
        acc[date].starts++;
        return acc;
      }, {});

      completions.forEach(event => {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        if (dailyBreakdown[date]) {
          dailyBreakdown[date].completions++;
        }
      });

      return {
        totalStarts,
        totalCompletions,
        totalAbandonments,
        completionRate,
        abandonmentRate,
        avgCompletionTime,
        flowTypeBreakdown,
        stepBreakdown,
        dailyBreakdown,
        timeframe
      };
    } catch (error) {
      console.error('❌ Error getting onboarding analytics:', error);
      throw error;
    }
  }

  /**
   * Get user journey data
   */
  async getUserJourneys(limit: number = 50): Promise<UserJourney[]> {
    try {
      const { data: journeys, error } = await this.supabaseService.client
        .from('user_journeys')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching user journeys:', error);
        throw error;
      }

      return journeys || [];
    } catch (error) {
      console.error('❌ Error getting user journeys:', error);
      throw error;
    }
  }

  /**
   * Track user journey step
   */
  async trackUserJourneyStep(userId: string, step: UserJourneyStep): Promise<void> {
    try {
      // Get or create user journey
      let { data: journey, error: fetchError } = await this.supabaseService.client
        .from('user_journeys')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Error fetching user journey:', fetchError);
        return;
      }

      if (!journey) {
        // Create new journey
        const { data: newJourney, error: createError } = await this.supabaseService.client
          .from('user_journeys')
          .insert({
            user_id: userId,
            steps: [step],
            completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating user journey:', createError);
          return;
        }

        journey = newJourney;
      } else {
        // Update existing journey
        const updatedSteps = [...(journey.steps || []), step];
        const { error: updateError } = await this.supabaseService.client
          .from('user_journeys')
          .update({
            steps: updatedSteps,
            updated_at: new Date().toISOString()
          })
          .eq('id', journey.id);

        if (updateError) {
          console.error('❌ Error updating user journey:', updateError);
          return;
        }
      }

      console.log(`📊 User journey step tracked: ${step.action} for user ${userId}`);
    } catch (error) {
      console.error('❌ Error tracking user journey step:', error);
    }
  }

  /**
   * Complete user journey
   */
  async completeUserJourney(userId: string): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('user_journeys')
        .update({
          completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('completed', false);

      if (error) {
        console.error('❌ Error completing user journey:', error);
        return;
      }

      console.log(`✅ User journey completed for user ${userId}`);
    } catch (error) {
      console.error('❌ Error completing user journey:', error);
    }
  }

  /**
   * Generate session ID for user
   */
  private generateSessionId(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${userId}-${timestamp}-${random}`;
  }

  /**
   * Get analytics summary for admin dashboard
   */
  async getAnalyticsSummary(): Promise<{
    totalEvents: number;
    recentEvents: number;
    topEventTypes: Array<{ event_type: string; count: number }>;
    activeUsers: number;
  }> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Get total events count
      const { count: totalEvents, error: totalError } = await this.supabaseService.client
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', oneDayAgo.toISOString());

      if (totalError) {
        console.error('❌ Error getting total events count:', totalError);
      }

      // Get recent events count (last 24 hours)
      const { count: recentEvents, error: recentError } = await this.supabaseService.client
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', oneDayAgo.toISOString());

      if (recentError) {
        console.error('❌ Error getting recent events count:', recentError);
      }

      // Get top event types
      const { data: eventTypes, error: typesError } = await this.supabaseService.client
        .from('analytics_events')
        .select('event_type')
        .gte('timestamp', oneDayAgo.toISOString());

      if (typesError) {
        console.error('❌ Error getting event types:', typesError);
      }

      const topEventTypes = eventTypes ? 
        Object.entries(
          eventTypes.reduce((acc: Record<string, number>, event) => {
            acc[event.event_type] = (acc[event.event_type] || 0) + 1;
            return acc;
          }, {})
        )
        .map(([event_type, count]) => ({ event_type, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) : [];

      // Get active users (users with events in last 24 hours)
      const { data: activeUsersData, error: activeError } = await this.supabaseService.client
        .from('analytics_events')
        .select('user_id')
        .gte('timestamp', oneDayAgo.toISOString());

      if (activeError) {
        console.error('❌ Error getting active users:', activeError);
      }

      const activeUsers = activeUsersData ? 
        new Set(activeUsersData.map(event => event.user_id)).size : 0;

      return {
        totalEvents: totalEvents || 0,
        recentEvents: recentEvents || 0,
        topEventTypes,
        activeUsers
      };
    } catch (error) {
      console.error('❌ Error getting analytics summary:', error);
      return {
        totalEvents: 0,
        recentEvents: 0,
        topEventTypes: [],
        activeUsers: 0
      };
    }
  }

  /**
   * Cleanup old analytics data
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await this.supabaseService.client
        .from('analytics_events')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (error) {
        console.error('❌ Error cleaning up old analytics data:', error);
        return;
      }

      console.log(`🧹 Cleaned up analytics data older than ${daysToKeep} days`);
    } catch (error) {
      console.error('❌ Error in cleanupOldData:', error);
    }
  }

  /**
   * Increment message count for analytics
   */
  async incrementMessageCount(channelId: string): Promise<void> {
    try {
      // Implementation for incrementing message count
      console.log(`📊 Incrementing message count for channel ${channelId}`);
    } catch (error) {
      console.error('❌ Error incrementing message count:', error);
    }
  }

  /**
   * Increment thread count for analytics
   */
  async incrementThreadCount(channelId: string): Promise<void> {
    try {
      // Implementation for incrementing thread count
      console.log(`📊 Incrementing thread count for channel ${channelId}`);
    } catch (error) {
      console.error('❌ Error incrementing thread count:', error);
    }
  }

  /**
   * Increment command count for analytics
   */
  async incrementCommandCount(commandName: string): Promise<void> {
    try {
      // Implementation for incrementing command count
      console.log(`📊 Incrementing command count for ${commandName}`);
    } catch (error) {
      console.error('❌ Error incrementing command count:', error);
    }
  }

  /**
   * Log error for analytics
   */
  async logError(error: Error, context?: string): Promise<void> {
    try {
      // Implementation for logging errors
      console.error(`❌ Analytics error log: ${error.message}`, context ? `Context: ${context}` : '');
    } catch (logError) {
      console.error('❌ Error logging error:', logError);
    }
  }

  /**
   * Get real-time stats
   */
  async getRealTimeStats(): Promise<any> {
    try {
      // Implementation for getting real-time stats
      return {
        messages: 0,
        threads: 0,
        commands: 0,
        errors: 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting real-time stats:', error);
      return null;
    }
  }

  /**
   * Send dashboard update
   */
  async sendDashboardUpdate(data: any): Promise<void> {
    try {
      // Implementation for sending dashboard updates
      console.log('📊 Sending dashboard update:', data);
    } catch (error) {
      console.error('❌ Error sending dashboard update:', error);
    }
  }

  /**
   * Get dashboard analytics
   */
  async getDashboardAnalytics(): Promise<any> {
    try {
      // Implementation for getting dashboard analytics
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalMessages: 0,
        totalCommands: 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting dashboard analytics:', error);
      return null;
    }
  }

  /**
   * Get user journey (singular)
   */
  async getUserJourney(userId: string): Promise<UserJourney | null> {
    try {
      const { data: journey, error } = await this.supabaseService.client
        .from('user_journeys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No journey found
        }
        console.error('❌ Error fetching user journey:', error);
        throw error;
      }

      return journey;
    } catch (error) {
      console.error('❌ Error getting user journey:', error);
      return null;
    }
  }

  /**
   * Destroy/cleanup method
   */
  async destroy(): Promise<void> {
    try {
      // Implementation for cleanup
      console.log('🧹 Destroying AdvancedAnalyticsService');
    } catch (error) {
      console.error('❌ Error destroying AdvancedAnalyticsService:', error);
    }
  }
}