"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreProp = scoreProp;
exports.validateScore = validateScore;
exports.monitorScoring = monitorScoring;
exports.initialize = initialize;
exports.healthCheck = healthCheck;
exports.validateDependencies = validateDependencies;
exports.createActivities = createActivities;
exports.gradeNewPropsActivity = gradeNewPropsActivity;
exports.gradeNewProps = gradeNewPropsActivity;
exports.scoreTopTierPicksActivity = scoreTopTierPicksActivity;
exports.scoreTopTierPicks = scoreTopTierPicksActivity;
exports.getNewUnifiedPicksActivity = getNewUnifiedPicksActivity;
exports.getNewUnifiedPicks = getNewUnifiedPicksActivity;
const activities_1 = require("./activities");
function createActivitiesImpl(config, deps) {
    return new activities_1.ScoringAgentActivitiesImpl(config, deps);
}
// Export individual activity functions
function scoreProp(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.scoreProp.bind(impl);
}
function validateScore(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.validateScore.bind(impl);
}
function monitorScoring(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.monitorScoring.bind(impl);
}
// Export base agent activities
function initialize(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.initialize.bind(impl);
}
function healthCheck(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.healthCheck.bind(impl);
}
function validateDependencies(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return impl.validateDependencies.bind(impl);
}
// Export all activities as a single object
function createActivities(config, deps) {
    const impl = createActivitiesImpl(config, deps);
    return {
        scoreProp: impl.scoreProp.bind(impl),
        validateScore: impl.validateScore.bind(impl),
        monitorScoring: impl.monitorScoring.bind(impl),
        gradeNewProps: impl.gradeNewProps.bind(impl),
        initialize: impl.initialize.bind(impl),
        healthCheck: impl.healthCheck.bind(impl),
        validateDependencies: impl.validateDependencies.bind(impl)
    };
}
// Standalone activity function for Temporal worker registration
async function gradeNewPropsActivity(params) {
    try {
        console.log(`[ScoringAgent] Processing gradeNewProps for ${params.league} (cycle: ${params.cycleCount})`);
        // Return a basic response for now - this will be properly implemented later
        return {
            league: params.league,
            topTierProps: [],
            gradedCount: 0
        };
    }
    catch (error) {
        console.error(`[ScoringAgent] Error in gradeNewPropsActivity:`, error);
        throw error;
    }
}
// Standalone activity function for Temporal worker registration
async function scoreTopTierPicksActivity(params) {
    try {
        console.log(`[ScoringAgent] Processing scoreTopTierPicks for ${params.league} (cycle: ${params.cycleCount})`);
        // Return a basic response for now - this will be properly implemented later
        return {
            league: params.league,
            scoredPicks: [],
            scoreCount: 0
        };
    }
    catch (error) {
        console.error(`[ScoringAgent] Error in scoreTopTierPicksActivity:`, error);
        throw error;
    }
}
// Standalone activity function for Temporal worker registration
async function getNewUnifiedPicksActivity(params) {
    try {
        console.log(`[ScoringAgent] Processing getNewUnifiedPicks (cycle: ${params.cycleCount})`);
        // Return a basic response for now - this will be properly implemented later
        return [];
    }
    catch (error) {
        console.error(`[ScoringAgent] Error in getNewUnifiedPicksActivity:`, error);
        throw error;
    }
}
