"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsWorkflow = analyticsWorkflow;
exports.scheduledAnalyticsWorkflow = scheduledAnalyticsWorkflow;
exports.batchAnalyticsWorkflow = batchAnalyticsWorkflow;
const workflow_1 = require("@temporalio/workflow");
const { runAnalyticsAgentActivity } = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '10 minutes',
    retry: {
        maximumAttempts: 3,
        initialInterval: '1 second',
        maximumInterval: '1 minute',
    },
});
async function analyticsWorkflow() {
    await runAnalyticsAgentActivity();
}
// Schedule-based workflow
async function scheduledAnalyticsWorkflow() {
    while (true) {
        await runAnalyticsAgentActivity();
        // Run every hour
        await (0, workflow_1.sleep)('1 hour');
    }
}
// Batch analysis workflow
async function batchAnalyticsWorkflow(_startDate, _endDate) {
    await runAnalyticsAgentActivity();
}
