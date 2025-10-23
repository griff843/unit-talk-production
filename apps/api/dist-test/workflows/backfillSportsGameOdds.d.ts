import type { BackfillSGOOptions, BackfillProgress } from '../activities/backfillSGOActivities';
/**
 * SportsGameOdds Backfill Workflow
 *
 * Backfills historical games and props from SGO API during 7-day trial
 * with automatic settlement integration and idempotency controls.
 *
 * Features:
 * - Multi-sport batch processing (MLB, NFL, NBA, NCAAF, NCAAB, WNBA, NHL)
 * - Configurable day-by-day windowing
 * - Rate limiting and API quota management
 * - Automatic SettlementAgent integration
 * - Idempotency with duplicate detection
 * - Progress tracking and monitoring
 * - Hot/Warm/Cold data architecture support
 */
export declare function backfillSportsGameOdds(options: BackfillSGOOptions): Promise<BackfillProgress>;
/**
 * Continuous SGO Backfill Workflow
 *
 * Long-running workflow for continuous historical data ingestion.
 * Designed to run as a background service during trial period.
 */
export declare function continuousSGOBackfill(options: BackfillSGOOptions): Promise<void>;
/**
 * Sport-specific backfill for targeted data ingestion
 */
export declare function backfillSportSpecific(sport: string, days?: number): Promise<BackfillProgress>;
//# sourceMappingURL=backfillSportsGameOdds.d.ts.map