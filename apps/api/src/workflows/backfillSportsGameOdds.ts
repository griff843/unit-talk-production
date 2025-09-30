import { proxyActivities, sleep, log, workflowInfo } from '@temporalio/workflow';
import type {
  BackfillSGOActivities,
  BackfillSGOOptions,
  BackfillProgress,
  GameData,
  PropData,
  SportConfig
} from '../activities/backfillSGOActivities';

// Proxy activities with appropriate timeouts
const {
  fetchSGOGames,
  fetchSGOProps, 
  insertGames,
  insertProps,
  queueSettlement,
  updateProgress,
  checkDuplicates,
  validateSGOResponse,
  storeBatch
} = proxyActivities<BackfillSGOActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '30s',
    maximumInterval: '10m',
    backoffCoefficient: 2.0,
  },
});

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
export async function backfillSportsGameOdds(options: BackfillSGOOptions): Promise<BackfillProgress> {
  const { 
    sports = ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA', 'NHL'],
    days = 7,
    batchSize = 100,
    rateLimit = 60, // requests per minute
    dryRun = false
  } = options;

  const workflowId = workflowInfo().workflowId;
  const startTime = new Date();

  log.info('Starting SportsGameOdds backfill workflow', {
    workflowId,
    sports,
    days,
    batchSize,
    rateLimit,
    dryRun
  });

  // Initialize progress tracking
  let progress: BackfillProgress = {
    workflowId,
    startedAt: startTime,
    totalDays: days,
    processedDays: 0,
    totalSports: sports.length,
    processedSports: 0,
    totalGames: 0,
    processedGames: 0,
    totalProps: 0,
    processedProps: 0,
    duplicatesSkipped: 0,
    errors: [],
    completedAt: null,
    status: 'running'
  };

  try {
    // Process each sport
    for (let sportIndex = 0; sportIndex < sports.length; sportIndex++) {
      const sport = sports[sportIndex];
      
      log.info(`Processing sport ${sport} (${sportIndex + 1}/${sports.length})`);

      // Process each day for this sport
      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - dayOffset);
        
        log.info(`Processing ${sport} for ${targetDate.toISOString().split('T')[0]}`);

        try {
          // Fetch games for this sport/date
          const games = await fetchSGOGames({
            sport,
            date: targetDate,
            apiKey: process.env.SPORTSGAMEODDS_KEY!
          });

          progress.totalGames += games.length;
          await updateProgress(progress);

          // Process games in batches
          for (let i = 0; i < games.length; i += batchSize) {
            const gameBatch = games.slice(i, i + batchSize);
            
            // Check for duplicates
            const duplicateCheck = await checkDuplicates(
              gameBatch.map(g => g.external_game_id),
              'games'
            );

            const newGames = gameBatch.filter(game => 
              !duplicateCheck.existing.includes(game.external_game_id)
            );

            progress.duplicatesSkipped += gameBatch.length - newGames.length;

            if (newGames.length > 0 && !dryRun) {
              // Insert new games
              await insertGames({
                games: newGames,
                source: 'sgo'
              });
            }

            progress.processedGames += newGames.length;

            // Process props for each game
            for (const game of newGames) {
              try {
                const props = await fetchSGOProps({
                  gameId: game.external_game_id,
                  sport,
                  apiKey: process.env.SPORTSGAMEODDS_KEY!
                });

                progress.totalProps += props.length;

                // Check for prop duplicates
                const propDuplicateCheck = await checkDuplicates(
                  props.map(p => p.external_prop_id),
                  'raw_props'
                );

                const newProps = props.filter(prop =>
                  !propDuplicateCheck.existing.includes(prop.external_prop_id)
                );

                progress.duplicatesSkipped += props.length - newProps.length;

                if (newProps.length > 0 && !dryRun) {
                  // Insert new props
                  await insertProps({
                    props: newProps,
                    gameId: game.id,
                    source: 'sgo'
                  });

                  // Queue settlement for these props
                  await queueSettlement({
                    propIds: newProps.map(p => p.id),
                    gameId: game.id,
                    priority: 'backfill',
                    source: 'sgo'
                  });
                }

                progress.processedProps += newProps.length;
                
                // Rate limiting - sleep between API calls
                if (rateLimit > 0) {
                  await sleep(`${Math.ceil(60000 / rateLimit)}ms`);
                }

              } catch (error) {
                const errorMsg = `Failed to process props for game ${game.external_game_id}: ${error}`;
                log.error(errorMsg);
                progress.errors.push({
                  timestamp: new Date(),
                  sport,
                  date: targetDate,
                  gameId: game.external_game_id,
                  error: errorMsg
                });
              }
            }

            // Update progress after each batch
            await updateProgress(progress);
          }

        } catch (error) {
          const errorMsg = `Failed to process ${sport} for ${targetDate.toISOString().split('T')[0]}: ${error}`;
          log.error(errorMsg);
          progress.errors.push({
            timestamp: new Date(),
            sport,
            date: targetDate,
            error: errorMsg
          });
        }

        progress.processedDays++;
        await updateProgress(progress);
      }

      progress.processedSports++;
      await updateProgress(progress);

      log.info(`Completed sport ${sport}: ${progress.processedGames} games, ${progress.processedProps} props`);
    }

    // Mark as completed
    progress.status = 'completed';
    progress.completedAt = new Date();
    
    log.info('SportsGameOdds backfill completed successfully', {
      duration: progress.completedAt.getTime() - startTime.getTime(),
      totalGames: progress.processedGames,
      totalProps: progress.processedProps,
      duplicatesSkipped: progress.duplicatesSkipped,
      errors: progress.errors.length
    });

  } catch (error) {
    progress.status = 'failed';
    progress.completedAt = new Date();
    
    const errorMsg = `Backfill workflow failed: ${error}`;
    log.error(errorMsg);
    progress.errors.push({
      timestamp: new Date(),
      error: errorMsg
    });
  }

  // Final progress update
  await updateProgress(progress);

  return progress;
}

/**
 * Continuous SGO Backfill Workflow
 * 
 * Long-running workflow for continuous historical data ingestion.
 * Designed to run as a background service during trial period.
 */
export async function continuousSGOBackfill(options: BackfillSGOOptions): Promise<void> {
  const { 
    sports = ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA', 'NHL'],
    batchSize = 50,
    rateLimit = 30,
    maxDays = 30 // Extended for continuous operation
  } = options;

  log.info('Starting continuous SGO backfill workflow');

  let currentDay = 1;
  
  while (currentDay <= maxDays) {
    try {
      // Process current day window
      const result = await backfillSportsGameOdds({
        ...options,
        days: 1,
        batchSize,
        rateLimit
      });

      if (result.status === 'failed') {
        log.error(`Day ${currentDay} backfill failed, continuing...`);
      }

      currentDay++;

      // Sleep between day processing to manage API quota
      await sleep('1h'); // 1 hour between day batches

    } catch (error) {
      log.error(`Continuous backfill error on day ${currentDay}: ${error}`);
      
      // Exponential backoff on errors
      await sleep(`${Math.min(300, currentDay * 30)}s`);
      currentDay++;
    }
  }

  log.info('Continuous SGO backfill completed');
}

/**
 * Sport-specific backfill for targeted data ingestion
 */
export async function backfillSportSpecific(sport: string, days: number = 7): Promise<BackfillProgress> {
  return backfillSportsGameOdds({
    sports: [sport],
    days,
    batchSize: 100,
    rateLimit: 60
  });
}