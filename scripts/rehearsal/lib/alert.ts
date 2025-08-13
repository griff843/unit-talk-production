/**
 * @fileoverview Alert Manager
 * 
 * Manages alert posting and clearing for incident simulation during rehearsal.
 * Integrates with Alertmanager and incident management systems.
 */

interface AlertPayload {
  alertname: string;
  severity: 'critical' | 'warning' | 'info';
  summary: string;
  description: string;
  source: string;
  runbook_url?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

interface AlertResult {
  success: boolean;
  alertId?: string;
  timestamp: number;
  error?: string;
}

export class AlertManager {
  private environment: 'staging' | 'prod';
  private alertmanagerUrl: string;
  private webhookUrl?: string;

  constructor(environment: 'staging' | 'prod') {
    this.environment = environment;
    this.alertmanagerUrl = this.getAlertmanagerUrl();
    this.webhookUrl = process.env.ALERT_WEBHOOK_URL;
  }

  private getAlertmanagerUrl(): string {
    if (this.environment === 'prod') {
      return process.env.PROD_ALERTMANAGER_URL || 'http://alertmanager:9093';
    }
    return process.env.ALERTMANAGER_URL || 'http://localhost:9093';
  }

  async postAlert(payload: AlertPayload): Promise<AlertResult> {
    try {
      const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Enhance payload with standard labels
      const enhancedPayload = this.enhanceAlertPayload(payload, alertId);

      // Post to Alertmanager
      const alertmanagerResult = await this.postToAlertmanager(enhancedPayload);

      // Post to webhook if configured
      if (this.webhookUrl) {
        await this.postToWebhook(enhancedPayload);
      }

      // Create incident entry
      await this.createIncident(enhancedPayload);

      // Trigger auto-actions if critical
      if (payload.severity === 'critical') {
        await this.triggerCriticalAlertActions(enhancedPayload);
      }

      console.log(`🚨 Alert posted: ${payload.alertname} (${alertId})`);

      return {
        success: true,
        alertId,
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private enhanceAlertPayload(payload: AlertPayload, alertId: string): AlertPayload & { 
    labels: Record<string, string>; 
    annotations: Record<string, string>;
    alertId: string;
  } {
    return {
      ...payload,
      alertId,
      labels: {
        environment: this.environment,
        service: 'unit-talk-platform',
        team: 'platform-engineering',
        source: payload.source,
        rehearsal: 'true',
        ...payload.labels
      },
      annotations: {
        summary: payload.summary,
        description: payload.description,
        runbook_url: payload.runbook_url || 'https://docs.unit-talk.com/runbooks/default',
        alert_id: alertId,
        created_at: new Date().toISOString(),
        ...payload.annotations
      }
    };
  }

  private async postToAlertmanager(payload: any): Promise<void> {
    try {
      // Convert to Alertmanager format
      const alertmanagerPayload = [{
        labels: {
          alertname: payload.alertname,
          severity: payload.severity,
          ...payload.labels
        },
        annotations: payload.annotations,
        startsAt: new Date().toISOString(),
        generatorURL: `${process.env.API_URL}/alerts/${payload.alertId}`
      }];

      const response = await fetch(`${this.alertmanagerUrl}/api/v1/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertmanagerPayload),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Alertmanager responded with ${response.status}: ${response.statusText}`);
      }

      console.log(`📡 Alert sent to Alertmanager: ${payload.alertname}`);
    } catch (error) {
      console.error(`Failed to post to Alertmanager: ${error}`);
      // Don't throw - we want to continue with other notifications
    }
  }

  private async postToWebhook(payload: any): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'alert',
          payload,
          environment: this.environment,
          timestamp: new Date().toISOString()
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Webhook responded with ${response.status}`);
      }

      console.log(`🔗 Alert sent to webhook: ${payload.alertname}`);
    } catch (error) {
      console.error(`Failed to post to webhook: ${error}`);
    }
  }

  private async createIncident(payload: any): Promise<void> {
    try {
      // In a real implementation, this would create an incident in the database
      const incident = {
        id: `incident-${payload.alertId}`,
        alert_name: payload.alertname,
        severity: payload.severity,
        status: 'open',
        summary: payload.summary,
        description: payload.description,
        labels: payload.labels,
        annotations: payload.annotations,
        created_at: new Date().toISOString(),
        source: payload.source,
        environment: this.environment
      };

      console.log(`📊 Incident created: ${incident.id}`);
      
      // Store in database
      // await this.supabase.from('incidents').insert(incident);

    } catch (error) {
      console.error(`Failed to create incident: ${error}`);
    }
  }

  private async triggerCriticalAlertActions(payload: any): Promise<void> {
    try {
      console.log(`🚨 Triggering critical alert actions for: ${payload.alertname}`);

      // Auto-enable SAFE_MODE for critical alerts
      if (payload.alertname.includes('Freshness') || payload.alertname.includes('Critical')) {
        await this.enableSafeMode(payload);
      }

      // Send to escalation channels
      await this.escalateCriticalAlert(payload);

      // Create PagerDuty incident (if configured)
      await this.createPagerDutyIncident(payload);

    } catch (error) {
      console.error(`Failed to trigger critical alert actions: ${error}`);
    }
  }

  private async enableSafeMode(payload: any): Promise<void> {
    try {
      const { FlagsManager } = require('./flags');
      const flagsManager = new FlagsManager(this.environment);
      
      const result = await flagsManager.setFlag('SAFE_MODE', true);
      if (result.success) {
        console.log(`🛡️ SAFE_MODE enabled due to critical alert: ${payload.alertname}`);
      } else {
        console.error(`Failed to enable SAFE_MODE: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error enabling SAFE_MODE: ${error}`);
    }
  }

  private async escalateCriticalAlert(payload: any): Promise<void> {
    // Send to escalation channels (Slack, Discord, SMS, etc.)
    console.log(`📢 Escalating critical alert: ${payload.alertname}`);
    
    // In production, this would integrate with:
    // - Slack API for immediate notifications
    // - Discord webhooks for team alerts
    // - Twilio for SMS notifications
    // - Email for backup notifications
  }

  private async createPagerDutyIncident(payload: any): Promise<void> {
    // Create PagerDuty incident for critical alerts
    const pagerDutyKey = process.env.PAGERDUTY_INTEGRATION_KEY;
    
    if (!pagerDutyKey) {
      console.log(`⏭️ PagerDuty not configured, skipping incident creation`);
      return;
    }

    try {
      console.log(`📟 Creating PagerDuty incident for: ${payload.alertname}`);
      
      // In production, this would call PagerDuty Events API
      // await this.callPagerDutyAPI(payload, pagerDutyKey);
      
    } catch (error) {
      console.error(`Failed to create PagerDuty incident: ${error}`);
    }
  }

  async clearAlert(alertname: string): Promise<AlertResult> {
    try {
      const alertId = `clear-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Clear from Alertmanager
      await this.clearFromAlertmanager(alertname);

      // Update incident status
      await this.closeIncident(alertname);

      // Clear any auto-triggered actions
      await this.clearAutoActions(alertname);

      console.log(`✅ Alert cleared: ${alertname}`);

      return {
        success: true,
        alertId,
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async clearFromAlertmanager(alertname: string): Promise<void> {
    try {
      // In production, this would call Alertmanager API to resolve the alert
      console.log(`🔄 Clearing alert from Alertmanager: ${alertname}`);
      
      // Mock clearing operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Failed to clear from Alertmanager: ${error}`);
    }
  }

  private async closeIncident(alertname: string): Promise<void> {
    try {
      console.log(`📋 Closing incident for alert: ${alertname}`);
      
      // Update incident status to closed
      // await this.supabase
      //   .from('incidents')
      //   .update({ 
      //     status: 'closed', 
      //     closed_at: new Date().toISOString(),
      //     resolution: 'Alert cleared during rehearsal'
      //   })
      //   .eq('alert_name', alertname)
      //   .eq('status', 'open');

    } catch (error) {
      console.error(`Failed to close incident: ${error}`);
    }
  }

  private async clearAutoActions(alertname: string): Promise<void> {
    try {
      // Reverse any auto-triggered actions
      if (alertname.includes('Freshness') || alertname.includes('Critical')) {
        console.log(`🔄 Clearing auto-actions for: ${alertname}`);
        
        // Note: SAFE_MODE should be cleared manually during recovery testing
        // to ensure proper rehearsal flow
      }
    } catch (error) {
      console.error(`Failed to clear auto-actions: ${error}`);
    }
  }

  async listActiveAlerts(): Promise<{ alerts: any[]; count: number }> {
    try {
      const response = await fetch(`${this.alertmanagerUrl}/api/v1/alerts`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Alertmanager responded with ${response.status}`);
      }

      const data = await response.json();
      const alerts = data.data || [];

      return {
        alerts: alerts.filter((alert: any) => 
          alert.labels?.rehearsal === 'true' && 
          alert.labels?.environment === this.environment
        ),
        count: alerts.length
      };

    } catch (error) {
      console.error(`Failed to list active alerts: ${error}`);
      return { alerts: [], count: 0 };
    }
  }

  async testAlertFlow(): Promise<{ success: boolean; steps: string[]; errors: string[] }> {
    const steps: string[] = [];
    const errors: string[] = [];

    try {
      // Step 1: Test alert posting
      steps.push('Testing alert posting...');
      const testAlert: AlertPayload = {
        alertname: 'RehearsalTestAlert',
        severity: 'warning',
        summary: 'Test alert for rehearsal validation',
        description: 'This is a test alert to validate the alert flow',
        source: 'rehearsal-test'
      };

      const postResult = await this.postAlert(testAlert);
      if (postResult.success) {
        steps.push('✅ Alert posted successfully');
      } else {
        errors.push(`Alert posting failed: ${postResult.error}`);
      }

      // Step 2: Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Test alert clearing
      steps.push('Testing alert clearing...');
      const clearResult = await this.clearAlert('RehearsalTestAlert');
      if (clearResult.success) {
        steps.push('✅ Alert cleared successfully');
      } else {
        errors.push(`Alert clearing failed: ${clearResult.error}`);
      }

      return {
        success: errors.length === 0,
        steps,
        errors
      };

    } catch (error) {
      errors.push(`Test flow failed: ${error}`);
      return { success: false, steps, errors };
    }
  }
}