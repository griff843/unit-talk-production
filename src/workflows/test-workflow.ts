import { log } from '@temporalio/workflow';

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
export async function testWorkflow(input: TestWorkflowInput): Promise<TestWorkflowOutput> {
  log.info('Test workflow started', { input });
  
  // Simple processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const result: TestWorkflowOutput = {
    success: true,
    message: `Processed: ${input.message}`,
    timestamp: Date.now()
  };
  
  log.info('Test workflow completed', { result });
  
  return result;
}