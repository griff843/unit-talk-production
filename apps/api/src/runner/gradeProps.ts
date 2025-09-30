/**
 * PROFESSIONAL PROP GRADING - Upgraded from Basic System
 * 
 * This runner now processes ALL daily picks through the professional grading system:
 * - Devigging FIRST (removes hidden vig)
 * - CLV tracking (monitors line movement)
 * - Professional grading (45+ factors)
 * - Risk assessment (Kelly sizing)
 * - Full compliance with NON_NEGOTIABLE_SHARP_GRADING_RULES.md
 */

import { ProfessionalPropProcessor } from '../services/ProfessionalPropProcessor';
import { requireSupabase } from '../utils/supabaseUtils';
import { createLogger } from '../utils/logger';

const logger = createLogger('gradeProps');

async function main() {
  try {
    logger.info('Starting professional prop grading process');
    
    // Initialize professional processor
    const professionalProcessor = ProfessionalPropProcessor.getInstance();
    
    // Get ungraded raw props (the source of all picks)
    const supabaseClient = requireSupabase();
      const { data: rawProps, error } = await supabase
      .from('sports_game_odds')
      .select('*')
      .is('processed_at', null)
      .eq('is_valid', true)  // Use is_valid instead of status
      .limit(100);

    if (error) {
      logger.error('Error fetching raw props:', error);
      return;
    }

    if (!rawProps || rawProps.length === 0) {
      logger.info('No unprocessed raw props found');
      return;
    }

    logger.info(`Found ${rawProps.length} raw props for professional grading`);

    // Process through professional system
    logger.info('About to call processRawProps with config:', {
      max_batch_size: rawProps.length,
      timeout_ms: 60000,
      sample_prop: rawProps[0] ? {
        id: rawProps[0].id,
        sport: rawProps[0].sport,
        player: rawProps[0].player_name
      } : 'No props found'
    });
    
    const results = await professionalProcessor.processRawProps({
      max_batch_size: rawProps.length,
      timeout_ms: 60000 // 60 second timeout for batch
    });

    logger.info(`Professional grading completed: ${results.length} props processed`, {
      tierDistribution: results.reduce((acc, result) => {
        acc[result.tier] = (acc[result.tier] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgProfessionalScore: results.reduce((sum, r) => sum + r.professionalScore, 0) / results.length,
      avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    });

    // Log compliance with sharp grading rules
    const compliantPicks = results.filter(r => 
      r.devigged_edge > 0 && 
      r.clv_tracking_id && 
      r.kelly_fraction > 0
    );
    
    const complianceRate = compliantPicks.length / results.length * 100;
    logger.info(`Sharp grading rule compliance: ${complianceRate.toFixed(1)}%`, {
      deviggingApplied: results.filter(r => r.devigged_edge > 0).length,
      clvTrackingActive: results.filter(r => r.clv_tracking_id).length,
      kellySized: results.filter(r => r.kelly_fraction > 0).length
    });

    if (complianceRate < 100) {
      logger.error('🚨 NON-NEGOTIABLE SHARP GRADING RULES VIOLATED', {
        violations: results.filter(r => 
          !r.devigged_edge || !r.clv_tracking_id || !r.kelly_fraction
        ).length,
        reference: 'See NON_NEGOTIABLE_SHARP_GRADING_RULES.md'
      });
    } else {
      logger.info('✅ 100% compliance with sharp grading rules achieved');
    }

  } catch (error) {
    logger.error('Professional grading process failed:', error);
    throw error;
  }
}

main().catch(error => {
  logger.error('Fatal error in professional grading process:', error);
  process.exit(1);
}); 