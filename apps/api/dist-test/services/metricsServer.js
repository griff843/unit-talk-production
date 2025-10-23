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
exports.featureMetrics = exports.alertsSent = exports.contestEntries = exports.userActions = exports.picksGraded = exports.picksProcessed = exports.agentHealthStatus = exports.durationHistogram = exports.errorCounter = exports.skippedCounter = exports.ingestedCounter = exports.externalApiErrors = exports.externalApiDuration = exports.externalApiCalls = exports.dbOperationsTotal = exports.dbConnectionsIdle = exports.dbConnectionsActive = exports.dbQueryDuration = exports.activeConnections = exports.httpResponseSize = exports.httpRequestSize = exports.httpRequestDuration = exports.httpRequestsTotal = void 0;
exports.startMetricsServer = startMetricsServer;
const http = __importStar(require("http"));
const prom_client_1 = require("prom-client");
const featureStoreMetrics_1 = require("./metrics/featureStoreMetrics");
// Create a registry for all metrics
const register = new prom_client_1.Registry();
(0, prom_client_1.collectDefaultMetrics)({ register });
// ==============================================
// HTTP & API METRICS
// ==============================================
// HTTP request metrics
exports.httpRequestsTotal = new prom_client_1.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});
exports.httpRequestDuration = new prom_client_1.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
});
exports.httpRequestSize = new prom_client_1.Histogram({
    name: 'http_request_size_bytes',
    help: 'Size of HTTP requests in bytes',
    labelNames: ['method', 'route'],
    buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
    registers: [register],
});
exports.httpResponseSize = new prom_client_1.Histogram({
    name: 'http_response_size_bytes',
    help: 'Size of HTTP responses in bytes',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
    registers: [register],
});
exports.activeConnections = new prom_client_1.Gauge({
    name: 'http_active_connections',
    help: 'Current number of active HTTP connections',
    registers: [register],
});
// ==============================================
// DATABASE METRICS
// ==============================================
exports.dbQueryDuration = new prom_client_1.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table', 'status'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
});
exports.dbConnectionsActive = new prom_client_1.Gauge({
    name: 'db_connections_active',
    help: 'Current number of active database connections',
    registers: [register],
});
exports.dbConnectionsIdle = new prom_client_1.Gauge({
    name: 'db_connections_idle',
    help: 'Current number of idle database connections',
    registers: [register],
});
exports.dbOperationsTotal = new prom_client_1.Counter({
    name: 'db_operations_total',
    help: 'Total number of database operations',
    labelNames: ['operation', 'table', 'status'],
    registers: [register],
});
// ==============================================
// EXTERNAL API METRICS
// ==============================================
exports.externalApiCalls = new prom_client_1.Counter({
    name: 'external_api_calls_total',
    help: 'Total number of external API calls',
    labelNames: ['provider', 'endpoint', 'status_code'],
    registers: [register],
});
exports.externalApiDuration = new prom_client_1.Histogram({
    name: 'external_api_duration_seconds',
    help: 'Duration of external API calls in seconds',
    labelNames: ['provider', 'endpoint', 'status_code'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [register],
});
exports.externalApiErrors = new prom_client_1.Counter({
    name: 'external_api_errors_total',
    help: 'Total number of external API errors',
    labelNames: ['provider', 'error_type'],
    registers: [register],
});
// ==============================================
// AGENT SYSTEM METRICS
// ==============================================
// Agent-specific Counters
exports.ingestedCounter = new prom_client_1.Counter({
    name: 'agent_ingested_total',
    help: 'Total number of props ingested',
    labelNames: ['agent_type'],
    registers: [register],
});
exports.skippedCounter = new prom_client_1.Counter({
    name: 'agent_skipped_total',
    help: 'Total number of props skipped',
    labelNames: ['agent_type', 'reason'],
    registers: [register],
});
exports.errorCounter = new prom_client_1.Counter({
    name: 'agent_errors_total',
    help: 'Total number of ingestion errors',
    labelNames: ['agent_type', 'error_type'],
    registers: [register],
});
exports.durationHistogram = new prom_client_1.Histogram({
    name: 'agent_ingestion_duration_seconds',
    help: 'Duration of ingestion agent run (seconds)',
    labelNames: ['agent_type', 'phase'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [register],
});
exports.agentHealthStatus = new prom_client_1.Gauge({
    name: 'agent_health_status',
    help: 'Health status of agents (1 = healthy, 0 = unhealthy)',
    labelNames: ['agent_name', 'agent_type'],
    registers: [register],
});
exports.picksProcessed = new prom_client_1.Counter({
    name: 'picks_processed_total',
    help: 'Total number of picks processed',
    labelNames: ['status', 'capper', 'sport'],
    registers: [register],
});
exports.picksGraded = new prom_client_1.Counter({
    name: 'picks_graded_total',
    help: 'Total number of picks graded',
    labelNames: ['result', 'capper', 'sport'],
    registers: [register],
});
// ==============================================
// BUSINESS METRICS
// ==============================================
exports.userActions = new prom_client_1.Counter({
    name: 'user_actions_total',
    help: 'Total number of user actions',
    labelNames: ['action_type', 'user_tier'],
    registers: [register],
});
exports.contestEntries = new prom_client_1.Counter({
    name: 'contest_entries_total',
    help: 'Total number of contest entries',
    labelNames: ['contest_type', 'entry_fee_tier'],
    registers: [register],
});
exports.alertsSent = new prom_client_1.Counter({
    name: 'alerts_sent_total',
    help: 'Total number of alerts sent',
    labelNames: ['alert_type', 'channel'],
    registers: [register],
});
// Feature store metric family
exports.featureMetrics = new featureStoreMetrics_1.FeatureStoreMetrics(register);
// Start the HTTP server for Prometheus scraping
function startMetricsServer(port = 9000) {
    http.createServer(async (req, res) => {
        if (req.url === '/metrics') {
            res.setHeader('Content-Type', register.contentType);
            res.end(await register.metrics());
        }
        else {
            res.writeHead(404);
            res.end();
        }
    }).listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`🚦 Prometheus metrics server running at http://localhost:${port}/metrics`);
    });
}
