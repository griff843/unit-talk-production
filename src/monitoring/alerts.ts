import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { z } from 'zod';

export const AlertSeverityEnum = z.enum(['info', 'warning', 'error', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeverityEnum>;

export const AlertChannelEnum = z.enum(['email', 'slack', 'discord', 'pagerduty']);
export type AlertChannel = z.infer<typeof AlertChannelEnum>;

export const AlertSchema = z.object({
  id: z.string().uuid(),
  agent: z.string(),
  severity: AlertSeverityEnum,
  message: z.string(),
  context: z.record(z.unknown()),
  channels: z.array(AlertChannelEnum),
  acknowledged: z.boolean(),
  resolved: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Alert = z.infer<typeof AlertSchema>;

export interface AlertConfig {
  enabled: boolean;
  defaultChannels: AlertChannel[];
  thresholds: Record<string, number>;
  minInterval: number;
  groupingWindow: number;
}

export class AlertManager {
  private static instance: AlertManager;
  private readonly logger: Logger;
  private alertCache: Map<string, Alert[]> = new Map();
  private lastAlertTime: Map<string, number> = new Map();

  private constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: AlertConfig
  ) {
    this.logger = new Logger('AlertManager');
  }

  public static getInstance(
    supabase: SupabaseClient,
    config: AlertConfig
  ): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager(supabase, config);
    }
    return AlertManager.instance;
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Alert Manager');
    await this.loadActiveAlerts();
    this.startCleanupInterval();
  }

  private async loadActiveAlerts(): Promise<void> {
    const { data: alerts, error } = await this.supabase
      .from('alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to load active alerts:', error);
      return;
    }

    alerts?.forEach(alert => {
      const existing = this.alertCache.get(alert.agent) || [];
      existing.push(alert);
      this.alertCache.set(alert.agent, existing);
    });
  }

  public async createAlert(
    agent: string,
    severity: AlertSeverity,
    message: string,
    context: Record<string, any> = {},
    channels: AlertChannel[] = this.config.defaultChannels
  ): Promise<void> {
    if (!this.config.enabled) return;

    // Check rate limiting
    const key = `${agent}:${severity}:${message}`;
    const lastTime = this.lastAlertTime.get(key) || 0;
    const now = Date.now();

    if (now - lastTime < this.config.minInterval) {
      return;
    }

    try {
      const alert: Omit<Alert, 'id' | 'created_at' | 'updated_at'> = {
        agent,
        severity,
        message,
        context,
        channels,
        acknowledged: false,
        resolved: false,
      };

      const { data, error } = await this.supabase
        .from('alerts')
        .insert(alert)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      const existing = this.alertCache.get(agent) || [];
      existing.push(data);
      this.alertCache.set(agent, existing);

      // Update rate limiting
      this.lastAlertTime.set(key, now);

      // Send notifications
      await this.sendNotifications(data);

      this.logger.info('Alert created:', {
        agent,
        severity,
        message,
      });
    } catch (error) {
      this.logger.error('Failed to create alert:', error);
    }
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    for (const channel of alert.channels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(alert);
            break;
          case 'slack':
            await this.sendSlackNotification(alert);
            break;
          case 'discord':
            await this.sendDiscordNotification(alert);
            break;
          case 'pagerduty':
            await this.sendPagerDutyNotification(alert);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification:`, error);
      }
    }
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Implement email notification
  }

  private async sendSlackNotification(alert: Alert): Promise<void> {
    // Implement Slack notification
  }

  private async sendDiscordNotification(alert: Alert): Promise<void> {
    // Implement Discord notification
  }

  private async sendPagerDutyNotification(alert: Alert): Promise<void> {
    // Implement PagerDuty notification
  }

  public async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      const { data: alert, error } = await this.supabase
        .from('alerts')
        .update({ acknowledged: true })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      const existing = this.alertCache.get(alert.agent) || [];
      const index = existing.findIndex(a => a.id === alertId);
      if (index !== -1) {
        existing[index] = alert;
        this.alertCache.set(alert.agent, existing);
      }

      this.logger.info('Alert acknowledged:', { alertId });
    } catch (error) {
      this.logger.error('Failed to acknowledge alert:', error);
    }
  }

  public async resolveAlert(alertId: string): Promise<void> {
    try {
      const { data: alert, error } = await this.supabase
        .from('alerts')
        .update({ resolved: true })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;

      // Update cache
      const existing = this.alertCache.get(alert.agent) || [];
      this.alertCache.set(
        alert.agent,
        existing.filter(a => a.id !== alertId)
      );

      this.logger.info('Alert resolved:', { alertId });
    } catch (error) {
      this.logger.error('Failed to resolve alert:', error);
    }
  }

  public getActiveAlerts(agent?: string): Alert[] {
    if (agent) {
      return this.alertCache.get(agent) || [];
    }

    return Array.from(this.alertCache.values()).flat();
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      this.lastAlertTime.forEach((time, key) => {
        if (now - time > this.config.groupingWindow) {
          this.lastAlertTime.delete(key);
        }
      });
    }, this.config.groupingWindow);
  }

  public async shutdown(): Promise<void> {
    // Cleanup if needed
  }
} 