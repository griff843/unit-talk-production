/**
 * Material Change Detector
 *
 * @deprecated SPRINT-REPO-ARCHITECTURE-NORMALIZATION-001
 * This is a stub. The canonical scorer is computeScoreV2 in
 * apps/api/src/agents/GradingAgent/scoring/computeScoreV2.ts.
 * See docs/architecture/SCORING_AUTHORITY.md for the scoring authority map.
 *
 * @module MaterialChangeDetector
 */

import { createLogger } from '../../../utils/logger';

const logger = createLogger('MaterialChangeDetector');

/**
 * Types of material changes
 */
export enum ChangeType {
  LINE_MOVEMENT = 'line_movement',
  ODDS_SHIFT = 'odds_shift',
  STEAM_MOVE = 'steam_move',
  REVERSE_LINE_MOVEMENT = 'reverse_line_movement',
  INJURY_NEWS = 'injury_news',
  WEATHER_CHANGE = 'weather_change',
  VOLUME_SPIKE = 'volume_spike',
}

/**
 * Material change detection result
 */
export interface MaterialChange {
  type: ChangeType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  details: {
    oldValue?: number;
    newValue?: number;
    delta?: number;
    threshold?: number;
    metadata?: Record<string, any>;
  };
  actionRequired: boolean;
  recommendedAction?: 'recheck' | 'alert' | 'hedge' | 'close';
}

/**
 * Prop snapshot for change detection
 */
export interface PropSnapshot {
  propId: string;
  line: number;
  overOdds: number;
  underOdds: number;
  timestamp: string;
  volume?: number;
  metadata?: Record<string, any>;
}

/**
 * Material Change Detector
 *
 * Stub implementation - provides minimal interface for compilation
 */
export class MaterialChangeDetector {
  private initialized: boolean = false;
  private snapshots: Map<string, PropSnapshot[]> = new Map();
  private eventHandlers: Map<string, Array<(...args: any[]) => void>> = new Map();

  constructor() {
    logger.info('MaterialChangeDetector initialized (stub)');
  }

  /**
   * Register event handler
   */
  on(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Emit event
   */
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        logger.error('Event handler error', { event, error });
      }
    });
  }

  /**
   * Initialize the detector
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing MaterialChangeDetector...');
    this.initialized = true;
  }

  /**
   * Record a prop snapshot
   *
   * @param snapshot - Current prop state
   */
  recordSnapshot(snapshot: PropSnapshot): void {
    const history = this.snapshots.get(snapshot.propId) || [];
    history.push(snapshot);

    // Keep last 100 snapshots per prop
    if (history.length > 100) {
      history.shift();
    }

    this.snapshots.set(snapshot.propId, history);
    logger.debug('Recorded snapshot', { propId: snapshot.propId, historyLength: history.length });
  }

  /**
   * Detect material changes for a prop
   *
   * @param propId - Prop identifier
   * @param currentSnapshot - Current prop state
   * @returns Array of detected material changes
   */
  async detectChanges(propId: string, currentSnapshot: PropSnapshot): Promise<MaterialChange[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const history = this.snapshots.get(propId) || [];
    if (history.length === 0) {
      this.recordSnapshot(currentSnapshot);
      return [];
    }

    const changes: MaterialChange[] = [];
    const lastSnapshot = history[history.length - 1];

    // Stub implementation - detect basic line movement
    // TODO: Implement full material change detection algorithm

    // Line movement detection
    const lineDelta = Math.abs(currentSnapshot.line - lastSnapshot.line);
    if (lineDelta >= 0.5) {
      changes.push({
        type: ChangeType.LINE_MOVEMENT,
        severity: lineDelta >= 1.0 ? 'high' : 'medium',
        timestamp: currentSnapshot.timestamp,
        details: {
          oldValue: lastSnapshot.line,
          newValue: currentSnapshot.line,
          delta: lineDelta,
          threshold: 0.5,
        },
        actionRequired: lineDelta >= 1.0,
        recommendedAction: lineDelta >= 1.0 ? 'recheck' : undefined,
      });
    }

    // Odds shift detection
    const oddsDelta = Math.abs(currentSnapshot.overOdds - lastSnapshot.overOdds);
    if (oddsDelta >= 10) {
      changes.push({
        type: ChangeType.ODDS_SHIFT,
        severity: oddsDelta >= 20 ? 'high' : 'medium',
        timestamp: currentSnapshot.timestamp,
        details: {
          oldValue: lastSnapshot.overOdds,
          newValue: currentSnapshot.overOdds,
          delta: oddsDelta,
          threshold: 10,
        },
        actionRequired: oddsDelta >= 20,
        recommendedAction: oddsDelta >= 20 ? 'alert' : undefined,
      });
    }

    this.recordSnapshot(currentSnapshot);

    if (changes.length > 0) {
      logger.info('Material changes detected', { propId, changeCount: changes.length });

      // Emit events for detected changes
      changes.forEach(change => {
        this.emit('materialChange', { propId, change });

        if (change.severity === 'critical') {
          this.emit('criticalChange', { propId, change });
        }
      });
    }

    return changes;
  }

  /**
   * Get change history for a prop
   *
   * @param propId - Prop identifier
   * @returns Array of snapshots
   */
  getHistory(propId: string): PropSnapshot[] {
    return this.snapshots.get(propId) || [];
  }

  /**
   * Clear history for a prop
   *
   * @param propId - Prop identifier
   */
  clearHistory(propId: string): void {
    this.snapshots.delete(propId);
    logger.debug('Cleared history', { propId });
  }

  /**
   * Shutdown the detector
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down MaterialChangeDetector');
    this.snapshots.clear();
    this.initialized = false;
  }
}

/**
 * Singleton instance
 */
let detectorInstance: MaterialChangeDetector | null = null;

/**
 * Get or create the MaterialChangeDetector singleton
 */
export function getMaterialChangeDetector(): MaterialChangeDetector {
  if (!detectorInstance) {
    detectorInstance = new MaterialChangeDetector();
  }
  return detectorInstance;
}
