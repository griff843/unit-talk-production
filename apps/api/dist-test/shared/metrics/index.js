"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const logging_1 = require("../../services/logging");
class MetricsService {
    constructor() {
        this.logger = logging_1.logger;
    }
    recordMetric(metricName, value) {
        this.logger.info(`Metric recorded: ${metricName} = ${value}`);
    }
    incrementCounter(counterName) {
        this.logger.info(`Counter incremented: ${counterName}`);
    }
}
exports.MetricsService = MetricsService;
