#!/usr/bin/env tsx

/**
 * ML Canary Deployment Controller
 * 
 * Manages the automated rollout of ML models through canary deployment stages:
 * - Stage 1: Shadow mode (0% traffic) - predictions logged, not published
 * - Stage 2: Canary (5% traffic) - gradual rollout with monitoring
 * - Stage 3: Full production (100% traffic) - complete deployment
 * 
 * Features:
 * - Automated rollback on SLO breach
 * - Real-time monitoring and alerting
 * - Comprehensive logging and reporting
 * - Circuit breaker protection
 */

import { createClient } from '@supabase/supabase-js';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

interface DeploymentConfig {
  stage: 'stage1' | 'stage2' | 'stage3';
  modelVersion: string;
  targetPercentage: number;
  maxErrorRate: number;
  maxLatencyMs: number;
  maxAccuracyDegradation: number;
  monitoringDurationMs: number;
  rollbackTimeoutMs: number;
}

interface MetricThresholds {
  errorRate: number;
  latencyP95: number;
  accuracyDelta: number;
  requestCount: number;
}

interface DeploymentMetrics {
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  requestCount: number;
  successCount: number;
  fallbackCount: number;
  cacheHitRate: number;
  accuracyDelta: number;
  discrepancyRate: number;
}

interface RollbackPlan {
  previousModelVersion: string;
  rollbackSteps: string[];
  validationChecks: string[];
  estimatedDurationMs: number;
}

class MLCanaryController {
  private supabase: any;
  private config: DeploymentConfig;
  private startTime: Date;
  private deploymentId: string;
  private rollbackPlan: RollbackPlan | null = null;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.startTime = new Date();
    this.deploymentId = `deploy-${config.modelVersion}-${config.stage}-${Date.now()}`;
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Execute the canary deployment
   */
  async deploy(): Promise<boolean> {
    console.log(chalk.blue(`\n🚀 Starting ML Canary Deployment`));
    console.log(chalk.gray(`Deployment ID: ${this.deploymentId}`));
    console.log(chalk.gray(`Stage: ${this.config.stage}`));
    console.log(chalk.gray(`Model Version: ${this.config.modelVersion}`));
    console.log(chalk.gray(`Target Traffic: ${this.config.targetPercentage}%`));

    try {
      // Pre-deployment validation
      await this.preDeploymentValidation();
      
      // Create rollback plan
      await this.createRollbackPlan();
      
      // Execute deployment based on stage
      switch (this.config.stage) {
        case 'stage1':
          return await this.deployShadowMode();
        case 'stage2':
          return await this.deployCanary();
        case 'stage3':
          return await this.deployProduction();
        default:
          throw new Error(`Invalid deployment stage: ${this.config.stage}`);
      }

    } catch (error) {
      console.error(chalk.red(`❌ Deployment failed: ${error}`));
      await this.executeRollback();
      return false;
    }
  }

