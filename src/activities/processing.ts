import { createLogger } from '../utils/logger';
import { createSupabaseClient } from '../utils/supabase';

const logger = createLogger('ProcessingActivities');
const supabase = createSupabaseClient();

/**
 * PROCESSING ACTIVITIES
 * Core activities for prop processing, scoring, and grading
 */

export async function processUSPDetection(params: {
  leagues: string[];
  cycleCount: number;
}): Promise<{ success: boolean; uspResults: any[]; errors: string[] }> {
  try {
    logger.info(`🔄 Processing USP detection for leagues: ${params.leagues.join(', ')}`, {
      leagues: params.leagues,
      cycleCount: params.cycleCount
    });

    const uspResults = [];
    const errors: string[] = [];

    // Get recent props for USP analysis
    const { data: props, error } = await supabase
      .from('raw_props')
      .select('*')
      .in('league', params.leagues)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
      .order('created_at', { ascending: false });

    if (error) {
      errors.push(`Failed to fetch props: ${error.message}`);
      return { success: false, uspResults: [], errors };
    }

    // Process each USP type
    const uspTypes = ['steam', 'line_movement', 'hedge', 'middle', 'stale', 'injury', 'suspicious'];
    
    for (const uspType of uspTypes) {
      try {
        const result = await detectUSPType(uspType, props || []);
        uspResults.push({ type: uspType, ...result });
      } catch (uspError) {
        errors.push(`USP ${uspType} detection failed: ${uspError}`);
        uspResults.push({ type: uspType, success: false, detected: 0 });
      }
    }

    logger.info(`✅ USP detection complete`, {
      leagues: params.leagues,
      uspResults: uspResults.length,
      errors: errors.length
    });

    return {
      success: errors.length === 0,
      uspResults,
      errors
    };

  } catch (error) {
    logger.error(`❌ USP detection failed:`, error);
    return {
      success: false,
      uspResults: [],
      errors: [String(error)]
    };
  }
}

export async function scoreAndGradeProps(params: {
  leagues: string[];
  cycleCount: number;
}): Promise<{ success: boolean; propsScored: number; propsPromoted: number; errors: string[] }> {
  try {
    logger.info(`🔄 Scoring and grading props for leagues: ${params.leagues.join(', ')}`, {
      leagues: params.leagues,
      cycleCount: params.cycleCount
    });

    const errors: string[] = [];
    let propsScored = 0;
    let propsPromoted = 0;

    // Get unscored props
    const { data: props, error } = await supabase
      .from('raw_props')
      .select('*')
      .in('league', params.leagues)
      .is('tier_tag', null)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      errors.push(`Failed to fetch props for scoring: ${error.message}`);
      return { success: false, propsScored: 0, propsPromoted: 0, errors };
    }

    // Score each prop
    for (const prop of props || []) {
      try {
        const score = await calculatePropScore(prop);
        const tier = determineTier(score);

        // Update prop with score and tier
        const { error: updateError } = await supabase
          .from('raw_props')
          .update({
            confidence_score: score.confidence,
            edge_score: score.edge,
            tier_tag: tier,
            updated_at: new Date().toISOString()
          })
          .eq('id', prop.id);

        if (updateError) {
          errors.push(`Failed to update prop ${prop.id}: ${updateError.message}`);
        } else {
          propsScored++;
          
          // If S or A tier, promote to final_picks
          if (tier === 'S' || tier === 'A') {
            const { error: insertError } = await supabase
              .from('final_picks')
              .insert({
                id: `pick-${prop.id}`,
                raw_prop_id: prop.id,
                player_name: prop.player_name,
                team: prop.team,
                stat_type: prop.stat_type,
                line: prop.line,
                tier: tier,
                confidence_score: score.confidence,
                edge_score: score.edge,
                created_at: new Date().toISOString(),
                league: prop.league,
                sport: prop.sport
              });

            if (insertError) {
              errors.push(`Failed to promote prop ${prop.id}: ${insertError.message}`);
            } else {
              propsPromoted++;
            }
          }
        }
      } catch (propError) {
        errors.push(`Scoring failed for prop ${prop.id}: ${propError}`);
      }
    }

    logger.info(`✅ Scoring and grading complete`, {
      leagues: params.leagues,
      propsScored,
      propsPromoted,
      errors: errors.length
    });

    return {
      success: errors.length === 0,
      propsScored,
      propsPromoted,
      errors
    };

  } catch (error) {
    logger.error(`❌ Scoring and grading failed:`, error);
    return {
      success: false,
      propsScored: 0,
      propsPromoted: 0,
      errors: [String(error)]
    };
  }
}

// Helper functions
async function detectUSPType(_uspType: string, _props: any[]): Promise<{ success: boolean; detected: number }> {
  // Mock USP detection logic - replace with actual implementation
  const detected = Math.floor(Math.random() * 5);
  return { success: true, detected };
}

async function calculatePropScore(prop: any): Promise<{ confidence: number; edge: number }> {
  // Mock scoring logic - replace with actual implementation
  return {
    confidence: Math.random() * 100,
    edge: Math.random() * 20
  };
}

function determineTier(score: { confidence: number; edge: number }): string {
  if (score.confidence > 80 && score.edge > 15) return 'S';
  if (score.confidence > 70 && score.edge > 10) return 'A';
  if (score.confidence > 60 && score.edge > 5) return 'B';
  return 'C';
}