/**
 * Feature-Flagged Alert Agent
 * 
 * Orchestrates between Event-Driven and Polling Alert modes
 * with comprehensive A/B testing, performance monitoring, and automatic rollback
 */

import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';
import { EventDrivenProcessor } from './EventDrivenProcessor';
import { FeatureFlagService } from '../../services/feature-flags/FeatureFlagService';
import { ABTestingEngine } from '../../services/feature-flags/ABTestingEngine';
import { SupabaseClient } from '@supabase/supabase-js';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { requireSupabase } from '../../utils/supabaseUtils';

export interface PollingAlertProcessor {
  initialize(): Promise<void>;
  processAlerts(batchSize?: number): Promise<AlertProcessingResult>;
  getMetrics(): PollingMetrics;
  cleanup(): Promise<void>;
}

export interface AlertProcessingResult {
  alertsProcessed: number;
  alertsGenerated: number;
  averageLatency: number;
  errorCount: number;
  processingTimeMs: number;
  alerts: AlertOpportunity[];
}

export interface PollingMetrics {
  totalAlertsProcessed: number;
  averageLatencyMs: number;
  errorRate: number;
  throughputPerSecond: number;
  lastPollingTime: string;
}

export interface AlertOpportunity {
  type: 'steam' | 'line_movement' | 'injury' | 'sharp_money' | 'arbitrage';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  confidence: number;
  player_name: string;
  stat_type: string;
  trigger_data: Record<string, any>;
  expires_at: string;
}

export interface AlertComparisonResult {
  alertId: string;
  userId?: string;
  
  // Flag evaluation
  flagEnabled: boolean;
  variant: 'control' | 'treatment';
  abTestGroup?: string;
  
  // Polling mode results
  pollingResult?: AlertProcessingResult;
  pollingLatency?: number;
  
  // Event-driven results  
  eventDrivenResult?: AlertProcessingResult;
  eventDrivenLatency?: number;
  
  // Performance comparison
  latencyDelta: number;
  accuracyComparison?: number;
  
  // Final decision
  selectedResult: AlertProcessingResult;
  selectionReason: string;
  
  // Metadata
  timestamp: string;
  environment: string;
}

export class FeatureFlaggedAlertAgent extends BaseAgent {
  private eventDrivenProcessor?: EventDrivenProcessor;
  private pollingProcessor?: PollingAlertProcessor;
  private featureFlagService: FeatureFlagService;
  private abTestingEngine: ABTestingEngine;

  // Performance tracking
  private performanceMetrics = {
    totalAlerts: 0,
    pollingAlerts: 0,
    eventDrivenAlerts: 0,
    avgPollingLatency: 0,
    avgEventDrivenLatency: 0,
    errorRate: 0,
    lastReset: Date.now()
  };

  // Processing state
  private isProcessing = false;
  private pollingInterval?: NodeJS.Timeout;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    if (!this.hasSupabase()) {
      throw new Error('FeatureFlaggedAlertAgent requires Supabase client');
    }

