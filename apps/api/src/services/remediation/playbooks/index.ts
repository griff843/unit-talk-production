/**
 * @fileoverview Playbook Exports
 *
 * Barrel exports for all remediation playbooks.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/playbooks
 */

// Base class
export { BasePlaybook } from './BasePlaybook';

// Playbook implementations
export { MVRefreshLagPlaybook } from './MVRefreshLagPlaybook';
export { PipelineLagThrottlePlaybook } from './PipelineLagThrottlePlaybook';
export { CreditBurnThrottlePlaybook } from './CreditBurnThrottlePlaybook';
export { DiscordBacklogNudgePlaybook } from './DiscordBacklogNudgePlaybook';
export { SLOEvaluatorStuckPlaybook } from './SLOEvaluatorStuckPlaybook';

// Type imports for convenience
import { IPlaybook, PlaybookId } from '../types';

import { CreditBurnThrottlePlaybook } from './CreditBurnThrottlePlaybook';
import { DiscordBacklogNudgePlaybook } from './DiscordBacklogNudgePlaybook';
import { MVRefreshLagPlaybook } from './MVRefreshLagPlaybook';
import { PipelineLagThrottlePlaybook } from './PipelineLagThrottlePlaybook';
import { SLOEvaluatorStuckPlaybook } from './SLOEvaluatorStuckPlaybook';

/**
 * Factory function to create all playbook instances
 */
export function createAllPlaybooks(): Map<PlaybookId, IPlaybook> {
  const playbooks = new Map<PlaybookId, IPlaybook>();

  playbooks.set('MV_REFRESH_LAG', new MVRefreshLagPlaybook());
  playbooks.set('PIPELINE_LAG_THROTTLE', new PipelineLagThrottlePlaybook());
  playbooks.set('CREDIT_BURN_THROTTLE', new CreditBurnThrottlePlaybook());
  playbooks.set('DISCORD_BACKLOG_NUDGE', new DiscordBacklogNudgePlaybook());
  playbooks.set('SLO_EVALUATOR_STUCK', new SLOEvaluatorStuckPlaybook());

  return playbooks;
}

/**
 * Register all playbooks with the registry
 */
export async function registerAllPlaybooks(registry: {
  register: (playbook: IPlaybook) => void;
}): Promise<void> {
  const playbooks = createAllPlaybooks();

  for (const [_id, playbook] of playbooks) {
    registry.register(playbook);
  }
}
