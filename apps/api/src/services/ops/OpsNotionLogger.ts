/* eslint-disable @typescript-eslint/no-explicit-any, max-lines, max-lines-per-function */
/**
 * @fileoverview Ops Notion Logger
 *
 * Logs SLO incidents to Notion with:
 * - Page creation per incident
 * - Status updates on ACK/RESOLVE
 * - Retry with exponential backoff
 * - Rate limit handling
 *
 * Part of PR7: Incident Routing + Ops Digest
 *
 * @module services/ops/OpsNotionLogger
 */

import { Client } from '@notionhq/client';
import { makeLogger } from '../../utils/logger';
import { NotionPayload, NotificationResult, IncidentRecord } from './OpsIncidentRouter';

const logger = makeLogger('OpsNotionLogger');

// ============================================================================
// Types
// ============================================================================

interface OpsNotionLoggerConfig {
  maxRetries: number;
  backoffMultiplier: number;
  rateLimitDelayMs: number;
}

interface NotionPageProperties {
  'Incident ID': { title: Array<{ text: { content: string } }> };
  'SLO Name': { rich_text: Array<{ text: { content: string } }> };
  'SLO ID': { rich_text: Array<{ text: { content: string } }> };
  'Severity': { select: { name: string } };
  'Status': { select: { name: string } };
  'Opened At': { date: { start: string } };
  'Acknowledged At': { date: { start: string } | null };
  'Resolved At': { date: { start: string } | null };
  'Trigger Value': { number: number };
  'Trigger Threshold': { number: number };
  'Environment': { select: { name: string } };
  'Correlation ID': { rich_text: Array<{ text: { content: string } }> };
}

// ============================================================================
// OpsNotionLogger Class
// ============================================================================

export class OpsNotionLogger {
  private client: Client | null = null;
  private databaseId: string | null = null;
  private config: OpsNotionLoggerConfig;
  private pageCache: Map<string, string> = new Map(); // incidentId -> pageId

  constructor(config?: Partial<OpsNotionLoggerConfig>) {
    this.config = {
      maxRetries: 3,
      backoffMultiplier: 2,
      rateLimitDelayMs: 1000,
      ...config,
    };
  }

  /**
   * Initialize with Notion credentials
   */
  initialize(apiKey: string, databaseId: string): void {
    this.client = new Client({
      auth: apiKey,
    });
    this.databaseId = databaseId;
    logger.info('Notion client initialized for OpsNotionLogger', {
      databaseId: databaseId.substring(0, 8) + '...',
    });
  }

