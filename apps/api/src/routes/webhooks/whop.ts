import express from 'express';
import crypto from 'crypto';
import { createLogger } from '../../utils/logger';
import { supabaseClient, isSupabaseConfigured } from '../../utils/supabaseUtils';

const logger = createLogger('WhopWebhook');
export const whopWebhookRouter = express.Router();

import Redis from 'ioredis';
import { requireSupabase, supabaseClient } from '../../utils/supabaseUtils';

const roleChangeChannel = 'ut:roles:change';
const redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});
redisPub.on('error', (err) => logger.warn('Redis publisher error', { error: (err as Error).message }));

// We rely on global express.json but capture raw body via verify hook in api-server
// If rawBody is not present, we fall back to JSON stringification of parsed body

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifySignature(rawBody: Buffer, timestamp: string | undefined, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  // Support either `${timestamp}.${raw}` or just raw body depending on provider
  const payload = timestamp ? Buffer.from(`${timestamp}.${rawBody.toString('utf8')}`, 'utf8') : rawBody;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

whopWebhookRouter.post('/', async (req, res) => {
  const enabled = process.env.WHOP_WEBHOOKS_ENABLED === 'true';
  if (!enabled) {
    return res.status(202).json({ success: true, message: 'Webhooks disabled (feature flag)', ignored: true });
  }

  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('Missing WHOP_WEBHOOK_SECRET');
    return res.status(500).json({ success: false, error: 'Webhook secret not configured' });
  }

  const signature = (req.headers['x-whop-signature'] || req.headers['whop-signature'] || req.headers['x-signature']) as string | undefined;
  const timestamp = (req.headers['x-whop-timestamp'] || req.headers['x-timestamp']) as string | undefined;

  // Optional replay protection (5 minutes)
  if (timestamp) {
    const tsNum = Number(timestamp);
    if (!Number.isNaN(tsNum)) {
      const ageSec = Math.floor(Date.now() / 1000) - tsNum;
      if (ageSec > 300) {
        logger.warn('Webhook timestamp too old', { ageSec });
        return res.status(400).json({ success: false, error: 'stale_timestamp' });
      }
    }
  }

  // Acquire raw body captured by express.json verify hook
  const rawBody: Buffer = (req as any).rawBody ? (req as any).rawBody : Buffer.from(JSON.stringify(req.body || {}), 'utf8');

  if (!verifySignature(rawBody, timestamp, signature, secret)) {
    logger.warn('Invalid webhook signature');
    return res.status(401).json({ success: false, error: 'invalid_signature' });
  }

  let event: any = undefined;
  try {
    event = req.body && Object.keys(req.body).length ? req.body : JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    logger.error('Failed to parse webhook body', { error: (e as Error).message });
    return res.status(400).json({ success: false, error: 'invalid_json' });
  }

  // Normalize minimal fields we care about
  const whop_user_id = event?.data?.user?.id || event?.user_id || event?.userId || null;
  const event_type = event?.type || event?.event || 'unknown';
  const occurred_at = event?.created_at || event?.createdAt || null;

  // Best-effort: store event for audit; if DB not configured or table missing, log and ack
  if (isSupabaseConfigured) {
    try {
      const supabaseClient = requireSupabase();
    await supabaseClient!
        .from('membership_events')
        .insert({
          source: 'whop',
          event_type,
          occurred_at: occurred_at ? new Date(occurred_at).toISOString() : new Date().toISOString(),
          whop_user_id,
          raw_event: event,
          parsed: { received_headers: req.headers }
        });
    } catch (dbErr) {
      logger.warn('Failed to persist membership_event (will still ack)', { error: (dbErr as Error).message });
    }
  } else {
    logger.warn('Supabase not configured; event not persisted');
  }

  // Map Whop event to a target tier for Discord role processing
  function mapTargetTier(evtType: string, evt: any): 'trial' | 'member' | 'vip' | 'vip_plus' | null {
    const lower = (evtType || '').toLowerCase();
    if (lower.includes('trial') && (lower.includes('start') || lower.includes('created'))) return 'trial';
    if (lower.includes('vip_plus') || lower.includes('vip+')) return 'vip_plus';
    if (lower.includes('vip')) return 'vip';
    if (lower.includes('upgrade')) {
      // Heuristic: prefer vip_plus if plan/product name mentions it
      const name = (evt?.plan?.name || evt?.product?.name || '').toLowerCase();
      if (name.includes('vip+') || name.includes('vip_plus') || name.includes('vip plus')) return 'vip_plus';
      if (name.includes('vip')) return 'vip';
      return 'vip';
    }
    if (lower.includes('expired') || lower.includes('cancel') || lower.includes('downgrade') || lower.includes('revoked')) {
      return 'member';
    }
    if (lower.includes('active') || lower.includes('paid')) return 'member';
    return null;
  }

  // Attempt to extract Discord user id from the event payload (common patterns)
  const discord_user_id = (event?.discord_user_id
    || event?.data?.discord_user_id
    || event?.data?.user?.discord_id
    || event?.user?.discord_id
    || event?.metadata?.discord_user_id) as string | undefined;

  const targetTier = mapTargetTier(event_type, event);

  if (discord_user_id && targetTier) {
    try {
      const payload = {
        type: 'role.change',
        source: 'whop',
        userId: discord_user_id,
        targetTier,
        occurred_at: occurred_at || new Date().toISOString(),
      };
      await redisPub.publish(roleChangeChannel, JSON.stringify(payload));
      logger.info('Published role change to Redis', { userId: discord_user_id, targetTier });
    } catch (pubErr) {
      logger.error('Failed to publish role change', { error: (pubErr as Error).message });
    }
  // Schedule trial expiration reminders when applicable
  if (isSupabaseConfigured && targetTier === 'trial' && discord_user_id) {
    try {
      const rawEnd = (event?.trial_ends_at || event?.data?.trial_ends_at || event?.data?.trial_end) as string | undefined;
      const endAt = rawEnd ? new Date(rawEnd) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const t48 = new Date(endAt.getTime() - 48 * 60 * 60 * 1000);
      const t6 = new Date(endAt.getTime() - 6 * 60 * 60 * 1000);
      const supabaseClient = requireSupabase();
    await supabaseClient!.from('reminder_jobs').insert([
        { discord_user_id, job_type: 'trial_expiring', scheduled_for: t48.toISOString(), payload: { window: 'T-48h' } },
        { discord_user_id, job_type: 'trial_expiring', scheduled_for: t6.toISOString(), payload: { window: 'T-6h' } },
      ]);
      logger.info('Scheduled trial expiration reminders', { userId: discord_user_id, endAt: endAt.toISOString() });
    } catch (schedErr) {
      logger.warn('Failed to schedule trial reminders', { error: (schedErr as Error).message });
    }
  }

  } else {
    logger.warn('Missing discord_user_id or unmapped event_type; skipping publish', { event_type, hasDiscordId: !!discord_user_id, targetTier });
  }

  return res.status(202).json({ success: true, received: true, published: Boolean(discord_user_id && targetTier) });
});

export default whopWebhookRouter;

