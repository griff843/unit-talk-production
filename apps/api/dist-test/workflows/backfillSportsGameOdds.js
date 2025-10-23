"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillSportsGameOdds = backfillSportsGameOdds;
exports.continuousSGOBackfill = continuousSGOBackfill;
exports.backfillSportSpecific = backfillSportSpecific;
const workflow_1 = require("@temporalio/workflow");
// Proxy activities with appropriate timeouts
const { fetchSGOGames, fetchSGOProps, insertGames, insertProps, queueSettlement, updateProgress, checkDuplicates, validateSGOResponse, storeBatch } = (0, workflow_1.proxyActivities)({
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
async function backfillSportsGameOdds(options) {
    const { sports = ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA', 'NHL'], days = 7, batchSize = 100, rateLimit = 60, // requests per minute
    dryRun = false } = options;
    const workflowId = (0, workflow_1.workflowInfo)().workflowId;
    const startTime = new Date();
    workflow_1.log.info('Starting SportsGameOdds backfill workflow', {
        workflowId,
        sports,
        days,
        batchSize,
        rateLimit,
        dryRun
    });
    // Initialize progress tracking
    let progress = {
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
            workflow_1.log.info(`Processing sport ${sport} (${sportIndex + 1}/${sports.length})`);
            // Process each day for this sport
            for (let dayOffset = 0; dayOffset < days; dayOffset++) {
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() - dayOffset);
                workflow_1.log.info(`Processing ${sport} for ${targetDate.toISOString().split('T')[0]}`);
                try {
                    // Fetch games for this sport/date
                    const games = await fetchSGOGames({
                        sport,
                        date: targetDate,
                        apiKey: process.env.SPORTSGAMEODDS_KEY
                    });
                    progress.totalGames += games.length;
                    await updateProgress(progress);
                    // Process games in batches
                    for (let i = 0; i < games.length; i += batchSize) {
                        const gameBatch = games.slice(i, i + batchSize);
                        // Check for duplicates
                        const duplicateCheck = await checkDuplicates(gameBatch.map(g => g.external_game_id), 'games');
                        const newGames = gameBatch.filter(game => !duplicateCheck.existing.includes(game.external_game_id));
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
                                    apiKey: process.env.SPORTSGAMEODDS_KEY
                                });
                                progress.totalProps += props.length;
                                // Check for prop duplicates
                                const propDuplicateCheck = await checkDuplicates(props.map(p => p.external_prop_id), 'raw_props');
                                const newProps = props.filter(prop => !propDuplicateCheck.existing.includes(prop.external_prop_id));
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
                                    await (0, workflow_1.sleep)(`${Math.ceil(60000 / rateLimit)}ms`);
                                }
                            }
                            catch (error) {
                                const errorMsg = `Failed to process props for game ${game.external_game_id}: ${error}`;
                                workflow_1.log.error(errorMsg);
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
                }
                catch (error) {
                    const errorMsg = `Failed to process ${sport} for ${targetDate.toISOString().split('T')[0]}: ${error}`;
                    workflow_1.log.error(errorMsg);
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
            workflow_1.log.info(`Completed sport ${sport}: ${progress.processedGames} games, ${progress.processedProps} props`);
        }
        // Mark as completed
        progress.status = 'completed';
        progress.completedAt = new Date();
        workflow_1.log.info('SportsGameOdds backfill completed successfully', {
            duration: progress.completedAt.getTime() - startTime.getTime(),
            totalGames: progress.processedGames,
            totalProps: progress.processedProps,
            duplicatesSkipped: progress.duplicatesSkipped,
            errors: progress.errors.length
        });
    }
    catch (error) {
        progress.status = 'failed';
        progress.completedAt = new Date();
        const errorMsg = `Backfill workflow failed: ${error}`;
        workflow_1.log.error(errorMsg);
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
async function continuousSGOBackfill(options) {
    const { sports = ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA', 'NHL'], batchSize = 50, rateLimit = 30, maxDays = 30 // Extended for continuous operation
     } = options;
    workflow_1.log.info('Starting continuous SGO backfill workflow');
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
                workflow_1.log.error(`Day ${currentDay} backfill failed, continuing...`);
            }
            currentDay++;
            // Sleep between day processing to manage API quota
            await (0, workflow_1.sleep)('1h'); // 1 hour between day batches
        }
        catch (error) {
            workflow_1.log.error(`Continuous backfill error on day ${currentDay}: ${error}`);
            // Exponential backoff on errors
            await (0, workflow_1.sleep)(`${Math.min(300, currentDay * 30)}s`);
            currentDay++;
        }
    }
    workflow_1.log.info('Continuous SGO backfill completed');
}
/**
 * Sport-specific backfill for targeted data ingestion
 */
async function backfillSportSpecific(sport, days = 7) {
    return backfillSportsGameOdds({
        sports: [sport],
        days,
        batchSize: 100,
        rateLimit: 60
    });
}
//# sourceMappingURL=backfillSportsGameOdds.js.map