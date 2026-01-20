/**
 * @fileoverview Base Playbook Abstract Class
 *
 * Base class for all remediation playbooks.
 * Provides common functionality and enforces interface compliance.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/playbooks/BasePlaybook
 */

import { v4 as uuidv4 } from 'uuid';
import { makeLogger, Logger } from '../../../utils/logger';
import {
  ActionRecord,
  ExecutionContext,
  ExecutionResult,
  ExecutionType,
  IPlaybook,
  KnobResolutionResult,
  PlaybookId,
} from '../types';
import { KnobResolver, getKnobResolver } from '../KnobResolver';

// ============================================================================
// BasePlaybook Abstract Class
// ============================================================================

export abstract class BasePlaybook implements IPlaybook {
  abstract readonly id: PlaybookId;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly executionType: ExecutionType;
  abstract readonly requiredKnobs: string[];

  protected logger: Logger;
  protected knobResolver: KnobResolver;

  constructor(knobResolver?: KnobResolver) {
    this.knobResolver = knobResolver || getKnobResolver();
    this.logger = makeLogger(`Playbook:${this.constructor.name}`);
  }

  /**
   * Check if this playbook can execute given current knob availability
   */
  canExecute(knobs: Map<string, KnobResolutionResult>): boolean {
    if (this.executionType === 'RECOMMENDATION_ONLY') {
      return false;
    }

    for (const requiredKnob of this.requiredKnobs) {
      const resolution = knobs.get(requiredKnob);
      if (!resolution?.exists || !resolution.can_execute) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute the playbook - must be implemented by subclasses
   */
  abstract execute(context: ExecutionContext, dryRun: boolean): Promise<ExecutionResult>;

  /**
   * Get rollback steps - must be implemented by subclasses
   */
  abstract getRollbackSteps(context: ExecutionContext): string[];

  /**
   * Get recommendations when execution is not possible
   */
  abstract getRecommendations(context: ExecutionContext): string[];

  /**
   * Create a successful result
   */
  protected createSuccessResult(
    actionsTaken: ActionRecord[],
    dryRun: boolean,
    context: ExecutionContext
  ): ExecutionResult {
    return {
      success: true,
      execution_id: uuidv4(),
      playbook_id: this.id,
      execution_type: this.executionType,
      status: 'executed',
      actions_taken: actionsTaken,
      rollback_steps: this.getRollbackSteps(context),
      duration_ms: 0, // Will be filled by engine
      dry_run: dryRun,
    };
  }

  /**
   * Create a failed result
   */
  protected createFailedResult(error: string, dryRun: boolean): ExecutionResult {
    return {
      success: false,
      execution_id: uuidv4(),
      playbook_id: this.id,
      execution_type: this.executionType,
      status: 'failed',
      actions_taken: [],
      error,
      duration_ms: 0,
      dry_run: dryRun,
    };
  }

  /**
   * Create a recommendation-only result
   */
  protected createRecommendationResult(
    recommendations: string[],
    dryRun: boolean
  ): ExecutionResult {
    return {
      success: true,
      execution_id: uuidv4(),
      playbook_id: this.id,
      execution_type: 'RECOMMENDATION_ONLY',
      status: 'skipped',
      actions_taken: [],
      recommendations,
      duration_ms: 0,
      dry_run: dryRun,
    };
  }

  /**
   * Create an action record
   */
  protected createAction(
    actionType: string,
    success: boolean,
    options?: {
      targetKnob?: string;
      previousValue?: unknown;
      newValue?: unknown;
      error?: string;
    }
  ): ActionRecord {
    return {
      action_type: actionType,
      target_knob: options?.targetKnob,
      previous_value: options?.previousValue,
      new_value: options?.newValue,
      timestamp: new Date().toISOString(),
      success,
      error: options?.error,
    };
  }
}
