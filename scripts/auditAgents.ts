#!/usr/bin/env node
/**
 * Comprehensive Agent Audit Script
 * Audits all agents in src/agents/ for production readiness
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AgentAuditResult {
  name: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  issues: string[];
  warnings: string[];
  testsPassing: boolean;
  buildErrors: number;
  missingMethods: string[];
  codeQuality: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'POOR';
}

class AgentAuditor {
  private results: AgentAuditResult[] = [];
  private agentsDir = 'src/agents';

  async auditAllAgents(): Promise<void> {
    console.log('🔍 Starting comprehensive agent audit...\n');

    const agents = await this.getAgentDirectories();
    
    for (const agent of agents) {
      if (agent === 'BaseAgent') continue; // Skip BaseAgent as it's abstract
      
      console.log(`📋 Auditing ${agent}...`);
      const result = await this.auditAgent(agent);
      this.results.push(result);
      this.printAgentResult(result);
    }

    this.printSummary();
  }

  private async getAgentDirectories(): Promise<string[]> {
    const entries = await fs.readdir(this.agentsDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  }

  private async auditAgent(agentName: string): Promise<AgentAuditResult> {
    const result: AgentAuditResult = {
      name: agentName,
      status: 'GREEN',
      issues: [],
      warnings: [],
      testsPassing: false,
      buildErrors: 0,
      missingMethods: [],
      codeQuality: 'EXCELLENT'
    };

    try {
      // Check if agent directory exists and has required files
      await this.checkAgentStructure(agentName, result);
      
      // Check TypeScript compilation
      await this.checkTypeScriptCompilation(agentName, result);
      
      // Check for missing BaseAgent methods
      await this.checkBaseAgentImplementation(agentName, result);
      
      // Check test coverage
      await this.checkTestCoverage(agentName, result);
      
      // Check code quality
      await this.checkCodeQuality(agentName, result);
      
      // Determine overall status
      this.determineStatus(result);
      
    } catch (error) {
      result.status = 'RED';
      result.issues.push(`Audit failed: ${error.message}`);
    }

    return result;
  }

  private async checkAgentStructure(agentName: string, result: AgentAuditResult): Promise<void> {
    const agentPath = join(this.agentsDir, agentName);
    const requiredFiles = ['index.ts', 'types.ts'];
    
    for (const file of requiredFiles) {
      const filePath = join(agentPath, file);
      try {
        await fs.access(filePath);
      } catch {
        // Check for types/index.ts as alternative
        if (file === 'types.ts') {
          try {
            await fs.access(join(agentPath, 'types', 'index.ts'));
            continue;
          } catch {
            result.issues.push(`Missing ${file}`);
          }
        } else {
          result.issues.push(`Missing ${file}`);
        }
      }
    }
  }

  private async checkTypeScriptCompilation(agentName: string, result: AgentAuditResult): Promise<void> {
    try {
      const agentPath = join(this.agentsDir, agentName, 'index.ts');
      const { stderr } = await execAsync(`npx tsc --noEmit ${agentPath}`);
      
      if (stderr) {
        const errors = stderr.split('\n').filter(line => line.includes('error'));
        result.buildErrors = errors.length;
        result.issues.push(...errors);
      }
    } catch (error) {
      result.buildErrors++;
      result.issues.push(`TypeScript compilation failed: ${error.message}`);
    }
  }

  private async checkBaseAgentImplementation(agentName: string, result: AgentAuditResult): Promise<void> {
    try {
      const agentPath = join(this.agentsDir, agentName, 'index.ts');
      const content = await fs.readFile(agentPath, 'utf-8');
      
      const requiredMethods = [
        'initialize',
        'process', 
        'cleanup',
        'collectMetrics',
        'checkHealth'
      ];
      
      for (const method of requiredMethods) {
        if (!content.includes(`${method}(`)) {
          result.missingMethods.push(method);
        }
      }
      
      // Check for BaseAgent extension
      if (!content.includes('extends BaseAgent')) {
        result.issues.push('Does not extend BaseAgent');
      }
      
    } catch (error) {
      result.issues.push(`Failed to check BaseAgent implementation: ${error.message}`);
    }
  }

  private async checkTestCoverage(agentName: string, result: AgentAuditResult): Promise<void> {
    const testPaths = [
      join(this.agentsDir, agentName, 'tests'),
      join(this.agentsDir, agentName, '__tests__'),
      join(this.agentsDir, agentName, 'test')
    ];
    
    let hasTests = false;
    for (const testPath of testPaths) {
      try {
        await fs.access(testPath);
        hasTests = true;
        break;
      } catch {
        // Continue checking other paths
      }
    }
    
    if (!hasTests) {
      result.issues.push('No test directory found');
    } else {
      // Try to run tests
      try {
        await execAsync(`npm test -- ${agentName}`);
        result.testsPassing = true;
      } catch (error) {
        result.issues.push('Tests failing');
      }
    }
  }

  private async checkCodeQuality(agentName: string, result: AgentAuditResult): Promise<void> {
    try {
      const agentPath = join(this.agentsDir, agentName, 'index.ts');
      const content = await fs.readFile(agentPath, 'utf-8');
      
      // Check for TODO/FIXME comments
      const todos = content.match(/\/\/\s*(TODO|FIXME|XXX)/gi);
      if (todos && todos.length > 0) {
        result.warnings.push(`${todos.length} TODO/FIXME comments found`);
      }
      
      // Check for console.log statements
      const consoleLogs = content.match(/console\.(log|debug|info|warn|error)/g);
      if (consoleLogs && consoleLogs.length > 0) {
        result.warnings.push(`${consoleLogs.length} console statements found`);
      }
      
      // Check for proper error handling
      if (!content.includes('try') || !content.includes('catch')) {
        result.warnings.push('Limited error handling detected');
      }
      
      // Check for JSDoc comments
      const jsdocComments = content.match(/\/\*\*[\s\S]*?\*\//g);
      const functionCount = content.match(/(?:public|private|protected)?\s*(?:async\s+)?(?:function\s+)?[\w]+\s*\(/g);
      
      if (!jsdocComments || (functionCount && jsdocComments.length < functionCount.length * 0.5)) {
        result.warnings.push('Insufficient documentation');
      }
      
    } catch (error) {
      result.warnings.push(`Code quality check failed: ${error.message}`);
    }
  }

  private determineStatus(result: AgentAuditResult): void {
    if (result.issues.length > 0 || result.buildErrors > 0 || result.missingMethods.length > 0) {
      result.status = 'RED';
      result.codeQuality = 'POOR';
    } else if (result.warnings.length > 3 || !result.testsPassing) {
      result.status = 'YELLOW';
      result.codeQuality = result.warnings.length > 5 ? 'NEEDS_WORK' : 'GOOD';
    } else {
      result.status = 'GREEN';
      result.codeQuality = result.warnings.length === 0 ? 'EXCELLENT' : 'GOOD';
    }
  }

  private printAgentResult(result: AgentAuditResult): void {
    const statusEmoji = result.status === 'GREEN' ? '✅' : result.status === 'YELLOW' ? '⚠️' : '❌';
    console.log(`${statusEmoji} ${result.name}: ${result.status}`);
    
    if (result.issues.length > 0) {
      console.log('  Issues:');
      result.issues.forEach(issue => console.log(`    - ${issue}`));
    }
    
    if (result.warnings.length > 0) {
      console.log('  Warnings:');
      result.warnings.forEach(warning => console.log(`    - ${warning}`));
    }
    
    if (result.missingMethods.length > 0) {
      console.log(`  Missing methods: ${result.missingMethods.join(', ')}`);
    }
    
    console.log(`  Code Quality: ${result.codeQuality}`);
    console.log(`  Tests Passing: ${result.testsPassing ? '✅' : '❌'}`);
    console.log('');
  }

  private printSummary(): void {
    console.log('📊 AUDIT SUMMARY');
    console.log('================');
    
    const green = this.results.filter(r => r.status === 'GREEN').length;
    const yellow = this.results.filter(r => r.status === 'YELLOW').length;
    const red = this.results.filter(r => r.status === 'RED').length;
    
    console.log(`✅ Green (Production Ready): ${green}`);
    console.log(`⚠️  Yellow (Needs Minor Fixes): ${yellow}`);
    console.log(`❌ Red (Critical Issues): ${red}`);
    console.log(`📈 Total Agents Audited: ${this.results.length}`);
    
    console.log('\n🎯 PRIORITY FIXES NEEDED:');
    this.results
      .filter(r => r.status === 'RED')
      .forEach(result => {
        console.log(`\n${result.name}:`);
        result.issues.forEach(issue => console.log(`  - ${issue}`));
      });
  }
}

// Run the audit
if (require.main === module) {
  const auditor = new AgentAuditor();
  auditor.auditAllAgents().catch(console.error);
}

export { AgentAuditor };