    const supabase = this.requireSupabase();
    this.featureFlagService = new FeatureFlagService(supabase);
    this.abTestingEngine = new ABTestingEngine(supabase, this.featureFlagService);
  }

  // Required abstract method implementations
  protected async initialize(): Promise<void> {
    this.logger.info('🚀 FeatureFlaggedAlertAgent initializing...');

    // Initialize processors
    await this.initializeProcessors();

    // Start performance monitoring
    this.startPerformanceMonitoring();

    this.logger.info('✅ FeatureFlaggedAlertAgent initialized successfully');
  }

  protected async process(): Promise<void> {
    // Main processing logic - run feature-flagged alert processing
    await this.processAlerts({
      batchSize: 50,
      metadata: { source: 'periodic_process' }
    });
  }

  protected async checkHealth(): Promise<HealthStatus> {
    const checks: Array<{ service: string; status: string; error?: string }> = [];

    // Check Supabase connectivity
    try {
      if (this.hasSupabase()) {
        await this.requireSupabase().from('unified_picks').select('count').limit(1);
        checks.push({ service: 'supabase', status: 'healthy' });
      } else {
        throw new Error('Client not available');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'supabase', status: 'unhealthy', error: errorMessage });
    }

    // Check feature flag service
    try {
      await this.featureFlagService.evaluateFlag('test_flag', {});
      checks.push({ service: 'feature-flags', status: 'healthy' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'feature-flags', status: 'degraded', error: errorMessage });
    }

    // Check processors
    checks.push({
      service: 'polling-processor',
      status: this.pollingProcessor ? 'healthy' : 'not_initialized'
    });
    checks.push({
      service: 'event-driven-processor',
      status: this.eventDrivenProcessor ? 'healthy' : 'not_initialized'
    });

    // Overall health
    const healthyServices = checks.filter(check => check.status === 'healthy').length;
    const totalServices = checks.length;
    const healthPercentage = healthyServices / totalServices;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthPercentage >= 0.8) {
      overallStatus = 'healthy';
    } else if (healthPercentage >= 0.5) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.performanceMetrics,
        processingState: {
          isProcessing: this.isProcessing,
          hasPollingInterval: !!this.pollingInterval
        }
      }
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    const baseMetrics: BaseMetrics = {
      agentName: this.config.name,
      successCount: this.performanceMetrics.totalAlerts,
      errorCount: Math.round(this.performanceMetrics.errorRate * this.performanceMetrics.totalAlerts),
      warningCount: 0,
      processingTimeMs: this.performanceMetrics.avgPollingLatency,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };

    // Return base metrics with additional properties for custom tracking
    return {
      ...baseMetrics,
      // Additional metrics stored as extended properties (not strictly typed)
      totalAlerts: this.performanceMetrics.totalAlerts,
      pollingAlerts: this.performanceMetrics.pollingAlerts,
      eventDrivenAlerts: this.performanceMetrics.eventDrivenAlerts,
      avgPollingLatency: this.performanceMetrics.avgPollingLatency,
      avgEventDrivenLatency: this.performanceMetrics.avgEventDrivenLatency,
      errorRate: this.performanceMetrics.errorRate
    } as BaseMetrics & Record<string, any>;
  }

  /**
   * Process alerts using feature-flagged approach
   */
  async processAlerts(context: {
    userId?: string;
    sessionId?: string;
    batchSize?: number;
    metadata?: Record<string, any>;
  } = {}): Promise<AlertComparisonResult> {
    const startTime = Date.now();
    const alertId = `alert-${Date.now()}`;
    
    try {
      // Evaluate feature flag
      const flagEvaluation = await this.featureFlagService.evaluateFlag(
        'event_driven_alert_agent',
        {
          userId: context.userId,
          userSegment: context.metadata?.userSegment,
          environment: process.env.NODE_ENV,
          metadata: context.metadata
        }
      );

      this.logger.debug('Feature flag evaluated for alert processing', {
        alertId,
        enabled: flagEvaluation.enabled,
        variant: flagEvaluation.variant,
        abTestGroup: flagEvaluation.abTestGroup,
        userId: context.userId
      });

      // Always run polling mode for comparison baseline
      const pollingStartTime = Date.now();
      const pollingResult = await this.runPollingMode(context.batchSize);
      const pollingLatency = Date.now() - pollingStartTime;

      let eventDrivenResult: AlertProcessingResult | undefined;
      let eventDrivenLatency: number | undefined;
      let selectedResult: AlertProcessingResult;
      let selectionReason: string;
      let latencyDelta: number;

      // Run event-driven mode if flag is enabled
      if (flagEvaluation.enabled && this.eventDrivenProcessor) {
        const eventDrivenStartTime = Date.now();
        
        try {
          eventDrivenResult = await this.runEventDrivenMode();
          eventDrivenLatency = Date.now() - eventDrivenStartTime;
          
          // Calculate performance delta
          latencyDelta = eventDrivenLatency - pollingLatency;
          
          // Determine which result to use
          const selectionStrategy = await this.determineSelectionStrategy(flagEvaluation);
          
          if (selectionStrategy === 'event_driven') {
            selectedResult = eventDrivenResult;
            selectionReason = 'Event-driven processor selected via feature flag';
          } else if (selectionStrategy === 'polling') {
            selectedResult = pollingResult;
            selectionReason = 'Polling processor selected for comparison baseline';
          } else {
            // Performance-based selection
            selectedResult = latencyDelta <= 500 ? eventDrivenResult : pollingResult; // 500ms threshold
            selectionReason = `Performance-based selection: ${selectionStrategy}`;
          }
          
        } catch (error) {
          this.logger.error('Event-driven processing failed, falling back to polling', {
            alertId,
            error: error instanceof Error ? error.message : String(error)
          });
          
          selectedResult = pollingResult;
          selectionReason = 'Event-driven system failed, polling fallback';
          latencyDelta = 0;
          
          // Track A/B test error event
          await this.abTestingEngine.trackEvent({
            flagName: 'event_driven_alert_agent',
            variant: 'treatment',
            userId: context.userId || 'anonymous',
            eventType: 'error',
            errorOccurred: true,
            errorDetails: error instanceof Error ? error.message : String(error),
            sessionId: context.sessionId,
            latencyMs: Date.now() - eventDrivenStartTime
          });
        }
      } else {
        // Flag disabled - use polling only
        selectedResult = pollingResult;
        selectionReason = 'Feature flag disabled - polling mode only';
        latencyDelta = 0;
      }

      // Create comparison result
      const comparisonResult: AlertComparisonResult = {
        alertId,
        userId: context.userId,
        
        // Flag evaluation
        flagEnabled: flagEvaluation.enabled,
        variant: flagEvaluation.variant as 'control' | 'treatment' || 'control',
        abTestGroup: flagEvaluation.abTestGroup,
        
        // Polling results
        pollingResult,
        pollingLatency,
        
        // Event-driven results
        eventDrivenResult,
        eventDrivenLatency,
        
        // Performance comparison
        latencyDelta,
        accuracyComparison: this.calculateAccuracyComparison(pollingResult, eventDrivenResult),
        
        // Final decision
        selectedResult,
        selectionReason,
        
        // Metadata
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };

      // Track A/B testing events
      await this.trackABTestingEvents(comparisonResult, context);
      
      // Update performance metrics
      this.updatePerformanceMetrics(comparisonResult);
      
      // Store comparison result for analysis
      await this.storeComparisonResult(comparisonResult);

      const totalProcessingTime = Date.now() - startTime;
      
      this.logger.info('Feature-flagged alert processing completed', {
        alertId,
        flagEnabled: flagEvaluation.enabled,
        variant: comparisonResult.variant,
        selectedMode: selectedResult === eventDrivenResult ? 'event_driven' : 'polling',
        totalProcessingTimeMs: totalProcessingTime,
        alertsGenerated: selectedResult.alertsGenerated,
        latencyDelta
      });

      return comparisonResult;

    } catch (error) {
      this.logger.error('Feature-flagged alert processing failed', {
        alertId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Emergency fallback to polling mode
      const pollingResult = await this.runPollingMode(context.batchSize);
      
      return {
        alertId,
        userId: context.userId,
        flagEnabled: false,
        variant: 'control',
        pollingResult,
        pollingLatency: Date.now() - startTime,
        latencyDelta: 0,
        selectedResult: pollingResult,
        selectionReason: 'Emergency fallback due to system error',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };
    }
  }

  /**
   * Run polling mode alert processing
   */
  private async runPollingMode(batchSize: number = 50): Promise<AlertProcessingResult> {
    const startTime = Date.now();
    
    try {
      if (!this.pollingProcessor) {
        await this.initializePollingProcessor();
      }
      
      const result = await this.pollingProcessor!.processAlerts(batchSize);
      
      this.logger.debug('Polling mode processing completed', {
        alertsProcessed: result.alertsProcessed,
        alertsGenerated: result.alertsGenerated,
        latency: result.averageLatency
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Polling mode processing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return empty result
      return {
        alertsProcessed: 0,
        alertsGenerated: 0,
        averageLatency: Date.now() - startTime,
        errorCount: 1,
        processingTimeMs: Date.now() - startTime,
        alerts: []
      };
    }
  }

  /**
   * Run event-driven mode alert processing
   */
  private async runEventDrivenMode(): Promise<AlertProcessingResult> {
    const startTime = Date.now();
    
    try {
      if (!this.eventDrivenProcessor) {
        throw new Error('Event-driven processor not initialized');
      }
      
      const metrics = this.eventDrivenProcessor.getMetrics();
      
      // Convert event-driven metrics to AlertProcessingResult format
      const result: AlertProcessingResult = {
        alertsProcessed: metrics.totalEventsProcessed,
        alertsGenerated: metrics.alertsGenerated,
        averageLatency: metrics.averageLatencyMs,
        errorCount: Math.round(metrics.errorRate * metrics.totalEventsProcessed),
        processingTimeMs: Date.now() - startTime,
        alerts: [] // Alerts are processed in real-time, not batched
      };
      
      this.logger.debug('Event-driven mode processing completed', {
        eventsProcessed: result.alertsProcessed,
        alertsGenerated: result.alertsGenerated,
        averageLatency: result.averageLatency
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Event-driven mode processing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return empty result
      return {
        alertsProcessed: 0,
        alertsGenerated: 0,
        averageLatency: Date.now() - startTime,
        errorCount: 1,
        processingTimeMs: Date.now() - startTime,
        alerts: []
      };
    }
  }

  /**
   * Determine which system to use based on A/B test assignment
   */
  private async determineSelectionStrategy(flagEvaluation: any): Promise<string> {
    if (!flagEvaluation.abTestGroup) {
      return 'event_driven'; // Default to event-driven if no A/B test
    }
    
    // A/B test logic
    if (flagEvaluation.variant === 'control') {
      return 'polling';
    } else if (flagEvaluation.variant === 'treatment') {
      return 'event_driven';
    }
    
    return 'event_driven';
  }

  /**
   * Calculate accuracy comparison between systems
   */
  private calculateAccuracyComparison(
    pollingResult: AlertProcessingResult,
    eventDrivenResult?: AlertProcessingResult
  ): number | undefined {
    if (!eventDrivenResult) return undefined;
    
    // Compare alert generation rates as a proxy for accuracy
    const pollingRate = pollingResult.alertsGenerated / (pollingResult.alertsProcessed || 1);
    const eventDrivenRate = eventDrivenResult.alertsGenerated / (eventDrivenResult.alertsProcessed || 1);
    
    if (pollingRate === 0) return eventDrivenRate > 0 ? 100 : 0;
    
    return ((eventDrivenRate - pollingRate) / pollingRate) * 100;
  }

  /**
   * Track A/B testing events for both systems
   */
  private async trackABTestingEvents(
    result: AlertComparisonResult,
    context: any
  ): Promise<void> {
    try {
      // Track control group (polling) event
      await this.abTestingEngine.trackEvent({
        flagName: 'event_driven_alert_agent',
        variant: 'control',
        userId: context.userId || 'anonymous',
        eventType: 'performance',
        eventValue: result.pollingResult?.alertsGenerated || 0,
        latencyMs: result.pollingLatency,
        sessionId: context.sessionId,
        metadata: {
          alertsProcessed: result.pollingResult?.alertsProcessed,
          averageLatency: result.pollingResult?.averageLatency,
          errorCount: result.pollingResult?.errorCount
        }
      });

      // Track treatment group (event-driven) event if available
      if (result.eventDrivenResult && result.eventDrivenLatency) {
        await this.abTestingEngine.trackEvent({
          flagName: 'event_driven_alert_agent',
          variant: 'treatment',
          userId: context.userId || 'anonymous',
          eventType: 'performance',
          eventValue: result.eventDrivenResult.alertsGenerated,
          latencyMs: result.eventDrivenLatency,
          sessionId: context.sessionId,
          metadata: {
            alertsProcessed: result.eventDrivenResult.alertsProcessed,
            averageLatency: result.eventDrivenResult.averageLatency,
            errorCount: result.eventDrivenResult.errorCount
          }
        });
      }

      // Track conversion event (successful alert processing)
      await this.abTestingEngine.trackEvent({
        flagName: 'event_driven_alert_agent',
        variant: result.variant,
        userId: context.userId || 'anonymous',
        eventType: 'conversion',
        eventValue: 1,
        sessionId: context.sessionId
      });

    } catch (error) {
      this.logger.error('Failed to track A/B testing events', {
        alertId: result.alertId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update internal performance metrics
   */
  private updatePerformanceMetrics(result: AlertComparisonResult): void {
    this.performanceMetrics.totalAlerts++;
    this.performanceMetrics.pollingAlerts++;
    
    if (result.eventDrivenResult) {
      this.performanceMetrics.eventDrivenAlerts++;
    }
    
    // Update latency averages
    const total = this.performanceMetrics.totalAlerts;
    this.performanceMetrics.avgPollingLatency = 
      (this.performanceMetrics.avgPollingLatency * (total - 1) + (result.pollingLatency || 0)) / total;
    
    if (result.eventDrivenLatency) {
      const eventDrivenTotal = this.performanceMetrics.eventDrivenAlerts;
      this.performanceMetrics.avgEventDrivenLatency = 
        (this.performanceMetrics.avgEventDrivenLatency * (eventDrivenTotal - 1) + result.eventDrivenLatency) / eventDrivenTotal;
    }
  }

  /**
   * Store comparison result for analysis
   */
  private async storeComparisonResult(result: AlertComparisonResult): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          await this.requireSupabase()
            .from('alert_comparisons')
            .insert({
              alert_id: result.alertId,
              user_id: result.userId,
              flag_enabled: result.flagEnabled,
              variant: result.variant,
              ab_test_group: result.abTestGroup,
              polling_result: result.pollingResult,
              event_driven_result: result.eventDrivenResult,
              polling_latency: result.pollingLatency,
              event_driven_latency: result.eventDrivenLatency,
              latency_delta: result.latencyDelta,
              accuracy_comparison: result.accuracyComparison,
              selected_mode: result.selectedResult === result.eventDrivenResult ? 'event_driven' : 'polling',
              selection_reason: result.selectionReason,
              environment: result.environment
            });
        },
        async () => {
          this.logger.warn('Circuit breaker open, caching comparison result locally');
        }
      );

    } catch (error) {
      this.logger.error('Failed to store comparison result', {
        alertId: result.alertId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Initialize processors based on feature flags
   */
  private async initializeProcessors(): Promise<void> {
    try {
      // Always initialize polling processor as baseline
      await this.initializePollingProcessor();
      
      // Initialize event-driven processor if dependencies are met
      const hotWarmColdFlag = await this.featureFlagService.evaluateFlag('hot_warm_cold_pipeline');
      
      if (hotWarmColdFlag.enabled) {
        await this.initializeEventDrivenProcessor();
        this.logger.info('✅ Event-driven processor initialized');
      } else {
        this.logger.info('ℹ️ Event-driven processor not initialized - dependencies not met');
      }

    } catch (error) {
      this.logger.error('Failed to initialize processors', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Initialize polling processor
   */
  private async initializePollingProcessor(): Promise<void> {
    this.pollingProcessor = new (class implements PollingAlertProcessor {
      private supabase: SupabaseClient;
      private logger: any;
      private metrics: PollingMetrics = {
        totalAlertsProcessed: 0,
        averageLatencyMs: 0,
        errorRate: 0,
        throughputPerSecond: 0,
        lastPollingTime: new Date().toISOString()
      };

      constructor(supabase: SupabaseClient, logger: any) {
        this.supabase = supabase;
        this.logger = logger;
      }

      async initialize(): Promise<void> {
        this.logger.info('Polling processor initialized');
      }

      async processAlerts(batchSize: number = 50): Promise<AlertProcessingResult> {
        const startTime = Date.now();
        const alerts: AlertOpportunity[] = [];
        
        try {
          // Simulate polling-based alert processing
          const { data: recentProps, error } = await this.supabase
            .from('sports_game_odds')
            .select('*')
            .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
            .limit(batchSize);

          if (error || !recentProps) {
            throw new Error(`Failed to fetch props: ${error?.message}`);
          }

          // Process each prop for alerts
          for (const prop of recentProps) {
            const alert = this.processIndividualProp(prop);
            if (alert) {
              alerts.push(alert);
            }
          }

          const processingTime = Date.now() - startTime;
          
          // Update metrics
          this.metrics.totalAlertsProcessed += recentProps.length;
          this.metrics.averageLatencyMs = (this.metrics.averageLatencyMs + processingTime) / 2;
          this.metrics.lastPollingTime = new Date().toISOString();

          return {
            alertsProcessed: recentProps.length,
            alertsGenerated: alerts.length,
            averageLatency: processingTime,
            errorCount: 0,
            processingTimeMs: processingTime,
            alerts
          };

        } catch (error) {
          const processingTime = Date.now() - startTime;
          this.metrics.errorRate = (this.metrics.errorRate + 1) / 2;
          
          return {
            alertsProcessed: 0,
            alertsGenerated: 0,
            averageLatency: processingTime,
            errorCount: 1,
            processingTimeMs: processingTime,
            alerts: []
          };
        }
      }

      private processIndividualProp(prop: any): AlertOpportunity | null {
        // Simple alert logic for demonstration
        if (Math.abs(prop.line_movement || 0) > 0.5) {
          return {
            type: 'line_movement',
            priority: 'medium',
            confidence: 0.7,
            player_name: prop.player_name || 'Unknown',
            stat_type: prop.stat_type || 'Unknown',
            trigger_data: {
              line_movement: prop.line_movement,
              current_line: prop.line
            },
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
          };
        }
        return null;
      }

      getMetrics(): PollingMetrics {
        return { ...this.metrics };
      }

      async cleanup(): Promise<void> {
        this.logger.info('Polling processor cleaned up');
      }
    })(this.requireSupabase(), this.logger);

    await this.pollingProcessor.initialize();
  }

  /**
   * Initialize event-driven processor
   */
  private async initializeEventDrivenProcessor(): Promise<void> {
    const { TicketStateManager } = await import('./TicketStateManager');
    
    const ticketStateManager = new TicketStateManager(this.requireSupabase(), this.logger);

    this.eventDrivenProcessor = new EventDrivenProcessor(
      this.requireSupabase(),
      this.logger,
      ticketStateManager
    );
    
    await this.eventDrivenProcessor.initialize();
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Emit performance metrics every 60 seconds
    setInterval(async () => {
      await this.emitPerformanceMetrics();
    }, 60000);

    // Reset metrics every hour
    setInterval(() => {
      this.resetPerformanceMetrics();
    }, 60 * 60 * 1000);
  }

  /**
   * Emit performance metrics for monitoring
   */
  private async emitPerformanceMetrics(): Promise<void> {
    try {
      const metrics = {
        ...this.performanceMetrics,
        eventDrivenAdoptionRate: this.performanceMetrics.eventDrivenAlerts / this.performanceMetrics.totalAlerts,
        performanceRatio: this.performanceMetrics.avgEventDrivenLatency / this.performanceMetrics.avgPollingLatency,
        timestamp: new Date().toISOString()
      };

      await this.requireSupabase()
        .from('events')
        .insert({
          event_type: 'alert.performance.metrics.v1',
          aggregate_id: 'feature-flagged-alert-agent',
          aggregate_type: 'alert_agent',
          event_data: metrics,
          idempotency_key: `alert-metrics-${Date.now()}`,
          metadata: {
            source: 'FeatureFlaggedAlertAgent',
            component: 'performance_monitoring'
          }
        });

    } catch (error) {
      this.logger.error('Failed to emit performance metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Reset performance metrics
   */
  private resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalAlerts: 0,
      pollingAlerts: 0,
      eventDrivenAlerts: 0,
      avgPollingLatency: 0,
      avgEventDrivenLatency: 0,
      errorRate: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Start continuous alert processing
   */
  async startContinuousProcessing(intervalMs: number = 30000): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Alert processing already running');
      return;
    }

    this.isProcessing = true;
    
    this.pollingInterval = setInterval(async () => {
      try {
        await this.processAlerts({ 
          batchSize: 50,
          metadata: { continuous: true }
        });
      } catch (error) {
        this.logger.error('Continuous alert processing failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, intervalMs);

    this.logger.info('Continuous alert processing started', { intervalMs });
  }

  /**
   * Stop continuous alert processing
   */
  async stopContinuousProcessing(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    this.isProcessing = false;
    this.logger.info('Continuous alert processing stopped');
  }

  /**
   * Get agent health status
   */
  getHealthStatus(): {
    healthy: boolean;
    metrics: any;
    eventDrivenProcessorReady: boolean;
    pollingProcessorReady: boolean;
    continuousProcessing: boolean;
  } {
    return {
      healthy: true,
      metrics: this.performanceMetrics,
      eventDrivenProcessorReady: !!this.eventDrivenProcessor,
      pollingProcessorReady: !!this.pollingProcessor,
      continuousProcessing: this.isProcessing
    };
  }

  /**
   * Get A/B test analysis for the alert system
   */
  async getABTestAnalysis(): Promise<any> {
    return await this.abTestingEngine.analyzeTest('event_driven_alert_agent');
  }

  /**
   * Generate comprehensive alert system report
   */
  async generateSystemReport(): Promise<any> {
    return await this.abTestingEngine.generateTestReport('event_driven_alert_agent');
  }

  /**
   * Cleanup and shutdown
   */
  protected async cleanup(): Promise<void> {
    await this.stopContinuousProcessing();

    if (this.eventDrivenProcessor) {
      await this.eventDrivenProcessor.cleanup();
    }

    if (this.pollingProcessor) {
      await this.pollingProcessor.cleanup();
    }

    this.logger.info('Feature-flagged alert agent cleaned up');
  }
}