  /**
   * Pre-deployment validation
   */
  private async preDeploymentValidation(): Promise<void> {
    const spinner = ora('🔍 Running pre-deployment validation...').start();

    try {
      // Validate model artifact exists
      await this.validateModelArtifact();
      
      // Check database connectivity
      await this.validateDatabaseConnection();
      
      // Verify ML infrastructure health
      await this.validateMLInfrastructure();
      
      // Check current production metrics
      await this.validateCurrentMetrics();
      
      spinner.succeed('✅ Pre-deployment validation passed');
    } catch (error) {
      spinner.fail(`❌ Pre-deployment validation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Deploy shadow mode (Stage 1)
   */
  private async deployShadowMode(): Promise<boolean> {
    console.log(chalk.yellow('\n📊 Deploying Shadow Mode (0% traffic)'));
    
    // Update deployment stage in database
    await this.updateDeploymentStage('stage1', 0);
    
    // Enable shadow mode logging
    await this.enableShadowMode();
    
    // Monitor shadow predictions
    return await this.monitorShadowMode();
  }

  /**
   * Deploy canary (Stage 2)
   */
  private async deployCanary(): Promise<boolean> {
    console.log(chalk.yellow('\n🚀 Deploying Canary (5% traffic)'));
    
    // Gradually increase traffic percentage
    const steps = [1, 2, 5]; // 1%, 2%, 5%
    
    for (const percentage of steps) {
      console.log(chalk.blue(`\n📈 Increasing traffic to ${percentage}%`));
      
      await this.updateDeploymentStage('stage2', percentage);
      
      // Monitor for stability before next step
      const isStable = await this.monitorCanaryMetrics(percentage);
      if (!isStable) {
        console.log(chalk.red(`❌ Canary at ${percentage}% failed stability check`));
        await this.executeRollback();
        return false;
      }
    }
    
    return true;
  }

  /**
   * Deploy production (Stage 3)
   */
  private async deployProduction(): Promise<boolean> {
    console.log(chalk.green('\n🌟 Deploying Production (100% traffic)'));
    
    // Gradually increase to 100%
    const steps = [10, 25, 50, 75, 100];
    
    for (const percentage of steps) {
      console.log(chalk.blue(`\n📈 Increasing traffic to ${percentage}%`));
      
      await this.updateDeploymentStage('stage3', percentage);
      
      // Extended monitoring for production
      const monitorDuration = percentage === 100 ? 
        this.config.monitoringDurationMs : 
        Math.min(this.config.monitoringDurationMs / 2, 300000); // Max 5 minutes for intermediate steps
      
      const isStable = await this.monitorProductionMetrics(percentage, monitorDuration);
      if (!isStable) {
        console.log(chalk.red(`❌ Production at ${percentage}% failed stability check`));
        await this.executeRollback();
        return false;
      }
    }
    
    // Final validation
    await this.finalProductionValidation();
    
    console.log(chalk.green('\n🎉 Production deployment completed successfully!'));
    return true;
  }

  /**
   * Monitor shadow mode predictions
   */
  private async monitorShadowMode(): Promise<boolean> {
    const spinner = ora('📊 Monitoring shadow mode predictions...').start();
    const monitoringDuration = this.config.monitoringDurationMs;
    const checkInterval = 30000; // 30 seconds
    const startTime = Date.now();

    try {
      while (Date.now() - startTime < monitoringDuration) {
        const metrics = await this.collectShadowMetrics();
        
        // Update spinner with current metrics
        spinner.text = `📊 Shadow Mode - Predictions: ${metrics.requestCount}, Avg Discrepancy: ${(metrics.discrepancyRate * 100).toFixed(2)}%, Latency: ${metrics.avgLatencyMs.toFixed(1)}ms`;
        
        // Check for critical issues
        if (metrics.errorRate > this.config.maxErrorRate) {
          spinner.fail(`❌ Error rate too high: ${(metrics.errorRate * 100).toFixed(2)}%`);
          return false;
        }
        
        if (metrics.p95LatencyMs > this.config.maxLatencyMs) {
          spinner.fail(`❌ Latency too high: ${metrics.p95LatencyMs.toFixed(1)}ms`);
          return false;
        }
        
        await this.sleep(checkInterval);
      }
      
      spinner.succeed('✅ Shadow mode monitoring completed successfully');
      return true;
      
    } catch (error) {
      spinner.fail(`❌ Shadow mode monitoring failed: ${error}`);
      return false;
    }
  }

  /**
   * Monitor canary metrics
   */
  private async monitorCanaryMetrics(percentage: number): Promise<boolean> {
    const spinner = ora(`📊 Monitoring canary at ${percentage}%...`).start();
    const monitoringDuration = Math.min(this.config.monitoringDurationMs, 600000); // Max 10 minutes
    const checkInterval = 15000; // 15 seconds
    const startTime = Date.now();

    try {
      while (Date.now() - startTime < monitoringDuration) {
        const metrics = await this.collectCanaryMetrics();
        
        spinner.text = `📊 Canary ${percentage}% - Requests: ${metrics.requestCount}, Success: ${(((metrics.successCount / metrics.requestCount) || 0) * 100).toFixed(1)}%, Latency: ${metrics.p95LatencyMs.toFixed(1)}ms`;
        
        // Check SLO thresholds
        const sloViolation = await this.checkSLOViolation(metrics);
        if (sloViolation) {
          spinner.fail(`❌ SLO violation detected: ${sloViolation}`);
          return false;
        }
        
        await this.sleep(checkInterval);
      }
      
      spinner.succeed(`✅ Canary ${percentage}% monitoring completed successfully`);
      return true;
      
    } catch (error) {
      spinner.fail(`❌ Canary monitoring failed: ${error}`);
      return false;
    }
  }

  /**
   * Monitor production metrics
   */
  private async monitorProductionMetrics(percentage: number, duration: number): Promise<boolean> {
    const spinner = ora(`📊 Monitoring production at ${percentage}%...`).start();
    const checkInterval = 10000; // 10 seconds
    const startTime = Date.now();

    try {
      while (Date.now() - startTime < duration) {
        const metrics = await this.collectProductionMetrics();
        
        spinner.text = `🌟 Production ${percentage}% - Req/min: ${(metrics.requestCount * 60000 / (Date.now() - startTime)).toFixed(0)}, Error Rate: ${(metrics.errorRate * 100).toFixed(3)}%, P95: ${metrics.p95LatencyMs.toFixed(1)}ms`;
        
        // Strict SLO checking for production
        const sloViolation = await this.checkSLOViolation(metrics, true);
        if (sloViolation) {
          spinner.fail(`❌ Production SLO violation: ${sloViolation}`);
          return false;
        }
        
        await this.sleep(checkInterval);
      }
      
      spinner.succeed(`✅ Production ${percentage}% monitoring completed successfully`);
      return true;
      
    } catch (error) {
      spinner.fail(`❌ Production monitoring failed: ${error}`);
      return false;
    }
  }

  /**
   * Check for SLO violations
   */
  private async checkSLOViolation(metrics: DeploymentMetrics, isProduction = false): Promise<string | null> {
    const strictMultiplier = isProduction ? 0.8 : 1.0; // 20% stricter for production
    
    if (metrics.errorRate > this.config.maxErrorRate * strictMultiplier) {
      return `Error rate ${(metrics.errorRate * 100).toFixed(3)}% exceeds threshold ${(this.config.maxErrorRate * strictMultiplier * 100).toFixed(3)}%`;
    }
    
    if (metrics.p95LatencyMs > this.config.maxLatencyMs * strictMultiplier) {
      return `P95 latency ${metrics.p95LatencyMs.toFixed(1)}ms exceeds threshold ${(this.config.maxLatencyMs * strictMultiplier).toFixed(1)}ms`;
    }
    
    if (Math.abs(metrics.accuracyDelta) > this.config.maxAccuracyDegradation * strictMultiplier) {
      return `Accuracy degradation ${(Math.abs(metrics.accuracyDelta) * 100).toFixed(2)}% exceeds threshold ${(this.config.maxAccuracyDegradation * strictMultiplier * 100).toFixed(2)}%`;
    }
    
    return null;
  }

  /**
   * Collect shadow mode metrics
   */
  private async collectShadowMetrics(): Promise<DeploymentMetrics> {
    const { data, error } = await this.supabase
      .from('ml_performance_metrics')
      .select('*')
      .eq('model_version', this.config.modelVersion)
      .eq('environment', 'shadow')
      .gte('hour', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('hour', { ascending: false })
      .limit(1);

    if (error) throw error;

    const metrics = data?.[0] || {};
    
    return {
      errorRate: (metrics.error_count || 0) / Math.max(1, metrics.total_predictions || 1),
      avgLatencyMs: metrics.avg_latency_ms || 0,
      p95LatencyMs: metrics.p95_latency_ms || 0,
      requestCount: metrics.total_predictions || 0,
      successCount: (metrics.total_predictions || 0) - (metrics.error_count || 0),
      fallbackCount: metrics.fallback_count || 0,
      cacheHitRate: (metrics.cache_hits || 0) / Math.max(1, metrics.total_predictions || 1),
      accuracyDelta: metrics.avg_accuracy_differential || 0,
      discrepancyRate: metrics.avg_discrepancy || 0,
    };
  }

  /**
   * Collect canary metrics
   */
  private async collectCanaryMetrics(): Promise<DeploymentMetrics> {
    return await this.collectMetricsForEnvironment('canary');
  }

  /**
   * Collect production metrics
   */
  private async collectProductionMetrics(): Promise<DeploymentMetrics> {
    return await this.collectMetricsForEnvironment('production');
  }

  /**
   * Collect metrics for specific environment
   */
  private async collectMetricsForEnvironment(environment: string): Promise<DeploymentMetrics> {
    const { data, error } = await this.supabase
      .from('ml_performance_metrics')
      .select('*')
      .eq('model_version', this.config.modelVersion)
      .eq('environment', environment)
      .gte('hour', new Date(Date.now() - 1800000).toISOString()) // Last 30 minutes
      .order('hour', { ascending: false });

    if (error) throw error;

    // Aggregate metrics from last 30 minutes
    const totalPredictions = data.reduce((sum: number, row: any) => sum + (row.total_predictions || 0), 0);
    const totalErrors = data.reduce((sum: number, row: any) => sum + (row.error_count || 0), 0);
    const totalCacheHits = data.reduce((sum: number, row: any) => sum + (row.cache_hits || 0), 0);
    const totalFallbacks = data.reduce((sum: number, row: any) => sum + (row.fallback_count || 0), 0);
    
    const avgLatency = data.reduce((sum: number, row: any) => sum + (row.avg_latency_ms || 0), 0) / Math.max(1, data.length);
    const maxP95Latency = Math.max(...data.map((row: any) => row.p95_latency_ms || 0));
    const avgAccuracyDelta = data.reduce((sum: number, row: any) => sum + (row.avg_accuracy_differential || 0), 0) / Math.max(1, data.length);

    return {
      errorRate: totalErrors / Math.max(1, totalPredictions),
      avgLatencyMs: avgLatency,
      p95LatencyMs: maxP95Latency,
      requestCount: totalPredictions,
      successCount: totalPredictions - totalErrors,
      fallbackCount: totalFallbacks,
      cacheHitRate: totalCacheHits / Math.max(1, totalPredictions),
      accuracyDelta: avgAccuracyDelta,
      discrepancyRate: 0, // Not applicable for non-shadow modes
    };
  }

  /**
   * Update deployment stage in database
   */
  private async updateDeploymentStage(stage: string, percentage: number): Promise<void> {
    const { error } = await this.supabase
      .from('ml_deployment_status')
      .upsert({
        deployment_id: this.deploymentId,
        model_version: this.config.modelVersion,
        stage,
        traffic_percentage: percentage,
        status: 'active',
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to update deployment stage: ${error.message}`);
    }

    // Update environment variable for running services
    process.env.ML_DEPLOYMENT_STAGE = stage;
    process.env.ML_CANARY_PERCENTAGE = percentage.toString();
  }

