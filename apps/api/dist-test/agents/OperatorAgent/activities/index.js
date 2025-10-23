"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorSystem = monitorSystem;
exports.handleAlert = handleAlert;
exports.performMaintenance = performMaintenance;
exports.handleCriticalError = handleCriticalError;
exports.updateLiveGameStatus = updateLiveGameStatus;
exports.logUSPError = logUSPError;
const __1 = require("..");
// Mock dependencies for activities
const getDependencies = () => {
    // This would be properly injected in production
    return {
        supabase: null,
        logger: console,
        errorHandler: null
    };
};
async function monitorSystem() {
    const agent = __1.OperatorAgent.getInstance(getDependencies());
    await agent.monitorAgents();
}
async function handleAlert(alert) {
    const agent = __1.OperatorAgent.getInstance(getDependencies());
    await agent.handleCommand(`handle alert: ${JSON.stringify(alert)}`);
}
async function performMaintenance() {
    const agent = __1.OperatorAgent.getInstance(getDependencies());
    await agent.generateSummary('daily');
    await agent.learnAndEvolve();
}
async function handleCriticalError(params) {
    const agent = __1.OperatorAgent.getInstance(getDependencies());
    try {
        console.log(`[OperatorAgent] Handling critical error from ${params.agentId}: ${params.errorMessage}`);
        // Handle the critical error - could involve alerts, notifications, etc.
        await agent.handleCommand(`critical error: ${params.errorMessage}`);
        return {
            success: true,
            message: `Critical error handled successfully for agent ${params.agentId}`
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[OperatorAgent] Failed to handle critical error:`, errorMessage);
        return {
            success: false,
            message: `Failed to handle critical error: ${errorMessage}`
        };
    }
}
async function updateLiveGameStatus(params) {
    const agent = __1.OperatorAgent.getInstance(getDependencies());
    try {
        console.log(`[OperatorAgent] Updating live game status: ${params.totalCount} live games across leagues: ${params.leaguesWithLiveGames.join(', ')}`);
        // Process live game status updates
        await agent.handleCommand(`update live games: ${JSON.stringify(params)}`);
        return {
            success: true,
            message: `Live game status updated for ${params.totalCount} games`,
            data: {
                liveGames: params.liveGames,
                totalCount: params.totalCount,
                leagues: params.leaguesWithLiveGames,
                timestamp: params.timestamp || new Date().toISOString()
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[OperatorAgent] Failed to update live game status:`, errorMessage);
        return {
            success: false,
            message: `Failed to update live game status: ${errorMessage}`
        };
    }
}
async function logUSPError(params) {
    const agent = __1.OperatorAgent.getInstance(getDependencies());
    try {
        console.log(`[OperatorAgent] Logging USP error (${params.uspType}): ${params.error} - Cycle: ${params.cycleCount || 'unknown'}`);
        // Log USP (United Syndicate Protocol) error for monitoring
        await agent.handleCommand(`USP error logged: type=${params.uspType}, error=${params.error}, cycle=${params.cycleCount}`);
        return {
            success: true,
            message: `USP error logged successfully (type: ${params.uspType})`
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[OperatorAgent] Failed to log USP error:`, errorMessage);
        return {
            success: false,
            message: `Failed to log USP error: ${errorMessage}`
        };
    }
}
