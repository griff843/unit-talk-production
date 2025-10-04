#!/usr/bin/env tsx
/**
 * Run REAL Enhanced45Factor ScoringAgent (195-factor system) on Oct 2 picks
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { loadBaseAgentDependencies } from '../../agents/BaseAgent/loadDeps';
import { ScoringAgent } from '../../agents/ScoringAgent';
import { scoringAgentConfig } from '../../config/agentConfig';

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  RUNNING REAL ENHANCED45FACTOR SCORINGAGENT');
  console.log('  195-Factor Professional Scoring System');
  console.log('══════════════════════════════════════════════════════════\n');

  // Verify Enhanced45Factor is enabled
  if (process.env.USE_ENHANCED_45_FACTOR !== 'true') {
    console.error('❌ ERROR: USE_ENHANCED_45_FACTOR must be set to "true"');
    console.error('Current value:', process.env.USE_ENHANCED_45_FACTOR);
    process.exit(1);
  }

  console.log('✅ Enhanced45Factor enabled');
  console.log('📊 Loading agent dependencies...\n');

  try {
    // Load dependencies
    const deps = await loadBaseAgentDependencies();

    // Create ScoringAgent with Enhanced45Factor
    const agent = new ScoringAgent(scoringAgentConfig, deps);

    console.log('🎯 ScoringAgent initialized with Enhanced45FactorEngine');
    console.log('⚡ Processing picks through 195-factor system...\n');

    // Run the agent - it will automatically score all unscored picks
    await agent.run();

    console.log('\n✅ Enhanced45Factor scoring completed successfully');
    console.log('══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Enhanced45Factor scoring failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
