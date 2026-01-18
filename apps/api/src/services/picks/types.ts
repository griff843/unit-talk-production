/**
 * Pick submission input for Smart Form API
 */
export interface PickSubmissionInput {
  // Tenant & User Context
  tenantId: string;
  userId: string;

  // Pick Details
  league: string;
  playerId?: string;
  playerName?: string;
  marketType: string;
  line: number;
  side: 'over' | 'under' | string;
  odds?: number;

  // Game Context
  gameId?: string; // Resolved game ID
  gameDate?: string; // ISO date string if gameId not available

  // Betting Details
  stakeText?: string; // e.g., "1u", "2 units"
  stake?: number; // Numeric stake value
  userScore?: number; // User confidence 1-10

  // Idempotency
  idempotencyKey?: string;
  betSlipId?: string;

  // Additional Context
  metadata?: Record<string, any>;
}

/**
 * Pick data returned from driver
 */
export interface PickData {
  id: string;
  tenantId: string;
  userId: string;
  pickId?: string; // For canonical driver
  propId?: string; // For canonical driver
  selection: string;
  odds: number;
  stake: number;
  confidence?: number;
  workflowStage?: string;
  status: string;
  idempotencyKey?: string;
  betSlipId?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

/**
 * Publish options for outbox pattern
 */
export interface PublishOptions {
  channel: 'DISCORD' | 'CANARY' | 'WEBHOOK' | 'EMAIL';
  threadId?: string;
  scheduledFor?: Date;
  metadata?: Record<string, any>;
}

/**
 * Publish record data
 */
export interface PublishData {
  id: string;
  pickId: string;
  channel: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  threadId?: string;
  externalMessageId?: string;
  attempts: number;
  sentAt?: string;
  createdAt: string;
}

/**
 * Database driver interface for picks management
 */
export interface IPicksDriver {
  /**
   * Insert a new pick
   */
  insertPick(input: PickSubmissionInput): Promise<PickData>;

  /**
   * Get pick by ID
   */
  getPickById(pickId: string, tenantId: string): Promise<PickData | null>;

  /**
   * Get pick by idempotency key
   */
  getPickByIdempotencyKey(idempotencyKey: string, tenantId: string): Promise<PickData | null>;

  /**
   * Create publish record (outbox pattern)
   */
  createPublishRecord?(pickId: string, tenantId: string, options: PublishOptions): Promise<PublishData>;

  /**
   * Update publish record status
   */
  updatePublishStatus?(publishId: string, status: PublishData['status'], metadata?: Record<string, any>): Promise<void>;

  /**
   * Check if tables exist (runtime DDL check)
   */
  checkTablesExist(): Promise<boolean>;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  eventType: string;
  refType: 'pick' | 'publish' | 'user' | 'prop';
  refId: string;
  tenantId: string;
  actorId?: string;
  data?: Record<string, any>;
  correlationId?: string;
}
