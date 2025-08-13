/**
 * Correctness Monitoring Service - Data validation and cross-provider verification
 * Ensures accuracy of odds, game times, and other critical sports betting data
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

export interface DataProvider {
  id: string;
  providerName: string;
  providerType: 'primary' | 'validation' | 'reference';
  reliabilityScore: number;
  isActive: boolean;
  supportedSports: string[];
  dataTypes: string[];
}

export interface ValidationRule {
  id: string;
  ruleName: string;
  ruleType: 'odds_variance' | 'time_drift' | 'line_movement' | 'availability';
  dataType: 'odds' | 'game_times' | 'player_props';
  sport?: string;
  thresholdConfig: {
    max_odds_variance?: number;
    max_time_drift_minutes?: number;
    max_line_variance?: number;
    min_sample_size?: number;
    time_window_minutes?: number;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
}

export interface DataSnapshot {
  id: string;
  snapshotTimestamp: Date;
  providerId: string;
  gameId: string;
  sport: string;
  gameTime?: Date;
  homeTeam: string;
  awayTeam: string;
  oddsData: {
    spread?: {
      home_odds: number;
      away_odds: number;
      line: number;
    };
    moneyline?: {
      home_odds: number;
      away_odds: number;
    };
    total?: {
      over_odds: number;
      under_odds: number;
      line: number;
    };
    props?: Array<{
      prop_type: string;
      line: number;
      over_odds: number;
      under_odds: number;
      player_name?: string;
    }>;
  };
  lineData?: {
    spread_line?: number;
    total_line?: number;
    movements?: Array<{
      timestamp: string;
      old_line: number;
      new_line: number;
      move_direction: 'up' | 'down';
    }>;
  };
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  id: string;
  validationTimestamp: Date;
  ruleId: string;
  gameId: string;
  sport: string;
  primaryProviderId: string;
  validationProviderId: string;
  validationType: string;
  discrepancyFound: boolean;
  discrepancySeverity: 'low' | 'medium' | 'high' | 'critical';
  discrepancyDetails: Record<string, any>;
  expectedValue?: Record<string, any>;
  actualValue?: Record<string, any>;
  variancePercentage?: number;
  resolutionStatus: 'open' | 'investigating' | 'resolved' | 'false_positive';
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface CorrectnessAlert {
  id: string;
  alertType: 'odds_discrepancy' | 'time_drift' | 'data_missing' | 'quality_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  providerId?: string;
  gameId?: string;
  sport?: string;
  validationResultId?: string;
  alertTitle: string;
  alertDescription?: string;
  recommendedActions: string[];
  impactAssessment?: string;
  thresholdValue?: number;
  actualValue?: number;
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: Date;
}

export interface QualityMetrics {
  providerId: string;
  sport?: string;
  accuracy: number;      // 0.0-1.0
  timeliness: number;    // average minutes delay
  completeness: number;  // 0.0-1.0
  consistency: number;   // 0.0-1.0
  performanceScore: number; // 0-100
  trendDirection: 'improving' | 'stable' | 'degrading';
  sampleSize: number;
  measurementPeriod: number; // minutes
}

export interface GameValidationStatus {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  gameTime?: Date;
  providerCount: number;
  providers: string[];
  totalValidations: number;
  discrepanciesFound: number;
  criticalDiscrepancies: number;
  latestSnapshot: Date;
  minutesSinceLastUpdate: number;
  validationStatus: 'HEALTHY' | 'CAUTION' | 'WARNING' | 'CRITICAL' | 'INCOMPLETE';
}

interface MonitoringCache {
  providers: Map<string, DataProvider>;
  rules: Map<string, ValidationRule>;
  lastCacheUpdate: Date;
}

export class CorrectnessMonitoringService extends EventEmitter {
  private supabase: ReturnType<typeof createClient>;
  private logger: any;
  private cache: MonitoringCache;
  private validationQueue: Array<{
    gameId: string;
    sport: string;
    validationType: string;
    priority: number;
  }> = [];
  private isProcessingQueue = false;

  constructor(logger: any = console) {
    super();
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    this.logger = logger;
    
    this.cache = {
      providers: new Map(),
      rules: new Map(),
      lastCacheUpdate: new Date(0)
    };

    // Start background processing
    this.startBackgroundProcessing();
  }

  /**
   * Capture data snapshot from a provider
   */
  async captureDataSnapshot(snapshot: Omit<DataSnapshot, 'id' | 'snapshotTimestamp'>): Promise<string> {
    this.logger.info('Capturing data snapshot', {
      provider: snapshot.providerId,
      gameId: snapshot.gameId,
      sport: snapshot.sport
    });

    try {
      const { data: snapshotId, error } = await this.supabase.rpc('capture_data_snapshot', {
        p_provider_name: await this.getProviderName(snapshot.providerId),
        p_game_id: snapshot.gameId,
        p_sport: snapshot.sport,
        p_game_time: snapshot.gameTime?.toISOString(),
        p_home_team: snapshot.homeTeam,
        p_away_team: snapshot.awayTeam,
        p_odds_data: snapshot.oddsData,
        p_line_data: snapshot.lineData || {},
        p_metadata: snapshot.metadata || {}
      });

      if (error) {
        throw new Error(`Failed to capture snapshot: ${error.message}`);
      }

      // Queue validation if multiple providers have data
      await this.queueValidation(snapshot.gameId, snapshot.sport);

      this.emit('snapshotCaptured', {
        snapshotId,
        gameId: snapshot.gameId,
        sport: snapshot.sport,
        providerId: snapshot.providerId,
        timestamp: new Date()
      });

      return snapshotId;

    } catch (error) {
      this.logger.error('Failed to capture data snapshot', { error, snapshot });
      throw error;
    }
  }

  /**
   * Validate data consistency between providers
   */
  async validateDataConsistency(
    gameId: string,
    sport: string,
    validationType: string = 'odds_variance',
    timeWindowMinutes: number = 5
  ): Promise<string> {
    this.logger.info('Validating data consistency', {
      gameId,
      sport,
      validationType,
      timeWindowMinutes
    });

    try {
      const { data: resultId, error } = await this.supabase.rpc('validate_data_consistency', {
        p_game_id: gameId,
        p_sport: sport,
        p_validation_type: validationType,
        p_time_window_minutes: timeWindowMinutes
      });

      if (error) {
        throw new Error(`Failed to validate data consistency: ${error.message}`);
      }

      // Get the validation result details
      const result = await this.getValidationResult(resultId);
      
      if (result && result.discrepancyFound) {
        this.emit('discrepancyDetected', {
          validationResultId: resultId,
          gameId,
          sport,
          validationType,
          severity: result.discrepancySeverity,
          variance: result.variancePercentage,
          timestamp: new Date()
        });
      }

      return resultId;

    } catch (error) {
      this.logger.error('Failed to validate data consistency', { error, gameId, sport });
      throw error;
    }
  }

  /**
   * Get validation result by ID
   */
  async getValidationResult(resultId: string): Promise<ValidationResult | null> {
    const { data: result, error } = await this.supabase
      .from('validation_results')
      .select('*')
      .eq('id', resultId)
      .single();

    if (error) {
      this.logger.error('Failed to get validation result', { error, resultId });
      return null;
    }

    if (!result) return null;

    return {
      id: result.id,
      validationTimestamp: new Date(result.validation_timestamp),
      ruleId: result.rule_id,
      gameId: result.game_id,
      sport: result.sport,
      primaryProviderId: result.primary_provider_id,
      validationProviderId: result.validation_provider_id,
      validationType: result.validation_type,
      discrepancyFound: result.discrepancy_found,
      discrepancySeverity: result.discrepancy_severity,
      discrepancyDetails: result.discrepancy_details || {},
      expectedValue: result.expected_value,
      actualValue: result.actual_value,
      variancePercentage: result.variance_percentage ? parseFloat(result.variance_percentage) : undefined,
      resolutionStatus: result.resolution_status,
      resolutionNotes: result.resolution_notes,
      resolvedAt: result.resolved_at ? new Date(result.resolved_at) : undefined,
      resolvedBy: result.resolved_by
    };
  }

  /**
   * Get active correctness alerts
   */
  async getActiveAlerts(
    severity?: string,
    sport?: string,
    limit: number = 50
  ): Promise<CorrectnessAlert[]> {
    let query = this.supabase
      .from('active_correctness_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (severity) {
      query = query.eq('severity', severity);
    }

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data: alerts, error } = await query;

    if (error) {
      throw new Error(`Failed to get active alerts: ${error.message}`);
    }

    return alerts?.map(a => ({
      id: a.id,
      alertType: a.alert_type,
      severity: a.severity,
      providerId: a.provider_name, // Using provider name as ID for display
      gameId: a.game_id,
      sport: a.sport,
      validationResultId: a.validation_result_id,
      alertTitle: a.alert_title,
      alertDescription: a.alert_description,
      recommendedActions: a.recommended_actions || [],
      impactAssessment: a.impact_assessment,
      thresholdValue: a.threshold_value ? parseFloat(a.threshold_value) : undefined,
      actualValue: a.actual_value ? parseFloat(a.actual_value) : undefined,
      status: a.status,
      acknowledgedAt: a.acknowledged_at ? new Date(a.acknowledged_at) : undefined,
      acknowledgedBy: a.acknowledged_by,
      resolvedAt: a.resolved_at ? new Date(a.resolved_at) : undefined,
      resolvedBy: a.resolved_by,
      resolutionNotes: a.resolution_notes,
      createdAt: new Date(a.created_at)
    })) || [];
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('correctness_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy
      })
      .eq('id', alertId);

    if (error) {
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }

    this.emit('alertAcknowledged', {
      alertId,
      acknowledgedBy,
      timestamp: new Date()
    });
  }

  /**
   * Resolve a validation discrepancy
   */
  async resolveDiscrepancy(
    resultId: string,
    resolutionStatus: 'resolved' | 'false_positive',
    resolutionNotes: string,
    resolvedBy: string
  ): Promise<void> {
    const { data: success, error } = await this.supabase.rpc('resolve_validation_discrepancy', {
      p_result_id: resultId,
      p_resolution_status: resolutionStatus,
      p_resolution_notes: resolutionNotes,
      p_resolved_by: resolvedBy
    });

    if (error || !success) {
      throw new Error(`Failed to resolve discrepancy: ${error?.message || 'Unknown error'}`);
    }

    this.emit('discrepancyResolved', {
      resultId,
      resolutionStatus,
      resolvedBy,
      timestamp: new Date()
    });
  }

  /**
   * Get data quality metrics for providers
   */
  async getQualityMetrics(
    providerName?: string,
    sport?: string,
    hours: number = 24
  ): Promise<QualityMetrics[]> {
    let query = this.supabase
      .from('data_quality_dashboard')
      .select('*')
      .gte('metric_timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('metric_timestamp', { ascending: false });

    if (providerName) {
      query = query.eq('provider_name', providerName);
    }

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data: metrics, error } = await query;

    if (error) {
      throw new Error(`Failed to get quality metrics: ${error.message}`);
    }

    // Group by provider and sport to create consolidated metrics
    const grouped = new Map<string, {
      accuracy?: number;
      timeliness?: number;
      completeness?: number;
      consistency?: number;
      performanceScore?: number;
      sampleSize?: number;
      measurementPeriod?: number;
      providerId: string;
      sport?: string;
    }>();

    metrics?.forEach(m => {
      const key = `${m.provider_name}-${m.sport || 'all'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          providerId: m.provider_name,
          sport: m.sport,
          performanceScore: m.performance_score,
          sampleSize: m.sample_size,
          measurementPeriod: m.measurement_period_minutes
        });
      }
      
      const entry = grouped.get(key)!;
      if (m.metric_type === 'accuracy') entry.accuracy = m.metric_value;
      if (m.metric_type === 'timeliness') entry.timeliness = m.metric_value;
      if (m.metric_type === 'completeness') entry.completeness = m.metric_value;
      if (m.metric_type === 'consistency') entry.consistency = m.metric_value;
    });

    return Array.from(grouped.values()).map(entry => ({
      providerId: entry.providerId,
      sport: entry.sport,
      accuracy: entry.accuracy || 0,
      timeliness: entry.timeliness || 0,
      completeness: entry.completeness || 0,
      consistency: entry.consistency || 0,
      performanceScore: entry.performanceScore || 0,
      trendDirection: 'stable' as const, // Would need trend calculation
      sampleSize: entry.sampleSize || 0,
      measurementPeriod: entry.measurementPeriod || 0
    }));
  }

  /**
   * Get game validation status
   */
  async getGameValidationStatus(
    gameId?: string,
    sport?: string,
    hours: number = 24
  ): Promise<GameValidationStatus[]> {
    let query = this.supabase
      .from('game_validation_status')
      .select('*')
      .order('validation_status', { ascending: false });

    if (gameId) {
      query = query.eq('game_id', gameId);
    }

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data: games, error } = await query;

    if (error) {
      throw new Error(`Failed to get game validation status: ${error.message}`);
    }

    return games?.map(g => ({
      gameId: g.game_id,
      sport: g.sport,
      homeTeam: g.home_team,
      awayTeam: g.away_team,
      gameTime: g.game_time ? new Date(g.game_time) : undefined,
      providerCount: g.provider_count,
      providers: g.providers?.split(', ') || [],
      totalValidations: g.total_validations,
      discrepanciesFound: g.discrepancies_found,
      criticalDiscrepancies: g.critical_discrepancies,
      latestSnapshot: new Date(g.latest_snapshot),
      minutesSinceLastUpdate: g.minutes_since_last_update,
      validationStatus: g.validation_status
    })) || [];
  }

  /**
   * Calculate and update quality metrics for a provider
   */
  async updateQualityMetrics(
    providerName: string,
    sport?: string,
    hoursLookback: number = 24
  ): Promise<void> {
    try {
      await this.supabase.rpc('calculate_quality_metrics', {
        p_provider_name: providerName,
        p_sport: sport,
        p_hours_lookback: hoursLookback
      });

      this.emit('qualityMetricsUpdated', {
        providerName,
        sport,
        hoursLookback,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to update quality metrics', { error, providerName, sport });
      throw error;
    }
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<any[]> {
    const { data: health, error } = await this.supabase
      .from('data_provider_health')
      .select('*')
      .order('quality_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to get provider health: ${error.message}`);
    }

    return health || [];
  }

  /**
   * Get validation discrepancy summary
   */
  async getValidationSummary(hours: number = 24): Promise<any[]> {
    const { data: summary, error } = await this.supabase
      .from('validation_discrepancy_summary')
      .select('*')
      .order('discrepancy_rate_percent', { ascending: false });

    if (error) {
      throw new Error(`Failed to get validation summary: ${error.message}`);
    }

    return summary || [];
  }

  /**
   * Queue validation for processing
   */
  private async queueValidation(
    gameId: string,
    sport: string,
    validationType: string = 'odds_variance',
    priority: number = 1
  ): Promise<void> {
    this.validationQueue.push({
      gameId,
      sport,
      validationType,
      priority
    });

    // Sort by priority
    this.validationQueue.sort((a, b) => b.priority - a.priority);

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processValidationQueue();
    }
  }

  /**
   * Process validation queue
   */
  private async processValidationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.validationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.validationQueue.length > 0) {
        const validation = this.validationQueue.shift()!;
        
        try {
          await this.validateDataConsistency(
            validation.gameId,
            validation.sport,
            validation.validationType
          );
        } catch (error) {
          this.logger.error('Validation queue processing error', { error, validation });
        }

        // Small delay between validations to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Get provider name by ID
   */
  private async getProviderName(providerId: string): Promise<string> {
    // If it's already a name, return it
    if (typeof providerId === 'string' && !providerId.includes('-')) {
      return providerId;
    }

    const { data: provider } = await this.supabase
      .from('data_providers')
      .select('provider_name')
      .eq('id', providerId)
      .single();

    return provider?.provider_name || providerId;
  }

  /**
   * Start background processing
   */
  private startBackgroundProcessing(): void {
    // Process validation queue every 30 seconds
    setInterval(() => {
      this.processValidationQueue();
    }, 30000);

    // Update quality metrics every 15 minutes
    setInterval(async () => {
      try {
        const providers = await this.getProviderHealth();
        for (const provider of providers.slice(0, 5)) {
          await this.updateQualityMetrics(provider.provider_name);
        }
      } catch (error) {
        this.logger.error('Background quality metrics update failed', { error });
      }
    }, 900000);

    // Emit health status every 5 minutes
    setInterval(async () => {
      try {
        const health = await this.getProviderHealth();
        const alerts = await this.getActiveAlerts('critical');
        
        this.emit('healthUpdate', {
          providers: health,
          criticalAlerts: alerts,
          timestamp: new Date()
        });
      } catch (error) {
        this.logger.error('Health update failed', { error });
      }
    }, 300000);
  }

  /**
   * Validate specific provider data
   */
  async validateProviderData(
    providerName: string,
    gameIds: string[],
    validationTypes: string[] = ['odds_variance', 'time_drift']
  ): Promise<{ validated: number; discrepancies: number; results: string[] }> {
    const results: string[] = [];
    let discrepancies = 0;

    for (const gameId of gameIds) {
      for (const validationType of validationTypes) {
        try {
          // Get game sport from recent snapshots
          const { data: snapshot } = await this.supabase
            .from('data_snapshots')
            .select('sport')
            .eq('game_id', gameId)
            .limit(1)
            .single();

          if (snapshot) {
            const resultId = await this.validateDataConsistency(
              gameId,
              snapshot.sport,
              validationType
            );
            
            results.push(resultId);

            // Check if discrepancy was found
            const result = await this.getValidationResult(resultId);
            if (result?.discrepancyFound) {
              discrepancies++;
            }
          }
        } catch (error) {
          this.logger.error('Provider validation error', { error, gameId, validationType });
        }
      }
    }

    return {
      validated: results.length,
      discrepancies,
      results
    };
  }

  /**
   * Run comprehensive validation across all active games
   */
  async runComprehensiveValidation(sport?: string): Promise<{
    totalGames: number;
    validationsRun: number;
    discrepanciesFound: number;
    criticalIssues: number;
  }> {
    const games = await this.getGameValidationStatus(undefined, sport, 2);
    let validationsRun = 0;
    let discrepanciesFound = 0;
    let criticalIssues = 0;

    for (const game of games) {
      if (game.providerCount >= 2) {
        try {
          const resultId = await this.validateDataConsistency(
            game.gameId,
            game.sport,
            'odds_variance'
          );
          
          validationsRun++;

          const result = await this.getValidationResult(resultId);
          if (result?.discrepancyFound) {
            discrepanciesFound++;
            if (result.discrepancySeverity === 'critical') {
              criticalIssues++;
            }
          }
        } catch (error) {
          this.logger.error('Comprehensive validation error', { error, game: game.gameId });
        }
      }
    }

    return {
      totalGames: games.length,
      validationsRun,
      discrepanciesFound,
      criticalIssues
    };
  }
}

// Export for easy integration
export async function createCorrectnessMonitoringService(logger?: any): Promise<CorrectnessMonitoringService> {
  return new CorrectnessMonitoringService(logger);
}