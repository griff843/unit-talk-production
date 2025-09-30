import { proxyActivities } from '@temporalio/workflow';
import * as wf from '@temporalio/workflow';

// Import activity types for scoring
interface ScoringActivities {
  fetchPropsWithFeatures(params: {
    batchSize: number;
    minFeatureAge?: number;
  }): Promise<{
    candidates: Array<{
      propId: string;
      features: Record<string, any>;
      marketData: Record<string, any>;
    }>;
    totalFound: number;
  }>;

  scorePropBatch(params: {
    candidates: Array<{
      propId: string;
      features: Record<string, any>;
      marketData: Record<string, any>;
    }>;
    ensembleWeights: Record<string, number>;
  }): Promise<{
    results: Array<{
      propId: string;
      professionalScore: number;
      deviggedEdge: number;
      kellyFraction: number;
      grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
      confidence: number;
      featureContributions: Record<string, number>;
      reasoning: string[];
    }>;
    errorCount: number;
  }>;

  writeScoringResults(params: {
    results: Array<{
      propId: string;
      professionalScore: number;
      deviggedEdge: number;
      kellyFraction: number;
      grade: string;
      confidence: number;
      featureContributions: Record<string, number>;
    }>;
    batchSize: number;
  }): Promise<{
    writtenCount: number;
    errorCount: number;
  }>;

  updateScoringMetrics(params: {
    results: any[];
    duration: number;
  }): Promise<void>;

  sendScoringAlert(params: {
    alertType: 'high_grade' | 'low_confidence' | 'error' | 'completion';
    message: string;
    details: object;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void>;
}

// Configure activities for professional scoring
const activities = proxyActivities<ScoringActivities>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '1 minute',
  scheduleToStartTimeout: '30 seconds'
});

/**
 * ScoringWorkflow - Professional Pick Scoring Engine
 * 
 * Reads feature vectors from WARM tier and applies ensemble scoring
 * with devigging, Kelly fraction calculation, and grade assignment.
 * 
 * Grade Distribution:
 * - S-tier: Score >= 85, Edge >= 8%, Kelly >= 0.03 (Elite picks)
 * - A-tier: Score >= 75, Edge >= 5%, Kelly >= 0.02 (Strong picks) 
 * - B-tier: Score >= 65, Edge >= 3%, Kelly >= 0.01 (Good picks)
 * - C-tier: Score >= 55, Edge >= 1%, Kelly >= 0.005 (Marginal picks)
 * - D-tier: Score >= 45, Edge >= 0% (Weak picks)
 * - F-tier: Score < 45 or negative edge (Avoid)
 */
