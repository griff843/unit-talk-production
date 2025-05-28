import { Provider } from './types';
import { RedisClient } from '../../utils/redis';

interface CheckStateInput {
  provider: Provider;
  interval: number;
  force?: boolean;
}

interface CheckStateResult {
  shouldPull: boolean;
  lastPull?: string;
  reason: string;
}

export async function checkIngestionState(
  input: CheckStateInput,
  redis: RedisClient
): Promise<CheckStateResult> {
  const { provider, interval, force } = input;
  
  // Force pull if requested
  if (force) {
    return {
      shouldPull: true,
      reason: 'Force pull requested'
    };
  }

  // Check Redis for last pull timestamp
  const cacheKey = `feed:lastPull:${provider}`;
  const lastPull = await redis.get(cacheKey);

  if (!lastPull) {
    return {
      shouldPull: true,
      reason: 'No previous pull found'
    };
  }

  const lastPullTime = new Date(lastPull).getTime();
  const now = Date.now();
  const timeSinceLastPull = now - lastPullTime;

  // Check if enough time has elapsed since last pull
  if (timeSinceLastPull >= interval * 60 * 1000) {
    return {
      shouldPull: true,
      lastPull,
      reason: `Interval elapsed (${Math.floor(timeSinceLastPull / (60 * 1000))} minutes since last pull)`
    };
  }

  // Check if data is stale (75% of interval passed)
  const staleThreshold = interval * 60 * 1000 * 0.75;
  if (timeSinceLastPull >= staleThreshold) {
    return {
      shouldPull: true,
      lastPull,
      reason: 'Data approaching staleness threshold'
    };
  }

  return {
    shouldPull: false,
    lastPull,
    reason: `Too soon to pull (${Math.floor(timeSinceLastPull / (60 * 1000))} minutes since last pull)`
  };
}

// Activity wrapper
export const checkIngestionStateActivity = async (
  input: CheckStateInput
): Promise<CheckStateResult> => {
  const redis = new RedisClient(); // Connection details from env
  try {
    return await checkIngestionState(input, redis);
  } finally {
    await redis.disconnect();
  }
}; 