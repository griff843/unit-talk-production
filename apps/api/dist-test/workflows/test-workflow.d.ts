export interface TestWorkflowInput {
    message: string;
}
export interface TestWorkflowOutput {
    success: boolean;
    message: string;
    timestamp: number;
}
/**
 * Simple test workflow for E2E testing
 */
export declare function testWorkflow(input: TestWorkflowInput): Promise<TestWorkflowOutput>;
//# sourceMappingURL=test-workflow.d.ts.map