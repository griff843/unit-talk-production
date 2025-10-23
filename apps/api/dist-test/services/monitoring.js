"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoring = exports.MonitoringService = exports.metrics = void 0;
const express_1 = __importDefault(require("express"));
const prom_client_1 = require("prom-client");
const logging_1 = require("./logging");
const redis_1 = require("./redis");
// Collect default Node.js metrics
(0, prom_client_1.collectDefaultMetrics)();
// Custom metrics
exports.metrics = {
    httpRequests: new prom_client_1.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code']
    }),
    httpDuration: new prom_client_1.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route'],
        buckets: [0.1, 0.5, 1, 2, 5]
    }),
    agentHealth: new prom_client_1.Gauge({
        name: 'agent_health_status',
        help: 'Health status of agents (1 = healthy, 0 = unhealthy)',
        labelNames: ['agent_name']
    }),
    agentOperations: new prom_client_1.Counter({
        name: 'agent_operations_total',
        help: 'Total number of agent operations',
        labelNames: ['agent_name', 'operation', 'status']
    }),
    cacheHits: new prom_client_1.Counter({
        name: 'cache_hits_total',
        help: 'Total number of cache hits',
        labelNames: ['cache_type']
    }),
    cacheMisses: new prom_client_1.Counter({
        name: 'cache_misses_total',
        help: 'Total number of cache misses',
        labelNames: ['cache_type']
    })
};
class MonitoringService {
    constructor(port = 9090) {
        this.app = (0, express_1.default)();
        this.port = port;
        this.setupRoutes();
    }
    setupRoutes() {
        // Metrics endpoint for Prometheus
        this.app.get('/metrics', async (_, res) => {
            try {
                res.set('Content-Type', prom_client_1.register.contentType);
                res.end(await prom_client_1.register.metrics());
            }
            catch (error) {
                res.status(500).end(error);
            }
        });
        // Health check endpoint
        this.app.get('/health', async (_, res) => {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                redis: await redis_1.redis.healthCheck()
            };
            res.json(health);
        });
        // Ready check endpoint
        this.app.get('/ready', async (_, res) => {
            const ready = {
                status: 'ready',
                services: {
                    redis: await redis_1.redis.healthCheck()
                }
            };
            const allReady = Object.values(ready.services).every(Boolean);
            res.status(allReady ? 200 : 503).json(ready);
        });
    }
    start() {
        this.app.listen(this.port, () => {
            logging_1.logger.info(`Monitoring service started on port ${this.port}`);
            logging_1.logger.info(`📊 Metrics: http://localhost:${this.port}/metrics`);
            logging_1.logger.info(`🏥 Health: http://localhost:${this.port}/health`);
            logging_1.logger.info(`✅ Ready: http://localhost:${this.port}/ready`);
        });
    }
}
exports.MonitoringService = MonitoringService;
exports.monitoring = new MonitoringService();
