import { SupabaseClient } from '@supabase/supabase-js';
import { RawProp } from './types';

/**
 * Check if a raw prop is a duplicate based on multiple criteria
 * @param prop - The prop to check for duplicates
 * @param supabase - Supabase client instance
 * @returns Promise<boolean> - True if duplicate exists
 */
export async function isDuplicateRawProp(prop: RawProp, supabase: SupabaseClient): Promise<boolean> {
  try {
    // Primary duplicate check: external_game_id + player_name + stat_type + line
    const { data: primaryCheck } = await supabase
      .from('raw_props')
      .select('id')
      .eq('external_game_id', prop.external_game_id)
      .eq('player_name', prop.player_name)
      .eq('stat_type', prop.stat_type)
      .eq('line', prop.line)
      .maybeSingle();

    if (primaryCheck) {
      return true;
    }

    // Secondary check: game_id + player_name + stat_type (if game_id exists)
    if (prop.game_id) {
      const { data: secondaryCheck } = await supabase
        .from('raw_props')
        .select('id')
        .eq('game_id', prop.game_id)
        .eq('player_name', prop.player_name)
        .eq('stat_type', prop.stat_type)
        .eq('line', prop.line)
        .maybeSingle();

      if (secondaryCheck) {
        return true;
      }
    }

    // Tertiary check: exact match on key fields within time window
    if (prop.game_time) {
      const gameTime = new Date(prop.game_time);
      const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
      const startTime = new Date(gameTime.getTime() - timeWindow);
      const endTime = new Date(gameTime.getTime() + timeWindow);

      const { data: timeCheck } = await supabase
        .from('raw_props')
        .select('id')
        .eq('player_name', prop.player_name)
        .eq('stat_type', prop.stat_type)
        .eq('line', prop.line)
        .eq('team', prop.team)
        .gte('game_time', startTime.toISOString())
        .lte('game_time', endTime.toISOString())
        .maybeSingle();

      if (timeCheck) {
        return true;
      }
    }

    return false;

  } catch (error) {
    // Log error but don't fail the ingestion process
    console.error('Error checking for duplicates:', error);
    return false; // Assume not duplicate if check fails
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use isDuplicateRawProp with supabase parameter instead
 */
export async function isDuplicateRawPropLegacy(prop: RawProp): Promise<boolean> {
  // This would need to import supabase, but we'll make it return false for now
  // to avoid breaking existing code during migration
  console.warn('isDuplicateRawPropLegacy is deprecated. Use isDuplicateRawProp with supabase parameter.');
  return false;
}

/**
 * Get duplicate props for analysis
 * @param prop - The prop to find duplicates for
 * @param supabase - Supabase client instance
 * @returns Promise<RawProp[]> - Array of duplicate props
 */
export async function findDuplicateProps(prop: RawProp, supabase: SupabaseClient): Promise<RawProp[]> {
  try {
    const { data, error } = await supabase
      .from('raw_props')
      .select('*')
      .eq('player_name', prop.player_name)
      .eq('stat_type', prop.stat_type)
      .eq('line', prop.line);

    if (error) {
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('Error finding duplicate props:', error);
    return [];
  }
}

/**
 * Create a unique key for deduplication
 * @param prop - The prop to create a key for
 * @returns string - Unique key for the prop
 */
export function createDeduplicationKey(prop: RawProp): string {
  const keyParts = [
    prop.external_game_id || 'no-game-id',
    prop.player_name || 'no-player',
    prop.stat_type || 'no-stat',
    prop.line?.toString() || 'no-line',
    prop.provider || 'no-provider'
  ];

  return keyParts.join('|').toLowerCase();
}