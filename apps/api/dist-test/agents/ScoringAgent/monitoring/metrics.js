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
exports.register = exports.queueSize = exports.failedOperations = exports.processingDuration = exports.pickGrades = exports.picksProcessed = void 0;
exports.trackPickProcessed = trackPickProcessed;
exports.trackPickGrade = trackPickGrade;
exports.trackProcessingTime = trackProcessingTime;
exports.trackFailedOperation = trackFailedOperation;
exports.updateQueueSize = updateQueueSize;
const client = __importStar(require("prom-client"));
// Create registry
const register = new client.Registry();
exports.register = register;
// Grading metrics
exports.picksProcessed = new client.Counter({
    name: 'grading_picks_processed_total',
    help: 'Total number of picks processed',
    labelNames: ['bet_type', 'status']
});
exports.pickGrades = new client.Counter({
    name: 'grading_pick_grades_total',
    help: 'Distribution of grades assigned to picks',
    labelNames: ['tier', 'bet_type']
});
exports.processingDuration = new client.Histogram({
    name: 'grading_processing_duration_seconds',
    help: 'Time spent processing picks',
    buckets: [0.1, 0.5, 1, 2, 5],
    labelNames: ['bet_type']
});
exports.failedOperations = new client.Counter({
    name: 'grading_failed_operations_total',
    help: 'Number of failed operations',
    labelNames: ['operation_type', 'error_type']
});
exports.queueSize = new client.Gauge({
    name: 'grading_queue_size',
    help: 'Current number of picks waiting to be processed'
});
// Register all metrics
register.registerMetric(exports.picksProcessed);
register.registerMetric(exports.pickGrades);
register.registerMetric(exports.processingDuration);
register.registerMetric(exports.failedOperations);
register.registerMetric(exports.queueSize);
// Helper functions
function trackPickProcessed(betType, status) {
    exports.picksProcessed.labels(betType, status).inc();
}
function trackPickGrade(tier, betType) {
    exports.pickGrades.labels(tier, betType).inc();
}
function trackProcessingTime(betType, durationMs) {
    exports.processingDuration.labels(betType).observe(durationMs / 1000);
}
function trackFailedOperation(operationType, errorType) {
    exports.failedOperations.labels(operationType, errorType).inc();
}
function updateQueueSize(size) {
    exports.queueSize.set(size);
}
