import express from 'express';
import { FeatureStoreService } from '../services/FeatureStoreService';
import { authenticateToken } from '../security';
import { createLogger } from '../utils/logger';

const logger = createLogger('FeaturesRouter');
const router = express.Router();
const featureStore = new FeatureStoreService();

// Auth middleware (allow test bypass)
const featuresAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.headers['x-e2e-test'] === 'true' && process.env.NODE_ENV !== 'production') {
    logger.info('E2E test bypass enabled for features route');
    return next();
  }
  return authenticateToken(req, res, next);
};

router.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  next();
});

// GET /api/features/query?entityType=player&entityId=123&names=feat1,feat2&asOf=ISO
router.get('/query', featuresAuth, async (req, res): Promise<void> => {
  try {
    const entityType = String(req.query.entityType || '');
    const entityId = String(req.query.entityId || '');
    const names = String(req.query.names || '');
    const asOf = req.query.asOf ? String(req.query.asOf) : undefined;

    if (!entityType || !entityId || !names) {
      res.status(400).json({ success: false, error: 'Missing entityType, entityId, or names' });
      return;
    }

    const featureNames = names.split(',').map(s => s.trim()).filter(Boolean);
    const result = await featureStore.queryFeatures({ entityType, entityId, featureNames, asOf });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Feature query failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Feature query failed' });
  }
});

export default router;