  /**
   * Check if logger is configured
   */
  isConfigured(): boolean {
    return this.client !== null && this.databaseId !== null;
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Handle rate limiting
      if (this.isRateLimitError(error)) {
        const retryAfter = this.getRetryAfter(error);
        logger.warn(`Notion rate limited, waiting ${retryAfter}ms`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return this.retryWithBackoff(operation, attempt);
      }

      if (attempt >= this.config.maxRetries) {
        throw error;
      }

      const delay = Math.pow(this.config.backoffMultiplier, attempt - 1) * 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Notion operation failed (attempt ${attempt}/${this.config.maxRetries}), retrying in ${delay}ms`, {
        error: errorMessage,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, attempt + 1);
    }
  }

  /**
   * Check if error is rate limit
   */
  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      return (error as { code: string }).code === 'rate_limited';
    }
    return false;
  }

  /**
   * Get retry-after delay from error
   */
  private getRetryAfter(error: unknown): number {
    if (error && typeof error === 'object' && 'headers' in error) {
      const headers = (error as { headers: Record<string, string> }).headers;
      const retryAfter = headers?.['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter, 10) * 1000;
      }
    }
    return this.config.rateLimitDelayMs;
  }

  /**
   * Log incident to Notion
   */
  async logIncident(payload: NotionPayload): Promise<NotificationResult> {
    if (!this.client || !this.databaseId) {
      return { success: false, error: 'Notion client not initialized' };
    }

    try {
      const { incident, correlationId, environment } = payload;

      // Check if we have an existing page for this incident
      const existingPageId = this.pageCache.get(incident.incident_id);

      if (existingPageId && incident.status !== 'open') {
        // Update existing page for status changes
        return await this.updateIncidentPage(existingPageId, incident, correlationId);
      }

      // Create new page
      const pageId = await this.createIncidentPage(incident, correlationId, environment);

      // Cache page ID
      this.pageCache.set(incident.incident_id, pageId);

      // Clean cache if too large
      if (this.pageCache.size > 1000) {
        const keys = Array.from(this.pageCache.keys());
        for (let i = 0; i < 500; i++) {
          this.pageCache.delete(keys[i]);
        }
      }

      logger.info('Created Notion incident page', {
        incidentId: incident.incident_id,
        pageId,
        correlationId,
      });

      return {
        success: true,
        messageId: pageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to log incident to Notion', {
        incidentId: payload.incident.incident_id,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create incident page in Notion
   */
  private async createIncidentPage(
    incident: IncidentRecord,
    correlationId: string,
    environment: string
  ): Promise<string> {
    const properties = this.buildPageProperties(incident, correlationId, environment);

    const response = await this.retryWithBackoff(async () => {
      return this.client!.pages.create({
        parent: { database_id: this.databaseId! },
        properties: properties as any,
        children: this.buildPageContent(incident) as any,
      });
    });

    return response.id;
  }

  /**
   * Update incident page status
   */
  private async updateIncidentPage(
    pageId: string,
    incident: IncidentRecord,
    correlationId: string
  ): Promise<NotificationResult> {
    try {
      await this.retryWithBackoff(async () => {
        const updateProps: Record<string, unknown> = {
          'Status': { select: { name: incident.status.toUpperCase() } },
        };

        if (incident.acknowledged_at) {
          updateProps['Acknowledged At'] = { date: { start: incident.acknowledged_at } };
        }

        if (incident.resolved_at) {
          updateProps['Resolved At'] = { date: { start: incident.resolved_at } };
        }

        return this.client!.pages.update({
          page_id: pageId,
          properties: updateProps as any,
        });
      });

      logger.info('Updated Notion incident page', {
        incidentId: incident.incident_id,
        pageId,
        status: incident.status,
        correlationId,
      });

      return {
        success: true,
        messageId: pageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update Notion incident page', {
        pageId,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Build Notion page properties
   */
  private buildPageProperties(
    incident: IncidentRecord,
    correlationId: string,
    environment: string
  ): NotionPageProperties {
    return {
      'Incident ID': {
        title: [{ text: { content: incident.incident_id } }],
      },
      'SLO Name': {
        rich_text: [{ text: { content: incident.slo_name } }],
      },
      'SLO ID': {
        rich_text: [{ text: { content: incident.slo_id } }],
      },
      'Severity': {
        select: { name: incident.severity.toUpperCase() },
      },
      'Status': {
        select: { name: incident.status.toUpperCase() },
      },
      'Opened At': {
        date: { start: incident.opened_at },
      },
      'Acknowledged At': incident.acknowledged_at
        ? { date: { start: incident.acknowledged_at } }
        : null,
      'Resolved At': incident.resolved_at
        ? { date: { start: incident.resolved_at } }
        : null,
      'Trigger Value': {
        number: incident.trigger_value,
      },
      'Trigger Threshold': {
        number: incident.trigger_threshold,
      },
      'Environment': {
        select: { name: environment.toUpperCase() },
      },
      'Correlation ID': {
        rich_text: [{ text: { content: correlationId } }],
      },
    };
  }

  /**
   * Build page content blocks
   */
  private buildPageContent(incident: IncidentRecord): Array<{
    object: 'block';
    type: string;
    [key: string]: unknown;
  }> {
    const blocks: Array<{
      object: 'block';
      type: string;
      [key: string]: unknown;
    }> = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Incident Details' } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `SLO: ${incident.slo_name}\nSeverity: ${incident.severity.toUpperCase()}\nStatus: ${incident.status.toUpperCase()}`,
              },
            },
          ],
        },
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Metrics' } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `Current Value: ${incident.trigger_value}\nThreshold: ${incident.trigger_threshold}\nDelta: ${(incident.trigger_value - incident.trigger_threshold).toFixed(2)}`,
              },
            },
          ],
        },
      },
    ];

    // Add evidence if present
    if (incident.evidence && Object.keys(incident.evidence).length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Evidence' } }],
        },
      });

      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [
            {
              type: 'text',
              text: { content: JSON.stringify(incident.evidence, null, 2) },
            },
          ],
          language: 'json',
        },
      });
    }

    return blocks;
  }

  /**
   * Test connection to Notion
   */
  async testConnection(): Promise<boolean> {
    if (!this.client || !this.databaseId) {
      return false;
    }

    try {
      await this.client.databases.retrieve({
        database_id: this.databaseId,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

let loggerInstance: OpsNotionLogger | null = null;

export function getOpsNotionLogger(): OpsNotionLogger {
  if (!loggerInstance) {
    loggerInstance = new OpsNotionLogger();
  }
  return loggerInstance;
}

export function initializeOpsNotionLogger(
  apiKey: string,
  databaseId: string
): OpsNotionLogger {
  const notionLogger = getOpsNotionLogger();
  notionLogger.initialize(apiKey, databaseId);
  return notionLogger;
}

/**
 * Create sender function for OpsIncidentRouter
 */
export function createNotionSenderFn(
  notionLogger: OpsNotionLogger
): (payload: NotionPayload) => Promise<NotificationResult> {
  return (payload: NotionPayload) => notionLogger.logIncident(payload);
}
