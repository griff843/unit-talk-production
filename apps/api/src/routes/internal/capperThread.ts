import express, { Router } from 'express';
import { z } from 'zod';

import { capperThreadResolver } from '../../services/CapperThreadResolver';
import { createLogger } from '../../utils/logger';
// Read feature flags directly from process.env in api-cloud profile

const router: Router = express.Router();
const logger = createLogger('InternalCapperThreadRoutes');

const EnsureSchema = z
  .object({
    discord_id: z.string().min(1),
    capper_handle: z.string().optional(),
    require: z.array(z.enum(['picks', 'qa'])).optional(),
  })
  .strict();

// POST /internal/capper-thread/ensure
router.post('/ensure', async (req, res) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `ensure-${Date.now()}`;
  res.setHeader('x-correlation-id', correlationId);

  try {
    if (process.env.CAPPER_THREAD_DB_ENABLED !== 'true') {
      return res.status(412).json({ error: 'CAPPER_THREAD_DB_ENABLED=false', correlationId });
    }

    const parsed = EnsureSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_request', details: parsed.error.flatten(), correlationId });
    }

    const { discord_id, capper_handle, require } = parsed.data;
    const result = await capperThreadResolver.ensure({
      discordId: discord_id,
      capperHandle: capper_handle,
      require: require || ['picks', 'qa'],
      correlationId,
    });

    return res.json({ correlationId, ...result });
  } catch (e: any) {
    logger.error({ err: e?.message }, 'ensure endpoint failed');
    return res.status(500).json({ error: 'internal_error', message: e?.message, correlationId });
  }
});

export { router as internalCapperThreadRoutes };
