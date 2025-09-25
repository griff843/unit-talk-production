// @ts-nocheck
/**
 * Professional Betting Scheduler
 * Manages automated execution of CLV monitoring, feedback loops, and system optimization
 * This is what keeps the system sharp and adaptive to changing markets
 *
 * @module ProfessionalBettingScheduler
 */

import { createLogger } from '../../utils/logger';
import { clvAlertService } from '../alerts/CLVAlertService';
import { clvTrackingService } from '../clv/CLVTrackingService';
import { feedbackLoopService } from '../feedback/FeedbackLoopService';

export class ProfessionalBettingScheduler {
  private static instance: ProfessionalBettingScheduler;
  private logger: any;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  private constructor() {
    this.logger = createLogger('ProfessionalBettingScheduler');
  }

  public static getInstance(): ProfessionalBettingScheduler {
    if (!ProfessionalBettingScheduler.instance) {
      ProfessionalBettingScheduler.instance = new ProfessionalBettingScheduler();
    }
    return ProfessionalBettingScheduler.instance;
  }

  /**
   * Start all professional betting automation
   */
  public start(): void {
    if (this.isRunning) {
      this.logger.warn('Professional betting scheduler already running');
      return;
    }

    // Skip starting timers during test runs to avoid open handles
    if (process.env.NODE_ENV === 'test') {
      this.logger.info('Skipping ProfessionalBettingScheduler timers in test environment');
      return;
    }

    this.logger.info('Starting professional betting automation...');
    this.isRunning = true;

    // 1. CLV Monitoring - Every hour
    this.scheduleTask('clv_monitoring', () => {
      this.runCLVMonitoring();
    }, 60 * 60 * 1000); // 1 hour

    // 2. Feedback Loop - Every 6 hours during active betting
    this.scheduleTask('feedback_loop', () => {
      this.runFeedbackLoop();
    }, 6 * 60 * 60 * 1000); // 6 hours

    // 3. Deep Optimization - Daily at 4 AM EST
    this.scheduleDailyTask('deep_optimization', () => {
      this.runDeepOptimization();
    }, 4); // 4 AM

    // 4. Performance Reports - Weekly on Sunday at 6 AM EST
    this.scheduleWeeklyTask('performance_report', () => {
      this.generatePerformanceReport();
    }, 0, 6); // Sunday, 6 AM

    // 5. Model Health Check - Every 30 minutes during games
    this.scheduleTask('health_check', () => {
      this.runHealthCheck();
    }, 30 * 60 * 1000); // 30 minutes

    this.logger.info('All professional betting automation started');
  }

  /**
   * Stop all automation
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.logger.info('Stopping professional betting automation...');

    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      this.logger.info(`Stopped ${name} scheduler`);
    }

    this.intervals.clear();
    this.isRunning = false;

    this.logger.info('Professional betting automation stopped');
  }

  /**
   * Schedule a recurring task
   */
  private scheduleTask(name: string, task: () => void, intervalMs: number): void {
    // Run immediately, then on interval
    task();

    const interval = setInterval(() => {
      try {
        task();
      } catch (error) {
        this.logger.error(`Scheduled task ${name} failed`, error);
      }
    }, intervalMs);

    this.intervals.set(name, interval);
    this.logger.info(`Scheduled ${name} to run every ${intervalMs / 1000}s`);
  }

  /**
   * Schedule a daily task at specific hour
   */
  private scheduleDailyTask(name: string, task: () => void, hour: number): void {
    const runTask = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(hour, 0, 0, 0);

      // If hour has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      const delay = next.getTime() - now.getTime();

      setTimeout(() => {
        try {
          task();
        } catch (error) {
          this.logger.error(`Daily task ${name} failed`, error);
        }

        // Schedule next day
        runTask();
      }, delay);
    };

