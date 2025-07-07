import { createLogger } from '../utils/logger';
import { createSupabaseClient } from '../utils/supabase';
import axios from 'axios';

const logger = createLogger('IngestionActivities');
const supabase = createSupabaseClient();

/**
 * INGESTION ACTIVITIES
 * Core activities for data ingestion from various providers
 */

export async function ingestOptimalProps(params: {
  league: string;
  isLiveMode: boolean;
  cycleCount: number;
}): Promise<{ success: boolean; propsIngested: number; errors: string[] }> {
  try {
    logger.info(`🔄 Ingesting Optimal props for ${params.league}`, { 
      league: params.league, 
      cycleCount: params.cycleCount 
    });

    const apiKey = process.env['OPTIMAL_API_KEY'];
    if (!apiKey || apiKey === 'dummy_key_for_testing') {
      throw new Error('Optimal API key not configured');
    }

    // Make API call to Optimal
    const response = await axios.get(`https://api.optimal.com/props/${params.league}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 10000
    });

    const props = response.data?.props || [];
    let insertedCount = 0;
    const errors: string[] = [];

    // Insert props into raw_props table
    for (const prop of props) {
      try {
        const { error } = await supabase
          .from('raw_props')
          .insert({
            id: `optimal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            external_game_id: prop.game_id || `game-${Date.now()}`,
            player_name: prop.player_name,
            team: prop.team,
            stat_type: prop.prop_type,
            line: prop.line,
            over_odds: prop.over_odds ?? 0,
            under_odds: prop.under_odds ?? 0,
            provider: 'Optimal',
            game_time: prop.game_time || new Date().toISOString(),
            scraped_at: new Date().toISOString(),
            sport: params.league,
            league: params.league,
            created_at: new Date().toISOString()
          });

        if (error) {
          errors.push(`Failed to insert prop for ${prop.player_name}: ${error.message}`);
        } else {
          insertedCount++;
        }
      } catch (insertError) {
        errors.push(`Insert error for ${prop.player_name}: ${insertError}`);
      }
    }

    logger.info(`✅ Optimal ingestion complete`, { 
      league: params.league, 
      propsIngested: insertedCount,
      errors: errors.length 
    });

    return {
      success: errors.length === 0,
      propsIngested: insertedCount,
      errors
    };

  } catch (error) {
    logger.error(`❌ Optimal ingestion failed for ${params.league}:`, error);
    return {
      success: false,
      propsIngested: 0,
      errors: [String(error)]
    };
  }
}

export async function ingestSGOProps(params: {
  league: string;
  isLiveMode: boolean;
  cycleCount: number;
}): Promise<{ success: boolean; propsIngested: number; errors: string[] }> {
  try {
    logger.info(`🔄 Ingesting SGO props for ${params.league} (fallback)`, { 
      league: params.league, 
      cycleCount: params.cycleCount 
    });

    const apiKey = process.env['SGO_API_KEY'];
    if (!apiKey || apiKey === 'dummy_key_for_testing') {
      logger.warn('SGO API key not configured, using mock data');
      return {
        success: true,
        propsIngested: 0,
        errors: ['SGO API not configured - using dummy key']
      };
    }

    // SGO API integration would go here
    // For now, return mock success
    return {
      success: true,
      propsIngested: 0,
      errors: []
    };

  } catch (error) {
    logger.error(`❌ SGO ingestion failed for ${params.league}:`, error);
    return {
      success: false,
      propsIngested: 0,
      errors: [String(error)]
    };
  }
}

export async function validateIngestionData(params: {
  league: string;
  expectedMinProps: number;
}): Promise<{ isValid: boolean; actualCount: number; issues: string[] }> {
  try {
    const { data, error } = await supabase
      .from('raw_props')
      .select('count')
      .eq('league', params.league)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

    if (error) {
      return {
        isValid: false,
        actualCount: 0,
        issues: [`Database query failed: ${error.message}`]
      };
    }

    const actualCount = data?.[0]?.count || 0;
    const issues: string[] = [];

    if (actualCount < params.expectedMinProps) {
      issues.push(`Low prop count: ${actualCount} < ${params.expectedMinProps}`);
    }

    return {
      isValid: issues.length === 0,
      actualCount,
      issues
    };

  } catch (error) {
    return {
      isValid: false,
      actualCount: 0,
      issues: [String(error)]
    };
  }
}