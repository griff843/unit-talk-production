"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWorkflow = testWorkflow;
const workflow_1 = require("@temporalio/workflow");
/**
 * Simple test workflow for E2E testing
 */
async function testWorkflow(input) {
    workflow_1.log.info('Test workflow started', { input });
    // Simple processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    const result = {
        success: true,
        message: `Processed: ${input.message}`,
        timestamp: Date.now()
    };
    workflow_1.log.info('Test workflow completed', { result });
    return result;
}
//# sourceMappingURL=test-workflow.js.map