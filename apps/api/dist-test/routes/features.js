"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const FeatureStoreService_1 = require("../services/FeatureStoreService");
const security_1 = require("../security");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('FeaturesRouter');
const router = express_1.default.Router();
const featureStore = new FeatureStoreService_1.FeatureStoreService();
// Auth middleware (allow test bypass)
const featuresAuth = (req, res, next) => {
    if (req.headers['x-e2e-test'] === 'true' && process.env.NODE_ENV !== 'production') {
        logger.info('E2E test bypass enabled for features route');
        return next();
    }
    return (0, security_1.authenticateToken)(req, res, next);
};
router.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    next();
});
// GET /api/features/query?entityType=player&entityId=123&names=feat1,feat2&asOf=ISO
router.get('/query', featuresAuth, async (req, res) => {
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
    }
    catch (error) {
        logger.error('Feature query failed', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ success: false, error: 'Feature query failed' });
    }
});
exports.default = router;
