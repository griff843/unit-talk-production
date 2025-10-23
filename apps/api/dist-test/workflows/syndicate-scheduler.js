"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emergencyStopSignal = exports.resumeSignal = exports.pauseSignal = void 0;
exports.syndicateSchedulerWorkflow = syndicateSchedulerWorkflow;
exports.leagueIngestionWorkflow = leagueIngestionWorkflow;
exports.uspProcessingWorkflow = uspProcessingWorkflow;
exports.gradingAndScoringWorkflow = gradingAndScoringWorkflow;
exports.discordAlertWorkflow = discordAlertWorkflow;
const workflow_1 = require("@temporalio/workflow");
// Activity proxies with syndicate-optimized configurations
const feedActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '90 seconds',
    retry: {
        maximumAttempts: 3,
        initialInterval: '1 second',
        maximumInterval: '10 seconds'
    }
});
const alertActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds',
    retry: {
        maximumAttempts: 2,
        initialInterval: '1 second',
        maximumInterval: '5 seconds'
    }
});
const gradingActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '60 seconds',
    retry: {
        maximumAttempts: 3,
        initialInterval: '2 seconds',
        maximumInterval: '10 seconds'
    }
});
const notificationActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds',
    retry: {
        maximumAttempts: 2,
        initialInterval: '1 second',
        maximumInterval: '5 seconds'
    }
});
const operatorActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds',
    retry: {
        maximumAttempts: 2,
        initialInterval: '1 second',
        maximumInterval: '5 seconds'
    }
});
// Workflow signals for emergency controls
exports.pauseSignal = (0, workflow_1.defineSignal)('pause');
exports.resumeSignal = (0, workflow_1.defineSignal)('resume');
exports.emergencyStopSignal = (0, workflow_1.defineSignal)('emergencyStop');
/**
 * MAIN SYNDICATE SCHEDULER WORKFLOW
 * Orchestrates all ingestion, processing, and alerting on 2-minute intervals
 */
async function syndicateSchedulerWorkflow() {
    let isPaused = false;
    let isEmergencyStopped = false;
    let cycleCount = 0;
    // Set up signal handlers
    (0, workflow_1.setHandler)(exports.pauseSignal, (reason) => {
        isPaused = true;
        console.log(`Syndicate scheduler paused: ${reason}`);
    });
    (0, workflow_1.setHandler)(exports.resumeSignal, (reason) => {
        isPaused = false;
        console.log(`Syndicate scheduler resumed: ${reason}`);
    });
    (0, workflow_1.setHandler)(exports.emergencyStopSignal, (reason) => {
        isEmergencyStopped = true;
        console.log(`Syndicate scheduler emergency stopped: ${reason}`);
    });
    while (!isEmergencyStopped) {
        try {
            // Wait if paused
            await (0, workflow_1.condition)(() => !isPaused || isEmergencyStopped);
            if (isEmergencyStopped) {
                break;
            }
            cycleCount++;
            const cycleStartTime = Date.now();
            // 1. DETECT LIVE GAMES (determines interval mode)
            const liveGames = await operatorActivities.updateLiveGameStatus({
                liveGames: [],
                totalCount: 0,
                leaguesWithLiveGames: [],
                timestamp: new Date()
            });
            const isLiveMode = Array.isArray(liveGames) && liveGames.length > 0;
            const intervalMs = isLiveMode ? 60000 : 300000; // 1 min vs 5 min - ELITE MODE
            // 2. PARALLEL LEAGUE INGESTION
            const leagues = ['MLB', 'NBA', 'NFL', 'NHL', 'NCAAB', 'NCAAF'];
            const ingestionPromises = leagues.map(league => leagueIngestionWorkflow({ league, isLiveMode, cycleCount }));
            await Promise.allSettled(ingestionPromises);
            // 3. USP PROCESSING (parallel with ingestion)
            const uspPromise = uspProcessingWorkflow({
                leagues,
                isLiveMode,
                cycleCount
            });
            // 4. GRADING AND SCORING
            const gradingPromise = gradingAndScoringWorkflow({
                leagues,
                isLiveMode,
                cycleCount
            });
            // 5. DISCORD ALERTS
            const alertPromise = discordAlertWorkflow({
                cycleCount,
                isLiveMode
            });
            // Wait for all processing to complete
            await Promise.allSettled([uspPromise, gradingPromise, alertPromise]);
            // 6. PERFORMANCE MONITORING
            const cycleTime = Date.now() - cycleStartTime;
            const maxCycleTime = isLiveMode ? 50000 : 240000; // 50s for 1-min live, 4min for off-peak
            if (cycleTime > maxCycleTime) {
                await operatorActivities.logPerformanceWarning({
                    cycleTime,
                    maxCycleTime,
                    cycleCount,
                    message: `Cycle ${cycleCount} exceeded target time: ${cycleTime}ms`
                });
            }
            // 7. WAIT FOR NEXT CYCLE
            const remainingTime = Math.max(0, intervalMs - cycleTime);
            if (remainingTime > 0) {
                await (0, workflow_1.sleep)(remainingTime);
            }
        }
        catch (error) {
            await operatorActivities.handleCriticalError({
                error: String(error),
                cycleCount,
                timestamp: new Date(),
                context: 'syndicateSchedulerWorkflow'
            });
            // Brief pause before retry
            await (0, workflow_1.sleep)(5000);
        }
    }
}
/**
 * LEAGUE-SPECIFIC INGESTION WORKFLOW
 * Handles ingestion for a single league with fallback support
 */
