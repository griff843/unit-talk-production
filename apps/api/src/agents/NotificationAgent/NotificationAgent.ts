import { autopilotGuard } from '../../lib/AutopilotGuard';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult } from '../BaseAgent/types';

// import { logger } from '../../shared/logger';

export interface NotificationPayload {
  type: 'email' | 'sms' | 'slack';
  recipient: string;
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
}

export class NotificationAgent extends BaseAgent {
  private static instance: NotificationAgent | null = null;
  private isInitialized: boolean = false;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  static getInstance(config: BaseAgentConfig, deps: BaseAgentDependencies): NotificationAgent {
    if (!NotificationAgent.instance) {
      NotificationAgent.instance = new NotificationAgent(config, deps);
    }
    return NotificationAgent.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    // Notification agent initialization
    this.isInitialized = true;
  }

  async process(): Promise<void> {
    // Notification agent processing logic
  }

  async cleanup(): Promise<void> {
    // Notification agent cleanup
  }

  async checkHealth(): Promise<HealthCheckResult> {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }

  async collectMetrics(): Promise<any> {
    return {};
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    // Phase 6.5: AutopilotGuard is the SOLE authority for side effects
    const guardResult = await autopilotGuard.assertMayPerformSideEffect({
      action: 'NOTIFICATION_SEND',
      agent_name: 'NotificationAgent',
      metadata: { type: payload.type, recipient: payload.recipient, subject: payload.subject },
    });

    if (!guardResult.allowed) {
      this.logger.info('Notification blocked by AutopilotGuard', {
        type: payload.type,
        recipient: payload.recipient,
        reason: guardResult.reason,
        mode: guardResult.mode,
      });
      return;
    }

    try {
      // Validate payload
      this.validatePayload(payload);

      // Send notification based on type
      switch (payload.type) {
        case 'email':
          await this.sendEmail(payload);
          break;
        case 'sms':
          await this.sendSMS(payload);
          break;
        case 'slack':
          await this.sendSlack(payload);
          break;
        default:
          throw new Error(`Unsupported notification type: ${(payload as any).type}`);
      }

      // Log success
      this.logger.info('Notification sent successfully', {
        type: payload.type,
        recipient: payload.recipient,
      });
    } catch (error) {
      // Log error
      this.logger.error('Failed to send notification', {
        error,
        type: payload.type,
        recipient: payload.recipient,
      });
      throw error;
    }
  }

  async sendBatchNotifications(payloads: NotificationPayload[]): Promise<void> {
    const results = await Promise.allSettled(
      payloads.map(payload => this.sendNotification(payload))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(`${failed.length} notifications failed out of ${payloads.length}`);
    }
  }

  private validatePayload(payload: NotificationPayload): void {
    if (!payload.recipient) {
      throw new Error('Recipient is required');
    }
    if (!payload.message) {
      throw new Error('Message is required');
    }
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    // Implementation would send email
    this.logger.info(
      `Sending email to ${payload.recipient} with subject '${payload.subject || ''}' and message: ${payload.message}`
    );
  }

  private async sendSMS(payload: NotificationPayload): Promise<void> {
    // Implementation would send SMS
    this.logger.info(`Sending SMS to ${payload.recipient} with message: ${payload.message}`);
  }

  private async sendSlack(payload: NotificationPayload): Promise<void> {
    // Implementation would send Slack message
    this.logger.info(
      `Sending Slack message to ${payload.recipient} with message: ${payload.message}`
    );
  }
}
