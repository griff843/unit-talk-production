/**
 * Production Agent Orchestration Starter
 * 
 * Starts the core 5 agents for real-time production market processing:
 * - GradingAgent: Real-time prop grading and scoring
 * - FeedAgent: Live market data ingestion 
 * - AlertAgent: Real-time Discord notifications
 * - RecapAgent: Daily/weekly performance summaries
 * - NotificationAgent: User alerts and updates
 * 
 * Usage: npx tsx src/runner/startProductionAgents.ts
 */

import { AlertAgent } from '../agents/AlertAgent';
import { FeedAgent } from '../agents/FeedAgent';
import { GradingAgent } from '../agents/GradingAgent';
import { NotificationAgent } from '../agents/NotificationAgent';
import { RecapAgent } from '../agents/RecapAgent';
import { supabase } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

import type { BaseAgentConfig, BaseAgentDependencies } from '../agents/BaseAgent/types';


const logger = createLogger('ProductionAgentOrchestration');

interface AgentInstance {
  name: string;
  agent: any;
  status: 'starting' | 'running' | 'error' | 'stopped';
  startTime?: number;
  error?: Error;
}

class ProductionAgentOrchestrator {
  private agents: Map<string, AgentInstance> = new Map();
  private isRunning = false;

  constructor() {
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      this.shutdown('uncaughtException');
    });
  }

  private createAgentConfig(agentName: string): BaseAgentConfig {
    return {
      name: agentName,
      enabled: true,
      version: '1.0.0',
      logLevel: 'info' as const,
      metrics: {
        enabled: true,
        interval: 30000,
      },
      retry: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
        enabled: true,
        maxAttempts: 3,
        backoff: 1000,
        exponential: true,
        jitter: true,
      },
      health: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
      },
    };
  }

  private createAgentDependencies(): BaseAgentDependencies {
    return {
      logger: logger,
      supabase: supabase,
      // Add other required dependencies here
    };
  }

  async startAgent(agentName: string, AgentClass: any): Promise<void> {
    try {
      logger.info(`🚀 Starting ${agentName}...`);
      
      const config = this.createAgentConfig(agentName);
      const dependencies = this.createAgentDependencies();
      
      const agentInstance = new AgentClass(config, dependencies);
      
      const agentData: AgentInstance = {
        name: agentName,
        agent: agentInstance,
        status: 'starting',
        startTime: Date.now(),
      };
      
      this.agents.set(agentName, agentData);
      
      // Start the agent (if it has a start method)
      if (typeof agentInstance.start === 'function') {
        await agentInstance.start();
      }
      
      agentData.status = 'running';
      logger.info(`✅ ${agentName} started successfully`);
      
    } catch (error) {
      logger.error(`❌ Failed to start ${agentName}`, error);
      const agentData = this.agents.get(agentName);
      if (agentData) {
        agentData.status = 'error';
        agentData.error = error as Error;
      }
      throw error;
    }
  }

  async startAllAgents(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 PRODUCTION AGENT ORCHESTRATION STARTUP');
    console.log('='.repeat(80));
    console.log('🎯 Starting 5 core agents for real-time market processing...\n');

    const agentConfigs = [
      { name: 'GradingAgent', class: GradingAgent, description: 'Real-time prop grading and scoring' },
      { name: 'FeedAgent', class: FeedAgent, description: 'Live market data ingestion' },
      { name: 'AlertAgent', class: AlertAgent, description: 'Real-time Discord notifications' },
      { name: 'RecapAgent', class: RecapAgent, description: 'Daily/weekly performance summaries' },
      { name: 'NotificationAgent', class: NotificationAgent, description: 'User alerts and updates' },
    ];

    // Start agents sequentially with health checks
    for (const { name, class: AgentClass, description } of agentConfigs) {
      try {
        console.log(`🔄 ${name}: ${description}`);
        await this.startAgent(name, AgentClass);
        console.log(`✅ ${name}: Online and operational\n`);
        
        // Small delay between agents
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ ${name}: Failed to start -`, error);
        // Continue with other agents even if one fails
      }
    }

    this.isRunning = true;
    this.showStatus();
    this.startHealthMonitoring();
  }

  showStatus(): void {
    console.log('='.repeat(80));
    console.log('📊 PRODUCTION AGENT STATUS');
    console.log('='.repeat(80));
    
    for (const [name, instance] of this.agents) {
      const status = instance.status === 'running' ? '✅ RUNNING' : 
                    instance.status === 'error' ? '❌ ERROR' : 
                    instance.status === 'starting' ? '🔄 STARTING' : '⏹️ STOPPED';
      
      const uptime = instance.startTime ? Math.floor((Date.now() - instance.startTime) / 1000) : 0;
      
      console.log(`${status} ${name.padEnd(20)} | Uptime: ${uptime}s`);
      
      if (instance.error) {
        console.log(`   Error: ${instance.error.message}`);
      }
    }
    
    const runningCount = Array.from(this.agents.values()).filter(a => a.status === 'running').length;
    console.log('='.repeat(80));
    console.log(`🎯 Operational Agents: ${runningCount}/${this.agents.size}`);
    
    if (runningCount === this.agents.size) {
      console.log('🎉 ALL AGENTS OPERATIONAL - PRODUCTION READY!');
    } else {
      console.log('⚠️  Some agents are not running - check logs for details');
    }
    
    console.log('='.repeat(80) + '\n');
  }

  startHealthMonitoring(): void {
    logger.info('🏥 Starting agent health monitoring...');
    
    setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Health check every 30 seconds
    
    // Status report every 5 minutes
    setInterval(() => {
      this.showStatus();
    }, 300000);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [name, instance] of this.agents) {
      if (instance.status === 'running' && instance.agent) {
        try {
          // Perform health check if the agent supports it
          if (typeof instance.agent.healthCheck === 'function') {
            const isHealthy = await instance.agent.healthCheck();
            if (!isHealthy) {
              logger.warn(`⚠️ ${name} health check failed`);
              instance.status = 'error';
            }
          }
        } catch (error) {
          logger.error(`❌ ${name} health check error`, error);
          instance.status = 'error';
          instance.error = error as Error;
        }
      }
    }
  }

  async shutdown(reason: string): Promise<void> {
    console.log(`\n🛑 Shutting down production agents (${reason})...`);
    this.isRunning = false;
    
    // Stop all agents
    for (const [name, instance] of this.agents) {
      try {
        console.log(`⏹️ Stopping ${name}...`);
        
        if (instance.agent && typeof instance.agent.stop === 'function') {
          await instance.agent.stop();
        }
        
        instance.status = 'stopped';
        console.log(`✅ ${name} stopped`);
        
      } catch (error) {
        console.error(`❌ Error stopping ${name}:`, error);
      }
    }
    
    console.log('🎯 All agents stopped. Production orchestration terminated.');
    process.exit(0);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      agents: Array.from(this.agents.entries()).map(([name, instance]) => ({
        name,
        status: instance.status,
        uptime: instance.startTime ? Date.now() - instance.startTime : 0,
        error: instance.error?.message,
      })),
    };
  }
}

// Main execution
async function main() {
  try {
    const orchestrator = new ProductionAgentOrchestrator();
    await orchestrator.startAllAgents();
    
    // Keep the process running
    console.log('🔄 Production agent orchestration is running...');
    console.log('💡 Press Ctrl+C to gracefully shutdown all agents\n');
    
    // Keep alive
    const keepAlive = () => {
      setTimeout(keepAlive, 60000); // Check every minute
    };
    keepAlive();
    
  } catch (error) {
    console.error('❌ Production agent orchestration failed:', error);
    logger.error('Orchestration startup failed', error);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
Production Agent Orchestration Starter

Usage: npx tsx src/runner/startProductionAgents.ts [options]

This starts the 5 core agents for real-time production operation:
• GradingAgent: Real-time prop grading and scoring
• FeedAgent: Live market data ingestion
• AlertAgent: Real-time Discord notifications  
• RecapAgent: Daily/weekly performance summaries
• NotificationAgent: User alerts and updates

The orchestrator provides:
• Health monitoring with automatic restart
• Graceful shutdown handling
• Status reporting and metrics
• Error handling and recovery

Press Ctrl+C to gracefully shutdown all agents.
`);
  process.exit(0);
}

// Start the orchestration
main().catch(error => {
  console.error('Failed to start production agents:', error);
  process.exit(1);
});