async function leagueIngestionWorkflow(params) {
    const { league, isLiveMode, cycleCount } = params;
    try {
        // 1. UNIFIED INGESTION (Dual-API Strategy)
        // Uses intelligent routing: Optimal for player props, Odds API for NCAAF/WNBA/Settlement
        let ingestionResult = await feedActivities.ingestUnifiedData({
            league,
            batchSize: isLiveMode ? 500 : 200,
            timeout: 30000 // Reduced for 1-minute cycles
        });
        // 2. FALLBACK IF PRIMARY FAILS
        if (!ingestionResult.success) {
            await operatorActivities.logFallbackActivation({
                league,
                primaryError: ingestionResult.error || 'Unknown error',
                cycleCount
            });
            ingestionResult = await feedActivities.ingestFallbackProps({
                league,
                provider: 'SGO',
                timeout: 45000
            });
        }
        // 3. DATA PROCESSING
        if (ingestionResult.success && ingestionResult.propCount > 0) {
            await feedActivities.deduplicateAndNormalize({
                league,
                batchId: ingestionResult.batchId
            });
            await feedActivities.triggerGrading({
                batchId: ingestionResult.batchId,
                league,
                propCount: ingestionResult.propCount
            });
            // 4. METRICS LOGGING
            await operatorActivities.updateProcessingMetrics({
                league,
                batchId: ingestionResult.batchId,
                propCount: ingestionResult.propCount,
                cycleCount,
                processingTime: Date.now()
            });
        }
    }
    catch (error) {
        await operatorActivities.logError({
            workflow: 'leagueIngestionWorkflow',
            league,
            error: String(error),
            timestamp: new Date()
        });
    }
}
/**
 * USP PROCESSING WORKFLOW
 * Detects all Unique Selling Propositions in parallel
 */
async function uspProcessingWorkflow(params) {
    const { leagues, isLiveMode, cycleCount } = params;
    try {
        // Enhanced USP detection during live mode
        const uspPromises = [
            // Steam movement detection
            alertActivities.detectSteamMovement({
                leagues,
                threshold: isLiveMode ? 0.5 : 1.0,
                timeWindow: isLiveMode ? 120 : 300
            }),
            // Line movement detection
            alertActivities.detectLineMovement({
                leagues,
                significantThreshold: isLiveMode ? 1.0 : 2.0,
                timeWindow: isLiveMode ? 120 : 300
            }),
            // Hedge opportunities
            alertActivities.detectHedgeOpportunities({
                leagues,
                minProfitMargin: 0.05
            }),
            // Middle opportunities
            alertActivities.detectMiddleOpportunities({
                leagues,
                minGap: 2.0
            }),
            // Stale line detection
            alertActivities.detectStaleLines({
                leagues,
                maxAge: isLiveMode ? 300 : 600 // 5min live, 10min off-peak
            }),
            // Injury impact detection
            alertActivities.detectInjuryImpacts({
                leagues,
                sources: ['ESPN', 'RotoBaller', 'FantasyPros']
            }),
            // Suspicious activity detection
            alertActivities.detectSuspiciousActivity({
                leagues,
                patterns: ['unusual_volume', 'coordinated_betting', 'line_manipulation']
            })
        ];
        const uspResults = await Promise.allSettled(uspPromises);
        // Log any USP detection errors
        uspResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                const uspTypes = ['steam', 'line_movement', 'hedge', 'middle', 'stale', 'injury', 'suspicious'];
                operatorActivities.logUSPError({
                    uspType: uspTypes[index] || 'unknown',
                    error: String(result.reason),
                    cycleCount
                });
            }
        });
    }
    catch (error) {
        await operatorActivities.logUSPError({
            uspType: 'general',
            error: String(error),
            cycleCount
        });
    }
}
/**
 * GRADING AND SCORING WORKFLOW
 * Fast grading and scoring for syndicate speed
 */
