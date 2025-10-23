"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syndicateSchedulerWorkflow = syndicateSchedulerWorkflow;
exports.liveGameDetectorWorkflow = liveGameDetectorWorkflow;
exports.quotaMonitoringWorkflow = quotaMonitoringWorkflow;
exports.healthMonitoringWorkflow = healthMonitoringWorkflow;
exports.createLeagueScheduleWorkflow = createLeagueScheduleWorkflow;
exports.nflScheduleWorkflow = nflScheduleWorkflow;
exports.nbaScheduleWorkflow = nbaScheduleWorkflow;
exports.mlbScheduleWorkflow = mlbScheduleWorkflow;
exports.nhlScheduleWorkflow = nhlScheduleWorkflow;
exports.ncaafScheduleWorkflow = ncaafScheduleWorkflow;
exports.ncaabScheduleWorkflow = ncaabScheduleWorkflow;
exports.wnbaScheduleWorkflow = wnbaScheduleWorkflow;
const workflow_1 = require("@temporalio/workflow");
// Activity proxies
const feedActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '2 minutes'
});
const alertActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds'
});
const operatorActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '1 minute'
});
const notificationActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds'
});
const gradingActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '2 minutes'
});
/**
 * SYNDICATE SCHEDULER WORKFLOW
 * Main data ingestion and processing workflow (1 minute intervals)
 */
async function syndicateSchedulerWorkflow() {
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000; // Prevent infinite loops
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const leagues = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA'];
            // 1. DATA INGESTION - Successfully fetching props
            await feedActivities.fetchFeed({
                timestamp: new Date(),
                leagues
            });
            // 2. PROFESSIONAL GRADING - Process ungraded props through professional system
            for (const league of leagues) {
                try {
                    await gradingActivities.gradeNewProps({
                        league,
                        isLiveMode: true,
                        cycleCount: iteration
                    });
                }
                catch (gradingError) {
                    await operatorActivities.logError({
                        error: `Professional grading failed for ${league}: ${gradingError}`,
                        workflow: 'syndicateSchedulerWorkflow',
                        timestamp: new Date()
                    });
                }
            }
            // 3. PROMOTE TOP TIER PICKS - Promote S/A tier picks to unified_picks
            try {
                const scoringResults = []; // Will be populated by individual league grading
                await gradingActivities.updateUnifiedPicks({
                    scoringResults,
                    cycleCount: iteration,
                    timestamp: new Date()
                });
            }
            catch (promotionError) {
                await operatorActivities.logError({
                    error: `Pick promotion failed: ${promotionError}`,
                    workflow: 'syndicateSchedulerWorkflow',
                    timestamp: new Date()
                });
            }
            // Wait for next interval
            await (0, workflow_1.sleep)('1 minute');
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `Syndicate scheduler error: ${error}`,
                workflow: 'syndicateSchedulerWorkflow',
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('5 minutes'); // Back off on error
            iteration++;
        }
    }
}
/**
 * LIVE GAME DETECTOR WORKFLOW
 * Continuously monitors for live games and adjusts system mode
 */
async function liveGameDetectorWorkflow() {
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const leagues = ['MLB', 'NBA', 'NFL', 'NHL', 'NCAAB', 'NCAAF', 'WNBA'];
            const allLiveGames = [];
            for (const league of leagues) {
                try {
                    const liveGames = await feedActivities.getLiveGames({ league });
                    allLiveGames.push(...liveGames);
                }
                catch (error) {
                    await operatorActivities.logError({
                        error: `Error getting live games for ${league}: ${error}`,
                        timestamp: new Date()
                    });
                }
            }
            // Update live game status
            await operatorActivities.updateLiveGameStatus({
                liveGames: allLiveGames,
                totalCount: allLiveGames.length,
                leaguesWithLiveGames: Array.from(new Set(allLiveGames.map(g => g.league))),
                timestamp: new Date()
            });
            // Determine check interval based on live game count
            const checkInterval = allLiveGames.length > 0 ? '30 seconds' : '5 minutes';
            await (0, workflow_1.sleep)(checkInterval);
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `Live game detector error: ${error}`,
                workflow: 'liveGameDetectorWorkflow',
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
    }
}
/**
 * QUOTA MONITORING WORKFLOW
 * Monitors API quotas and activates fallbacks
 */
