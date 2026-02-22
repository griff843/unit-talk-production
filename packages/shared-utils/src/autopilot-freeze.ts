/* eslint-disable max-lines */
/* eslint-disable complexity */
/**
 * Autopilot Freeze State Manager
 * SPRINT-TRUTH-RESTORATION-001: Redis-backed distributed state
 *
 * Lightweight library for checking autopilot freeze state.
 * Used by agents to determine if operations should be skipped during CI incidents.
 *
 * INVARIANT #2: Fail-closed - Redis errors in production cause freeze (safe default)
 * INVARIANT #4: No demo mode fallbacks without explicit flag
 *
 * Storage Priority:
 * 1. Redis (distributed, production) - requires REDIS_URL
 * 2. File-based (local dev only) - requires isLocalFileStateEnabled()=true
 * 3. Fail-closed (default) - no state = frozen to be safe
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

import Redis from 'ioredis';

// =============================================================================
// Types
// =============================================================================

export type FreezeScope = 'ALL' | 'DEPLOYMENTS' | 'AFFECTED_FLOW' | 'DATA_OPERATIONS';
export type AgentLane = 'ScoringAgent' | 'SettlementAgent' | 'GradingAgent' | 'PublishingAgent';

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

const REDIS_KEY = 'autopilot:freeze:state';
const CACHE_TTL_MS = 5000; // 5 seconds

// SPRINT-ARCHITECTURE-HARDENING-002A: Lazy env access (no module-scope)
function getRedisUrl(): string | undefined {
  return process.env['REDIS_URL'];
}
function isLocalFileStateEnabled(): boolean {
  return process.env['isLocalFileStateEnabled()'] === 'true';
}

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

// Fail-closed state: If we can't read state, assume frozen for safety
const FAIL_CLOSED_STATE: AutopilotFreezeState = {
  frozen: true,
  scope: 'ALL',
  reason: 'FAIL-CLOSED: Unable to read autopilot state',
  triggered_at: new Date().toISOString(),
  triggered_by: 'SYSTEM_FAIL_CLOSED',
  auto_unfreeze_at: null,
  incident_id: null,
  frozen_lanes: ['ScoringAgent', 'SettlementAgent', 'GradingAgent', 'PublishingAgent'],
};

// =============================================================================
// Redis Client (Lazy Initialization)
// =============================================================================

let redisClient: Redis | null = null;
let redisInitialized = false;
let redisError: Error | null = null;

function getRedisClient(): Redis | null {
  if (redisInitialized) {
    return redisClient;
  }

  redisInitialized = true;

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    console.warn('[AUTOPILOT] No REDIS_URL configured - Redis not available');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on('error', err => {
      console.error('[AUTOPILOT] Redis connection error:', err.message);
      redisError = err;
    });

    redisClient.on('connect', () => {
      console.log('[AUTOPILOT] Redis connected successfully');
      redisError = null;
    });

    return redisClient;
  } catch (err) {
    console.error('[AUTOPILOT] Failed to initialize Redis client:', err);
    redisError = err as Error;
    return null;
  }
}

// =============================================================================
// File-based Fallback (Local Development Only)
// =============================================================================

const findProjectRoot = (): string => {
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf-8'));
      if (pkg.workspaces) {
        return currentDir;
      }
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd();
};

const PROJECT_ROOT = findProjectRoot();
const STATE_FILE = path.join(PROJECT_ROOT, 'runtime_config', 'autopilot_state.json');

function readFileState(): AutopilotFreezeState | null {
  if (!isLocalFileStateEnabled()) {
    return null;
  }

  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch (err) {
    console.error('[AUTOPILOT] Failed to read file state:', err);
  }

  return null;
}

// =============================================================================
// Cache Layer
// =============================================================================

let cachedState: AutopilotFreezeState | null = null;
let lastReadTime = 0;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Read the current autopilot freeze state.
 * Priority: Redis -> File (if isLocalFileStateEnabled()=true) -> Fail-closed
 * Cached for 5 seconds to avoid excessive reads.
 */
export async function getAutopilotStateAsync(): Promise<AutopilotFreezeState> {
  const now = Date.now();

  // Return cached state if still valid
  if (cachedState && now - lastReadTime < CACHE_TTL_MS) {
    return cachedState;
  }

  // Try Redis first
  const redis = getRedisClient();
  if (redis && !redisError) {
    try {
      const data = await redis.get(REDIS_KEY);
      if (data) {
        const state = { ...DEFAULT_STATE, ...JSON.parse(data) };
        cachedState = state;
        lastReadTime = now;
        return state;
      }
      // No data in Redis = not frozen
      cachedState = { ...DEFAULT_STATE };
      lastReadTime = now;
      return cachedState;
    } catch (err) {
      console.error('[AUTOPILOT] Redis read failed:', err);
      // Fall through to fallbacks
    }
  }

  // Try file-based fallback (local dev only)
  const fileState = readFileState();
  if (fileState) {
    cachedState = fileState;
    lastReadTime = now;
    return fileState;
  }

  // FAIL-CLOSED: No state source available in production = assume frozen
  if (getRedisUrl() && !isLocalFileStateEnabled()) {
    console.error('[AUTOPILOT] FAIL-CLOSED: Cannot read state - defaulting to frozen');
    cachedState = FAIL_CLOSED_STATE;
    lastReadTime = now;
    return FAIL_CLOSED_STATE;
  }

  // Local dev without Redis and without file = default unfrozen
  cachedState = { ...DEFAULT_STATE };
  lastReadTime = now;
  return cachedState;
}

