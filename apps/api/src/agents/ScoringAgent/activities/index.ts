import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';

import { ScoringAgentActivitiesImpl } from './activities';

function createActivitiesImpl(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  return new ScoringAgentActivitiesImpl(config, deps);
}

// Export individual activity functions
export function scoreProp(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.scoreProp.bind(impl);
}

export function validateScore(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.validateScore.bind(impl);
}

export function monitorScoring(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.monitorScoring.bind(impl);
}

// Export base agent activities
export function initialize(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.initialize.bind(impl);
}

export function healthCheck(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.healthCheck.bind(impl);
}

export function validateDependencies(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.validateDependencies.bind(impl);
}


// Export all activities as a single object
export function createActivities(config: BaseAgentConfig, deps: BaseAgentDependencies) {
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
export async function gradeNewPropsActivity(params: {
  league: string;
  isLiveMode: boolean;
  cycleCount: number;
}): Promise<{
  league: string;
  topTierProps: any[];
  gradedCount: number;
}> {
  try {
    console.log(`[ScoringAgent] Processing gradeNewProps for ${params.league} (cycle: ${params.cycleCount})`);

    // Return a basic response for now - this will be properly implemented later
    return {
      league: params.league,
      topTierProps: [],
      gradedCount: 0
    };
  } catch (error) {
    console.error(`[ScoringAgent] Error in gradeNewPropsActivity:`, error);
    throw error;
  }
}

// Standalone activity function for Temporal worker registration
export async function scoreTopTierPicksActivity(params: {
  scoredProps: any[];
  league: string;
  cycleCount: number;
}): Promise<{
  league: string;
  scoredPicks: any[];
  scoreCount: number;
}> {
  try {
    console.log(`[ScoringAgent] Processing scoreTopTierPicks for ${params.league} (cycle: ${params.cycleCount})`);

    // Return a basic response for now - this will be properly implemented later
    return {
      league: params.league,
      scoredPicks: [],
      scoreCount: 0
    };
  } catch (error) {
    console.error(`[ScoringAgent] Error in scoreTopTierPicksActivity:`, error);
    throw error;
  }
}

// Standalone activity function for Temporal worker registration
export async function getNewUnifiedPicksActivity(params: {
  cycleCount: number;
}): Promise<any[]> {
  try {
    console.log(`[ScoringAgent] Processing getNewUnifiedPicks (cycle: ${params.cycleCount})`);

    // Return a basic response for now - this will be properly implemented later
    return [];
  } catch (error) {
    console.error(`[ScoringAgent] Error in getNewUnifiedPicksActivity:`, error);
    throw error;
  }
}

// Export with the exact names Temporal expects
export { gradeNewPropsActivity as gradeNewProps };
export { scoreTopTierPicksActivity as scoreTopTierPicks };
export { getNewUnifiedPicksActivity as getNewUnifiedPicks };