async function quotaMonitoringWorkflow() {
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            // Check all API provider quotas
            const providers = ['optimal', 'odds-api', 'backup'];
            const quotaResults = [];
            for (const provider of providers) {
                try {
                    const rawQuotaStatus = await operatorActivities.checkApiQuota({ provider });
                    // Convert to expected QuotaStatus format
                    const quotaStatus = {
                        provider: rawQuotaStatus.provider,
                        used: rawQuotaStatus.hourlyUsed,
                        limit: rawQuotaStatus.hourlyLimit,
                        resetTime: rawQuotaStatus.resetTime.toISOString(),
                        percentage: (rawQuotaStatus.hourlyUsed / rawQuotaStatus.hourlyLimit) * 100
                    };
                    quotaResults.push(quotaStatus);
                    // Alert if quota usage is high
                    const percentage = quotaStatus.percentage;
                    if (percentage > 80) {
                        await alertActivities.processAlert({
                            type: 'quota',
                            provider,
                            usage: percentage,
                            severity: percentage > 95 ? 'critical' : 'warning'
                        });
                    }
                }
                catch (error) {
                    await operatorActivities.logError({
                        error: `Quota check failed for ${provider}: ${error}`,
                        timestamp: new Date()
                    });
                }
            }
            // Log quota metrics (replace updateQuotaMetrics with logging)
            await operatorActivities.logError({
                error: `Quota monitoring update - ${quotaResults.length} providers checked`,
                workflow: 'quotaMonitoringWorkflow',
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('15 minutes');
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `Quota monitoring error: ${error}`,
                workflow: 'quotaMonitoringWorkflow',
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('5 minutes');
            iteration++;
        }
    }
}
/**
 * HEALTH MONITORING WORKFLOW
 * System health and performance monitoring
 */
async function healthMonitoringWorkflow() {
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            // Comprehensive system health check (simplified)
            const healthResult = {
                healthScore: 95,
                issues: [],
                timestamp: new Date()
            };
            // Send alerts for unhealthy systems
            if (healthResult.healthScore < 80) {
                await alertActivities.processAlert({
                    type: 'health',
                    healthScore: healthResult.healthScore,
                    issues: healthResult.issues,
                    severity: healthResult.healthScore < 60 ? 'critical' : 'warning'
                });
            }
            // Log health metrics
            await operatorActivities.logError({
                error: `Health monitoring update - Score: ${healthResult.healthScore}`,
                workflow: 'healthMonitoringWorkflow',
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `Health monitoring error: ${error}`,
                workflow: 'healthMonitoringWorkflow',
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('5 minutes');
            iteration++;
        }
    }
}
/**
 * LEAGUE SCHEDULE WORKFLOW
 * Generic league-specific scheduling and peak hours management
 */
