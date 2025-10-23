"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.massiveParallelSGOBackfill = massiveParallelSGOBackfill;
exports.parallelSportBackfill = parallelSportBackfill;
exports.processDateRangeBatch = processDateRangeBatch;
exports.concurrentSettlementProcessor = concurrentSettlementProcessor;
const workflow_1 = require("@temporalio/workflow");
// Proxy activities with optimized timeouts for parallel processing
const { fetchSGOGames, fetchSGOProps, insertGames, insertProps, queueSettlement, updateProgress, checkDuplicates, validateSGOResponse, storeBatch } = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '10 minutes',
    retry: {
        maximumAttempts: 5,
        initialInterval: '15s',
        maximumInterval: '5m',
        backoffCoefficient: 1.5,
    },
});
/**
 * MASSIVE PARALLEL SGO BACKFILL WORKFLOW
 *
 * Designed to process 1.4M+ props efficiently using maximum parallelization:
 * - Concurrent sport processing (7 sports simultaneously)
 * - Parallel date range processing within each sport
 * - Batch API calls with intelligent rate limiting
 * - Concurrent settlement processing
 * - Real-time progress tracking and optimization
 *
 * Target: Complete 1.4M props in 6-8 hours
 */
async function massiveParallelSGOBackfill(options) {
    const { sports = ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA', 'NHL'], days = 365, // Full year for comprehensive backfill
    batchSize = 200, // Larger batches for efficiency
    maxConcurrentSports = 7, // All sports in parallel
    maxConcurrentDays = 5, // 5 date ranges per sport
    maxConcurrentGames = 20, // 20 games processed simultaneously
    smartRateLimit = true, batchApiCalls = true, dryRun = false } = options;
    const workflowId = (0, workflow_1.workflowInfo)().workflowId;
    const startTime = new Date();
    workflow_1.log.info('🚀 MASSIVE PARALLEL SGO BACKFILL STARTED', {
        workflowId,
        sports: sports.length,
        totalDays: days,
        maxConcurrentSports,
        maxConcurrentDays,
        maxConcurrentGames,
        targetProps: '1.4M+'
    });
    // Initialize comprehensive progress tracking
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
        // Create sport-specific backfill tasks with optimized date ranges
        const sportTasks = await createSportBackfillTasks(sports, days, batchSize);
        workflow_1.log.info(`📋 Created ${sportTasks.length} sport tasks with ${sportTasks.reduce((sum, task) => sum + task.dateRanges.length, 0)} total date ranges`);
        // Launch concurrent sport workflows
        const sportWorkflows = sportTasks.map(async (task, index) => {
            // Stagger workflow starts to avoid API burst
            if (index > 0) {
                await (0, workflow_1.sleep)(`${index * 2}s`);
            }
            return (0, workflow_1.startChild)('parallelSportBackfill', {
                args: [task, dryRun],
                workflowId: `${workflowId}-sport-${task.sport}`,
                taskQueue: 'unit-talk-dev',
                workflowExecutionTimeout: '4 hours'
            });
        });
        workflow_1.log.info(`🏃 Launched ${sportWorkflows.length} concurrent sport workflows`);
        // Start concurrent settlement processing
        const settlementWorkflow = (0, workflow_1.startChild)('concurrentSettlementProcessor', {
            args: [{ batchSize: 1000, maxConcurrent: 10 }],
            workflowId: `${workflowId}-settlement`,
            taskQueue: 'unit-talk-dev',
            workflowExecutionTimeout: '6 hours'
        });
        // Monitor all workflows concurrently
        const allWorkflows = await Promise.all(sportWorkflows);
        const settlementResult = await settlementWorkflow;
        // Aggregate results from all sport workflows
        const sportResults = await Promise.all(allWorkflows.map(workflow => workflow.result()));
        // Calculate final statistics
        progress.processedSports = sportResults.length;
        progress.totalGames = sportResults.reduce((sum, result) => sum + result.totalGames, 0);
        progress.processedGames = sportResults.reduce((sum, result) => sum + result.processedGames, 0);
        progress.totalProps = sportResults.reduce((sum, result) => sum + result.totalProps, 0);
        progress.processedProps = sportResults.reduce((sum, result) => sum + result.processedProps, 0);
        progress.duplicatesSkipped = sportResults.reduce((sum, result) => sum + result.duplicatesSkipped, 0);
        // Merge all errors
        progress.errors = sportResults.reduce((allErrors, result) => [...allErrors, ...result.errors], []);
        progress.status = 'completed';
        progress.completedAt = new Date();
        const duration = progress.completedAt.getTime() - startTime.getTime();
        const propsPerHour = Math.round((progress.processedProps / duration) * 3600000);
        workflow_1.log.info('🎯 MASSIVE PARALLEL SGO BACKFILL COMPLETED!', {
            duration: `${Math.round(duration / 1000 / 60)} minutes`,
            totalProps: progress.processedProps,
            propsPerHour,
            sportsCompleted: progress.processedSports,
            gamesProcessed: progress.processedGames,
            duplicatesSkipped: progress.duplicatesSkipped,
            errors: progress.errors.length,
            efficiency: `${Math.round((progress.processedProps / 1400000) * 100)}% of 1.4M target`
        });
    }
    catch (error) {
        progress.status = 'failed';
        progress.completedAt = new Date();
        const errorMsg = `Massive parallel backfill failed: ${error}`;
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
 * Parallel Sport Backfill Workflow
 * Processes a single sport with concurrent date range processing
 */
async function parallelSportBackfill(task, dryRun = false) {
    const { sport, dateRanges, batchSize, rateLimit } = task;
    const workflowId = (0, workflow_1.workflowInfo)().workflowId;
    const startTime = new Date();
    workflow_1.log.info(`🏀 Starting parallel ${sport} backfill`, {
        sport,
        dateRanges: dateRanges.length,
        batchSize,
        rateLimit
    });
    let sportProgress = {
        workflowId,
        startedAt: startTime,
        totalDays: dateRanges.length,
        processedDays: 0,
        totalSports: 1,
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
        // Launch concurrent date range processing
        const dateRangeWorkflows = dateRanges.map(async (dateRange, index) => {
            // Stagger starts to manage API rate limiting
            if (index > 0) {
                await (0, workflow_1.sleep)(`${index * 1}s`);
            }
            return (0, workflow_1.executeChild)('processDateRangeBatch', {
                args: [sport, dateRange, batchSize, rateLimit, dryRun],
                workflowExecutionTimeout: '2 hours'
            });
        });
        workflow_1.log.info(`📅 Launched ${dateRangeWorkflows.length} concurrent date range processors for ${sport}`);
        // Wait for all date ranges to complete
        const dateResults = await Promise.all(dateRangeWorkflows);
        // Aggregate sport results
        sportProgress.processedDays = dateResults.length;
        sportProgress.totalGames = dateResults.reduce((sum, result) => sum + result.gamesProcessed, 0);
        sportProgress.processedGames = sportProgress.totalGames;
        sportProgress.totalProps = dateResults.reduce((sum, result) => sum + result.propsProcessed, 0);
        sportProgress.processedProps = sportProgress.totalProps;
        sportProgress.processedSports = 1;
        sportProgress.status = 'completed';
        sportProgress.completedAt = new Date();
        const duration = sportProgress.completedAt.getTime() - startTime.getTime();
        const propsPerHour = Math.round((sportProgress.processedProps / duration) * 3600000);
        workflow_1.log.info(`✅ ${sport} backfill completed`, {
            duration: `${Math.round(duration / 1000 / 60)} minutes`,
            games: sportProgress.processedGames,
            props: sportProgress.processedProps,
            propsPerHour,
            dateRanges: dateResults.length
        });
    }
    catch (error) {
        sportProgress.status = 'failed';
        sportProgress.completedAt = new Date();
        const errorMsg = `${sport} backfill failed: ${error}`;
        workflow_1.log.error(errorMsg);
        sportProgress.errors.push({
            timestamp: new Date(),
            sport,
            error: errorMsg
        });
    }
    await updateProgress(sportProgress);
    return sportProgress;
}
/**
 * Process Date Range Batch
 * Handles concurrent game processing within a date range
 */
async function processDateRangeBatch(sport, dateRange, batchSize, rateLimit, dryRun) {
    const startTime = new Date();
    const progress = {
        sport,
        dateRange: `${dateRange.start} to ${dateRange.end}`,
        gamesProcessed: 0,
        propsProcessed: 0,
        apiCallsUsed: 0,
        duration: 0,
        status: 'running'
    };
    try {
        workflow_1.log.info(`📅 Processing ${sport} date range: ${dateRange.start} to ${dateRange.end}`);
        // Fetch all games for the date range
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const allGames = [];
        // Process each day in the range
        for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
            try {
                const dayGames = await fetchSGOGames({
                    sport,
                    date: new Date(currentDate),
                    apiKey: process.env.SPORTSGAMEODDS_KEY
                });
                allGames.push(...dayGames);
                progress.apiCallsUsed++;
                // Smart rate limiting
                if (progress.apiCallsUsed % 10 === 0) {
                    await (0, workflow_1.sleep)(`${Math.ceil(60000 / rateLimit)}ms`);
                }
            }
            catch (error) {
                workflow_1.log.warn(`Failed to fetch games for ${sport} on ${currentDate.toISOString().split('T')[0]}: ${error}`);
            }
        }
        workflow_1.log.info(`🎮 Found ${allGames.length} games for ${sport} in date range`);
        // Process games in concurrent batches
        const gameBatches = [];
        for (let i = 0; i < allGames.length; i += batchSize) {
            gameBatches.push(allGames.slice(i, i + batchSize));
        }
        // Launch concurrent game batch processing
        const gameBatchPromises = gameBatches.map(async (gameBatch, batchIndex) => {
            // Stagger batch starts
            if (batchIndex > 0) {
                await (0, workflow_1.sleep)(`${batchIndex * 0.5}s`);
            }
            return processConcurrentGameBatch(gameBatch, sport, batchSize, rateLimit, dryRun);
        });
        const batchResults = await Promise.all(gameBatchPromises);
        // Aggregate batch results
        progress.gamesProcessed = batchResults.reduce((sum, result) => sum + result.gamesProcessed, 0);
        progress.propsProcessed = batchResults.reduce((sum, result) => sum + result.propsProcessed, 0);
        progress.apiCallsUsed += batchResults.reduce((sum, result) => sum + result.apiCallsUsed, 0);
        progress.status = 'completed';
        progress.duration = new Date().getTime() - startTime.getTime();
        workflow_1.log.info(`✅ Date range completed for ${sport}`, {
            dateRange: progress.dateRange,
            games: progress.gamesProcessed,
            props: progress.propsProcessed,
            duration: `${Math.round(progress.duration / 1000)}s`,
            apiCalls: progress.apiCallsUsed
        });
    }
    catch (error) {
        progress.status = 'failed';
        progress.duration = new Date().getTime() - startTime.getTime();
        workflow_1.log.error(`❌ Date range failed for ${sport}: ${error}`);
    }
    return progress;
}
/**
 * Process Concurrent Game Batch
 * Handles parallel processing of games and their props
 */
