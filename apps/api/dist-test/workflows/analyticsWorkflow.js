"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsWorkflow = analyticsWorkflow;
const workflow_1 = require("@temporalio/workflow");
// Import your AnalyticsAgent activity
const { runAnalyticsAgent } = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '10 minutes',
    retry: {
        maximumAttempts: 3,
        initialInterval: '1s',
    },
});
// The Temporal workflow itself
async function analyticsWorkflow() {
    await runAnalyticsAgent();
}