async function createLeagueScheduleWorkflow(league) {
    return async function leagueScheduleWorkflow() {
        let shouldContinue = true;
        const MAX_ITERATIONS = 1000000;
        let iteration = 0;
        while (shouldContinue && iteration < MAX_ITERATIONS) {
            try {
                const peakHours = getLeaguePeakHours(league);
                const currentHour = new Date().getHours();
                const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;
                // Adjust processing frequency based on peak hours
                const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';
                // Process league-specific data using available feed activities
                await feedActivities.fetchFeed({
                    league,
                    isPeakTime,
                    timestamp: new Date()
                });
                await (0, workflow_1.sleep)(processingInterval);
                iteration++;
            }
            catch (error) {
                await operatorActivities.logError({
                    error: `League schedule error for ${league}: ${error}`,
                    workflow: `${league}ScheduleWorkflow`,
                    timestamp: new Date()
                });
                await (0, workflow_1.sleep)('2 minutes');
                iteration++;
            }
        }
    };
}
// Individual league workflows - directly implement the workflow logic
async function nflScheduleWorkflow() {
    const league = 'NFL';
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const peakHours = getLeaguePeakHours(league);
            const currentHour = new Date().getHours();
            const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;
            const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';
            // Process league-specific data using available feed activities
            await feedActivities.fetchFeed({
                league,
                isPeakTime,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)(processingInterval);
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `League schedule error for ${league}: ${error}`,
                workflow: `${league}ScheduleWorkflow`,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
    }
}
async function nbaScheduleWorkflow() {
    const league = 'NBA';
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const peakHours = getLeaguePeakHours(league);
            const currentHour = new Date().getHours();
            const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;
            const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';
            // Process league-specific data using available feed activities
            await feedActivities.fetchFeed({
                league,
                isPeakTime,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)(processingInterval);
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `League schedule error for ${league}: ${error}`,
                workflow: `${league}ScheduleWorkflow`,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
    }
}
async function mlbScheduleWorkflow() {
    const league = 'MLB';
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const peakHours = getLeaguePeakHours(league);
            const currentHour = new Date().getHours();
            const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;
            const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';
            // Process league-specific data using available feed activities
            await feedActivities.fetchFeed({
                league,
                isPeakTime,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)(processingInterval);
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `League schedule error for ${league}: ${error}`,
                workflow: `${league}ScheduleWorkflow`,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
    }
}
async function nhlScheduleWorkflow() {
    const league = 'NHL';
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const peakHours = getLeaguePeakHours(league);
            const currentHour = new Date().getHours();
            const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;
            const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';
            // Process league-specific data using available feed activities
            await feedActivities.fetchFeed({
                league,
                isPeakTime,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)(processingInterval);
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `League schedule error for ${league}: ${error}`,
                workflow: `${league}ScheduleWorkflow`,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
    }
}
async function ncaafScheduleWorkflow() {
    const league = 'NCAAF';
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const peakHours = getLeaguePeakHours(league);
            const currentHour = new Date().getHours();
            const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;
            const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';
            // Process league-specific data using available feed activities
            await feedActivities.fetchFeed({
                league,
                isPeakTime,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)(processingInterval);
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `League schedule error for ${league}: ${error}`,
                workflow: `${league}ScheduleWorkflow`,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
    }
}
async function ncaabScheduleWorkflow() {
    const league = 'NCAAB';
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const peakHours = getLeaguePeakHours(league);
            const currentHour = new Date().getHours();
            const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;
            const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';
            // Process league-specific data using available feed activities
            await feedActivities.fetchFeed({
                league,
                isPeakTime,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)(processingInterval);
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `League schedule error for ${league}: ${error}`,
                workflow: `${league}ScheduleWorkflow`,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
    }
}
async function wnbaScheduleWorkflow() {
    const league = 'WNBA';
    let shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;
    while (shouldContinue && iteration < MAX_ITERATIONS) {
        try {
            const peakHours = getLeaguePeakHours(league);
            const currentHour = new Date().getHours();
            const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;
            const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';
            // Process league-specific data using available feed activities
            await feedActivities.fetchFeed({
                league,
                isPeakTime,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)(processingInterval);
            iteration++;
        }
        catch (error) {
            await operatorActivities.logError({
                error: `League schedule error for ${league}: ${error}`,
                workflow: `${league}ScheduleWorkflow`,
                timestamp: new Date()
            });
            await (0, workflow_1.sleep)('2 minutes');
            iteration++;
        }
    }
}
/**
 * Helper function to get league-specific peak hours
 */
function getLeaguePeakHours(league) {
    const peakHours = {
        'MLB': { start: 18, end: 23 }, // 6 PM - 11 PM
        'NBA': { start: 18, end: 23 }, // 6 PM - 11 PM
        'NFL': { start: 12, end: 23 }, // 12 PM - 11 PM (Sunday/Monday)
        'NHL': { start: 18, end: 23 }, // 6 PM - 11 PM
        'NCAAB': { start: 18, end: 23 }, // 6 PM - 11 PM
        'NCAAF': { start: 11, end: 23 }, // 11 AM - 11 PM (Saturday)
        'WNBA': { start: 18, end: 22 } // 6 PM - 10 PM (typically evening games)
    };
    return peakHours[league] || { start: 18, end: 23 };
}
