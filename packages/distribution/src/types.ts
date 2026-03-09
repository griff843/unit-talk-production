/**
 * Distribution Channel Types
 * SPRINT-REPO-TRUTH-LOCK-002
 *
 * Canonical interfaces for the distribution domain.
 * Agents in apps/api/ will implement these interfaces in a future sprint.
 */

// ── Payload Types ─────────────────────────────────────────────────────────────

/** Payload for publishing a pick to distribution channels */
export interface PublishPickPayload {
  pickId: string;
  tier: string;
  sport: string;
  marketType: string;
  playerName: string;
  line: number;
  odds: number;
  side: 'over' | 'under' | 'yes' | 'no';
  score?: number;
  ev?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** Payload for publishing an alert */
export interface PublishAlertPayload {
  alertType: 'line_movement' | 'steam_move' | 'injury' | 'weather' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  relatedPickId?: string;
  metadata?: Record<string, unknown>;
}

/** Payload for publishing a recap */
export interface PublishRecapPayload {
  recapType: 'daily' | 'weekly' | 'monthly';
  period: string;
  totalPicks: number;
  winCount: number;
  lossCount: number;
  pushCount: number;
  roi: number;
  topPicks?: Array<{ pickId: string; result: string; ev: number }>;
  metadata?: Record<string, unknown>;
}

// ── Channel Interface ─────────────────────────────────────────────────────────

/** Result of a distribution operation */
export interface DistributionResult {
  success: boolean;
  channelId: string;
  messageId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Distribution Channel interface.
 *
 * Any channel (Discord, email, Slack, webhook) should implement this.
 * Agents like DiscordPromotionAgent, NotificationAgent, and RecapAgent
 * will implement this interface in a future sprint.
 */
export interface DistributionChannel {
  /** Unique channel identifier */
  readonly channelId: string;
  /** Human-readable channel name */
  readonly channelName: string;
  /** Whether the channel is currently enabled */
  readonly enabled: boolean;

  /** Publish a pick to this channel */
  publishPick(payload: PublishPickPayload): Promise<DistributionResult>;
  /** Publish an alert to this channel */
  publishAlert(payload: PublishAlertPayload): Promise<DistributionResult>;
  /** Publish a recap to this channel */
  publishRecap(payload: PublishRecapPayload): Promise<DistributionResult>;
}
