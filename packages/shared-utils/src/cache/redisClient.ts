/*
 * Lightweight Redis client for game snapshots with lazy dependency and safe fallbacks.
 * - Uses ioredis if available at runtime
 * - Exposes getGameSnapshot/setGameSnapshot with TTL
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<any>;
};

let redis: RedisLike | null = null;
let initialized = false;

async function getRedis(): Promise<RedisLike | null> {
  if (initialized) return redis;
  initialized = true;
  try {
    // Lazy import with minimal typing to avoid build-time dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = await import('ioredis');
    const url = process.env['REDIS_URL'] || 'redis://localhost:6379';
    const client = new (Redis as any).default(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try { await client.connect?.(); } catch {}
    redis = {
      async get(key: string) { return client.get(key); },
      async set(key: string, value: string, _mode?: string, ttlSeconds?: number) {
        if (ttlSeconds && ttlSeconds > 0) {
          return client.set(key, value, 'EX', ttlSeconds);
        }
        return client.set(key, value);
      },
    };
  } catch {
    redis = null;
  }
  return redis;
}

const keyForGame = (externalGameId: string) => `game:${externalGameId}`;

export async function getGameSnapshot(externalGameId: string): Promise<any | null> {
  const r = await getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(keyForGame(externalGameId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setGameSnapshot(
  externalGameId: string,
  payload: any,
  ttlSeconds?: number
): Promise<boolean> {
  const r = await getRedis();
  if (!r) return false;
  try {
    const ttl = Number(ttlSeconds || process.env['CACHE_TTL_SNAPSHOTS'] || 90);
    await r.set(keyForGame(externalGameId), JSON.stringify(payload), 'EX', ttl);
    return true;
  } catch {
    return false;
  }
}

