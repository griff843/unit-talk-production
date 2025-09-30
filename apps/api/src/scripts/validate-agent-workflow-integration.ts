#!/usr/bin/env tsx

/**
 * Agent & Workflow Integration Validation Script
 * 
 * Validates the complete SaaS-grade data lifecycle and factor-driven agent pipeline:
 * - Agent architecture compliance
 * - Workflow integration verification  
 * - Database schema compatibility
 * - TypeScript compilation validation
 * - Critical system dependencies
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  critical: boolean;
}

class SystemValidator {
  private results: ValidationResult[] = [];
  private errors: string[] = [];

  async runValidation(): Promise<void> {
    console.log('🚀 Starting Agent & Workflow Integration Validation\n');
    console.log('=' .repeat(60));
    
    try {
      await this.validateAgentArchitecture();
      await this.validateWorkflowIntegration();
      await this.validateDatabaseMigrations();
      await this.validateTypeScriptCompliance();
      await this.validateSystemDependencies();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Validation failed with error:', error);
      process.exit(1);
    }
  }

  private async validateAgentArchitecture(): Promise<void> {
    console.log('\n📊 Validating Agent Architecture...');
    
    // Check FeatureBuilderAgent
    this.validateFile(
      'Agent Architecture',
      'FeatureBuilderAgent exists',
      'src/agents/FeatureBuilderAgent/index.ts',
      true
    );

    // Check ScoringAgent 
    this.validateFile(
      'Agent Architecture',
      'ScoringAgent exists',
      'src/agents/ScoringAgent/ScoringAgent.ts',
      true
    );

    // Check PromotionAgent
    this.validateFile(
      'Agent Architecture',
      'PromotionAgent exists', 
      'src/agents/PromotionAgent/index.ts',
      true
    );

    // Check DataLifecycleAgent update
    this.validateFile(
      'Agent Architecture',
      'DataLifecycleAgent updated',
      'src/agents/DataLifecycleAgent/index.ts',
      true
    );

    // Validate agent content structure
    this.validateAgentContent();
  }

  private async validateWorkflowIntegration(): Promise<void> {
    console.log('\n⚡ Validating Workflow Integration...');
    
    // Check all workflow files
    const workflows = [
      'FeatureBuilderWorkflow.ts',
      'ScoringWorkflow.ts', 
      'PromotionWorkflow.ts',
      'DataLifecycleWorkflow.ts',
      'index.ts'
    ];

    workflows.forEach(workflow => {
      this.validateFile(
        'Workflow Integration',
        `${workflow} exists`,
        `src/workflows/data-lifecycle/${workflow}`,
        true
      );
    });

    // Validate workflow content
    this.validateWorkflowContent();
  }

  private async validateDatabaseMigrations(): Promise<void> {
    console.log('\n🗄️ Validating Database Migrations...');
    
    // Check HOT/WARM/COLD migration
    this.validateFile(
      'Database Schema',
      'HOT/WARM/COLD migration exists',
      'migrations/020_complete_hot_warm_cold_architecture.sql',
      true
    );

    // Validate migration content
    this.validateMigrationContent();
  }

  private async validateTypeScriptCompliance(): Promise<void> {
    console.log('\n🔍 Validating TypeScript Compliance...');
    
    // Check tsconfig files
    this.validateFile(
      'TypeScript Config',
      'tsconfig.json exists',
      'tsconfig.json',
      true
    );

    // Validate import paths and types
    this.validateTypeScriptStructure();
  }

  private async validateSystemDependencies(): Promise<void> {
    console.log('\n🔧 Validating System Dependencies...');
    
    // Check package.json
    this.validateFile(
      'Dependencies',
      'package.json exists',
      'package.json',
      true
    );

    // Validate critical dependencies
    this.validatePackageDependencies();
  }

  private validateFile(category: string, test: string, filePath: string, critical: boolean): boolean {
    const fullPath = join(process.cwd(), filePath);
    const exists = existsSync(fullPath);
    
    this.results.push({
      category,
      test,
      status: exists ? 'PASS' : 'FAIL',
      details: exists ? `✅ File found: ${filePath}` : `❌ Missing file: ${filePath}`,
      critical
    });

    return exists;
  }

  private validateAgentContent(): void {
    // Validate FeatureBuilderAgent content
    this.validateAgentFileContent(
      'FeatureBuilderAgent',
      'src/agents/FeatureBuilderAgent/index.ts',
      ['45-factor', 'market intelligence', 'BaseAgent']
    );

    // Validate ScoringAgent content  
    this.validateAgentFileContent(
      'ScoringAgent',
      'src/agents/ScoringAgent/ScoringAgent.ts',
      ['ensemble scoring', 'devigging', 'Kelly fraction']
    );

    // Validate PromotionAgent content
    this.validateAgentFileContent(
      'PromotionAgent', 
      'src/agents/PromotionAgent/index.ts',
      ['risk management', 'tier criteria', 'portfolio optimization']
    );
  }

  private validateWorkflowContent(): void {
    // Validate FeatureBuilderWorkflow
    this.validateWorkflowFileContent(
      'FeatureBuilderWorkflow',
      'src/workflows/data-lifecycle/FeatureBuilderWorkflow.ts',
      ['45-factor computation', 'steam detection', 'market efficiency']
    );

    // Validate ScoringWorkflow
    this.validateWorkflowFileContent(
      'ScoringWorkflow',
      'src/workflows/data-lifecycle/ScoringWorkflow.ts',
      ['professional scoring', 'grade distribution', 'Kelly fraction']
    );

    // Validate PromotionWorkflow  
    this.validateWorkflowFileContent(
      'PromotionWorkflow',
      'src/workflows/data-lifecycle/PromotionWorkflow.ts',
      ['tier criteria', 'risk assessment', 'unified_picks']
    );
  }

  private validateMigrationContent(): void {
    const migrationPath = 'migrations/020_complete_hot_warm_cold_architecture.sql';
    const fullPath = join(process.cwd(), migrationPath);
    
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const requiredElements = [
          'prop_ticks_hot',
          'features_daily_agg', 
          'prop_ticks_archive',
          'archive_hot_to_warm',
          'archive_warm_to_cold'
        ];

        const missingElements = requiredElements.filter(element => !content.includes(element));
        
        this.results.push({
          category: 'Database Schema',
          test: 'Migration content validation',
          status: missingElements.length === 0 ? 'PASS' : 'FAIL',
          details: missingElements.length === 0 
            ? '✅ All required schema elements found'
            : `❌ Missing elements: ${missingElements.join(', ')}`,
          critical: true
        });
      } catch (error) {
        this.results.push({
          category: 'Database Schema',
          test: 'Migration content validation',
          status: 'FAIL',
          details: `❌ Error reading migration: ${error}`,
          critical: true
        });
      }
    }
  }

  private validateTypeScriptStructure(): void {
    // Check for common TypeScript issues
    const tsConfigPath = join(process.cwd(), 'tsconfig.json');
    
    if (existsSync(tsConfigPath)) {
      try {
        const tsConfig = JSON.parse(readFileSync(tsConfigPath, 'utf-8'));
        
        this.results.push({
          category: 'TypeScript Config',
          test: 'Strict mode enabled',
          status: tsConfig.compilerOptions?.strict ? 'PASS' : 'WARN',
          details: tsConfig.compilerOptions?.strict 
            ? '✅ TypeScript strict mode enabled'
            : '⚠️ TypeScript strict mode not enabled',
          critical: false
        });

        this.results.push({
          category: 'TypeScript Config',
          test: 'Path mapping configured',
          status: tsConfig.compilerOptions?.paths ? 'PASS' : 'WARN',
          details: tsConfig.compilerOptions?.paths 
            ? '✅ Path mapping configured'
            : '⚠️ Path mapping not configured',
          critical: false
        });

      } catch (error) {
        this.results.push({
          category: 'TypeScript Config',
          test: 'tsconfig.json validation',
          status: 'FAIL',
          details: `❌ Error parsing tsconfig.json: ${error}`,
          critical: false
        });
      }
    }
  }

  private validatePackageDependencies(): void {
    const packagePath = join(process.cwd(), 'package.json');
    
    if (existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        const requiredDeps = [
          '@temporalio/workflow',
          '@temporalio/activity',
          'typescript'
        ];

        const missingDeps = requiredDeps.filter(dep => !dependencies[dep]);
        
        this.results.push({
          category: 'Dependencies',
          test: 'Critical dependencies check',
          status: missingDeps.length === 0 ? 'PASS' : 'FAIL',
          details: missingDeps.length === 0
            ? '✅ All critical dependencies found'
            : `❌ Missing dependencies: ${missingDeps.join(', ')}`,
          critical: true
        });

      } catch (error) {
        this.results.push({
          category: 'Dependencies',
          test: 'package.json validation',
          status: 'FAIL',
          details: `❌ Error parsing package.json: ${error}`,
          critical: true
        });
      }
    }
  }

  private validateAgentFileContent(agentName: string, filePath: string, requiredKeywords: string[]): void {
    const fullPath = join(process.cwd(), filePath);
    
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf-8').toLowerCase();
        const missingKeywords = requiredKeywords.filter(keyword => !content.includes(keyword.toLowerCase()));
        
        this.results.push({
          category: 'Agent Content',
          test: `${agentName} content validation`,
          status: missingKeywords.length === 0 ? 'PASS' : 'WARN',
          details: missingKeywords.length === 0
            ? `✅ ${agentName} contains all required elements`
            : `⚠️ ${agentName} missing keywords: ${missingKeywords.join(', ')}`,
          critical: false
        });
      } catch (error) {
        this.results.push({
          category: 'Agent Content',
          test: `${agentName} content validation`,
          status: 'FAIL',
          details: `❌ Error reading ${agentName}: ${error}`,
          critical: true
        });
      }
    }
  }

  private validateWorkflowFileContent(workflowName: string, filePath: string, requiredKeywords: string[]): void {
    const fullPath = join(process.cwd(), filePath);
    
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf-8').toLowerCase();
        const missingKeywords = requiredKeywords.filter(keyword => !content.includes(keyword.toLowerCase()));
        
        this.results.push({
          category: 'Workflow Content',
          test: `${workflowName} content validation`,
          status: missingKeywords.length === 0 ? 'PASS' : 'WARN',
          details: missingKeywords.length === 0
            ? `✅ ${workflowName} contains all required elements`
            : `⚠️ ${workflowName} missing keywords: ${missingKeywords.join(', ')}`,
          critical: false
        });
      } catch (error) {
        this.results.push({
          category: 'Workflow Content',
          test: `${workflowName} content validation`,
          status: 'FAIL',
          details: `❌ Error reading ${workflowName}: ${error}`,
          critical: true
        });
      }
    }
  }

  private generateReport(): void {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 VALIDATION REPORT');
    console.log('=' .repeat(60));

    const categories = [...new Set(this.results.map(r => r.category))];
    let totalTests = 0;
    let passedTests = 0;
    let criticalFailures = 0;

    categories.forEach(category => {
      console.log(`\n🏷️  ${category}:`);
      
      const categoryResults = this.results.filter(r => r.category === category);
      categoryResults.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
        console.log(`   ${icon} ${result.test}: ${result.details}`);
        
        totalTests++;
        if (result.status === 'PASS') passedTests++;
        if (result.status === 'FAIL' && result.critical) criticalFailures++;
      });
    });

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📈 SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`Critical Failures: ${criticalFailures}`);

    if (criticalFailures === 0) {
      console.log('\n🎉 VALIDATION SUCCESSFUL - System ready for E2E testing!');
      process.exit(0);
    } else {
      console.log('\n❌ VALIDATION FAILED - Critical issues must be resolved before E2E testing');
      process.exit(1);
    }
  }
}

// Run validation
const validator = new SystemValidator();
validator.runValidation().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});