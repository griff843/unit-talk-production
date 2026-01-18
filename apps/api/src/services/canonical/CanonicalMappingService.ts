/**
 * Canonical Mapping Service
 *
 * Handles entity resolution and mapping between external data sources
 * (Odds API, Optimal API, etc.) and canonical entities.
 *
 * Features:
 * - Multi-feed mapping with confidence scoring
 * - Fuzzy name matching for players and teams
 * - Heuristic-based game matching (sport, league, team, time)
 * - Conflict detection and tracking
 * - Prometheus metrics for mapping coverage and quality
 *
 * Phase 2 - Step 1: Canonical Entity Resolution
 */

import { supabaseClient } from '../supabaseClient';
import { createLogger } from '../../utils/logger';
import {
  canonicalMappingTotal,
  canonicalMappingConfidenceHistogram,
  canonicalMappingMethodTotal,
  canonicalMappingConflictsTotal,
  canonicalEntityTotal,
  canonicalMappingDuration,
} from '../metricsServer';
import type {
  Sport,
  MappingSource,
  MappingMethod,
  CanonicalGame,
  CanonicalPlayer,
  ExternalGameData,
  ExternalPlayerData,
  ExternalPropData,
  GameMappingResult,
  PlayerMappingResult,
  PropMappingResult,
  MappingConfig,
  NameSimilarityResult,
} from '../../types/canonical-entities';

const logger = createLogger('CanonicalMappingService');

/**
 * CanonicalMappingService
 *
 * Centralized service for mapping external data to canonical entities.
 */
export class CanonicalMappingService {
  private static instance: CanonicalMappingService;

  private config: MappingConfig = {
    exact_match_threshold: 1.0,
    high_confidence_threshold: 0.9,
    medium_confidence_threshold: 0.7,
    low_confidence_threshold: 0.5,
    name_similarity_threshold: 0.8,
    use_fuzzy_matching: true,
    game_time_tolerance_minutes: 60,
    auto_create_canonical_entities: true,
    auto_create_confidence_threshold: 0.9,
    auto_resolve_conflicts: false,
  };

