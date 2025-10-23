"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.e2ePropsWorkflow = e2ePropsWorkflow;
exports.liveGameMonitoringWorkflow = liveGameMonitoringWorkflow;
exports.apiQuotaMonitoringWorkflow = apiQuotaMonitoringWorkflow;
const workflow_1 = require("@temporalio/workflow");
// Create activity proxies with optimized timeouts for E2E testing
const ingestionActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '90 seconds' // Must complete within 2-min cycle
});
const processingActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '60 seconds' // Fast processing for syndicate speed
});
const alertActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds' // Alerts must be is_instant
});
const operatorActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds' // System monitoring must be fast
});
/**
 * MAIN E2E PROP PROCESSING WORKFLOW
 * Handles the complete prop lifecycle from ingestion to alerts
 */
async function e2ePropsWorkflow(params) {
    const startTime = Date.now();
    const workflowName = 'e2ePropsWorkflow';
    workflow_1.log.info(`🚀 Starting E2E Props Workflow - Cycle ${params.cycleCount}`, {
        leagues: params.leagues,
        cycleCount: params.cycleCount,
        isLiveMode: params.isLiveMode
    });
    const summary = {
        cycleCount: params.cycleCount,
        leagues: params.leagues,
        totalPropsIngested: 0,
        totalPropsScored: 0,
        totalPropsPromoted: 0,
        uspResults: [],
        errors: [],
        duration: 0
    };
    try {
        // Step 1: System Health Check
        const healthCheck = await operatorActivities.checkSystemHealth({
            timestamp: new Date().toISOString(),
            components: ['database', 'temporal', 'discord', 'apis']
        });
        if (!healthCheck.success) {
            summary.errors.push(...(healthCheck.issues || []));
            await alertActivities.sendOperatorAlert({
                timestamp: new Date().toISOString(),
                type: 'error',
                message: `Health check failed: ${(healthCheck.issues || []).join(', ')}`,
                metadata: {
                    cycleCount: params.cycleCount,
                    healthScore: healthCheck.healthScore || 0
                }
            });
        }
        // Step 2: Games Ingestion Phase
        workflow_1.log.info(`🎮 Starting games ingestion phase for ${params.leagues.length} leagues`);
        try {
            const gamesResult = await ingestionActivities.ingestOptimalGames({
                timestamp: new Date().toISOString(),
                leagues: params.leagues,
                isLiveMode: params.isLiveMode,
                cycleCount: params.cycleCount
            });
            if (gamesResult.success) {
                workflow_1.log.info(`✅ Games ingestion successful: ${gamesResult.gamesIngested} games processed`);
            }
            else {
                workflow_1.log.warn(`⚠️ Games ingestion had errors: ${gamesResult.errors.join(', ')}`);
                summary.errors.push(...gamesResult.errors);
            }
        }
        catch (gamesError) {
            const errorMessage = `Games ingestion failed: ${gamesError}`;
            workflow_1.log.error(errorMessage);
            summary.errors.push(errorMessage);
        }
        // Step 3: Props Ingestion Phase
        workflow_1.log.info(`📥 Starting props ingestion phase for ${params.leagues.length} leagues`);
        for (const league of params.leagues) {
            try {
                // Ingest from Optimal
                const optimalResult = await ingestionActivities.ingestOptimalProps({
                    timestamp: new Date().toISOString(),
                    league,
                    isLiveMode: params.isLiveMode,
                    cycleCount: params.cycleCount
                });
                if (optimalResult.success) {
                    summary.totalPropsIngested += optimalResult.propsIngested || 0;
                    workflow_1.log.info(`✅ Optimal ingestion complete for ${league}: ${optimalResult.propsIngested || 0} props`);
                }
                else {
                    summary.errors.push(...(optimalResult.errors || []));
                    await operatorActivities.logUSPError({
                        timestamp: new Date().toISOString(),
                        uspType: 'ingestion_optimal',
                        errorMessage: (optimalResult.errors || []).join(', '),
                        cycleCount: params.cycleCount
                    });
                }
                // Ingest from SGO (fallback)
                const sgoResult = await ingestionActivities.ingestSGOProps({
                    timestamp: new Date().toISOString(),
                    league,
                    isLiveMode: params.isLiveMode,
                    cycleCount: params.cycleCount
                });
                if (sgoResult.success) {
                    summary.totalPropsIngested += sgoResult.propsIngested || 0;
                    workflow_1.log.info(`✅ SGO ingestion complete for ${league}: ${sgoResult.propsIngested || 0} props`);
                }
                else {
                    const sgoError = sgoResult.error || 'Unknown error';
                    summary.errors.push(typeof sgoError === 'string' ? sgoError : String(sgoError));
                    await operatorActivities.logUSPError({
                        timestamp: new Date().toISOString(),
                        uspType: 'ingestion_sgo',
                        errorMessage: sgoResult.error || 'Unknown error',
                        cycleCount: params.cycleCount
                    });
                }
                // Validate ingestion data
                const validationResult = await ingestionActivities.validateIngestionData({
                    timestamp: new Date().toISOString(),
                    league,
                    expectedMinProps: 10
                });
                if (!validationResult.isValid) {
                    summary.errors.push(...(validationResult.issues || []));
                    await alertActivities.sendOperatorAlert({
                        timestamp: new Date().toISOString(),
                        type: 'error',
                        message: `Ingestion validation failed for ${league}: ${(validationResult.issues || []).join(', ')}`,
                        metadata: {
                            league,
                            actualCount: validationResult.actualCount || 0
                        }
                    });
                }
            }
            catch (leagueError) {
                const errorMsg = `Ingestion failed for ${league}: ${leagueError}`;
                summary.errors.push(errorMsg);
                await operatorActivities.logUSPError({
                    timestamp: new Date().toISOString(),
                    uspType: 'ingestion_league',
                    errorMessage: errorMsg,
                    cycleCount: params.cycleCount
                });
            }
        }
        // Step 3: Processing Phase
        workflow_1.log.info(`⚡ Starting processing phase`);
        // USP Detection
        const uspResult = await processingActivities.processUSPDetection({
            timestamp: new Date().toISOString(),
            leagues: params.leagues,
            cycleCount: params.cycleCount
        });
        if (uspResult.success) {
            summary.uspResults = uspResult.uspResults || [];
            workflow_1.log.info(`✅ USP detection complete: ${uspResult.uspResults?.length || 0} types processed`);
        }
        else {
            const uspError = uspResult.error || 'USP detection failed';
            summary.errors.push(typeof uspError === 'string' ? uspError : String(uspError));
            await operatorActivities.logUSPError({
                timestamp: new Date().toISOString(),
                uspType: 'usp_detection',
                errorMessage: uspResult.error || 'USP detection failed',
                cycleCount: params.cycleCount
            });
        }
        // Scoring and Grading
        const scoringResult = await processingActivities.scoreAndGradeProps({
            timestamp: new Date().toISOString(),
            leagues: params.leagues,
            cycleCount: params.cycleCount
        });
        if (scoringResult.success) {
            summary.totalPropsScored = scoringResult.propsScored;
            summary.totalPropsPromoted = scoringResult.propsPromoted;
            workflow_1.log.info(`✅ Scoring complete: ${scoringResult.propsScored} scored, ${scoringResult.propsPromoted} promoted`);
        }
        else {
            summary.errors.push(scoringResult.error || 'Scoring and grading failed');
            await operatorActivities.logUSPError({
                timestamp: new Date().toISOString(),
                uspType: 'scoring_grading',
                errorMessage: scoringResult.error || 'Scoring and grading failed',
                cycleCount: params.cycleCount
            });
        }
        // Step 4: Alert Phase
        if (summary.totalPropsPromoted > 0) {
            workflow_1.log.info(`📢 Sending approved picks alert`);
            // Mock picks data for alert
            const mockPicks = Array.from({ length: summary.totalPropsPromoted }, (_, i) => ({
                id: `pick-${i}`,
                player_name: `Player ${i + 1}`,
                team: `Team ${i % 4 + 1}`,
                stat_type: ['points', 'rebounds', 'assists'][i % 3],
                line: 20 + (i % 10),
                tier: i % 2 === 0 ? 'S' : 'A'
            }));
            const alertResult = await alertActivities.sendApprovedPicksAlert({
                timestamp: new Date().toISOString(),
                picks: mockPicks,
                cycleCount: params.cycleCount,
                totalPicks: summary.totalPropsScored
            });
            if (!alertResult.success) {
                summary.errors.push(`Alert failed: ${alertResult.error || 'Unknown error'}`);
            }
        }
        // Step 5: Workflow Completion
        const duration = Date.now() - startTime;
        summary.duration = duration;
        await operatorActivities.logWorkflowMetrics({
            timestamp: new Date().toISOString(),
            workflowName,
            duration,
            success: summary.errors.length === 0,
            cycleCount: params.cycleCount,
            metadata: {
                propsIngested: summary.totalPropsIngested,
                propsPromoted: summary.totalPropsPromoted,
                leagues: params.leagues.length
            }
        });
        workflow_1.log.info(`🏁 E2E Props Workflow Complete - Cycle ${params.cycleCount}`, {
            duration: Math.round(duration / 1000),
            success: summary.errors.length === 0,
            propsIngested: summary.totalPropsIngested,
            propsPromoted: summary.totalPropsPromoted,
            errors: summary.errors.length
        });
        return {
            success: summary.errors.length === 0,
            summary
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        summary.duration = duration;
        summary.errors.push(String(error));
        await alertActivities.sendWorkflowFailure({
            timestamp: new Date().toISOString(),
            workflowName,
            errorMessage: String(error),
            cycleCount: params.cycleCount
        });
        await operatorActivities.logWorkflowMetrics({
            timestamp: new Date().toISOString(),
            workflowName,
            duration,
            success: false,
            cycleCount: params.cycleCount,
            metadata: { error: String(error) }
        });
        workflow_1.log.error(`❌ E2E Props Workflow Failed - Cycle ${params.cycleCount}:`, { error: String(error) });
        return {
            success: false,
            summary
        };
    }
}
/**
 * LIVE GAME MONITORING WORKFLOW
 * Monitors for live games and triggers appropriate responses
 */
async function liveGameMonitoringWorkflow(params) {
    workflow_1.log.info(`🎮 Starting Live Game Monitoring - Cycle ${params.cycleCount}`, {
        leagues: params.leagues,
        cycleCount: params.cycleCount
    });
    try {
        const liveGameResult = await operatorActivities.detectLiveGames({
            timestamp: new Date().toISOString(),
            leagues: params.leagues
        });
        if (liveGameResult.success && liveGameResult.liveGames?.length > 0) {
            await alertActivities.sendOperatorAlert({
                timestamp: new Date().toISOString(),
                type: 'info',
                message: `Live games detected: ${liveGameResult.liveGames?.length || 0} games in progress`,
                metadata: {
                    liveGames: liveGameResult.liveGames?.length || 0,
                    leagues: params.leagues,
                    cycleCount: params.cycleCount
                }
            });
        }
        return {
            success: liveGameResult.success || false,
            liveGames: liveGameResult.liveGames || []
        };
    }
    catch (error) {
        workflow_1.log.error(`❌ Live Game Monitoring Failed:`, { err: String(error) });
        await alertActivities.sendOperatorAlert({
            timestamp: new Date().toISOString(),
            type: 'error',
            message: `Live game monitoring failed: ${error}`,
            metadata: { cycleCount: params.cycleCount }
        });
        return {
            success: false,
            liveGames: []
        };
    }
}
/**
 * API QUOTA MONITORING WORKFLOW
 * Monitors API usage and triggers fallbacks when needed
 */
async function apiQuotaMonitoringWorkflow(params) {
    workflow_1.log.info(`📊 Starting API Quota Monitoring - Cycle ${params.cycleCount}`, {
        providers: params.providers,
        cycleCount: params.cycleCount
    });
    const quotaStatus = [];
    try {
        for (const provider of params.providers) {
            // Mock quota check - replace with actual implementation
            const mockUsage = Math.floor(Math.random() * 1000);
            const mockLimit = 1000;
            const quotaResult = await operatorActivities.monitorAPIQuota({
                timestamp: new Date().toISOString(),
                provider,
                currentUsage: mockUsage,
                limit: mockLimit
            });
            quotaStatus.push({
                provider,
                usage: mockUsage,
                limit: mockLimit,
                percentage: quotaResult.percentage || 0,
                shouldFallback: quotaResult.shouldFallback || false
            });
            if (quotaResult.shouldFallback) {
                await alertActivities.sendFallbackTrigger({
                    timestamp: new Date().toISOString(),
                    primaryProvider: provider,
                    fallbackProvider: 'SGO',
                    reason: `Quota exceeded: ${quotaResult.percentage || 0}%`
                });
            }
        }
        return {
            success: true,
            quotaStatus
        };
    }
    catch (error) {
        workflow_1.log.error(`❌ API Quota Monitoring Failed:`, { err: String(error) });
        await alertActivities.sendOperatorAlert({
            timestamp: new Date().toISOString(),
            type: 'error',
            message: `API quota monitoring failed: ${error}`,
            metadata: { cycleCount: params.cycleCount }
        });
        return {
            success: false,
            quotaStatus
        };
    }
}
//# sourceMappingURL=e2e-props.workflow.js.map