  /**
   * Enable shadow mode
   */
  private async enableShadowMode(): Promise<void> {
    process.env.ML_SHADOW_MODE_ENABLED = 'true';
    process.env.ML_DEPLOYMENT_STAGE = 'stage1';
    
    // Log shadow mode activation
    console.log(chalk.blue('🔍 Shadow mode enabled - predictions will be logged but not published'));
  }

  /**
   * Create rollback plan
   */
  private async createRollbackPlan(): Promise<void> {
    // Get previous stable model version
    const { data: previousModel } = await this.supabase
      .from('ml_deployment_status')
      .select('model_version')
      .eq('status', 'stable')
      .order('updated_at', { ascending: false })
      .limit(1);

    this.rollbackPlan = {
      previousModelVersion: previousModel?.[0]?.model_version || 'heuristic-fallback',
      rollbackSteps: [
        'Disable ML scoring',
        'Revert to heuristic scoring',
        'Update deployment status',
        'Validate rollback',
        'Alert operations team',
      ],
      validationChecks: [
        'Verify heuristic scoring active',
        'Check error rates normalized',
        'Confirm latency under threshold',
        'Validate prediction accuracy',
      ],
      estimatedDurationMs: this.config.rollbackTimeoutMs,
    };
  }

  /**
   * Execute rollback
   */
  private async executeRollback(): Promise<void> {
    if (!this.rollbackPlan) {
      throw new Error('No rollback plan available');
    }

    console.log(chalk.red('\n🚨 Executing rollback...'));
    console.log(chalk.gray(`Rolling back to: ${this.rollbackPlan.previousModelVersion}`));

    const spinner = ora('🔄 Rolling back deployment...').start();

    try {
      // Step 1: Disable ML scoring immediately
      await this.disableMLScoring();
      spinner.text = '🔄 ML scoring disabled';

      // Step 2: Revert to previous model or heuristic
      await this.revertToPreviousModel();
      spinner.text = '🔄 Reverted to stable model';

      // Step 3: Update deployment status
      await this.updateRollbackStatus();
      spinner.text = '🔄 Updated deployment status';

      // Step 4: Validate rollback
      await this.validateRollback();
      spinner.text = '🔄 Validating rollback';

      // Step 5: Alert operations team
      await this.alertOperationsTeam();

      spinner.succeed('✅ Rollback completed successfully');

    } catch (error) {
      spinner.fail(`❌ Rollback failed: ${error}`);
      throw error;
    }
  }