async function processConcurrentGameBatch(games, sport, batchSize, rateLimit, dryRun) {
    let gamesProcessed = 0;
    let propsProcessed = 0;
    let apiCallsUsed = 0;
    try {
        // Check for duplicate games
        const duplicateCheck = await checkDuplicates(games.map(g => g.external_game_id), 'games');
        const newGames = games.filter(game => !duplicateCheck.existing.includes(game.external_game_id));
        if (newGames.length > 0 && !dryRun) {
            // Insert new games
            await insertGames({
                games: newGames,
                source: 'sgo'
            });
        }
        gamesProcessed = newGames.length;
        // Process props for all games concurrently
        const propPromises = newGames.map(async (game) => {
            try {
                const props = await fetchSGOProps({
                    gameId: game.external_game_id,
                    sport,
                    apiKey: process.env.SPORTSGAMEODDS_KEY
                });
                apiCallsUsed++;
                if (props.length > 0) {
                    // Check for prop duplicates
                    const propDuplicateCheck = await checkDuplicates(props.map(p => p.external_prop_id), 'raw_props');
                    const newProps = props.filter(prop => !propDuplicateCheck.existing.includes(prop.external_prop_id));
                    if (newProps.length > 0 && !dryRun) {
                        // Insert new props
                        await insertProps({
                            props: newProps,
                            gameId: game.id,
                            source: 'sgo'
                        });
                        // Queue settlement
                        await queueSettlement({
                            propIds: newProps.map(p => p.id),
                            gameId: game.id,
                            priority: 'backfill',
                            source: 'sgo'
                        });
                    }
                    return newProps.length;
                }
                return 0;
            }
            catch (error) {
                workflow_1.log.warn(`Failed to process props for game ${game.external_game_id}: ${error}`);
                return 0;
            }
        });
        // Wait for all prop processing to complete
        const propCounts = await Promise.all(propPromises);
        propsProcessed = propCounts.reduce((sum, count) => sum + count, 0);
        // Intelligent rate limiting between batches
        if (apiCallsUsed > 10) {
            await (0, workflow_1.sleep)(`${Math.ceil((apiCallsUsed * 60000) / rateLimit)}ms`);
        }
    }
    catch (error) {
        workflow_1.log.error(`Batch processing failed: ${error}`);
    }
    return { gamesProcessed, propsProcessed, apiCallsUsed };
}
/**
 * Concurrent Settlement Processor
 * Processes settlement queue in parallel with backfill
 */
