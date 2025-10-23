"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionRedis = exports.ProductionRedisService = void 0;
const logger_1 = require("../shared/logger");
/**
 * Production Redis Service with Fallback
 * Works with or without Redis server
 */
class ProductionRedisService {
    constructor() {
        this.memoryCache = new Map();
        this.isRedisAvailable = false;
        this.redis = null;
        this.initializeRedis();
    }
    static getInstance() {
        if (!ProductionRedisService.instance) {
            ProductionRedisService.instance = new ProductionRedisService();
        }
        return ProductionRedisService.instance;
    }
    async initializeRedis() {
        try {
            // Try to import and connect to Redis
            const Redis = await Promise.resolve().then(() => __importStar(require('ioredis')));
            this.redis = new Redis.default(process.env.REDIS_URL || 'redis://localhost:6379', {
                maxRetriesPerRequest: 1,
                lazyConnect: true,
                connectTimeout: 5000,
            });
            await this.redis.ping();
            this.isRedisAvailable = true;
            logger_1.logger.info('Redis connected successfully');
        }
        catch (error) {
            this.isRedisAvailable = false;
            logger_1.logger.warn('Redis not available, using memory cache fallback', { error: error.message });
        }
    }
    async healthCheck() {
        if (this.isRedisAvailable && this.redis) {
            try {
                const result = await this.redis.ping();
                return result === 'PONG';
            }
            catch (error) {
                this.isRedisAvailable = false;
                logger_1.logger.warn('Redis health check failed, switching to fallback', { error: error.message });
            }
        }
        // Memory cache is always available
        return true;
    }
    async set(key, value, ttl) {
        if (this.isRedisAvailable && this.redis) {
            try {
                if (ttl) {
                    await this.redis.setex(key, ttl, value);
                }
                else {
                    await this.redis.set(key, value);
                }
                return;
            }
            catch (error) {
                logger_1.logger.warn('Redis SET failed, using fallback', { key, error: error.message });
                this.isRedisAvailable = false;
            }
        }
        // Fallback to memory cache
        const expires = ttl ? Date.now() + (ttl * 1000) : undefined;
        this.memoryCache.set(key, { value, expires });
    }
    async get(key) {
        if (this.isRedisAvailable && this.redis) {
            try {
                return await this.redis.get(key);
            }
            catch (error) {
                logger_1.logger.warn('Redis GET failed, using fallback', { key, error: error.message });
                this.isRedisAvailable = false;
            }
        }
        // Fallback to memory cache
        const cached = this.memoryCache.get(key);
        if (!cached)
            return null;
        if (cached.expires && Date.now() > cached.expires) {
            this.memoryCache.delete(key);
            return null;
        }
        return cached.value;
    }
    async del(key) {
        if (this.isRedisAvailable && this.redis) {
            try {
                await this.redis.del(key);
                return;
            }
            catch (error) {
                logger_1.logger.warn('Redis DEL failed, using fallback', { key, error: error.message });
                this.isRedisAvailable = false;
            }
        }
        // Fallback to memory cache
        this.memoryCache.delete(key);
    }
    async exists(key) {
        if (this.isRedisAvailable && this.redis) {
            try {
                const result = await this.redis.exists(key);
                return result === 1;
            }
            catch (error) {
                logger_1.logger.warn('Redis EXISTS failed, using fallback', { key, error: error.message });
                this.isRedisAvailable = false;
            }
        }
        // Fallback to memory cache
        const cached = this.memoryCache.get(key);
        if (!cached)
            return false;
        if (cached.expires && Date.now() > cached.expires) {
            this.memoryCache.delete(key);
            return false;
        }
        return true;
    }
    getConnectionStatus() {
        return {
            redis: this.isRedisAvailable,
            fallback: !this.isRedisAvailable,
            mode: this.isRedisAvailable ? 'Redis' : 'Memory Cache'
        };
    }
    async getStats() {
        if (this.isRedisAvailable && this.redis) {
            try {
                const info = await this.redis.info('stats');
                return {
                    mode: 'redis',
                    totalConnections: this.extractInfo(info, 'total_connections_received'),
                    totalCommands: this.extractInfo(info, 'total_commands_processed'),
                };
            }
            catch (error) {
                // Fall through to memory stats
            }
        }
        return {
            mode: 'memory',
            cacheSize: this.memoryCache.size,
            memoryUsage: process.memoryUsage()
        };
    }
    extractInfo(info, key) {
        const match = info.match(new RegExp(`${key}:(\\d+)`));
        return match ? parseInt(match[1]) : 0;
    }
    async cleanup() {
        // Clean expired entries from memory cache
        const now = Date.now();
        for (const [key, cached] of this.memoryCache.entries()) {
            if (cached.expires && now > cached.expires) {
                this.memoryCache.delete(key);
            }
        }
    }
    async disconnect() {
        if (this.redis) {
            try {
                await this.redis.disconnect();
            }
            catch (error) {
                logger_1.logger.warn('Redis disconnect error', { error: error.message });
            }
        }
        this.memoryCache.clear();
    }
}
exports.ProductionRedisService = ProductionRedisService;
exports.productionRedis = ProductionRedisService.getInstance();
