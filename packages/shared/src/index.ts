export const utils = 'shared-utils';

// Export date utilities
export * from './date-utils';
export { dateUtils } from './date-utils';

// Export autopilot freeze utilities
export {
  isAutopilotFrozen,
  isAutopilotFrozenAsync,
  getAutopilotState,
  getAutopilotStateAsync,
  setAutopilotState,
  isLaneFrozen,
  shouldAgentOperate,
  getFreezeReason,
  getFreezeDetails,
  clearCache,
  isRedisHealthy,
  disconnectRedis,
} from './autopilot-freeze';
export type { FreezeScope, AgentLane, AutopilotFreezeState } from './autopilot-freeze';