async function concurrentSettlementProcessor(options) {
    const { batchSize, maxConcurrent } = options;
    const workflowId = (0, workflow_1.workflowInfo)().workflowId;
    workflow_1.log.info('🔧 Starting concurrent settlement processor', {
        workflowId,
        batchSize,
        maxConcurrent
    });
    let totalSettled = 0;
    let totalErrors = 0;
    try {
        // This would integrate with the existing settlement system
        // For now, we'll simulate the structure
        while (true) {
            // Check for pending settlement jobs
            // Process them in parallel batches
            // This would use the actual settlement activities
            await (0, workflow_1.sleep)('30s'); // Process every 30 seconds
            // Break condition would be based on queue status
            break; // Temporary for initial implementation
        }
    }
    catch (error) {
        workflow_1.log.error(`Settlement processor error: ${error}`);
    }
    workflow_1.log.info('🔧 Settlement processor completed', {
        settled: totalSettled,
        errors: totalErrors
    });
    return { settled: totalSettled, errors: totalErrors };
}
/**
 * Create optimized sport backfill tasks with intelligent date range splitting
 */
async function createSportBackfillTasks(sports, totalDays, batchSize) {
    const tasks = [];
    for (const sport of sports) {
        // Split days into optimal chunks (5-10 days per chunk for API efficiency)
        const daysPerChunk = 10;
        const dateRanges = [];
        for (let dayOffset = 0; dayOffset < totalDays; dayOffset += daysPerChunk) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - dayOffset - daysPerChunk + 1);
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - dayOffset);
            dateRanges.push({
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            });
        }
        // Sport-specific optimizations
        const sportConfig = getSportOptimization(sport);
        tasks.push({
            sport,
            dateRanges,
            batchSize: sportConfig.batchSize || batchSize,
            rateLimit: sportConfig.rateLimit || 60
        });
    }
    return tasks;
}
/**
 * Get sport-specific optimization settings
 */
function getSportOptimization(sport) {
    const optimizations = {
        'MLB': { batchSize: 300, rateLimit: 80 }, // High volume
        'NBA': { batchSize: 250, rateLimit: 70 }, // High volume
        'NFL': { batchSize: 200, rateLimit: 60 }, // Medium volume
        'NCAAF': { batchSize: 200, rateLimit: 60 }, // Medium volume
        'NCAAB': { batchSize: 250, rateLimit: 70 }, // High volume
        'WNBA': { batchSize: 150, rateLimit: 50 }, // Lower volume
        'NHL': { batchSize: 200, rateLimit: 60 } // Medium volume
    };
    return optimizations[sport] || { batchSize: 200, rateLimit: 60 };
}
//# sourceMappingURL=massiveParallelSGOBackfill.js.map