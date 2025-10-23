"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlPredictionCache = exports.redisCache = exports.redis = exports.MLPredictionCache = exports.RedisEnhancedCache = void 0;
const productionRedis_1 = require("../services/productionRedis");
const logger_1 = require("../shared/logger");
/**
 * Enhanced Redis Cache with fallback capabilities
 */
class RedisEnhancedCache {
    constructor() {
        this.redis = productionRedis_1.productionRedis;
    }
    async get(key) {
        try {
            return await this.redis.get(key);
        }
        catch (error) {
            logger_1.logger.error('Cache GET error', { key, error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
    async set(key, value, ttl) {
        try {
            await this.redis.set(key, value, ttl);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Cache SET error', { key, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    async del(key) {
        try {
            await this.redis.del(key);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Cache DEL error', { key, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    async exists(key) {
        try {
            return await this.redis.exists(key);
        }
        catch (error) {
            logger_1.logger.error('Cache EXISTS error', { key, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    async healthCheck() {
        return await this.redis.healthCheck();
    }
    getConnectionStatus() {
        return this.redis.getConnectionStatus();
    }
    async getStats() {
        return await this.redis.getStats();
    }
    async getPattern(pattern) {
        try {
            const result = new Map();
            // For now, return empty map since pattern matching isn't implemented
            // This is a placeholder to fix compilation errors
            logger_1.logger.warn('getPattern method called but pattern matching not implemented', { pattern });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Cache getPattern error', { pattern, error: error instanceof Error ? error.message : String(error) });
            return new Map();
        }
    }
    async ping() {
        try {
            return await this.redis.healthCheck();
        }
        catch (error) {
            logger_1.logger.error('Cache ping error', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    async cleanup() {
        await this.redis.cleanup();
    }
}
exports.RedisEnhancedCache = RedisEnhancedCache;
/**
 * ML Prediction Cache for storing and retrieving ML predictions
 */
class MLPredictionCache extends RedisEnhancedCache {
    constructor() {
        super(...arguments);
        this.mlPrefix = 'ml:prediction:';
    }
    async getPrediction(key) {
        try {
            const result = await this.get(`${this.mlPrefix}${key}`);
            return result ? JSON.parse(result) : null;
        }
        catch (error) {
            logger_1.logger.error('ML Cache GET error', { key, error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
    async setPrediction(key, prediction, ttl) {
        try {
            return await this.set(`${this.mlPrefix}${key}`, JSON.stringify(prediction), ttl);
        }
        catch (error) {
            logger_1.logger.error('ML Cache SET error', { key, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    async invalidatePrediction(key) {
        return await this.del(`${this.mlPrefix}${key}`);
    }
}
exports.MLPredictionCache = MLPredictionCache;
exports.redis = new RedisEnhancedCache();
exports.redisCache = exports.redis;
exports.mlPredictionCache = new MLPredictionCache();
