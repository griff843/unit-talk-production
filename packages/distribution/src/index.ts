/**
 * @unit-talk/distribution
 *
 * Content distribution channels for Unit Talk Platform.
 *
 * SPRINT-REPO-TRUTH-LOCK-002: Populated with canonical distribution types.
 * SPRINT-REPO-ARCHITECTURE-NORMALIZATION-001: Shell created for Blueprint v2 alignment.
 *
 * Agents (DiscordPromotionAgent, NotificationAgent, RecapAgent) remain in apps/api/
 * but will implement the DistributionChannel interface in a future sprint.
 */

export {
  type PublishPickPayload,
  type PublishAlertPayload,
  type PublishRecapPayload,
  type DistributionResult,
  type DistributionChannel,
} from './types';