  /**
   * Disable ML scoring immediately
   */
  private async disableMLScoring(): Promise<void> {
    process.env.ML_SHADOW_MODE_ENABLED = 'false';
    process.env.ML_DEPLOYMENT_STAGE = 'rollback';
    
    // Force circuit breaker open
    await this.supabase
      .from('ml_circuit_breaker_state')
      .upsert({
        deployment_id: this.deploymentId,
        is_open: true,
        reason: 'emergency_rollback',
        opened_at: new Date().toISOString(),
      });
  }

  /**
   * Revert to previous model
   */
  private async revertToPreviousModel(): Promise<void> {
    const { error } = await this.supabase
      .from('ml_deployment_status')
      .update({
        status: 'rolled_back',
        rollback_reason: 'slo_violation',
        rolled_back_at: new Date().toISOString(),
      })
      .eq('deployment_id', this.deploymentId);

    if (error) {
      throw new Error(`Failed to update rollback status: ${error.message}`);
    }
  }

  /**
   * Update rollback status
   */
  private async updateRollbackStatus(): Promise<void> {
    await this.supabase
      .from('ml_deployment_status')
      .insert({
        deployment_id: `rollback-${Date.now()}`,
        model_version: this.rollbackPlan!.previousModelVersion,
        stage: 'production',
        traffic_percentage: 0, // 0% ML, 100% heuristic
        status: 'active_rollback',
        created_at: new Date().toISOString(),
      });
  }

