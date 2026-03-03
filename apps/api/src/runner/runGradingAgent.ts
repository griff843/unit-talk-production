// src/runner/runGradingAgent.ts
import { loadBaseAgentDependencies } from '../agents/BaseAgent/loadDeps';
import { GradingAgent } from '../agents/GradingAgent';
import { gradingAgentConfig } from '../config/agentConfig';

async function main() {
  try {
    console.log('🚀 Starting GradingAgent...');

    const deps = await loadBaseAgentDependencies();
    const agent = new GradingAgent(gradingAgentConfig, deps);

    await agent.run();

    console.log('✅ GradingAgent completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ GradingAgent failed:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}