export async function ScoringWorkflow(params: {
  batchSize?: number;
  ensembleWeights?: Record<string, number>;
  minConfidence?: number;
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  propsScored: number;
  gradeDistribution: Record<string, number>;
  averageScore: number;
  averageEdge: number;
  alerts: Array<{
    type: string;
    message: string;
    count: number;
  }>;
  duration: number;
  errors: string[];
}> {
  
  const startTime = Date.now();
  const workflowId = wf.workflowInfo().workflowId;
  
  // Initialize result tracking
  let result = {
    success: false,
    propsScored: 0,
    gradeDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 },
    averageScore: 0,
    averageEdge: 0,
    alerts: [] as Array<{ type: string; message: string; count: number }>,
    duration: 0,
    errors: [] as string[]
  };

  try {
    wf.log.info('🎯 ScoringWorkflow started', {
      workflowId,
      params,
      scheduledAt: new Date().toISOString()
    });

    // ================================
    // 1. PARAMETER SETUP
    // ================================
    
    const batchSize = params.batchSize || 500;
    const dryRun = params.dryRun || false;
    const minConfidence = params.minConfidence || 70;
    
    // Ensemble model weights (calibrated from backtesting)
    const ensembleWeights = params.ensembleWeights || {
      market: 0.35,    // Market factors most predictive
      player: 0.25,    // Player performance factors
      matchup: 0.20,   // Matchup-specific factors
      meta: 0.15,      // Meta factors (injury, weather, etc.)
      timing: 0.05     // Timing optimization factors
    };

    wf.log.info('📊 Scoring parameters validated', {
      batchSize,
      minConfidence,
      ensembleWeights,
      dryRun
    });

    // ================================
    // 2. FETCH PROPS WITH FEATURES
    // ================================
    
    wf.log.info('📈 Fetching props with computed features');
    
    const fetchResult = await activities.fetchPropsWithFeatures({
      batchSize,
      minFeatureAge: 60 // Features computed within last hour
    });

    if (fetchResult.candidates.length === 0) {
      wf.log.info('ℹ️ No props with features found for scoring');
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    wf.log.info('✅ Props with features fetched', {
      candidatesFound: fetchResult.candidates.length,
      totalAvailable: fetchResult.totalFound
    });

    // ================================
    // 3. BATCH SCORING PROCESS
    // ================================
    
    wf.log.info(`🎯 Scoring ${fetchResult.candidates.length} props`);
    
    const scoringResult = await activities.scorePropBatch({
      candidates: fetchResult.candidates,
      ensembleWeights
    });

    if (scoringResult.errorCount > 0) {
      result.errors.push(`Scoring errors: ${scoringResult.errorCount} props failed`);
    }

    result.propsScored = scoringResult.results.length;

    // Calculate grade distribution and averages
    let totalScore = 0;
    let totalEdge = 0;
    
    scoringResult.results.forEach(r => {
      result.gradeDistribution[r.grade as keyof typeof result.gradeDistribution]++;
      totalScore += r.professionalScore;
      totalEdge += r.deviggedEdge;
    });

    result.averageScore = result.propsScored > 0 ? totalScore / result.propsScored : 0;
    result.averageEdge = result.propsScored > 0 ? totalEdge / result.propsScored : 0;

    wf.log.info('✅ Scoring completed', {
      propsScored: result.propsScored,
      gradeDistribution: result.gradeDistribution,
      averageScore: result.averageScore.toFixed(2),
      averageEdge: result.averageEdge.toFixed(2),
      errors: scoringResult.errorCount
    });

    // ================================
    // 4. GENERATE ALERTS FOR HIGH GRADES
    // ================================
    
    const sGrades = result.gradeDistribution.S;
    const aGrades = result.gradeDistribution.A;
    const bGrades = result.gradeDistribution.B;
    
    if (sGrades > 0) {
      result.alerts.push({
        type: 'high_grade_s',
        message: 'S-tier picks available',
        count: sGrades
      });

      await activities.sendScoringAlert({
        alertType: 'high_grade',
        message: `${sGrades} S-tier picks scored`,
        details: { 
          sTier: sGrades,
          avgScore: result.averageScore,
          avgEdge: result.averageEdge 
        },
        priority: 'critical'
      });
    }

    if (aGrades > 0) {
      result.alerts.push({
        type: 'high_grade_a',
        message: 'A-tier picks available',
        count: aGrades
      });

      await activities.sendScoringAlert({
        alertType: 'high_grade',
        message: `${aGrades} A-tier picks scored`,
        details: { 
          aTier: aGrades,
          avgScore: result.averageScore,
          avgEdge: result.averageEdge 
        },
        priority: 'high'
      });
    }

    // Alert on low confidence
    const lowConfidenceResults = scoringResult.results.filter(r => r.confidence < minConfidence);
    if (lowConfidenceResults.length > 0) {
      result.alerts.push({
        type: 'low_confidence',
        message: 'Low confidence scores detected',
        count: lowConfidenceResults.length
      });

      await activities.sendScoringAlert({
        alertType: 'low_confidence',
        message: `${lowConfidenceResults.length} low confidence scores`,
        details: { 
          lowConfidenceCount: lowConfidenceResults.length,
          threshold: minConfidence 
        },
        priority: 'medium'
      });
    }

    // ================================
    // 5. WRITE SCORING RESULTS
    // ================================
    
    if (!dryRun && scoringResult.results.length > 0) {
      wf.log.info('💾 Writing scoring results to database');
      
      const writeResult = await activities.writeScoringResults({
        results: scoringResult.results,
        batchSize: 50 // Smaller batches for database writes
      });

      if (writeResult.errorCount > 0) {
        result.errors.push(`Write errors: ${writeResult.errorCount} results failed to save`);
      }

      wf.log.info('✅ Scoring results written', {
        writtenCount: writeResult.writtenCount,
        errors: writeResult.errorCount
      });
    }

    // ================================
    // 6. UPDATE METRICS
    // ================================
    
    const duration = Date.now() - startTime;
    
    await activities.updateScoringMetrics({
      results: scoringResult.results,
      duration
    });

    // ================================
    // 7. SUCCESS COMPLETION
    // ================================
    
    result.success = result.errors.length === 0;
    result.duration = duration;
    
    wf.log.info('🎉 ScoringWorkflow completed', {
      workflowId,
      success: result.success,
      propsScored: result.propsScored,
      gradeDistribution: result.gradeDistribution,
      alerts: result.alerts.length,
      duration: result.duration,
      dryRun
    });

    // Send completion alert for significant scoring runs
    if (result.propsScored >= 100) {
      await activities.sendScoringAlert({
        alertType: 'completion',
        message: `Scoring workflow completed`,
        details: {
          propsScored: result.propsScored,
          gradeDistribution: result.gradeDistribution,
          averageScore: result.averageScore,
          duration: result.duration
        },
        priority: 'low'
      });
    }

    return result;

  } catch (error) {
    // ================================
    // ERROR HANDLING
    // ================================
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    result.duration = Date.now() - startTime;
    
    wf.log.error('❌ ScoringWorkflow failed', {
      workflowId,
      error: errorMessage,
      duration: result.duration,
      params
    });

    await activities.sendScoringAlert({
      alertType: 'error',
      message: 'Scoring workflow failed',
      details: {
        workflowId,
        error: errorMessage,
        duration: result.duration,
        params
      },
      priority: 'critical'
    });
    
    return result;
  }
}

/**
 * Scheduled ScoringWorkflow - Runs every 30 minutes for continuous scoring
 * 
 * Optimized for high-throughput professional scoring supporting:
 * - Real-time feature store consumption
 * - Professional grade assignment
 * - Kelly criterion position sizing
 * - Edge detection and alerts
 */
export async function ScheduledScoringWorkflow(): Promise<void> {
  wf.log.info('⏰ Scheduled ScoringWorkflow triggered');
  
  try {
    const result = await ScoringWorkflow({
      batchSize: 500,     // Moderate batch size for regular runs
      minConfidence: 70,  // Standard confidence threshold
      dryRun: false       // Real scoring
    });

    if (!result.success && result.errors.length > 0) {
      throw new Error(`Scheduled scoring failed: ${result.errors.join(', ')}`);
    }

    wf.log.info('✅ Scheduled ScoringWorkflow completed', {
      propsScored: result.propsScored,
      gradeDistribution: result.gradeDistribution,
      averageScore: result.averageScore.toFixed(2),
      duration: result.duration
    });

  } catch (error) {
    wf.log.error('❌ Scheduled ScoringWorkflow failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error; // Trigger Temporal retry
  }
}

/**
 * Express ScoringWorkflow - Triggered by feature completion events
 * 
 * Fast scoring for time-critical scenarios:
 * - New feature computations requiring immediate scoring
 * - Material change events needing rapid assessment
 * - Real-time opportunity identification
 */
export async function ExpressScoringWorkflow(params: {
  propIds: string[];
  priority: 'normal' | 'high' | 'critical';
  minGrade?: 'S' | 'A' | 'B' | 'C';
}): Promise<void> {
  wf.log.info('⚡ Express ScoringWorkflow triggered', {
    propIds: params.propIds.length,
    priority: params.priority,
    minGrade: params.minGrade
  });

  try {
    const result = await ScoringWorkflow({
      batchSize: 100,     // Small batches for speed
      minConfidence: 60,  // Lower threshold for express runs
      dryRun: false
    });

    // For critical runs, ensure we have high-grade picks
    if (params.priority === 'critical' && params.minGrade) {
      const minGradeCount = result.gradeDistribution[params.minGrade] || 0;
      if (minGradeCount === 0) {
        wf.log.warn(`⚠️ Critical express run found no ${params.minGrade}-tier picks`);
      }
    }

    if (!result.success && params.priority === 'critical') {
      throw new Error(`Critical express scoring failed: ${result.errors.join(', ')}`);
    }

  } catch (error) {
    wf.log.error('❌ Express ScoringWorkflow failed', {
      error: error instanceof Error ? error.message : String(error),
      priority: params.priority
    });
    
    if (params.priority === 'critical') {
      throw error;
    }
  }
}