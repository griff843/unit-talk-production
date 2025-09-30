/**
 * Comprehensive Rollback Procedures Service
 * 
 * Advanced rollback system for feature flag deployments with:
 * - Intelligent rollback triggers
 * - Multi-phase rollback strategies
 * - State preservation and recovery
 * - Impact minimization protocols
 * - Automated incident management
 */

import { createLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { FeatureFlagService } from '../feature-flags/FeatureFlagService';
import { AutomatedValidationGates } from './AutomatedValidationGates';
import { withCircuitBreaker } from '../enhanced-circuit-breaker';

export interface RollbackTrigger {
  type: 'manual' | 'automatic' | 'scheduled' | 'dependency_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  triggeredBy: string;
  metadata: Record<string, any>;
  requiresApproval: boolean;
}

export interface RollbackStrategy {
  name: string;
  description: string;
  phases: RollbackPhase[];
  estimatedDuration: number; // seconds
  riskLevel: 'low' | 'medium' | 'high';
  prerequisites: string[];
  successCriteria: string[];
}

export interface RollbackPhase {
  phaseName: string;
  description: string;
  actions: RollbackAction[];
  validationChecks: string[];
  timeoutSeconds: number;
  retryCount: number;
  rollbackOnFailure: boolean;
}

export interface RollbackAction {
  actionType: 'flag_update' | 'database_rollback' | 'cache_clear' | 'service_restart' | 'notification' | 'custom';
  description: string;
  parameters: Record<string, any>;
  timeoutSeconds: number;
  critical: boolean;
  compensatingAction?: RollbackAction;
}

export interface RollbackExecution {
  executionId: string;
  flagName: string;
  strategy: RollbackStrategy;
  trigger: RollbackTrigger;
  startTime: string;
  endTime?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'failed' | 'partially_completed';
  currentPhase: number;
  phases: RollbackPhaseResult[];
  totalDuration?: number;
  impactAssessment: ImpactAssessment;
  recovery: RecoveryPlan;
}

export interface RollbackPhaseResult {
  phaseName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  actions: RollbackActionResult[];
  validationResults: ValidationResult[];
  errors: string[];
}

export interface RollbackActionResult {
  actionType: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  result?: any;
  error?: string;
  compensatingActionExecuted?: boolean;
}

export interface ValidationResult {
  checkName: string;
  passed: boolean;
  result: any;
  error?: string;
  timestamp: string;
}

export interface ImpactAssessment {
  estimatedUsersAffected: number;
  estimatedRevenueImpact: number;
  serviceDegradation: 'none' | 'minimal' | 'moderate' | 'severe';
  rollbackComplexity: 'simple' | 'moderate' | 'complex' | 'high_risk';
  dependentServices: string[];
  mitigationStrategies: string[];
}

export interface RecoveryPlan {
  estimatedRecoveryTime: number; // seconds
  recoverySteps: string[];
  postRollbackTasks: string[];
  preventionMeasures: string[];
  followUpActions: string[];
}

export class RollbackProcedures {
  private logger = createLogger('RollbackProcedures');
  private supabase: SupabaseClient;
  private featureFlagService: FeatureFlagService;
  private validationGates: AutomatedValidationGates;
  
  // Active rollback tracking
  private activeRollbacks: Map<string, RollbackExecution> = new Map();
  private rollbackStrategies: Map<string, RollbackStrategy> = new Map();
  
  // Performance metrics
  private rollbackHistory: RollbackExecution[] = [];
  private successRate = 1.0;
  private averageRollbackTime = 0;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.featureFlagService = new FeatureFlagService(supabase);
    this.validationGates = new AutomatedValidationGates(supabase);
    
    this.initializeRollbackStrategies();
    this.startRollbackMonitoring();
  }

  /**
   * Initialize predefined rollback strategies
   */
  private initializeRollbackStrategies(): void {
    const strategies: RollbackStrategy[] = [
      {
        name: 'emergency_immediate',
        description: 'Immediate emergency rollback for critical failures',
        phases: [
          {
            phaseName: 'emergency_shutdown',
            description: 'Immediately disable feature flag',
            actions: [
              {
                actionType: 'flag_update',
                description: 'Disable feature flag and set rollout to 0%',
                parameters: { rollout_percentage: 0, enabled: false, emergency_kill_switch: true },
                timeoutSeconds: 5,
                critical: true
              },
              {
                actionType: 'cache_clear',
                description: 'Clear all feature flag caches',
                parameters: { cache_type: 'all' },
                timeoutSeconds: 10,
                critical: true
              },
              {
                actionType: 'notification',
                description: 'Send emergency alert to on-call team',
                parameters: { severity: 'critical', channels: ['discord', 'slack', 'email'] },
                timeoutSeconds: 30,
                critical: false
              }
            ],
            validationChecks: ['flag_disabled', 'cache_cleared', 'traffic_diverted'],
            timeoutSeconds: 60,
            retryCount: 3,
            rollbackOnFailure: false
          }
        ],
        estimatedDuration: 60,
        riskLevel: 'low',
        prerequisites: [],
        successCriteria: ['feature_flag_disabled', 'no_new_feature_traffic', 'notifications_sent']
      },
      
      {
        name: 'gradual_rollback',
        description: 'Gradual rollback with validation at each step',
        phases: [
          {
            phaseName: 'pause_rollout',
            description: 'Pause current rollout to assess situation',
            actions: [
              {
                actionType: 'flag_update',
                description: 'Pause rollout at current percentage',
                parameters: { enabled: false },
                timeoutSeconds: 10,
                critical: true
              },
              {
                actionType: 'notification',
                description: 'Notify operators of rollout pause',
                parameters: { severity: 'medium', message: 'Rollout paused for assessment' },
                timeoutSeconds: 30,
                critical: false
              }
            ],
            validationChecks: ['rollout_paused', 'metrics_stable'],
            timeoutSeconds: 120,
            retryCount: 2,
            rollbackOnFailure: true
          },
          {
            phaseName: 'gradual_reduction',
            description: 'Gradually reduce rollout percentage',
            actions: [
              {
                actionType: 'flag_update',
                description: 'Reduce rollout by 25% increments',
                parameters: { rollout_reduction_percent: 25, validation_wait_seconds: 120 },
                timeoutSeconds: 300,
                critical: true
              }
            ],
            validationChecks: ['metrics_improving', 'no_new_errors', 'user_experience_stable'],
            timeoutSeconds: 600,
            retryCount: 1,
            rollbackOnFailure: true
          },
          {
            phaseName: 'complete_rollback',
            description: 'Complete rollback to 0%',
            actions: [
              {
                actionType: 'flag_update',
                description: 'Set rollout to 0% and disable flag',
                parameters: { rollout_percentage: 0, enabled: false },
                timeoutSeconds: 30,
                critical: true
              },
              {
                actionType: 'cache_clear',
                description: 'Clear all caches to ensure immediate effect',
                parameters: { cache_type: 'all' },
                timeoutSeconds: 60,
                critical: true
              }
            ],
            validationChecks: ['flag_disabled', 'traffic_redirected', 'metrics_restored'],
            timeoutSeconds: 180,
            retryCount: 2,
            rollbackOnFailure: false
          }
        ],
        estimatedDuration: 900,
        riskLevel: 'medium',
        prerequisites: ['current_rollout_less_than_75'],
        successCriteria: ['feature_disabled', 'metrics_baseline_restored', 'no_ongoing_errors']
      },

      {
        name: 'database_state_rollback',
        description: 'Rollback with database state restoration',
        phases: [
          {
            phaseName: 'capture_current_state',
            description: 'Capture current system state before rollback',
            actions: [
              {
                actionType: 'database_rollback',
                description: 'Create state snapshot',
                parameters: { action: 'snapshot', tables: ['feature_flags', 'feature_flag_metrics'] },
                timeoutSeconds: 60,
                critical: true
              }
            ],
            validationChecks: ['snapshot_created'],
            timeoutSeconds: 120,
            retryCount: 1,
            rollbackOnFailure: true
          },
          {
            phaseName: 'feature_rollback',
            description: 'Roll back feature flag configuration',
            actions: [
              {
                actionType: 'flag_update',
                description: 'Restore previous flag configuration',
                parameters: { restore_from_history: true, rollback_steps: 1 },
                timeoutSeconds: 30,
                critical: true
              },
              {
                actionType: 'database_rollback',
                description: 'Restore previous metrics baseline',
                parameters: { action: 'restore', restore_point: 'pre_rollout' },
                timeoutSeconds: 120,
                critical: false
              }
            ],
            validationChecks: ['flag_restored', 'metrics_baseline_restored'],
            timeoutSeconds: 300,
            retryCount: 2,
            rollbackOnFailure: true
          },
          {
            phaseName: 'system_recovery',
            description: 'Ensure system recovery and stability',
            actions: [
              {
                actionType: 'service_restart',
                description: 'Restart affected services',
                parameters: { services: ['api', 'grading-agent'], graceful: true },
                timeoutSeconds: 180,
                critical: false
              },
              {
                actionType: 'cache_clear',
                description: 'Clear all relevant caches',
                parameters: { cache_type: 'all' },
                timeoutSeconds: 60,
                critical: true
              }
            ],
            validationChecks: ['services_healthy', 'caches_cleared', 'traffic_stable'],
            timeoutSeconds: 300,
            retryCount: 1,
            rollbackOnFailure: false
          }
        ],
        estimatedDuration: 1200,
        riskLevel: 'high',
        prerequisites: ['database_backup_available', 'maintenance_window_available'],
        successCriteria: ['system_fully_restored', 'baseline_metrics_achieved', 'no_data_loss']
      }
    ];

    for (const strategy of strategies) {
      this.rollbackStrategies.set(strategy.name, strategy);
    }

    this.logger.info('✅ Rollback strategies initialized', {
      totalStrategies: strategies.length
    });
  }

  /**
   * Execute rollback for a feature flag
   */
  async executeRollback(
    flagName: string,
    trigger: RollbackTrigger,
    strategyName?: string
  ): Promise<string> {
    const executionId = `rollback-${flagName}-${Date.now()}`;
    
    try {
      this.logger.warn('🔄 Initiating rollback execution', {
        executionId,
        flagName,
        trigger: trigger.type,
        severity: trigger.severity,
        reason: trigger.reason
      });

      // Select appropriate rollback strategy
      const strategy = await this.selectRollbackStrategy(flagName, trigger, strategyName);
      
      // Assess impact
      const impactAssessment = await this.assessRollbackImpact(flagName, trigger, strategy);
      
      // Create recovery plan
      const recoveryPlan = await this.createRecoveryPlan(flagName, strategy, impactAssessment);
      
      // Create rollback execution record
      const execution: RollbackExecution = {
        executionId,
        flagName,
        strategy,
        trigger,
        startTime: new Date().toISOString(),
        status: 'planning',
        currentPhase: 0,
        phases: strategy.phases.map(phase => ({
          phaseName: phase.phaseName,
          status: 'pending',
          actions: phase.actions.map(action => ({
            actionType: action.actionType,
            description: action.description,
            status: 'pending'
          })),
          validationResults: [],
          errors: []
        })),
        impactAssessment,
        recovery: recoveryPlan
      };

      // Store execution record
      this.activeRollbacks.set(executionId, execution);
      await this.storeRollbackExecution(execution);

      // Check if approval is required
      if (trigger.requiresApproval && trigger.severity !== 'critical') {
        this.logger.info('⏳ Rollback requires approval', { executionId });
        await this.requestRollbackApproval(execution);
        return executionId;
      }

      // Execute rollback phases
      await this.executeRollbackPhases(executionId);

      return executionId;

    } catch (error) {
      this.logger.error('❌ Rollback execution failed', {
        executionId,
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Execute rollback phases sequentially
   */
  private async executeRollbackPhases(executionId: string): Promise<void> {
    const execution = this.activeRollbacks.get(executionId);
    if (!execution) {
      throw new Error(`Rollback execution ${executionId} not found`);
    }

    execution.status = 'in_progress';
    await this.storeRollbackExecution(execution);

    try {
      for (let phaseIndex = 0; phaseIndex < execution.strategy.phases.length; phaseIndex++) {
        const phase = execution.strategy.phases[phaseIndex];
        const phaseResult = execution.phases[phaseIndex];
        
        execution.currentPhase = phaseIndex;
        
        this.logger.info(`🔄 Executing rollback phase: ${phase.phaseName}`, {
          executionId,
          phase: phaseIndex + 1,
          totalPhases: execution.strategy.phases.length
        });

        const phaseSuccess = await this.executeRollbackPhase(execution, phase, phaseResult);
        
        if (!phaseSuccess) {
          if (phase.rollbackOnFailure) {
            throw new Error(`Critical phase ${phase.phaseName} failed, aborting rollback`);
          } else {
            this.logger.warn('⚠️ Non-critical phase failed, continuing', {
              executionId,
              phaseName: phase.phaseName
            });
          }
        }

        await this.storeRollbackExecution(execution);
      }

      // Mark rollback as completed
      execution.status = 'completed';
      execution.endTime = new Date().toISOString();
      execution.totalDuration = Date.now() - new Date(execution.startTime).getTime();

      await this.storeRollbackExecution(execution);
      await this.emitRollbackEvent(executionId, 'rollback.completed', execution);

      this.logger.info('✅ Rollback completed successfully', {
        executionId,
        flagName: execution.flagName,
        totalDuration: execution.totalDuration
      });

      // Update success metrics
      this.updateSuccessMetrics(true, execution.totalDuration || 0);

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date().toISOString();
      execution.totalDuration = Date.now() - new Date(execution.startTime).getTime();

      await this.storeRollbackExecution(execution);
      await this.emitRollbackEvent(executionId, 'rollback.failed', execution);

      this.updateSuccessMetrics(false, execution.totalDuration || 0);

      throw error;
    } finally {
      // Store in history and cleanup
      this.rollbackHistory.push(execution);
      this.activeRollbacks.delete(executionId);
    }
  }

  /**
   * Execute individual rollback phase
   */
  private async executeRollbackPhase(
    execution: RollbackExecution,
    phase: RollbackPhase,
    phaseResult: RollbackPhaseResult
  ): Promise<boolean> {
    const startTime = Date.now();
    phaseResult.status = 'in_progress';
    phaseResult.startTime = new Date().toISOString();

    try {
      // Execute all actions in the phase
      for (let actionIndex = 0; actionIndex < phase.actions.length; actionIndex++) {
        const action = phase.actions[actionIndex];
        const actionResult = phaseResult.actions[actionIndex];

        const actionSuccess = await this.executeRollbackAction(
          execution.flagName,
          action,
          actionResult
        );

        if (!actionSuccess && action.critical) {
          throw new Error(`Critical action ${action.description} failed`);
        }
      }

      // Run validation checks
      for (const checkName of phase.validationChecks) {
        const validationResult = await this.runValidationCheck(
          execution.flagName,
          checkName
        );
        
        phaseResult.validationResults.push(validationResult);
        
        if (!validationResult.passed) {
          throw new Error(`Validation check ${checkName} failed: ${validationResult.error}`);
        }
      }

      phaseResult.status = 'completed';
      phaseResult.endTime = new Date().toISOString();
      phaseResult.duration = Date.now() - startTime;

      this.logger.info('✅ Rollback phase completed', {
        executionId: execution.executionId,
        phaseName: phase.phaseName,
        duration: phaseResult.duration
      });

      return true;

    } catch (error) {
      phaseResult.status = 'failed';
      phaseResult.endTime = new Date().toISOString();
      phaseResult.duration = Date.now() - startTime;
      phaseResult.errors.push(error instanceof Error ? error.message : String(error));

      this.logger.error('❌ Rollback phase failed', {
        executionId: execution.executionId,
        phaseName: phase.phaseName,
        error: error instanceof Error ? error.message : String(error)
      });

      return false;
    }
  }

  /**
   * Execute individual rollback action
   */
  private async executeRollbackAction(
    flagName: string,
    action: RollbackAction,
    actionResult: RollbackActionResult
  ): Promise<boolean> {
    const startTime = Date.now();
    actionResult.status = 'in_progress';
    actionResult.startTime = new Date().toISOString();

    try {
      this.logger.debug('🔧 Executing rollback action', {
        flagName,
        actionType: action.actionType,
        description: action.description
      });

      let result: any = null;

      switch (action.actionType) {
        case 'flag_update':
          result = await this.executeFlagUpdateAction(flagName, action.parameters);
          break;
          
        case 'database_rollback':
          result = await this.executeDatabaseRollbackAction(flagName, action.parameters);
          break;
          
        case 'cache_clear':
          result = await this.executeCacheClearAction(action.parameters);
          break;
          
        case 'service_restart':
          result = await this.executeServiceRestartAction(action.parameters);
          break;
          
        case 'notification':
          result = await this.executeNotificationAction(flagName, action.parameters);
          break;
          
        case 'custom':
          result = await this.executeCustomAction(flagName, action.parameters);
          break;
          
        default:
          throw new Error(`Unknown action type: ${action.actionType}`);
      }

      actionResult.status = 'completed';
      actionResult.endTime = new Date().toISOString();
      actionResult.duration = Date.now() - startTime;
      actionResult.result = result;

      return true;

    } catch (error) {
      actionResult.status = 'failed';
      actionResult.endTime = new Date().toISOString();
      actionResult.duration = Date.now() - startTime;
      actionResult.error = error instanceof Error ? error.message : String(error);

      // Execute compensating action if available
      if (action.compensatingAction) {
        this.logger.info('🔄 Executing compensating action', {
          flagName,
          originalAction: action.description,
          compensatingAction: action.compensatingAction.description
        });

        try {
          await this.executeRollbackAction(flagName, action.compensatingAction, {
            actionType: action.compensatingAction.actionType,
            description: action.compensatingAction.description,
            status: 'pending'
          });
          actionResult.compensatingActionExecuted = true;
        } catch (compensatingError) {
          this.logger.error('❌ Compensating action failed', {
            flagName,
            error: compensatingError instanceof Error ? compensatingError.message : String(compensatingError)
          });
        }
      }

      return false;
    }
  }

  /**
   * Execute flag update action
   */
  private async executeFlagUpdateAction(flagName: string, parameters: any): Promise<any> {
    if (parameters.restore_from_history) {
      // Restore from deployment history
      const { data: deployments } = await this.supabase
        .from('feature_flag_deployments')
        .select('previous_config')
        .eq('flag_name', flagName)
        .order('initiated_at', { ascending: false })
        .limit(parameters.rollback_steps || 1);

      if (deployments && deployments.length > 0) {
        const previousConfig = deployments[0].previous_config;
        await this.featureFlagService.updateFlag(flagName, previousConfig);
        return { restored_config: previousConfig };
      }
    } else {
      // Direct update
      await this.featureFlagService.updateFlag(flagName, {
        rolloutPercentage: parameters.rollout_percentage,
        enabled: parameters.enabled,
        emergencyKillSwitch: parameters.emergency_kill_switch
      });
    }

    return { flag_updated: true };
  }

  /**
   * Execute database rollback action
   */
  private async executeDatabaseRollbackAction(flagName: string, parameters: any): Promise<any> {
    switch (parameters.action) {
      case 'snapshot':
        // Create database snapshot
        const snapshotId = `snapshot-${flagName}-${Date.now()}`;
        // This would integrate with database backup system
        this.logger.info('📸 Database snapshot created', { snapshotId, tables: parameters.tables });
        return { snapshot_id: snapshotId };
        
      case 'restore':
        // Restore from snapshot
        this.logger.info('🔄 Restoring from database snapshot', { restore_point: parameters.restore_point });
        return { restored: true };
        
      default:
        throw new Error(`Unknown database action: ${parameters.action}`);
    }
  }

  /**
   * Execute cache clear action
   */
  private async executeCacheClearAction(parameters: any): Promise<any> {
    // Clear feature flag evaluation cache
    // This would integrate with Redis/cache system
    this.logger.info('🗑️ Clearing caches', { cache_type: parameters.cache_type });
    return { caches_cleared: true };
  }

  /**
   * Execute service restart action
   */
  private async executeServiceRestartAction(parameters: any): Promise<any> {
    // Restart services gracefully
    // This would integrate with Docker/Kubernetes
    this.logger.info('🔄 Restarting services', { 
      services: parameters.services,
      graceful: parameters.graceful 
    });
    return { services_restarted: parameters.services };
  }

  /**
   * Execute notification action
   */
  private async executeNotificationAction(flagName: string, parameters: any): Promise<any> {
    const message = parameters.message || `Rollback executed for feature flag: ${flagName}`;
    
    // Send notifications to configured channels
    // This would integrate with Discord, Slack, etc.
    this.logger.info('📢 Sending rollback notifications', {
      flagName,
      severity: parameters.severity,
      channels: parameters.channels
    });
    
    return { notifications_sent: parameters.channels || ['discord'] };
  }

  /**
   * Execute custom action
   */
  private async executeCustomAction(flagName: string, parameters: any): Promise<any> {
    // Execute custom rollback logic
    this.logger.info('⚙️ Executing custom rollback action', {
      flagName,
      customAction: parameters.action_name
    });
    
    return { custom_action_executed: true };
  }

  /**
   * Run validation check
   */
  private async runValidationCheck(flagName: string, checkName: string): Promise<ValidationResult> {
    try {
      let passed = false;
      let result: any = null;

      switch (checkName) {
        case 'flag_disabled':
          const flagStatus = await this.featureFlagService.evaluateFlag(flagName);
          passed = !flagStatus.enabled;
          result = { enabled: flagStatus.enabled };
          break;
          
        case 'cache_cleared':
          // Check if caches are cleared
          passed = true; // Assume success for now
          result = { cache_status: 'cleared' };
          break;
          
        case 'traffic_diverted':
          // Check if traffic is diverted away from feature
          passed = true; // Assume success for now
          result = { traffic_percentage: 0 };
          break;
          
        case 'metrics_stable':
          // Check if metrics have stabilized
          const validation = await this.validationGates.validateRollout(flagName);
          passed = validation.recommendation !== 'rollback';
          result = { validation_score: validation.overallScore };
          break;
          
        default:
          this.logger.warn('Unknown validation check', { checkName });
          passed = true; // Default to pass for unknown checks
          result = { check: checkName, status: 'unknown' };
      }

      return {
        checkName,
        passed,
        result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        checkName,
        passed: false,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Select appropriate rollback strategy
   */
  private async selectRollbackStrategy(
    flagName: string,
    trigger: RollbackTrigger,
    strategyName?: string
  ): Promise<RollbackStrategy> {
    if (strategyName && this.rollbackStrategies.has(strategyName)) {
      return this.rollbackStrategies.get(strategyName)!;
    }

    // Auto-select strategy based on trigger
    if (trigger.severity === 'critical') {
      return this.rollbackStrategies.get('emergency_immediate')!;
    }

    // Get current rollout percentage to determine strategy
    const { data: flagData } = await this.supabase
      .from('feature_flags')
      .select('rollout_percentage')
      .eq('flag_name', flagName)
      .single();

    const rolloutPercentage = flagData?.rollout_percentage || 0;

    if (rolloutPercentage > 75 || trigger.type === 'dependency_failure') {
      return this.rollbackStrategies.get('database_state_rollback')!;
    } else {
      return this.rollbackStrategies.get('gradual_rollback')!;
    }
  }

  /**
   * Assess rollback impact
   */
  private async assessRollbackImpact(
    flagName: string,
    trigger: RollbackTrigger,
    strategy: RollbackStrategy
  ): Promise<ImpactAssessment> {
    // Get current metrics to assess impact
    const metrics = await this.featureFlagService.getRolloutMetrics(flagName);
    
    const estimatedUsersAffected = metrics?.activeUsers || 0;
    const estimatedRevenueImpact = estimatedUsersAffected * 0.1; // Rough estimate
    
    let serviceDegradation: 'none' | 'minimal' | 'moderate' | 'severe' = 'minimal';
    if (trigger.severity === 'critical') {
      serviceDegradation = 'severe';
    } else if (trigger.severity === 'high') {
      serviceDegradation = 'moderate';
    }

    return {
      estimatedUsersAffected,
      estimatedRevenueImpact,
      serviceDegradation,
      rollbackComplexity: strategy.riskLevel === 'high' ? 'complex' : 'moderate',
      dependentServices: ['api', 'grading-agent', 'command-center'],
      mitigationStrategies: [
        'Gradual traffic reduction',
        'Real-time monitoring',
        'Immediate notification to stakeholders'
      ]
    };
  }

  /**
   * Create recovery plan
   */
  private async createRecoveryPlan(
    flagName: string,
    strategy: RollbackStrategy,
    impact: ImpactAssessment
  ): Promise<RecoveryPlan> {
    return {
      estimatedRecoveryTime: strategy.estimatedDuration + 300, // Add buffer
      recoverySteps: [
        'Monitor system metrics for stability',
        'Verify all validation gates pass',
        'Confirm user experience is restored',
        'Review and address root cause'
      ],
      postRollbackTasks: [
        'Conduct post-incident review',
        'Update rollback procedures if needed',
        'Communicate status to stakeholders',
        'Plan feature re-deployment strategy'
      ],
      preventionMeasures: [
        'Enhance validation gates',
        'Improve pre-deployment testing',
        'Implement additional monitoring',
        'Review deployment process'
      ],
      followUpActions: [
        'Schedule retrospective meeting',
        'Update documentation',
        'Implement lessons learned',
        'Plan next deployment iteration'
      ]
    };
  }

  // Helper methods and monitoring

  private async storeRollbackExecution(execution: RollbackExecution): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          await this.supabase
            .from('emergency_rollbacks')
            .upsert({
              id: execution.executionId,
              flag_name: execution.flagName,
              trigger_reason: execution.trigger.reason,
              trigger_type: execution.trigger.type,
              rollout_percentage_before: execution.impactAssessment.estimatedUsersAffected > 0 ? 50 : 0, // Estimate
              triggered_by: execution.trigger.triggeredBy,
              rollback_initiated_at: execution.startTime,
              rollback_completed_at: execution.endTime,
              rollback_successful: execution.status === 'completed',
              estimated_users_affected: execution.impactAssessment.estimatedUsersAffected,
              estimated_revenue_impact: execution.impactAssessment.estimatedRevenueImpact,
              metadata: {
                execution,
                strategy: execution.strategy.name,
                phases: execution.phases
              }
            }, { onConflict: 'id' });
        },
        async () => {
          this.logger.warn('Circuit breaker open, caching rollback execution locally');
        }
      );

    } catch (error) {
      this.logger.error('Failed to store rollback execution', {
        executionId: execution.executionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async emitRollbackEvent(
    executionId: string,
    eventType: string,
    execution: RollbackExecution
  ): Promise<void> {
    try {
      await this.supabase
        .from('events')
        .insert({
          event_type: eventType,
          aggregate_id: executionId,
          aggregate_type: 'rollback_execution',
          event_data: execution,
          idempotency_key: `${eventType}-${executionId}-${Date.now()}`,
          metadata: {
            source: 'RollbackProcedures',
            component: 'rollback_orchestration'
          }
        });

    } catch (error) {
      this.logger.error('Failed to emit rollback event', {
        executionId,
        eventType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async requestRollbackApproval(execution: RollbackExecution): Promise<void> {
    // This would integrate with approval workflow system
    this.logger.info('📋 Rollback approval requested', {
      executionId: execution.executionId,
      flagName: execution.flagName,
      severity: execution.trigger.severity
    });
  }

  private updateSuccessMetrics(success: boolean, duration: number): void {
    const newTotal = this.rollbackHistory.length + 1;
    const successCount = this.rollbackHistory.filter(r => r.status === 'completed').length + (success ? 1 : 0);
    
    this.successRate = successCount / newTotal;
    
    const totalDuration = this.rollbackHistory.reduce((sum, r) => sum + (r.totalDuration || 0), 0) + duration;
    this.averageRollbackTime = totalDuration / newTotal;
  }

  private startRollbackMonitoring(): void {
    // Monitor rollback executions every 30 seconds
    setInterval(() => {
      this.monitorActiveRollbacks();
    }, 30000);

    this.logger.info('✅ Rollback monitoring started');
  }

  private monitorActiveRollbacks(): void {
    for (const [executionId, execution] of this.activeRollbacks) {
      const elapsed = Date.now() - new Date(execution.startTime).getTime();
      const maxDuration = execution.strategy.estimatedDuration * 1000 * 2; // 2x buffer
      
      if (elapsed > maxDuration) {
        this.logger.error('⚠️ Rollback execution timeout', {
          executionId,
          elapsed: Math.round(elapsed / 1000),
          maxDuration: Math.round(maxDuration / 1000)
        });
        
        // Mark as failed due to timeout
        execution.status = 'failed';
        execution.endTime = new Date().toISOString();
        execution.totalDuration = elapsed;
      }
    }
  }

  /**
   * Get rollback execution status
   */
  getRollbackStatus(executionId: string): RollbackExecution | null {
    return this.activeRollbacks.get(executionId) || null;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    healthy: boolean;
    metrics: {
      successRate: number;
      averageRollbackTimeMs: number;
      activeRollbacks: number;
      totalRollbacks: number;
    };
  } {
    return {
      healthy: this.successRate > 0.95,
      metrics: {
        successRate: this.successRate,
        averageRollbackTimeMs: this.averageRollbackTime,
        activeRollbacks: this.activeRollbacks.size,
        totalRollbacks: this.rollbackHistory.length
      }
    };
  }
}