async function gradingAndScoringWorkflow(params) {
    const { leagues, isLiveMode, cycleCount } = params;
    try {
        // Parallel grading across all leagues
        const gradingPromises = leagues.map(league => gradingActivities.gradeNewProps({
            league,
            isLiveMode,
            cycleCount
        }));
        const gradingResults = await Promise.allSettled(gradingPromises);
        // Collect successful grading results
        const successfulGrading = gradingResults
            .filter((result) => result.status === 'fulfilled')
            .map(result => result.value);
        if (successfulGrading.length > 0) {
            // Score top-tier picks
            const scoringPromises = successfulGrading.map(gradedResult => gradingActivities.scoreTopTierPicks({
                gradedProps: gradedResult.topTierProps,
                league: gradedResult.league,
                cycleCount
            }));
            const scoringResults = await Promise.allSettled(scoringPromises);
            // Update final picks table
            const successfulScoring = scoringResults
                .filter((result) => result.status === 'fulfilled')
                .map(result => result.value);
            if (successfulScoring.length > 0) {
                await gradingActivities.updateUnifiedPicks({
                    scoringResults: successfulScoring,
                    cycleCount,
                    timestamp: new Date()
                });
            }
        }
        // Log any grading errors
        const failedGrading = gradingResults
            .filter(result => result.status === 'rejected')
            .map(result => result.reason);
        if (failedGrading.length > 0) {
            await operatorActivities.logGradingError({
                error: failedGrading.join('; '),
                leagues,
                cycleCount
            });
        }
    }
    catch (error) {
        await operatorActivities.logGradingError({
            error: String(error),
            leagues,
            cycleCount
        });
    }
}
/**
 * DISCORD ALERT WORKFLOW
 * <30 second Discord delivery for syndicate performance
 */
async function discordAlertWorkflow(params) {
    const { cycleCount, isLiveMode } = params;
    try {
        const alertStartTime = Date.now();
        // 1. GET NEW FINAL PICKS
        const newPicks = await gradingActivities.getNewUnifiedPicks({ cycleCount });
        if (newPicks.length === 0) {
            return; // No new picks to alert
        }
        // 2. BUILD DISCORD EMBEDS
        const embeds = await notificationActivities.buildPickEmbeds({
            picks: newPicks,
            isLiveMode
        });
        // 3. SEND CRITICAL ALERTS FIRST
        const criticalAlerts = embeds.filter(e => e.priority === 'critical');
        if (criticalAlerts.length > 0) {
            await notificationActivities.sendCriticalDiscordAlerts({
                alerts: criticalAlerts.map(e => ({
                    type: 'critical_pick',
                    priority: 'critical',
                    data: e.embed,
                    timestamp: new Date()
                })),
                cycleCount
            });
        }
        // 4. BATCH REMAINING ALERTS
        const remainingAlerts = embeds.filter(e => e.priority !== 'critical');
        if (remainingAlerts.length > 0) {
            await notificationActivities.batchDiscordAlerts({
                alerts: remainingAlerts.map(e => ({
                    type: 'pick_alert',
                    priority: e.priority,
                    data: e.embed,
                    timestamp: new Date()
                })),
                cycleCount
            });
        }
        // 5. LOG DISCORD METRICS
        const deliveryTime = Date.now() - alertStartTime;
        await operatorActivities.logDiscordMetrics({
            picksCount: newPicks.length,
            embedsCount: embeds.length,
            cycleCount,
            deliveryTime
        });
        // 6. ALERT IF DELIVERY TOO SLOW
        if (deliveryTime > 30000) { // 30 seconds
            await operatorActivities.logDiscordError({
                error: `Discord delivery took ${deliveryTime}ms (>30s target)`,
                cycleCount
            });
        }
    }
    catch (error) {
        await operatorActivities.logDiscordError({
            error: String(error),
            cycleCount
        });
    }
}
//# sourceMappingURL=syndicate-scheduler.js.map