  private constructor(config?: Partial<MappingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  public static getInstance(config?: Partial<MappingConfig>): CanonicalMappingService {
    if (!CanonicalMappingService.instance) {
      CanonicalMappingService.instance = new CanonicalMappingService(config);
    }
    return CanonicalMappingService.instance;
  }

  // =====================================================
  // Game Mapping
  // =====================================================

  /**
   * Map external game data to canonical game
   */
  async mapGame(externalGame: ExternalGameData): Promise<GameMappingResult> {
    const startTime = Date.now();

    try {
      logger.info('[mapGame] Mapping external game to canonical', {
        source: externalGame.source,
        externalGameId: externalGame.external_game_id,
        homeTeam: externalGame.home_team,
        awayTeam: externalGame.away_team,
      });

      // Step 1: Check if mapping already exists
      const existingMapping = await this.findExistingGameMapping(
        externalGame.source,
        externalGame.external_game_id
      );

      if (existingMapping) {
        logger.info('[mapGame] Found existing game mapping', {
          canonicalGameId: existingMapping.canonical_game_id,
          confidence: existingMapping.confidence_score,
        });

        const canonicalGame = await this.getCanonicalGame(existingMapping.canonical_game_id);

        // Emit metrics
        const duration = (Date.now() - startTime) / 1000;
        canonicalMappingDuration.observe({ entity_type: 'game' }, duration);
        canonicalMappingTotal.inc({ entity_type: 'game', source: externalGame.source, status: 'success' });
        canonicalMappingConfidenceHistogram.observe(
          { entity_type: 'game', source: externalGame.source },
          existingMapping.confidence_score
        );
        canonicalMappingMethodTotal.inc({ entity_type: 'game', method: existingMapping.mapping_method });

        return {
          success: true,
          canonical_game_id: existingMapping.canonical_game_id,
          canonical_game: canonicalGame || undefined,
          mapping: existingMapping,
          confidence_score: existingMapping.confidence_score,
          method: existingMapping.mapping_method,
          is_new_game: false,
        };
      }

      // Step 2: Try to find canonical game using heuristics
      const matchResult = await this.findCanonicalGameByHeuristics(externalGame);

      if (matchResult.canonical_game) {
        // Found a match - create mapping
        logger.info('[mapGame] Found canonical game match', {
          canonicalGameId: matchResult.canonical_game.id,
          confidence: matchResult.confidence_score,
          method: matchResult.method,
        });

        const mapping = await this.createGameMapping({
          canonical_game_id: matchResult.canonical_game.id,
          source: externalGame.source,
          external_game_id: externalGame.external_game_id,
          confidence_score: matchResult.confidence_score,
          mapping_method: matchResult.method,
          is_primary: true,
        });

        // Emit metrics
        const duration = (Date.now() - startTime) / 1000;
        canonicalMappingDuration.observe({ entity_type: 'game' }, duration);
        canonicalMappingTotal.inc({ entity_type: 'game', source: externalGame.source, status: 'success' });
        canonicalMappingConfidenceHistogram.observe(
          { entity_type: 'game', source: externalGame.source },
          matchResult.confidence_score
        );
        canonicalMappingMethodTotal.inc({ entity_type: 'game', method: matchResult.method });

        return {
          success: true,
          canonical_game_id: matchResult.canonical_game.id,
          canonical_game: matchResult.canonical_game,
          mapping,
          confidence_score: matchResult.confidence_score,
          method: matchResult.method,
          is_new_game: false,
        };
      }

      // Step 3: No match found - create new canonical game if enabled
      if (this.config.auto_create_canonical_entities) {
        logger.info('[mapGame] No match found, creating new canonical game');

        const newCanonicalGame = await this.createCanonicalGame(externalGame);

        const mapping = await this.createGameMapping({
          canonical_game_id: newCanonicalGame.id,
          source: externalGame.source,
          external_game_id: externalGame.external_game_id,
          confidence_score: 1.0, // Exact match since we just created it
          mapping_method: 'exact',
          is_primary: true,
        });

        // Emit metrics for new entity creation
        const duration = (Date.now() - startTime) / 1000;
        canonicalMappingDuration.observe({ entity_type: 'game' }, duration);
        canonicalMappingTotal.inc({ entity_type: 'game', source: externalGame.source, status: 'success' });
        canonicalMappingConfidenceHistogram.observe({ entity_type: 'game', source: externalGame.source }, 1.0);
        canonicalMappingMethodTotal.inc({ entity_type: 'game', method: 'exact' });
        canonicalEntityTotal.inc({ entity_type: 'game' }); // New entity created

        return {
          success: true,
          canonical_game_id: newCanonicalGame.id,
          canonical_game: newCanonicalGame,
          mapping,
          confidence_score: 1.0,
          method: 'exact',
          is_new_game: true,
        };
      }

      // Step 4: Auto-create disabled - return failure
      logger.warn('[mapGame] No match found and auto-create disabled');

      // Emit metrics for failure
      const duration = (Date.now() - startTime) / 1000;
      canonicalMappingDuration.observe({ entity_type: 'game' }, duration);
      canonicalMappingTotal.inc({ entity_type: 'game', source: externalGame.source, status: 'failed' });

      return {
        success: false,
        confidence_score: 0,
        method: 'heuristic',
        is_new_game: false,
        error: 'No canonical game match found and auto-create disabled',
      };
    } catch (error: any) {
      logger.error('[mapGame] Error mapping game', {
        error: error.message,
        externalGameId: externalGame.external_game_id,
      });

      // Emit metrics for error
      const duration = (Date.now() - startTime) / 1000;
      canonicalMappingDuration.observe({ entity_type: 'game' }, duration);
      canonicalMappingTotal.inc({ entity_type: 'game', source: externalGame.source, status: 'failed' });

      return {
        success: false,
        confidence_score: 0,
        method: 'heuristic',
        is_new_game: false,
        error: error.message,
      };
    }
  }

  /**
   * Find canonical game using heuristics:
   * - Sport + League match
   * - Team names match (with fuzzy matching)
   * - Game time within tolerance
   */
  private async findCanonicalGameByHeuristics(
    externalGame: ExternalGameData
  ): Promise<{ canonical_game: CanonicalGame | null; confidence_score: number; method: MappingMethod }> {
    // Normalize team names for matching
    const homeTeamNorm = this.normalizeTeamName(externalGame.home_team);
    const awayTeamNorm = this.normalizeTeamName(externalGame.away_team);

    // Calculate time range for matching
    const gameTime = new Date(externalGame.game_time);
    const timeTolerance = this.config.game_time_tolerance_minutes * 60 * 1000; // Convert to ms
    const minTime = new Date(gameTime.getTime() - timeTolerance);
    const maxTime = new Date(gameTime.getTime() + timeTolerance);

    // Query for potential matches
    const { data: potentialGames, error } = await supabaseClient
      .from('canonical_games')
      .select('*')
      .eq('sport', externalGame.sport)
      .eq('league', externalGame.league)
      .gte('game_time', minTime.toISOString())
      .lte('game_time', maxTime.toISOString());

    if (error) {
      logger.error('[findCanonicalGameByHeuristics] Database error', { error: error.message });
      return { canonical_game: null, confidence_score: 0, method: 'heuristic' };
    }

    if (!potentialGames || potentialGames.length === 0) {
      return { canonical_game: null, confidence_score: 0, method: 'heuristic' };
    }

    // Score each potential match
    const scoredGames = potentialGames.map((game) => {
      let score = 0;
      let matchDetails: string[] = [];

      // Sport + League match (baseline)
      score += 0.3;
      matchDetails.push('sport+league');

      // Home team match
      const homeTeamGameNorm = this.normalizeTeamName(game.home_team);
      if (homeTeamNorm === homeTeamGameNorm) {
        score += 0.25;
        matchDetails.push('home_team_exact');
      } else if (this.config.use_fuzzy_matching) {
        const homeSimilarity = this.calculateStringSimilarity(homeTeamNorm, homeTeamGameNorm);
        if (homeSimilarity > this.config.name_similarity_threshold) {
          score += 0.2 * homeSimilarity;
          matchDetails.push(`home_team_fuzzy(${(homeSimilarity * 100).toFixed(0)}%)`);
        }
      }

      // Away team match
      const awayTeamGameNorm = this.normalizeTeamName(game.away_team);
      if (awayTeamNorm === awayTeamGameNorm) {
        score += 0.25;
        matchDetails.push('away_team_exact');
      } else if (this.config.use_fuzzy_matching) {
        const awaySimilarity = this.calculateStringSimilarity(awayTeamNorm, awayTeamGameNorm);
        if (awaySimilarity > this.config.name_similarity_threshold) {
          score += 0.2 * awaySimilarity;
          matchDetails.push(`away_team_fuzzy(${(awaySimilarity * 100).toFixed(0)}%)`);
        }
      }

      // Time proximity (closer = higher score)
      const timeDiff = Math.abs(new Date(game.game_time).getTime() - gameTime.getTime());
      const timeScore = Math.max(0, 0.2 * (1 - timeDiff / timeTolerance));
      score += timeScore;
      matchDetails.push(`time_proximity(${(timeScore * 100).toFixed(0)}%)`);

      return {
        game,
        score,
        matchDetails: matchDetails.join(', '),
      };
    });

    // Sort by score descending
    scoredGames.sort((a, b) => b.score - a.score);

    const bestMatch = scoredGames[0];

    if (bestMatch && bestMatch.score >= this.config.low_confidence_threshold) {
      logger.info('[findCanonicalGameByHeuristics] Found match', {
        canonicalGameId: bestMatch.game.id,
        confidence: bestMatch.score.toFixed(2),
        matchDetails: bestMatch.matchDetails,
      });

      const method: MappingMethod = bestMatch.score >= this.config.exact_match_threshold ? 'exact' : 'heuristic';

      return {
        canonical_game: bestMatch.game as CanonicalGame,
        confidence_score: bestMatch.score,
        method,
      };
    }

    return { canonical_game: null, confidence_score: 0, method: 'heuristic' };
  }

  // =====================================================
  // Player Mapping
  // =====================================================

  /**
   * Map external player data to canonical player
   */
  async mapPlayer(externalPlayer: ExternalPlayerData): Promise<PlayerMappingResult> {
    const startTime = Date.now();

    try {
      logger.info('[mapPlayer] Mapping external player to canonical', {
        source: externalPlayer.source,
        playerName: externalPlayer.player_name,
        sport: externalPlayer.sport,
      });

      // Step 1: Check if mapping already exists
      const existingMapping = await this.findExistingPlayerMapping(
        externalPlayer.source,
        externalPlayer.player_name
      );

      if (existingMapping) {
        logger.info('[mapPlayer] Found existing player mapping', {
          canonicalPlayerId: existingMapping.canonical_player_id,
          confidence: existingMapping.confidence_score,
        });

        const canonicalPlayer = await this.getCanonicalPlayer(existingMapping.canonical_player_id);

        // Emit metrics for existing mapping
        const duration = (Date.now() - startTime) / 1000;
        canonicalMappingDuration.observe({ entity_type: 'player' }, duration);
        canonicalMappingTotal.inc({
          entity_type: 'player',
          source: externalPlayer.source,
          status: 'success',
        });
        canonicalMappingConfidenceHistogram.observe(
          { entity_type: 'player', source: externalPlayer.source },
          existingMapping.confidence_score
        );
        canonicalMappingMethodTotal.inc({
          entity_type: 'player',
          method: existingMapping.mapping_method,
        });

        return {
          success: true,
          canonical_player_id: existingMapping.canonical_player_id,
          canonical_player: canonicalPlayer || undefined,
          mapping: existingMapping,
          confidence_score: existingMapping.confidence_score,
          similarity_score: existingMapping.similarity_score,
          method: existingMapping.mapping_method,
          is_new_player: false,
        };
      }

      // Step 2: Try to find canonical player using fuzzy matching
      const matchResult = await this.findCanonicalPlayerByName(externalPlayer);

      if (matchResult.canonical_player) {
        logger.info('[mapPlayer] Found canonical player match', {
          canonicalPlayerId: matchResult.canonical_player.id,
          confidence: matchResult.confidence_score,
          similarity: matchResult.similarity_score,
        });

        const mapping = await this.createPlayerMapping({
          canonical_player_id: matchResult.canonical_player.id,
          source: externalPlayer.source,
          external_player_id: externalPlayer.external_player_id,
          external_player_name: externalPlayer.player_name,
          confidence_score: matchResult.confidence_score,
          similarity_score: matchResult.similarity_score,
          mapping_method: matchResult.method,
          is_primary: true,
        });

        // Emit metrics for new mapping to existing player
        const duration = (Date.now() - startTime) / 1000;
        canonicalMappingDuration.observe({ entity_type: 'player' }, duration);
        canonicalMappingTotal.inc({
          entity_type: 'player',
          source: externalPlayer.source,
          status: 'success',
        });
        canonicalMappingConfidenceHistogram.observe(
          { entity_type: 'player', source: externalPlayer.source },
          matchResult.confidence_score
        );
        canonicalMappingMethodTotal.inc({
          entity_type: 'player',
          method: matchResult.method,
        });

        return {
          success: true,
          canonical_player_id: matchResult.canonical_player.id,
          canonical_player: matchResult.canonical_player,
          mapping,
          confidence_score: matchResult.confidence_score,
          similarity_score: matchResult.similarity_score,
          method: matchResult.method,
          is_new_player: false,
        };
      }

      // Step 3: No match found - create new canonical player if enabled
      if (this.config.auto_create_canonical_entities) {
        logger.info('[mapPlayer] No match found, creating new canonical player');

        const newCanonicalPlayer = await this.createCanonicalPlayer(externalPlayer);

        const mapping = await this.createPlayerMapping({
          canonical_player_id: newCanonicalPlayer.id,
          source: externalPlayer.source,
          external_player_id: externalPlayer.external_player_id,
          external_player_name: externalPlayer.player_name,
          confidence_score: 1.0,
          similarity_score: 1.0,
          mapping_method: 'exact',
          is_primary: true,
        });

        // Emit metrics for new canonical player creation
        const duration = (Date.now() - startTime) / 1000;
        canonicalMappingDuration.observe({ entity_type: 'player' }, duration);
        canonicalMappingTotal.inc({
          entity_type: 'player',
          source: externalPlayer.source,
          status: 'success',
        });
        canonicalMappingConfidenceHistogram.observe(
          { entity_type: 'player', source: externalPlayer.source },
          1.0
        );
        canonicalMappingMethodTotal.inc({
          entity_type: 'player',
          method: 'exact',
        });
        canonicalEntityTotal.inc({ entity_type: 'player' });

        return {
          success: true,
          canonical_player_id: newCanonicalPlayer.id,
          canonical_player: newCanonicalPlayer,
          mapping,
          confidence_score: 1.0,
          similarity_score: 1.0,
          method: 'exact',
          is_new_player: true,
        };
      }

      // Step 4: Auto-create disabled
      logger.warn('[mapPlayer] No match found and auto-create disabled');

      // Emit failure metrics
      const duration = (Date.now() - startTime) / 1000;
      canonicalMappingDuration.observe({ entity_type: 'player' }, duration);
      canonicalMappingTotal.inc({
        entity_type: 'player',
        source: externalPlayer.source,
        status: 'failed',
      });

      return {
        success: false,
        confidence_score: 0,
        method: 'fuzzy',
        is_new_player: false,
        error: 'No canonical player match found and auto-create disabled',
      };
    } catch (error: any) {
      logger.error('[mapPlayer] Error mapping player', {
        error: error.message,
        playerName: externalPlayer.player_name,
      });

      // Emit failure metrics
      const duration = (Date.now() - startTime) / 1000;
      canonicalMappingDuration.observe({ entity_type: 'player' }, duration);
      canonicalMappingTotal.inc({
        entity_type: 'player',
        source: externalPlayer.source,
        status: 'failed',
      });

      return {
        success: false,
        confidence_score: 0,
        method: 'fuzzy',
        is_new_player: false,
        error: error.message,
      };
    }
  }

  /**
   * Find canonical player using fuzzy name matching
   */
  private async findCanonicalPlayerByName(
    externalPlayer: ExternalPlayerData
  ): Promise<{
    canonical_player: CanonicalPlayer | null;
    confidence_score: number;
    similarity_score?: number;
    method: MappingMethod;
  }> {
    const playerNameNorm = this.normalizePlayerName(externalPlayer.player_name);

    // Query for potential matches (same sport)
    const { data: potentialPlayers, error } = await supabaseClient
      .from('canonical_players')
      .select('*')
      .eq('sport', externalPlayer.sport)
      .eq('status', 'active');

    if (error) {
      logger.error('[findCanonicalPlayerByName] Database error', { error: error.message });
      return { canonical_player: null, confidence_score: 0, method: 'fuzzy' };
    }

    if (!potentialPlayers || potentialPlayers.length === 0) {
      return { canonical_player: null, confidence_score: 0, method: 'fuzzy' };
    }

    // Score each potential match
    const scoredPlayers = potentialPlayers.map((player) => {
      const canonicalNameNorm = this.normalizePlayerName(player.full_name);

      // Exact match
      if (playerNameNorm === canonicalNameNorm) {
        return {
          player,
          score: 1.0,
          similarity: 1.0,
          method: 'exact' as MappingMethod,
        };
      }

      // Fuzzy match
      if (this.config.use_fuzzy_matching) {
        const similarity = this.calculateStringSimilarity(playerNameNorm, canonicalNameNorm);

        // Check name variations too
        let maxSimilarity = similarity;
        if (player.name_variations && player.name_variations.length > 0) {
          for (const variation of player.name_variations) {
            const varNorm = this.normalizePlayerName(variation);
            const varSim = this.calculateStringSimilarity(playerNameNorm, varNorm);
            maxSimilarity = Math.max(maxSimilarity, varSim);
          }
        }

        return {
          player,
          score: maxSimilarity,
          similarity: maxSimilarity,
          method: 'fuzzy' as MappingMethod,
        };
      }

      return {
        player,
        score: 0,
        similarity: 0,
        method: 'fuzzy' as MappingMethod,
      };
    });

    // Sort by score descending
    scoredPlayers.sort((a, b) => b.score - a.score);

    const bestMatch = scoredPlayers[0];

    if (bestMatch && bestMatch.score >= this.config.name_similarity_threshold) {
      logger.info('[findCanonicalPlayerByName] Found match', {
        canonicalPlayerId: bestMatch.player.id,
        similarity: bestMatch.similarity.toFixed(2),
        method: bestMatch.method,
      });

      return {
        canonical_player: bestMatch.player as CanonicalPlayer,
        confidence_score: bestMatch.score,
        similarity_score: bestMatch.similarity,
        method: bestMatch.method,
      };
    }

    return { canonical_player: null, confidence_score: 0, method: 'fuzzy' };
  }

  // =====================================================
  // Prop Mapping
  // =====================================================

  /**
   * Map external prop to canonical prop (requires game + player mapping first)
   */
  async mapProp(externalProp: ExternalPropData): Promise<PropMappingResult> {
    const startTime = Date.now();

    try {
      logger.info('[mapProp] Mapping external prop', {
        source: externalProp.source,
        externalPropId: externalProp.external_prop_id,
        playerName: externalProp.player_name,
        statType: externalProp.stat_type,
      });

      // First map the player
      const playerResult = await this.mapPlayer({
        source: externalProp.source,
        player_name: externalProp.player_name,
        sport: externalProp.sport,
        metadata: externalProp.metadata,
      });

      if (!playerResult.success || !playerResult.canonical_player_id) {
        // Emit failure metrics
        const duration = (Date.now() - startTime) / 1000;
        canonicalMappingDuration.observe({ entity_type: 'prop' }, duration);
        canonicalMappingTotal.inc({
          entity_type: 'prop',
          source: externalProp.source,
          status: 'failed',
        });

        return {
          success: false,
          confidence_score: 0,
          error: 'Failed to map player for prop',
        };
      }

      // Create prop mapping
      const { data: propMapping, error } = await supabaseClient
        .from('prop_mappings')
        .insert({
          canonical_player_id: playerResult.canonical_player_id,
          stat_type: externalProp.stat_type,
          line: externalProp.line,
          source: externalProp.source,
          external_prop_id: externalProp.external_prop_id,
          over_odds: externalProp.over_odds,
          under_odds: externalProp.under_odds,
          confidence_score: playerResult.confidence_score,
          metadata: externalProp.metadata || {},
        })
        .select()
        .single();

      if (error) {
        logger.error('[mapProp] Error creating prop mapping', { error: error.message });

        // Emit failure metrics
        const duration = (Date.now() - startTime) / 1000;
        canonicalMappingDuration.observe({ entity_type: 'prop' }, duration);
        canonicalMappingTotal.inc({
          entity_type: 'prop',
          source: externalProp.source,
          status: 'failed',
        });

        return {
          success: false,
          confidence_score: 0,
          error: error.message,
        };
      }

      // Emit success metrics
      const duration = (Date.now() - startTime) / 1000;
      canonicalMappingDuration.observe({ entity_type: 'prop' }, duration);
      canonicalMappingTotal.inc({
        entity_type: 'prop',
        source: externalProp.source,
        status: 'success',
      });
      canonicalMappingConfidenceHistogram.observe(
        { entity_type: 'prop', source: externalProp.source },
        playerResult.confidence_score
      );

      return {
        success: true,
        prop_mapping_id: propMapping.id,
        canonical_player_id: playerResult.canonical_player_id,
        confidence_score: playerResult.confidence_score,
      };
    } catch (error: any) {
      logger.error('[mapProp] Error mapping prop', { error: error.message });

      // Emit failure metrics
      const duration = (Date.now() - startTime) / 1000;
      canonicalMappingDuration.observe({ entity_type: 'prop' }, duration);
      canonicalMappingTotal.inc({
        entity_type: 'prop',
        source: externalProp.source,
        status: 'failed',
      });

      return {
        success: false,
        confidence_score: 0,
        error: error.message,
      };
    }
  }

  // =====================================================
  // Helper Functions: String Similarity
  // =====================================================

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns value between 0 (completely different) and 1 (identical)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Normalize team name for matching
   */
  private normalizeTeamName(teamName: string): string {
    return teamName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Normalize player name for matching
   */
  private normalizePlayerName(playerName: string): string {
    return playerName
      .toLowerCase()
      .trim()
      .replace(/[^a-z\s]/g, '') // Remove numbers and special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b(jr|sr|ii|iii|iv)\b/g, ''); // Remove suffixes
  }

  // =====================================================
  // Database Operations
  // =====================================================

  private async findExistingGameMapping(source: MappingSource, externalGameId: string) {
    const { data, error } = await supabaseClient
      .from('game_mappings')
      .select('*')
      .eq('source', source)
      .eq('external_game_id', externalGameId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      logger.error('[findExistingGameMapping] Error', { error: error.message });
    }

    return data;
  }

  private async findExistingPlayerMapping(source: MappingSource, externalPlayerName: string) {
    const { data, error } = await supabaseClient
      .from('player_mappings')
      .select('*')
      .eq('source', source)
      .eq('external_player_name', externalPlayerName)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('[findExistingPlayerMapping] Error', { error: error.message });
    }

    return data;
  }

  private async getCanonicalGame(gameId: string): Promise<CanonicalGame | null> {
    const { data, error } = await supabaseClient
      .from('canonical_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) {
      logger.error('[getCanonicalGame] Error', { error: error.message });
      return null;
    }

    return data as CanonicalGame;
  }

  private async getCanonicalPlayer(playerId: string): Promise<CanonicalPlayer | null> {
    const { data, error } = await supabaseClient
      .from('canonical_players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (error) {
      logger.error('[getCanonicalPlayer] Error', { error: error.message });
      return null;
    }

    return data as CanonicalPlayer;
  }

  private async createCanonicalGame(externalGame: ExternalGameData): Promise<CanonicalGame> {
    const { data, error } = await supabaseClient
      .from('canonical_games')
      .insert({
        sport: externalGame.sport,
        league: externalGame.league,
        season: externalGame.season || new Date().getFullYear().toString(),
        home_team: externalGame.home_team,
        away_team: externalGame.away_team,
        game_time: externalGame.game_time,
        venue: externalGame.venue,
        status: 'scheduled',
        external_ids: {
          [externalGame.source]: externalGame.external_game_id,
        },
        metadata: externalGame.metadata || {},
      })
      .select()
      .single();

    if (error) {
      logger.error('[createCanonicalGame] Error', { error: error.message });
      throw error;
    }

    return data as CanonicalGame;
  }

  private async createCanonicalPlayer(externalPlayer: ExternalPlayerData): Promise<CanonicalPlayer> {
    const { data, error } = await supabaseClient
      .from('canonical_players')
      .insert({
        full_name: externalPlayer.player_name,
        sport: externalPlayer.sport,
        current_team: externalPlayer.team,
        position: externalPlayer.position,
        status: 'active',
        external_ids: {
          [externalPlayer.source]: externalPlayer.external_player_id || externalPlayer.player_name,
        },
        metadata: externalPlayer.metadata || {},
      })
      .select()
      .single();

    if (error) {
      logger.error('[createCanonicalPlayer] Error', { error: error.message });
      throw error;
    }

    return data as CanonicalPlayer;
  }

  private async createGameMapping(mapping: any) {
    const { data, error } = await supabaseClient.from('game_mappings').insert(mapping).select().single();

    if (error) {
      logger.error('[createGameMapping] Error', { error: error.message });
      throw error;
    }

    return data;
  }

  private async createPlayerMapping(mapping: any) {
    const { data, error } = await supabaseClient.from('player_mappings').insert(mapping).select().single();

    if (error) {
      logger.error('[createPlayerMapping] Error', { error: error.message });
      throw error;
    }

    return data;
  }
}
