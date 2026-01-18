/**
 * ===============================================================================
 * Steam Detector - Sharp money movement detection
 * Purpose: Identify steam moves (sharp money influx) in betting markets
 * Reference: Phase 11 predictive pipeline scaffolding
 * ===============================================================================
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../lib/logger';

export interface LineSnapshot {
  propId: string;
  sport: string;
  marketType: string;
  bookmaker: string;
  line: number;
  odds: number;
  timestamp: Date;
  volume?: number;
}

export interface SteamMove {
  propId: string;
  sport: string;
  marketType: string;
  detectedAt: Date;
  lineBefore: number;
  lineAfter: number;
  lineMovementPct: number;
  oddsBefore: number;
  oddsAfter: number;
  oddsMovementPct: number;
  volumeSpikeDetected: boolean;
  reverseLineMovement: boolean;
  multipleBookMovement: number;
  steamConfidenceScore: number;
  sharpBookAgreementPct: number;
}

export interface SteamDetectorConfig {
  lineMovementThreshold: number; // Minimum % line movement to consider
  oddsMovementThreshold: number; // Minimum % odds movement to consider
  volumeSpikeMultiplier: number; // Volume must be X times normal
  sharpBookmakers: string[]; // List of sharp bookmakers to track
  pollingInterval: number; // How often to poll for changes (ms)
}

const DEFAULT_CONFIG: SteamDetectorConfig = {
  lineMovementThreshold: 3.0, // 3% line movement
  oddsMovementThreshold: 5.0, // 5% odds movement
  volumeSpikeMultiplier: 3.0, // 3x normal volume
  sharpBookmakers: ['Pinnacle', 'Bookmaker.eu', 'CRIS', '5Dimes'],
  pollingInterval: 60 * 1000, // 1 minute
};

export class SteamDetector {
  private supabase: SupabaseClient;
  private config: SteamDetectorConfig;
  private lineHistory: Map<string, LineSnapshot[]> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(supabase: SupabaseClient, config: Partial<SteamDetectorConfig> = {}) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start continuous steam detection
   */
  startDetection(): void {
    logger.info('[SteamDetector] Starting continuous steam detection', {
      pollingInterval: this.config.pollingInterval,
    });

    this.pollingInterval = setInterval(() => {
      this.detectSteamMoves().catch((error) => {
        logger.error('[SteamDetector] Error in detection cycle', { error: error.message });
      });
    }, this.config.pollingInterval);
  }

  /**
   * Stop continuous steam detection
   */
  stopDetection(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info('[SteamDetector] Stopped steam detection');
    }
  }

  /**
   * Detect steam moves across all active props
   */
  async detectSteamMoves(): Promise<SteamMove[]> {
    logger.debug('[SteamDetector] Running steam detection cycle');

    const steamMoves: SteamMove[] = [];

    // 1. Get active props
    const activeProps = await this.getActiveProps();

    // 2. For each prop, check for steam moves
    for (const prop of activeProps) {
      try {
        // Get current line snapshot
        const currentSnapshot = await this.getCurrentLineSnapshot(prop.id);

        // Compare with historical snapshots
        const historicalSnapshots = this.lineHistory.get(prop.id) || [];

        if (historicalSnapshots.length > 0) {
          const previousSnapshot = historicalSnapshots[historicalSnapshots.length - 1];

          // Detect steam move
          const steamMove = await this.checkForSteamMove(previousSnapshot, currentSnapshot);

          if (steamMove) {
            steamMoves.push(steamMove);

            // Store steam move in database
            await this.storeSteamMove(steamMove);

            // Alert on high-confidence steam moves
            if (steamMove.steamConfidenceScore >= 0.8) {
              await this.alertSteamMove(steamMove);
            }
          }
        }

        // Update line history
        this.updateLineHistory(prop.id, currentSnapshot);
      } catch (error: any) {
        logger.error('[SteamDetector] Error detecting steam for prop', {
          propId: prop.id,
          error: error.message,
        });
      }
    }

    logger.info('[SteamDetector] Steam detection cycle complete', {
      steamMovesDetected: steamMoves.length,
    });

    return steamMoves;
  }

  /**
   * Get active props (games starting within next 24 hours)
   */
  private async getActiveProps(): Promise<any[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await this.supabase
      .from('props')
      .select('*')
      .eq('status', 'active')
      .lte('game_date', tomorrow.toISOString())
      .order('game_date', { ascending: true });

    if (error) {
      logger.error('[SteamDetector] Failed to get active props', { error: error.message });
      return [];
    }

    return data || [];
  }

  /**
   * Get current line snapshot from odds providers
   * TODO: Integrate with real odds API
   */
  private async getCurrentLineSnapshot(propId: string): Promise<LineSnapshot> {
    // Placeholder - would query real odds API
    const { data } = await this.supabase
      .from('props')
      .select('*')
      .eq('id', propId)
      .single();

    if (!data) {
      throw new Error(`Prop not found: ${propId}`);
    }

    // Simulate line snapshot (in production, fetch from odds API)
    return {
      propId: data.id,
      sport: data.sport,
      marketType: data.stat_type,
      bookmaker: data.bookmaker || 'Unknown',
      line: data.line + (Math.random() * 0.4 - 0.2), // Simulate slight movement
      odds: data.over_odds + Math.floor(Math.random() * 10 - 5),
      timestamp: new Date(),
      volume: Math.random() * 1000, // Simulated volume
    };
  }

  /**
   * Check if snapshots indicate a steam move
   */
  private async checkForSteamMove(
    previous: LineSnapshot,
    current: LineSnapshot
  ): Promise<SteamMove | null> {
    // Calculate movements
    const lineMovementPct = Math.abs(((current.line - previous.line) / previous.line) * 100);
    const oddsMovementPct = Math.abs(((current.odds - previous.odds) / previous.odds) * 100);

    // Check if movement exceeds thresholds
    if (
      lineMovementPct < this.config.lineMovementThreshold &&
      oddsMovementPct < this.config.oddsMovementThreshold
    ) {
      return null; // No significant movement
    }

    // Check for volume spike
    const volumeSpikeDetected = this.detectVolumSpike(previous.volume, current.volume);

    // Check for reverse line movement
    const reverseLineMovement = await this.detectReverseLineMovement(current.propId);

    // Check multiple books movement
    const multipleBookMovement = await this.checkMultipleBookMovement(current.propId);

    // Calculate confidence score
    const steamConfidenceScore = this.calculateConfidenceScore({
      lineMovementPct,
      oddsMovementPct,
      volumeSpikeDetected,
      reverseLineMovement,
      multipleBookMovement,
    });

    // Only return if confidence is above minimum threshold
    if (steamConfidenceScore < 0.5) {
      return null;
    }

    // Check sharp book agreement
    const sharpBookAgreementPct = await this.checkSharpBookAgreement(current.propId);

    return {
      propId: current.propId,
      sport: current.sport,
      marketType: current.marketType,
      detectedAt: new Date(),
      lineBefore: previous.line,
      lineAfter: current.line,
      lineMovementPct,
      oddsBefore: previous.odds,
      oddsAfter: current.odds,
      oddsMovementPct,
      volumeSpikeDetected,
      reverseLineMovement,
      multipleBookMovement,
      steamConfidenceScore,
      sharpBookAgreementPct,
    };
  }

  /**
   * Detect volume spike
   */
  private detectVolumSpike(previousVolume?: number, currentVolume?: number): boolean {
    if (!previousVolume || !currentVolume) return false;
    return currentVolume >= previousVolume * this.config.volumeSpikeMultiplier;
  }

  /**
   * Detect reverse line movement (line moves against public betting %)
   * TODO: Implement with actual public betting data
   */
  private async detectReverseLineMovement(propId: string): Promise<boolean> {
    // Placeholder - would check if line moved opposite to public betting percentage
    return Math.random() > 0.7; // 30% chance of RLM
  }

  /**
   * Check how many bookmakers moved simultaneously
   * TODO: Implement with multi-book odds data
   */
  private async checkMultipleBookMovement(propId: string): Promise<number> {
    // Placeholder - would check multiple bookmakers
    return Math.floor(Math.random() * 5); // 0-4 books
  }

  /**
   * Calculate steam confidence score (0-1)
   */
  private calculateConfidenceScore(factors: {
    lineMovementPct: number;
    oddsMovementPct: number;
    volumeSpikeDetected: boolean;
    reverseLineMovement: boolean;
    multipleBookMovement: number;
  }): number {
    let score = 0;

    // Line movement contributes 30%
    score += Math.min(factors.lineMovementPct / 10, 0.3);

    // Odds movement contributes 20%
    score += Math.min(factors.oddsMovementPct / 15, 0.2);

    // Volume spike contributes 20%
    if (factors.volumeSpikeDetected) score += 0.2;

    // Reverse line movement contributes 15%
    if (factors.reverseLineMovement) score += 0.15;

    // Multiple book movement contributes 15%
    score += Math.min(factors.multipleBookMovement / 5, 0.15);

    return Math.min(score, 1.0);
  }

  /**
   * Check sharp bookmaker agreement
   * TODO: Implement with sharp book data
   */
  private async checkSharpBookAgreement(propId: string): Promise<number> {
    // Placeholder - would check if sharp books all moved in same direction
    return Math.random() * 100; // 0-100%
  }

  /**
   * Update line history for a prop
   */
  private updateLineHistory(propId: string, snapshot: LineSnapshot): void {
    const history = this.lineHistory.get(propId) || [];
    history.push(snapshot);

    // Keep only last 100 snapshots
    if (history.length > 100) {
      history.shift();
    }

    this.lineHistory.set(propId, history);
  }

  /**
   * Store steam move in database
   */
  private async storeSteamMove(steamMove: SteamMove): Promise<void> {
    const { error } = await this.supabase.from('steam_moves').insert({
      tenant_id: '00000000-0000-0000-0000-000000000001',
      prop_id: steamMove.propId,
      sport: steamMove.sport,
      market_type: steamMove.marketType,
      detected_at: steamMove.detectedAt.toISOString(),
      line_before: steamMove.lineBefore,
      line_after: steamMove.lineAfter,
      line_movement_pct: steamMove.lineMovementPct,
      odds_before: steamMove.oddsBefore,
      odds_after: steamMove.oddsAfter,
      odds_movement_pct: steamMove.oddsMovementPct,
      volume_spike_detected: steamMove.volumeSpikeDetected,
      reverse_line_movement: steamMove.reverseLineMovement,
      multiple_books_movement: steamMove.multipleBookMovement,
      steam_confidence_score: steamMove.steamConfidenceScore,
      sharp_book_agreement_pct: steamMove.sharpBookAgreementPct,
    });

    if (error) {
      logger.error('[SteamDetector] Failed to store steam move', { error: error.message });
    }
  }

  /**
   * Alert on high-confidence steam move
   */
  private async alertSteamMove(steamMove: SteamMove): Promise<void> {
    logger.warn('[SteamDetector] HIGH-CONFIDENCE STEAM MOVE DETECTED', {
      propId: steamMove.propId,
      sport: steamMove.sport,
      lineMovement: `${steamMove.lineBefore} → ${steamMove.lineAfter}`,
      oddsMovement: `${steamMove.oddsBefore} → ${steamMove.oddsAfter}`,
      confidence: steamMove.steamConfidenceScore,
    });

    // TODO: Implement Discord/Slack alerting
    // await this.sendDiscordAlert(steamMove);
  }

  /**
   * Get steam move history for a prop
   */
  async getSteamHistory(propId: string): Promise<SteamMove[]> {
    const { data, error } = await this.supabase
      .from('steam_moves')
      .select('*')
      .eq('prop_id', propId)
      .order('detected_at', { ascending: false });

    if (error) {
      logger.error('[SteamDetector] Failed to get steam history', { error: error.message });
      return [];
    }

    return (data || []).map((row) => ({
      propId: row.prop_id,
      sport: row.sport,
      marketType: row.market_type,
      detectedAt: new Date(row.detected_at),
      lineBefore: row.line_before,
      lineAfter: row.line_after,
      lineMovementPct: row.line_movement_pct,
      oddsBefore: row.odds_before,
      oddsAfter: row.odds_after,
      oddsMovementPct: row.odds_movement_pct,
      volumeSpikeDetected: row.volume_spike_detected,
      reverseLineMovement: row.reverse_line_movement,
      multipleBookMovement: row.multiple_books_movement,
      steamConfidenceScore: row.steam_confidence_score,
      sharpBookAgreementPct: row.sharp_book_agreement_pct,
    }));
  }
}

export function createSteamDetector(supabase: SupabaseClient): SteamDetector {
  return new SteamDetector(supabase);
}