    runTask();
    this.logger.info(`Scheduled ${name} to run daily at ${hour}:00`);
  }

  /**
   * Schedule a weekly task
   */
  private scheduleWeeklyTask(name: string, task: () => void, dayOfWeek: number, hour: number): void {
    const runTask = () => {
      const now = new Date();
      const next = new Date();

      // Set to desired day and hour
      const daysUntilTarget = (dayOfWeek - now.getDay() + 7) % 7;
      next.setDate(now.getDate() + daysUntilTarget);
      next.setHours(hour, 0, 0, 0);

      // If time has passed this week, schedule for next week
      if (next <= now) {
        next.setDate(next.getDate() + 7);
      }

      const delay = next.getTime() - now.getTime();

      setTimeout(() => {
        try {
          task();
        } catch (error) {
          this.logger.error(`Weekly task ${name} failed`, error);
        }

        // Schedule next week
        runTask();
      }, delay);
    };

    runTask();
    this.logger.info(`Scheduled ${name} to run weekly on day ${dayOfWeek} at ${hour}:00`);
  }

  /**
   * CLV Monitoring - Hourly
   */
  private async runCLVMonitoring(): Promise<void> {
    try {
      this.logger.info('Running CLV monitoring...');
      await clvAlertService.monitorCLV();
      this.logger.info('CLV monitoring completed');
    } catch (error) {
      this.logger.error('CLV monitoring failed', error);
    }
  }

  /**
   * Feedback Loop - Every 6 hours
   */
  private async runFeedbackLoop(): Promise<void> {
    try {
      this.logger.info('Running feedback loop...');
      const results = await feedbackLoopService.runFeedbackLoop();

      // Log summary
      this.logger.info('Feedback loop completed', {
        weightAdjustments: results.weightAdjustments.length,
        bookAdjustments: results.bookAdjustments.length,
        marketAdjustments: results.marketAdjustments.length,
        prunedFeatures: results.prunedFeatures.length
      });

      // Alert if significant changes
      if (results.weightAdjustments.length > 5 || results.prunedFeatures.length > 0) {
        await clvAlertService.sendAlert('investigate',
          `Feedback loop made ${results.weightAdjustments.length} adjustments, pruned ${results.prunedFeatures.length} features`,
          { results }
        );
      }
    } catch (error) {
      this.logger.error('Feedback loop failed', error);
    }
  }

  /**
   * Deep Optimization - Daily at 4 AM
   */
  private async runDeepOptimization(): Promise<void> {
    try {
      this.logger.info('Running deep optimization...');

      // 1. Run extended feedback loop
      await this.runFeedbackLoop();

      // 2. Analyze feature importance over longer period
      const longTermStats = await clvTrackingService.getCLVStats({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      // 3. Generate optimization report
      this.logger.info('Deep optimization completed', {
        avgCLV: longTermStats.avgCLVPercentage,
        totalBets: longTermStats.totalBets,
        positiveRate: (longTermStats.clvPositive / longTermStats.totalBets * 100).toFixed(1) + '%'
      });

    } catch (error) {
      this.logger.error('Deep optimization failed', error);
    }
  }

  /**
   * Performance Report - Weekly
   */
  private async generatePerformanceReport(): Promise<void> {
    try {
      this.logger.info('Generating weekly performance report...');

      const weeklyStats = await clvTrackingService.getCLVStats({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      });

      const report = {
        period: 'Weekly',
        avgCLV: weeklyStats.avgCLVPercentage,
        totalBets: weeklyStats.totalBets,
        positiveRate: weeklyStats.clvPositive / weeklyStats.totalBets,
        topBooks: Array.from(weeklyStats.byBook.entries())
          .sort(([,a], [,b]) => b.avgCLV - a.avgCLV)
          .slice(0, 3),
        topMarkets: Array.from(weeklyStats.byMarket.entries())
          .sort(([,a], [,b]) => b.avgCLV - a.avgCLV)
          .slice(0, 5)
      };

      this.logger.info('Weekly performance report generated', report);

      // Send to admin if performance is concerning
      if (report.avgCLV < 1) {
        await clvAlertService.sendAlert('warning',
          `Weekly CLV below target: ${report.avgCLV.toFixed(2)}%`,
          report
        );
      }

    } catch (error) {
      this.logger.error('Performance report generation failed', error);
    }
  }

  /**
   * Health Check - Every 30 minutes
   */
  private async runHealthCheck(): Promise<void> {
    try {
      // Check recent performance
      const performance = await clvTrackingService.getRecentPerformance(2); // Last 2 hours

      // Basic health metrics
      const isHealthy = performance.avgCLV > -3; // Not catastrophically bad

      if (!isHealthy) {
        this.logger.warn('System health check failed', performance);

        await clvAlertService.sendAlert('critical',
          'System health check failed - emergency review needed',
          performance
        );
      }

    } catch (error) {
      this.logger.error('Health check failed', error);
    }
  }

  /**
   * Manual trigger for any task
   */
  public async triggerTask(taskName: string): Promise<void> {
    switch (taskName) {
      case 'clv_monitoring':
        await this.runCLVMonitoring();
        break;
      case 'feedback_loop':
        await this.runFeedbackLoop();
        break;
      case 'deep_optimization':
        await this.runDeepOptimization();
        break;
      case 'performance_report':
        await this.generatePerformanceReport();
        break;
      case 'health_check':
        await this.runHealthCheck();
        break;
      default:
        throw new Error(`Unknown task: ${taskName}`);
    }
  }

  /**
   * Get scheduler status
   */
  public getStatus(): {
    isRunning: boolean;
    scheduledTasks: string[];
    lastRunTimes: Record<string, Date>;
  } {
    return {
      isRunning: this.isRunning,
      scheduledTasks: Array.from(this.intervals.keys()),
      lastRunTimes: {} // TODO: Track last run times
    };
  }
}

// Export singleton instance
export const professionalBettingScheduler = ProfessionalBettingScheduler.getInstance();