/**
 * Synchronous version for backwards compatibility.
 * Uses cached state only - may be stale.
 */
export function getAutopilotState(): AutopilotFreezeState {
  // If we have cached state, return it
  if (cachedState) {
    // Trigger async refresh in background if cache is stale
    if (Date.now() - lastReadTime >= CACHE_TTL_MS) {
      getAutopilotStateAsync().catch(() => {});
    }
    return cachedState;
  }

  // Try file-based fallback for sync access
  const fileState = readFileState();
  if (fileState) {
    cachedState = fileState;
    lastReadTime = Date.now();
    return fileState;
  }

  // No cached state available - trigger async read and return safe default
  getAutopilotStateAsync().catch(() => {});

  // FAIL-CLOSED for production, DEFAULT for local dev
  if (getRedisUrl() && !isLocalFileStateEnabled()) {
    return FAIL_CLOSED_STATE;
  }
  return { ...DEFAULT_STATE };
}

/**
 * Set the autopilot freeze state.
 * Writes to Redis (preferred) or file (local dev fallback).
 */
export async function setAutopilotState(state: Partial<AutopilotFreezeState>): Promise<void> {
  const newState: AutopilotFreezeState = { ...DEFAULT_STATE, ...state };

  // Clear cache
  cachedState = null;
  lastReadTime = 0;

  // Try Redis first
  const redis = getRedisClient();
  if (redis && !redisError) {
    try {
      await redis.set(REDIS_KEY, JSON.stringify(newState));
      console.log('[AUTOPILOT] State written to Redis');
      cachedState = newState;
      lastReadTime = Date.now();
      return;
    } catch (err) {
      console.error('[AUTOPILOT] Redis write failed:', err);
      // Fall through to file fallback if allowed
    }
  }

  // File-based fallback (local dev only)
  if (isLocalFileStateEnabled()) {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
      console.log('[AUTOPILOT] State written to file');
      cachedState = newState;
      lastReadTime = Date.now();
      return;
    } catch (err) {
      console.error('[AUTOPILOT] File write failed:', err);
    }
  }

  throw new Error('FAIL-CLOSED: Unable to write autopilot state');
}

/**
 * Check if autopilot is currently frozen (global check).
 */
export function isAutopilotFrozen(): boolean {
  const state = getAutopilotState();

  if (state.frozen) {
    // Check auto-unfreeze time
    if (state.auto_unfreeze_at) {
      const unfreezeTime = new Date(state.auto_unfreeze_at).getTime();
      if (Date.now() > unfreezeTime) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Async version of isAutopilotFrozen for fresh state.
 */
export async function isAutopilotFrozenAsync(): Promise<boolean> {
  const state = await getAutopilotStateAsync();

  if (state.frozen) {
    if (state.auto_unfreeze_at) {
      const unfreezeTime = new Date(state.auto_unfreeze_at).getTime();
      if (Date.now() > unfreezeTime) {
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
        return operationType !== 'deployment';
      case 'DATA_OPERATIONS':
        return operationType !== 'data';
      case 'AFFECTED_FLOW':
        if (agentLane && state.frozen_lanes?.includes(agentLane)) {
          return false;
        }
        return true;
      case 'ALL':
        return false;
    }
  }

  // Lane-specific check
  if (agentLane) {
    if (state.scope === 'ALL') {
      return false;
    }
    if (state.frozen_lanes?.includes(agentLane)) {
      return false;
    }
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
 */
export function getFreezeDetails(): {
  frozen: boolean;
  scope: FreezeScope | null;
  reason: string | null;
  triggeredAt: string | null;
  triggeredBy: string | null;
  incidentId: string | null;
  frozenLanes: AgentLane[];
  source: 'redis' | 'file' | 'fail-closed' | 'default';
} {
  const state = getAutopilotState();
  const source =
    getRedisUrl() && !redisError
      ? 'redis'
      : isLocalFileStateEnabled()
        ? 'file'
        : state.frozen && state.reason?.includes('FAIL-CLOSED')
          ? 'fail-closed'
          : 'default';
  return {
    frozen: state.frozen,
    scope: state.scope,
    reason: state.reason,
    triggeredAt: state.triggered_at,
    triggeredBy: state.triggered_by,
    incidentId: state.incident_id,
    frozenLanes: state.frozen_lanes || [],
    source,
  };
}

/**
 * Clear the cache to force a fresh read on next access.
 */
export function clearCache(): void {
  cachedState = null;
  lastReadTime = 0;
}

/**
 * Check if Redis is connected and healthy.
 */
export async function isRedisHealthy(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Disconnect Redis client (for cleanup).
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisInitialized = false;
    redisError = null;
  }
}
