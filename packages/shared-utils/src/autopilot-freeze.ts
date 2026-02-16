/**
 * Autopilot Freeze State Reader
 *
 * Lightweight library for checking autopilot freeze state.
 * Used by agents to determine if operations should be skipped during CI incidents.
 *
 * Usage:
 *   import { isAutopilotFrozen, shouldAgentOperate } from '@shared-utils/autopilot-freeze';
 *
 *   if (isAutopilotFrozen()) {
 *     logger.info('Autopilot frozen, skipping risky operation');
 *     return;
 *   }
 *
 *   // Or check lane-specific freeze:
 *   if (!shouldAgentOperate('ScoringAgent')) {
 *     logger.info('ScoringAgent lane frozen, skipping');
 *     return;
 *   }
 *
 * @see docs/ops/AUTOPILOT_FREEZE_MATRIX.md
 * @see scripts/ops/set-autopilot-mode.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

export type FreezeScope = 'ALL' | 'DEPLOYMENTS' | 'AFFECTED_FLOW' | 'DATA_OPERATIONS';
export type AgentLane =
  | 'ScoringAgent'
  | 'SettlementAgent'
  | 'GradingAgent'
  | 'PublishingAgent';

export interface AutopilotFreezeState {
  frozen: boolean;
  scope: FreezeScope | null;
  reason: string | null;
  triggered_at: string | null;
  triggered_by: string | null;
  auto_unfreeze_at: string | null;
  incident_id: string | null;
  frozen_lanes: AgentLane[];
}

// =============================================================================
// Constants
// =============================================================================

// Resolve path relative to the project root
const findProjectRoot = (): string => {
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      // Check if this is the monorepo root (has workspaces)
      const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf-8'));
      if (pkg.workspaces) {
        return currentDir;
      }
    }
    currentDir = path.dirname(currentDir);
  }
  // Fallback to current directory
  return process.cwd();
};

const PROJECT_ROOT = findProjectRoot();
const STATE_FILE = path.join(PROJECT_ROOT, 'runtime_config', 'autopilot_state.json');

const DEFAULT_STATE: AutopilotFreezeState = {
  frozen: false,
  scope: null,
  reason: null,
  triggered_at: null,
  triggered_by: null,
  auto_unfreeze_at: null,
  incident_id: null,
  frozen_lanes: [],
};

// Cache for state to avoid frequent file reads
let cachedState: AutopilotFreezeState | null = null;
let lastReadTime = 0;
const CACHE_TTL_MS = 5000; // 5 seconds

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Read the current autopilot freeze state from disk.
 * Cached for 5 seconds to avoid excessive file reads.
 */
export function getAutopilotState(): AutopilotFreezeState {
  const now = Date.now();

  // Return cached state if still valid
  if (cachedState && now - lastReadTime < CACHE_TTL_MS) {
    return cachedState;
  }

  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      const state: AutopilotFreezeState = { ...DEFAULT_STATE, ...parsed };
      cachedState = state;
      lastReadTime = now;
      return state;
    }
  } catch {
    // Silently fall back to default state
  }

  cachedState = { ...DEFAULT_STATE };
  lastReadTime = now;
  return cachedState;
}

/**
 * Check if autopilot is currently frozen (global check).
 */
export function isAutopilotFrozen(): boolean {
  const state = getAutopilotState();

  // Check if frozen and not expired
  if (state.frozen) {
    // Check auto-unfreeze time
    if (state.auto_unfreeze_at) {
      const unfreezeTime = new Date(state.auto_unfreeze_at).getTime();
      if (Date.now() > unfreezeTime) {
        // Expired - consider unfrozen
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Check if a specific agent lane is frozen.
 */
export function isLaneFrozen(lane: AgentLane): boolean {
  const state = getAutopilotState();

  // If globally frozen with scope ALL, all lanes are frozen
  if (state.frozen && state.scope === 'ALL') {
    return true;
  }

  // Check lane-specific freeze
  if (state.frozen_lanes && state.frozen_lanes.includes(lane)) {
    return true;
  }

  return false;
}

/**
 * Determine if an agent should operate based on freeze state.
 * Returns true if the agent should proceed, false if it should skip.
 *
 * @param agentLane - The agent lane to check (optional for global check)
 * @param operationType - Type of operation for scope-based checks (optional)
 */
export function shouldAgentOperate(
  agentLane?: AgentLane,
  operationType?: 'deployment' | 'data' | 'workflow'
): boolean {
  const state = getAutopilotState();

  // Not frozen - proceed
  if (!state.frozen) {
    return true;
  }

  // Check auto-unfreeze expiry
  if (state.auto_unfreeze_at) {
    const unfreezeTime = new Date(state.auto_unfreeze_at).getTime();
    if (Date.now() > unfreezeTime) {
      return true;
    }
  }

  // Check scope-based operation type
  if (operationType && state.scope) {
    switch (state.scope) {
      case 'DEPLOYMENTS':
        // Only block deployment operations
        return operationType !== 'deployment';
      case 'DATA_OPERATIONS':
        // Only block data operations
        return operationType !== 'data';
      case 'AFFECTED_FLOW':
        // Check lane-specific
        if (agentLane && state.frozen_lanes?.includes(agentLane)) {
          return false;
        }
        return true;
      case 'ALL':
        // Block everything
        return false;
    }
  }

  // Lane-specific check
  if (agentLane) {
    // If scope is ALL, all lanes are blocked
    if (state.scope === 'ALL') {
      return false;
    }

    // Check if this specific lane is frozen
    if (state.frozen_lanes?.includes(agentLane)) {
      return false;
    }

    // Not in frozen lanes list, can proceed
    return true;
  }

  // Global freeze, no lane specified - block by default
  return false;
}

/**
 * Get the freeze reason for logging/debugging purposes.
 */
export function getFreezeReason(): string | null {
  const state = getAutopilotState();
  return state.reason;
}

/**
 * Get full freeze state for detailed logging.
 * Use sparingly as it reads the full state.
 */
export function getFreezeDetails(): {
  frozen: boolean;
  scope: FreezeScope | null;
  reason: string | null;
  triggeredAt: string | null;
  triggeredBy: string | null;
  incidentId: string | null;
  frozenLanes: AgentLane[];
} {
  const state = getAutopilotState();
  return {
    frozen: state.frozen,
    scope: state.scope,
    reason: state.reason,
    triggeredAt: state.triggered_at,
    triggeredBy: state.triggered_by,
    incidentId: state.incident_id,
    frozenLanes: state.frozen_lanes || [],
  };
}

/**
 * Clear the cache to force a fresh read on next access.
 * Useful for testing or when the state file is known to have changed.
 */
export function clearCache(): void {
  cachedState = null;
  lastReadTime = 0;
}