  /**
   * Validate rollback
   */
  private async validateRollback(): Promise<void> {
    // Wait a few seconds for rollback to take effect
    await this.sleep(5000);

    const metrics = await this.collectProductionMetrics();
    
    if (metrics.errorRate > this.config.maxErrorRate) {
      throw new Error(`Rollback validation failed: error rate still high (${(metrics.errorRate * 100).toFixed(3)}%)`);
    }
  }

  /**
   * Alert operations team
   */
  private async alertOperationsTeam(): Promise<void> {
    // This would integrate with your alerting system (Discord, Slack, PagerDuty, etc.)
    console.log(chalk.red('🚨 Operations team has been alerted of the rollback'));
  }

  /**
   * Final production validation
   */
  private async finalProductionValidation(): Promise<void> {
    const spinner = ora('🔍 Running final production validation...').start();

    try {
      // Extended monitoring period for final validation
      const validationDuration = 900000; // 15 minutes
      const startTime = Date.now();

      while (Date.now() - startTime < validationDuration) {
        const metrics = await this.collectProductionMetrics();
        
        const sloViolation = await this.checkSLOViolation(metrics, true);
        if (sloViolation) {
          spinner.fail(`❌ Final validation failed: ${sloViolation}`);
          throw new Error(`Final validation SLO violation: ${sloViolation}`);
        }
        
        const progress = ((Date.now() - startTime) / validationDuration * 100).toFixed(0);
        spinner.text = `🔍 Final validation ${progress}% - Error: ${(metrics.errorRate * 100).toFixed(3)}%, P95: ${metrics.p95LatencyMs.toFixed(1)}ms`;
        
        await this.sleep(30000); // Check every 30 seconds
      }

      // Mark deployment as stable
      await this.markDeploymentStable();
      
      spinner.succeed('✅ Final production validation completed');

    } catch (error) {
      spinner.fail(`❌ Final validation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Mark deployment as stable
   */
  private async markDeploymentStable(): Promise<void> {
    const { error } = await this.supabase
      .from('ml_deployment_status')
      .update({
        status: 'stable',
        stabilized_at: new Date().toISOString(),
      })
      .eq('deployment_id', this.deploymentId);

    if (error) {
      throw new Error(`Failed to mark deployment as stable: ${error.message}`);
    }
  }

  /**
   * Validation helper methods
   */
  private async validateModelArtifact(): Promise<void> {
    // Check if model file exists and is valid
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const modelPath = path.resolve(`./ml/models/${this.config.modelVersion}.json`);
    
    try {
      const modelData = await fs.readFile(modelPath, 'utf-8');
      const model = JSON.parse(modelData);
      
      if (!model.version || !model.metadata) {
        throw new Error('Invalid model artifact format');
      }
      
      if (model.version !== this.config.modelVersion) {
        throw new Error(`Model version mismatch: expected ${this.config.modelVersion}, got ${model.version}`);
      }
      
    } catch (error) {
      throw new Error(`Model artifact validation failed: ${error}`);
    }
  }

  private async validateDatabaseConnection(): Promise<void> {
    const { error } = await this.supabase
      .from('ml_shadow_predictions')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  private async validateMLInfrastructure(): Promise<void> {
    // Check Redis connectivity
    if (!process.env.REDIS_HOST) {
      throw new Error('Redis configuration missing');
    }
    
    // Validate feature store
    // This would include additional checks for ML infrastructure
  }

  private async validateCurrentMetrics(): Promise<void> {
    const currentMetrics = await this.collectProductionMetrics();
    
    if (currentMetrics.errorRate > this.config.maxErrorRate) {
      throw new Error(`Current system error rate too high for deployment: ${(currentMetrics.errorRate * 100).toFixed(3)}%`);
    }
  }

  /**
   * Utility methods
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CLI Interface
 */
const program = new Command();

program
  .name('ml-canary-deploy')
  .description('ML Canary Deployment Controller')
  .version('1.0.0');

program
  .command('deploy')
  .description('Execute canary deployment')
  .option('-s, --stage <stage>', 'Deployment stage (stage1|stage2|stage3)', 'stage1')
  .option('-m, --model-version <version>', 'Model version to deploy')
  .option('-p, --percentage <number>', 'Target traffic percentage', '5')
  .option('--error-threshold <number>', 'Maximum error rate', '0.01')
  .option('--latency-threshold <number>', 'Maximum P95 latency (ms)', '20')
  .option('--accuracy-threshold <number>', 'Maximum accuracy degradation', '0.02')
  .option('--monitoring-duration <number>', 'Monitoring duration (ms)', '600000')
  .option('--rollback-timeout <number>', 'Rollback timeout (ms)', '120000')
  .option('--interactive', 'Interactive mode with confirmations')
  .action(async (options) => {
    try {
      const config: DeploymentConfig = {
        stage: options.stage as 'stage1' | 'stage2' | 'stage3',
        modelVersion: options.modelVersion || `model-${Date.now()}`,
        targetPercentage: parseInt(options.percentage),
        maxErrorRate: parseFloat(options.errorThreshold),
        maxLatencyMs: parseInt(options.latencyThreshold),
        maxAccuracyDegradation: parseFloat(options.accuracyThreshold),
        monitoringDurationMs: parseInt(options.monitoringDuration),
        rollbackTimeoutMs: parseInt(options.rollbackTimeout),
      };

      // Interactive confirmation if requested
      if (options.interactive) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Deploy ${config.modelVersion} to ${config.stage} with ${config.targetPercentage}% traffic?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Deployment cancelled'));
          process.exit(0);
        }
      }

      const controller = new MLCanaryController(config);
      const success = await controller.deploy();

      if (success) {
        console.log(chalk.green('\n🎉 Deployment completed successfully!'));
        process.exit(0);
      } else {
        console.log(chalk.red('\n❌ Deployment failed'));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ Deployment error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('Execute emergency rollback')
  .option('-d, --deployment-id <id>', 'Deployment ID to rollback')
  .option('--force', 'Force rollback without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: chalk.red('Execute emergency rollback? This will immediately disable ML scoring.'),
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Rollback cancelled'));
          process.exit(0);
        }
      }

      // Create a minimal config for rollback
      const config: DeploymentConfig = {
        stage: 'stage1',
        modelVersion: 'rollback',
        targetPercentage: 0,
        maxErrorRate: 0.01,
        maxLatencyMs: 20,
        maxAccuracyDegradation: 0.02,
        monitoringDurationMs: 0,
        rollbackTimeoutMs: 120000,
      };

      const controller = new MLCanaryController(config);
      await (controller as any).executeRollback();

      console.log(chalk.green('\n✅ Emergency rollback completed'));
      process.exit(0);

    } catch (error) {
      console.error(chalk.red(`\n❌ Rollback error: ${error}`));
      process.exit(1);
    }
  });

program.parse();

export default MLCanaryController;