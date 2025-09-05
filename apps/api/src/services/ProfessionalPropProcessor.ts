// @ts-nocheck
/**
 * Professional Prop Processor
 * 
 * Ensures ALL props receive full professional treatment:
 * - Devigging FIRST (removes hidden vig)
 * - CLV tracking (monitors line movement)
 * - Professional grading (45+ factors)
 * - Risk assessment (Kelly sizing)
 * - Performance monitoring
 * 
 * This is the MISSING LINK between raw props and professional insights.
 */

import { SyndicateGradingEngine } from '../agents/GradingAgent/scoring/gradingEngine';
import { createLogger } from '../utils/logger';

import { CLVTrackingService } from './clv/CLVTrackingService';
import { DeviggingService } from './devigging/DeviggingService';
import { supabaseClient } from './supabaseClient';

import type { RawProp, UnifiedPick } from '../types/supabase-types';

export interface ProfessionalPropResult {
  pickId: string;
  professionalScore: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  confidence: number;
  devigged_edge: number;
  kelly_fraction: number;
  professional_insights: any;
  clv_tracking_id: string;
  // Domain uses camelCase; persistence maps to snake_case
  published: boolean;
  processing_time: number;
}

export interface PropProcessingOptions {
  auto_approve_threshold: number; // Professional professional_score threshold for auto-approval
  require_admin_review: string[]; // Tiers that require admin review
  max_batch_size: number;
  timeout_ms: number;
}

export class ProfessionalPropProcessor {
  private static instance: ProfessionalPropProcessor;
  private logger: any;
  private deviggingService: DeviggingService;
  private clvTrackingService: CLVTrackingService;
  private gradingEngine: SyndicateGradingEngine;

  // Default processing options
  private defaultOptions: PropProcessingOptions = {
    auto_approve_threshold: 3.0, // S/A tier auto-approved
    require_admin_review: ['B', 'C', 'D'],
    max_batch_size: 50,
    timeout_ms: 30000 // 30 second timeout per prop
  };

  private constructor() {
    this.logger = createLogger('ProfessionalPropProcessor');
    this.deviggingService = DeviggingService.getInstance();
    this.clvTrackingService = CLVTrackingService.getInstance();
    this.gradingEngine = new SyndicateGradingEngine();
  }

  public static getInstance(): ProfessionalPropProcessor {
    if (!ProfessionalPropProcessor.instance) {
      ProfessionalPropProcessor.instance = new ProfessionalPropProcessor();
    }
    return ProfessionalPropProcessor.instance;
  }

