#!/usr/bin/env tsx
import Redis from 'ioredis';

const CHANNEL = 'ut:roles:change';

async function main() {
  const [,, userId, tier] = process.argv;
  if (!userId || !tier) {
    console.error('Usage: tsx scripts/publish-role-change.ts <discord_user_id> <trial|member|vip|vip_plus>');
    process.exit(1);
  }
  const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
  const r = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await r.connect();
    const msg = { type: 'role.change', source: 'manual', userId, targetTier: tier, occurred_at: new Date().toISOString() };
    const sent = await r.publish(CHANNEL, JSON.stringify(msg));
    console.log(`Published to ${CHANNEL} (${sent} subscriber):`, msg);
  } finally {
    await r.quit();
  }
}

main().catch(err => { console.error(err); process.exit(1); });

