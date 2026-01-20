/**
 * @fileoverview Ops Services Index
 *
 * Exports all ops-related services for incident routing and digest.
 *
 * Part of PR7: Incident Routing + Ops Digest
 *
 * @module services/ops
 */

// Core router
export {
  OpsIncidentRouter,
  getOpsIncidentRouter,
  createOpsIncidentRouter,
  type IncidentRecord,
  type NotificationResult,
  type RoutingDecision,
  type OpsIncidentRouterConfig,
  type DiscordPayload,
  type NotionPayload,
} from './OpsIncidentRouter';

// Discord integration
export {
  OpsDiscordSender,
  getOpsDiscordSender,
  initializeOpsDiscordSender,
  createDiscordSenderFn,
} from './OpsDiscordSender';

// Discord embed builder
export {
  buildIncidentEmbed,
  buildDigestEmbed,
  buildEscalationContent,
  buildDigestContent,
  type OpsDigestData,
} from './OpsDiscordEmbedBuilder';

// Notion logging
export {
  OpsNotionLogger,
  getOpsNotionLogger,
  initializeOpsNotionLogger,
  createNotionSenderFn,
} from './OpsNotionLogger';

// Digest scheduler
export {
  OpsDigestScheduler,
  getOpsDigestScheduler,
  createOpsDigestScheduler,
} from './OpsDigestScheduler';

// Worker
export {
  OpsNotificationWorker,
  getOpsNotificationWorker,
  createOpsNotificationWorker,
} from './OpsNotificationWorker';