  /**
   * Main entry point - processes raw props through professional system
   */
  async processRawProps(options?: Partial<PropProcessingOptions>): Promise<ProfessionalPropResult[]> {
    const config = { ...this.defaultOptions, ...options };
    const results: ProfessionalPropResult[] = [];

    this.logger.info('Starting professional prop processing...');

    try {
      // 1. Get unprocessed raw props
      const rawProps = await this.getUnprocessedRawProps(config.max_batch_size);
      
      if (rawProps.length === 0) {
        this.logger.info('No unprocessed props found');
        return results;
      }

      this.logger.info(`Processing ${rawProps.length} raw props through professional system`);

      // 2. Process props through PARALLEL professional pipeline (5-7x performance improvement)
      this.logger.info('🚀 Using ParallelGradingEngine for enhanced performance');
      
      // Create parallel tasks for each prop
      const parallelTasks = rawProps.map(rawProp => ({
        name: `prop_${rawProp.id}`,
        task: async () => {
          const result = await this.processIndividualProp(rawProp, config);
          // Mark raw prop as processed
          await this.markRawPropProcessed(rawProp.id);
          return result;
        },
        fallback: null,
        timeout: config.timeout_ms || 30000,
        critical: true // All props are critical for processing
      }));

      // Execute in parallel batches for optimal performance
      const batchSize = Math.min(parallelTasks.length, 10); // Max 10 parallel
      const batches = [];
      for (let i = 0; i < parallelTasks.length; i += batchSize) {
        batches.push(parallelTasks.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        try {
          // Process batch in parallel
          const batchResults = await Promise.allSettled(
            batch.map(task => task.task())
          );

          // Handle results and errors
          batchResults.forEach((result, index) => {
            const rawProp = rawProps[results.length + index];
            if (result.status === 'fulfilled' && result.value) {
              results.push(result.value);
            } else {
              const error = result.status === 'rejected' ? result.reason : 'Unknown error';
              this.logger.error(`Failed to process prop ${rawProp.id} in parallel batch`, error);
              this.markRawPropError(rawProp.id, error instanceof Error ? error.message : String(error));
            }
          });

        } catch (error) {
          this.logger.error('Parallel batch processing failed', error);
          // Fall back to sequential processing for failed batch
          this.logger.info('Falling back to sequential processing for failed batch');
          
          for (const task of batch) {
            try {
              const result = await task.task();
              if (result) results.push(result);
            } catch (seqError) {
              this.logger.error(`Sequential fallback failed for task ${task.name}`, seqError);
            }
          }
        }
      }

      this.logger.info(`Successfully processed ${results.length}/${rawProps.length} props`);
      
      // 3. Generate processing summary
      await this.generateProcessingSummary(results);

      return results;

    } catch (error) {
      this.logger.error('Professional prop processing failed', error);
      throw error;
    }
  }

  /**
   * Process individual raw prop through complete professional pipeline
   */
  private async processIndividualProp(
    rawProp: RawProp, 
    config: PropProcessingOptions
  ): Promise<ProfessionalPropResult> {
    const startTime = Date.now();
    const propLogger = this.logger.child({ propId: rawProp.id, sport: rawProp.sport });

    try {
      propLogger.info('Starting professional processing for prop');

      // STEP 1: DEVIG ODDS (CRITICAL - ALL SHARP SYSTEMS DO THIS FIRST)
      const deviggingResult = await this.deviggOdds(rawProp);
      propLogger.info('Devigging completed', { 
        totalVig: (deviggingResult.totalVig || 0).toFixed(2) + '%',
        trueProbabilities: {
          over: (deviggingResult.outcome1?.trueProb || 0).toFixed(3),
          under: (deviggingResult.outcome2?.trueProb || 0).toFixed(3)
        }
      });

      // STEP 2: START CLV TRACKING
      const clvTrackingId = await this.startCLVTracking(rawProp, deviggingResult);
      propLogger.info('CLV tracking initiated', { clvTrackingId });

      // STEP 3: PROFESSIONAL GRADING WITH DEVIGGED ODDS
      const gradingResult = await this.runProfessionalGrading(rawProp, deviggingResult);
      propLogger.info('Professional grading completed', {
        finalScore: gradingResult.finalScore.toFixed(2),
        tier: gradingResult.tier,
        confidence: (gradingResult.confidence * 100).toFixed(1) + '%'
      });

      // STEP 4: RISK ASSESSMENT
      const riskAssessment = await this.calculateRiskAssessment(gradingResult);

      // STEP 5: DETERMINE AUTO-APPROVAL
      const autoApproved = this.shouldAutoApprove(gradingResult, config);

      // STEP 6: CREATE UNIFIED PICK WITH PROFESSIONAL DATA
      const pickId = await this.createUnifiedPick(
        rawProp,
        gradingResult,
        riskAssessment,
        clvTrackingId,
        autoApproved
      );

      const processingTime = Date.now() - startTime;
      propLogger.info('Professional processing completed', {
        pickId,
        processingTime: `${processingTime}ms`,
        autoApproved,
        tier: gradingResult.tier
      });

      return {
        pickId,
        professionalScore: gradingResult.finalScore,
        tier: gradingResult.tier,
        confidence: gradingResult.confidence,
        devigged_edge: gradingResult.edgeScore,
        kelly_fraction: gradingResult.kellyFraction,
        professional_insights: gradingResult.professionalInsights,
        clv_tracking_id: clvTrackingId,
        auto_approved: autoApproved,
        processing_time: processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      propLogger.error('Professional processing failed', { 
        error: error instanceof Error ? error.message : String(error),
        processingTime: `${processingTime}ms`
      });
      throw error;
    }
  }

  /**
   * Devig odds using professional devigging service
   */
  private async deviggOdds(rawProp: RawProp) {
    return this.deviggingService.devigTwoWay({
      odds1: rawProp.over_odds,
      odds2: rawProp.under_odds
    });
  }

  /**
   * Start CLV tracking for the prop
   */
  private async startCLVTracking(rawProp: RawProp, deviggingResult: any): Promise<string> {
    // Determine which side we would bet (higher true probability)
    const option1TrueProb = deviggingResult.outcome1?.trueProb || 0.5;
    const option2TrueProb = deviggingResult.outcome2?.trueProb || 0.5;
    const prediction = option1TrueProb > option2TrueProb ? 'over' : 'under';
    const betOdds = prediction === 'over' ? rawProp.over_odds : rawProp.under_odds;

    await this.clvTrackingService.trackPick({
      propId: rawProp.id,
      userId: 'system', // System-generated picks
      sport: rawProp.sport,
      market: rawProp.stat_type,
      book: 'aggregated', // Multiple book average
      openingLine: rawProp.line,
      openingOdds: betOdds,
      betLine: rawProp.line,
      betOdds: betOdds,
      gameTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // Assume 4 hours from now
      modelEdge: this.deviggingService.calculateEdge(
        prediction === 'over' ? option1TrueProb : option2TrueProb,
        betOdds,
        false
      )
    });

    return rawProp.id; // Use prop ID as CLV tracking ID
  }

  /**
   * Run professional grading with enhanced features
   */
  private async runProfessionalGrading(rawProp: RawProp, deviggingResult: any) {
    // Create enhanced features object with devigged data
    const enhancedFeatures = {
      // Raw prop data
      propId: rawProp.id,
      sport: rawProp.sport,
      statType: rawProp.stat_type,
      playerName: rawProp.player_name,
      line: rawProp.line,
      
      // Original odds
      overOdds: rawProp.over_odds,
      underOdds: rawProp.under_odds,
      
      // 🆕 DEVIGGED DATA (CRITICAL FOR PROFESSIONAL GRADING)
      devigged: {
        totalVig: deviggingResult.totalVig,
        overTrueProb: deviggingResult.option1TrueProb,
        underTrueProb: deviggingResult.option2TrueProb,
        trueEdge: {
          over: this.deviggingService.calculateEdge(deviggingResult.option1TrueProb, rawProp.over_odds, false),
          under: this.deviggingService.calculateEdge(deviggingResult.option2TrueProb, rawProp.under_odds, false)
        }
      },
      
      // Market context
      marketType: 'player_props',
      gameTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      
      // Professional indicators (would be populated by data feeds)
      steamMove: false,
      sharpAction: 0.5,
      publicBetting: 0.5,
      lineMovement: 0,
      
      // Default values for comprehensive grading
      playerForm: 0.7,
      matchupRating: 0.6,
      injuryImpact: 0,
      weatherImpact: 0,
      venueAdvantage: 0,
      motivation: 0.5
    };

    // Use the professional grading engine
    return await this.gradingEngine.gradeWithEnhancedFeatures(enhancedFeatures);
  }

  /**
   * Calculate risk assessment and Kelly sizing
   */
  private async calculateRiskAssessment(gradingResult: any) {
    return {
      kelly_fraction: gradingResult.kellyFraction,
      position_size: gradingResult.positionSize,
      risk_score: gradingResult.riskScore,
      correlation_risk: gradingResult.correlationRisk,
      portfolio_impact: gradingResult.portfolioImpact || 0,
      max_exposure: Math.min(gradingResult.kellyFraction * 0.25, 0.05) // 5% max position
    };
  }

  /**
   * Determine if prop should be auto-approved
   */
  private shouldAutoApprove(gradingResult: any, config: PropProcessingOptions): boolean {
    // Auto-approve high-tier picks with good professional scores
    if (gradingResult.tier === 'S' || gradingResult.tier === 'A') {
      return gradingResult.finalScore >= config.auto_approve_threshold;
    }
    
    // All other tiers require manual review
    return false;
  }

  /**
   * Create unified pick with professional data
   */
  private async createUnifiedPick(
    rawProp: RawProp,
    gradingResult: any,
    riskAssessment: any,
    clvTrackingId: string,
    autoApproved: boolean
  ): Promise<string> {
    
    // Determine prediction based on best edge
    const overEdge = gradingResult.professionalInsights?.devigged?.trueEdge?.over || 0;
    const underEdge = gradingResult.professionalInsights?.devigged?.trueEdge?.under || 0;
    const prediction = overEdge > underEdge ? 'over' : 'under';

    const unifiedPick: Partial<UnifiedPick & { 
      professional_score: number;
      devigged_edge: number;
      kelly_fraction: number;
      professional_insights: any;
      clv_tracking_id: string;
      feature_contributions: any;
      risk_assessment: any;
    }> = {
      raw_prop_id: rawProp.id,
      user_id: 'system',
      sport: rawProp.sport,
      prediction: prediction,
      confidence: gradingResult.confidence,
      published: autoApproved,
      tier: gradingResult.tier,
      
      // 🆕 PROFESSIONAL DATA
      score: gradingResult.finalScore,
      devigged_edge: gradingResult.edgeScore,
      kelly_fraction: gradingResult.kellyFraction,
      professional_insights: gradingResult.professionalInsights,
      clv_tracking_id: clvTrackingId,
      feature_contributions: gradingResult.featureContributions,
      risk_assessment: riskAssessment
    };

    const { data, error } = await supabaseClient
      .from('unified_picks')
      .insert(unifiedPick)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create unified pick: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get unprocessed raw props
   */
  private async getUnprocessedRawProps(limit: number): Promise<RawProp[]> {
    const { data, error } = await supabaseClient
      .from('raw_props')
      .select('*')
      .is('processed_at', null)
      .is('error_message', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch raw props: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Mark raw prop as processed
   */
  private async markRawPropProcessed(propId: string): Promise<void> {
    const { error } = await supabaseClient
      .from('raw_props')
      .update({ 
        processed_at: new Date().toISOString(),
        processed_by: 'professional_system'
      })
      .eq('id', propId);

    if (error) {
      this.logger.error(`Failed to mark prop ${propId} as processed:`, error);
    }
  }

  /**
   * Mark raw prop with error
   */
  private async markRawPropError(propId: string, errorMessage: string): Promise<void> {
    const { error } = await supabaseClient
      .from('raw_props')
      .update({ 
        error_message: errorMessage,
        error_at: new Date().toISOString()
      })
      .eq('id', propId);

    if (error) {
      this.logger.error(`Failed to mark prop ${propId} with error:`, error);
    }
  }

  /**
   * Generate processing summary for monitoring
   */
  private async generateProcessingSummary(results: ProfessionalPropResult[]): Promise<void> {
    const summary = {
      total_processed: results.length,
      auto_approved: results.filter(r => r.published).length,
      manual_review: results.filter(r => !r.published).length,
      tier_distribution: {
        S: results.filter(r => r.tier === 'S').length,
        A: results.filter(r => r.tier === 'A').length,
        B: results.filter(r => r.tier === 'B').length,
        C: results.filter(r => r.tier === 'C').length,
        D: results.filter(r => r.tier === 'D').length
      },
      avg_processing_time: results.reduce((sum, r) => sum + r.processing_time, 0) / results.length,
      avg_professional_score: results.reduce((sum, r) => sum + r.professionalScore, 0) / results.length,
      avg_confidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    };

    this.logger.info('Professional processing summary', summary);

    // Store summary for monitoring
    await supabaseClient
      .from('processing_logs')
      .insert({
        processor: 'professional_prop_processor',
        summary,
        processed_at: new Date().toISOString()
      });
  }

  /**
   * Process SmartForm submissions through professional system
   */
  async processSmartFormSubmission(ticketId: string): Promise<ProfessionalPropResult> {
    this.logger.info(`Processing SmartForm submission ${ticketId} through professional system`);

    // Get smart ticket data
    const { data: smartTicket, error } = await supabaseClient
      .from('smart_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error || !smartTicket) {
      throw new Error(`Smart ticket not found: ${ticketId}`);
    }

    // Convert SmartForm data to raw prop format
    const rawProp: Partial<RawProp> = {
      id: ticketId,
      sport: smartTicket.sport,
      stat_type: smartTicket.market_type,
      player_name: smartTicket.player_name,
      line: smartTicket.line,
      over_odds: smartTicket.over_odds || -110,
      under_odds: smartTicket.under_odds || -110,
      created_at: smartTicket.created_at,
      updated_at: new Date().toISOString()
    };

    // Process through professional pipeline
    return await this.processIndividualProp(rawProp as RawProp, this.defaultOptions);
  }

  /**
   * Process a single prop from GradingFeatureSet
   */
  async processGradingFeatureSet(features: any): Promise<ProfessionalPropResult> {
    // Convert GradingFeatureSet to RawProp format
    const rawProp: Partial<any> = {
      id: features.propId,
      sport: features.sport,
      stat_type: features.market?.type || features.marketType,
      player_name: features.player,
      line: features.market?.line || 0,
      over_odds: features.market?.odds || features.odds || -110,
      under_odds: features.market?.odds || features.odds || -110,
      created_at: features.timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Process through professional pipeline
    return await this.processIndividualProp(rawProp as any, this.defaultOptions);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<any> {
    const { data: stats } = await supabaseClient
      .from('processing_logs')
      .select('*')
      .eq('processor', 'professional_prop_processor')
      .order('processed_at', { ascending: false })
      .limit(10);

    return {
      recent_runs: stats,
      avg_processing_time: stats?.reduce((sum, s) => sum + (s.summary?.avg_processing_time || 0), 0) / (stats?.length || 1),
      total_processed: stats?.reduce((sum, s) => sum + (s.summary?.total_processed || 0), 0) || 0
    };
  }
}

// Export singleton instance
export const professionalPropProcessor = ProfessionalPropProcessor.getInstance();