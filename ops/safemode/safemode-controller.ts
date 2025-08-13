/**
 * Safe Mode & Freeze Controller
 * 
 * Monitors system health and automatically toggles safe mode and system freeze
 * based on alert conditions and manual operations requests.
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { promClient } from 'prom-client';

// Configuration
const CONFIG = {
  PORT: process.env.SAFEMODE_PORT || 3010,
  SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  DISCORD_WEBHOOK_STAGING: process.env.DISCORD_WEBHOOK_STAGING,
  DISCORD_WEBHOOK_PROD: process.env.DISCORD_WEBHOOK_PROD,
  PROMETHEUS_PUSHGATEWAY: process.env.PROMETHEUS_PUSHGATEWAY || 'http://localhost:9091',
  ALERTMANAGER_WEBHOOK_PORT: process.env.ALERTMANAGER_WEBHOOK_PORT || 3011,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

// Metrics
const safeModeGauge = new promClient.Gauge({
  name: 'unit_talk_safe_mode_enabled',
  help: 'Whether safe mode is currently enabled (1 = enabled, 0 = disabled)'
});

const systemFreezeGauge = new promClient.Gauge({
  name: 'unit_talk_system_freeze_enabled', 
  help: 'Whether system freeze is currently enabled (1 = enabled, 0 = disabled)'
});

const alertsHandledCounter = new promClient.Counter({
  name: 'unit_talk_alerts_handled_total',
  help: 'Total number of alerts handled',
  labelNames: ['alert_type', 'action']
});

// Logger utility
const logger = {
  info: (...args: any[]) => console.log('[INFO]', new Date().toISOString(), ...args),
  warn: (...args: any[]) => console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args: any[]) => console.error('[ERROR]', new Date().toISOString(), ...args),
  debug: (...args: any[]) => {
    if (CONFIG.LOG_LEVEL === 'debug') {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
};

// Alert sender utility
class AlertSender {
  private webhookUrl: string;

  constructor(environment: 'staging' | 'production') {
    this.webhookUrl = environment === 'production' 
      ? CONFIG.DISCORD_WEBHOOK_PROD!
      : CONFIG.DISCORD_WEBHOOK_STAGING!;
  }

  async sendAlert(
    title: string, 
    description: string, 
    severity: 'info' | 'warning' | 'critical' = 'info'
  ): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('Discord webhook not configured, skipping alert');
      return;
    }

    const colors = {
      info: 0x3498db,      // Blue
      warning: 0xf39c12,   // Orange  
      critical: 0xe74c3c   // Red
    };

    try {
      await axios.post(this.webhookUrl, {
        embeds: [{
          title: `🚨 ${title}`,
          description,
          color: colors[severity],
          timestamp: new Date().toISOString(),
          fields: [{
            name: 'Environment',
            value: process.env.NODE_ENV || 'development',
            inline: true
          }, {
            name: 'Service',
            value: 'Safe Mode Controller',
            inline: true
          }]
        }]
      }, {
        timeout: 5000
      });

      logger.info(`Alert sent successfully: ${title}`);
    } catch (error) {
      logger.error('Failed to send Discord alert:', error);
      // Don't throw - alerts should never crash the core system
    }
  }
}

// Safe Mode Controller
class SafeModeController {
  private supabase: any;
  private app: express.Application;
  private alertSender: AlertSender;
  private currentState: {
    safeMode: boolean;
    systemFreeze: boolean;
    lastUpdate: Date;
  };

  constructor() {
    this.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY);
    this.app = express();
    this.alertSender = new AlertSender(
      process.env.NODE_ENV === 'production' ? 'production' : 'staging'
    );
    
    this.currentState = {
      safeMode: false,
      systemFreeze: false,
      lastUpdate: new Date()
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupAlertmanagerWebhook();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Basic auth middleware for ops endpoints
    this.app.use('/ops', this.authMiddleware.bind(this));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  private authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }
    
    const token = authHeader.substring(7);
    const expectedToken = process.env.SAFEMODE_API_TOKEN || 'dev-token-change-me';
    
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    next();
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        currentState: this.currentState,
        timestamp: new Date().toISOString()
      });
    });

    // Status endpoint
    this.app.get('/ops/safemode/status', async (req, res) => {
      try {
        const config = await this.getSystemConfig();
        const status = {
          safeMode: config.SAFE_MODE === 'true',
          systemFreeze: config.SYSTEM_FREEZE === 'true',
          shadowMode: config.SHADOW_MODE === 'true',
          publishToDiscord: config.PUBLISH_TO_DISCORD === 'true',
          lastUpdate: this.currentState.lastUpdate.toISOString()
        };

        res.json(status);
      } catch (error) {
        logger.error('Failed to get system status:', error);
        res.status(500).json({ error: 'Failed to get system status' });
      }
    });

    // Manual safe mode toggle
    this.app.post('/ops/safemode/toggle', async (req, res) => {
      try {
        const { enabled, reason } = req.body;
        const result = await this.setSafeMode(enabled, reason || 'Manual toggle');
        
        res.json({
          success: true,
          safeMode: result.safeMode,
          reason: result.reason,
          timestamp: result.timestamp
        });
      } catch (error) {
        logger.error('Failed to toggle safe mode:', error);
        res.status(500).json({ error: 'Failed to toggle safe mode' });
      }
    });

    // Manual system freeze toggle
    this.app.post('/ops/safemode/freeze', async (req, res) => {
      try {
        const { enabled, reason } = req.body;
        const result = await this.setSystemFreeze(enabled, reason || 'Manual freeze');
        
        res.json({
          success: true,
          systemFreeze: result.systemFreeze,
          reason: result.reason,
          timestamp: result.timestamp
        });
      } catch (error) {
        logger.error('Failed to toggle system freeze:', error);
        res.status(500).json({ error: 'Failed to toggle system freeze' });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        // Update metrics with current state
        const config = await this.getSystemConfig();
        safeModeGauge.set(config.SAFE_MODE === 'true' ? 1 : 0);
        systemFreezeGauge.set(config.SYSTEM_FREEZE === 'true' ? 1 : 0);
        
        res.set('Content-Type', promClient.register.contentType);
        res.end(await promClient.register.metrics());
      } catch (error) {
        logger.error('Failed to generate metrics:', error);
        res.status(500).json({ error: 'Failed to generate metrics' });
      }
    });
  }

  private setupAlertmanagerWebhook() {
    // Separate port for Alertmanager webhooks
    const webhookApp = express();
    webhookApp.use(express.json());

    webhookApp.post('/webhook', async (req, res) => {
      try {
        await this.handleAlertmanagerWebhook(req.body);
        res.json({ status: 'processed' });
      } catch (error) {
        logger.error('Failed to process Alertmanager webhook:', error);
        res.status(500).json({ error: 'Failed to process webhook' });
      }
    });

    webhookApp.listen(CONFIG.ALERTMANAGER_WEBHOOK_PORT, () => {
      logger.info(`Alertmanager webhook listening on port ${CONFIG.ALERTMANAGER_WEBHOOK_PORT}`);
    });
  }

  private async handleAlertmanagerWebhook(payload: any): Promise<void> {
    logger.debug('Received Alertmanager webhook:', JSON.stringify(payload, null, 2));
    
    if (!payload.alerts || !Array.isArray(payload.alerts)) {
      logger.warn('Invalid Alertmanager webhook payload');
      return;
    }

    for (const alert of payload.alerts) {
      await this.processAlert(alert);
    }
  }

  private async processAlert(alert: any): Promise<void> {
    const alertName = alert.labels?.alertname;
    const status = alert.status; // 'firing' or 'resolved'
    const severity = alert.labels?.severity || 'warning';
    
    logger.info(`Processing alert: ${alertName} (${status}, ${severity})`);

    // Auto-trigger safe mode for critical alerts
    if (status === 'firing' && severity === 'critical') {
      await this.handleCriticalAlert(alertName, alert);
    }

    // Auto-resolve safe mode when alerts clear
    if (status === 'resolved' && this.currentState.safeMode) {
      await this.handleAlertResolved(alertName, alert);
    }

    alertsHandledCounter.inc({ alert_type: alertName, action: status });
  }

  private async handleCriticalAlert(alertName: string, alert: any): Promise<void> {
    const autoSafeModeAlerts = [
      'IngestionFailureRate',
      'HighErrorRate',
      'DatabaseConnectionLoss',
      'TemporalWorkflowFailures',
      'ExternalServiceDown'
    ];

    const autoFreezeAlerts = [
      'DataCorruption',
      'SecurityBreach',
      'CriticalDatabaseError'
    ];

    try {
      if (autoFreezeAlerts.includes(alertName)) {
        await this.setSystemFreeze(true, `Auto-freeze due to ${alertName}`);
        await this.alertSender.sendAlert(
          'System Freeze Activated',
          `Critical alert "${alertName}" triggered automatic system freeze. All operations suspended.`,
          'critical'
        );
      } else if (autoSafeModeAlerts.includes(alertName)) {
        await this.setSafeMode(true, `Auto-safe mode due to ${alertName}`);
        await this.alertSender.sendAlert(
          'Safe Mode Activated', 
          `Critical alert "${alertName}" triggered automatic safe mode. External operations disabled.`,
          'warning'
        );
      }
    } catch (error) {
      logger.error('Failed to handle critical alert:', error);
    }
  }

  private async handleAlertResolved(alertName: string, alert: any): Promise<void> {
    // Check if all critical alerts are resolved before disabling safe mode
    const criticalAlerts = await this.checkActiveCriticalAlerts();
    
    if (criticalAlerts.length === 0) {
      await this.setSafeMode(false, `Auto-recovery - all critical alerts resolved`);
      await this.alertSender.sendAlert(
        'Safe Mode Disabled',
        'All critical alerts have been resolved. Safe mode automatically disabled.',
        'info'
      );
    }
  }

  private async checkActiveCriticalAlerts(): Promise<any[]> {
    // In a real implementation, this would query Prometheus/Alertmanager
    // For now, return empty array (no active alerts)
    return [];
  }

  private async setSafeMode(enabled: boolean, reason: string): Promise<{
    safeMode: boolean;
    reason: string;
    timestamp: string;
  }> {
    logger.info(`Setting safe mode: ${enabled} (${reason})`);

    const { error } = await this.supabase
      .from('system_config')
      .update({ 
        value: enabled.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('key', 'SAFE_MODE');

    if (error) {
      throw new Error(`Failed to update SAFE_MODE: ${error.message}`);
    }

    // Update local state
    this.currentState.safeMode = enabled;
    this.currentState.lastUpdate = new Date();

    // Update Prometheus metrics
    safeModeGauge.set(enabled ? 1 : 0);

    return {
      safeMode: enabled,
      reason,
      timestamp: new Date().toISOString()
    };
  }

  private async setSystemFreeze(enabled: boolean, reason: string): Promise<{
    systemFreeze: boolean;
    reason: string;
    timestamp: string;
  }> {
    logger.info(`Setting system freeze: ${enabled} (${reason})`);

    const { error } = await this.supabase
      .from('system_config')
      .update({ 
        value: enabled.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('key', 'SYSTEM_FREEZE');

    if (error) {
      throw new Error(`Failed to update SYSTEM_FREEZE: ${error.message}`);
    }

    // Update local state
    this.currentState.systemFreeze = enabled;
    this.currentState.lastUpdate = new Date();

    // Update Prometheus metrics
    systemFreezeGauge.set(enabled ? 1 : 0);

    return {
      systemFreeze: enabled,
      reason,
      timestamp: new Date().toISOString()
    };
  }

  private async getSystemConfig(): Promise<Record<string, string>> {
    const { data, error } = await this.supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['SAFE_MODE', 'SYSTEM_FREEZE', 'SHADOW_MODE', 'PUBLISH_TO_DISCORD']);

    if (error) {
      throw new Error(`Failed to get system config: ${error.message}`);
    }

    return data.reduce((acc: Record<string, string>, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  }

  private async initializeState(): Promise<void> {
    try {
      const config = await this.getSystemConfig();
      this.currentState.safeMode = config.SAFE_MODE === 'true';
      this.currentState.systemFreeze = config.SYSTEM_FREEZE === 'true';
      this.currentState.lastUpdate = new Date();

      // Initialize metrics
      safeModeGauge.set(this.currentState.safeMode ? 1 : 0);
      systemFreezeGauge.set(this.currentState.systemFreeze ? 1 : 0);

      logger.info('Safe Mode Controller initialized', this.currentState);
    } catch (error) {
      logger.error('Failed to initialize state:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    await this.initializeState();

    this.app.listen(CONFIG.PORT, () => {
      logger.info(`Safe Mode Controller listening on port ${CONFIG.PORT}`);
    });

    // Periodic health check and metrics update
    setInterval(async () => {
      try {
        const config = await this.getSystemConfig();
        safeModeGauge.set(config.SAFE_MODE === 'true' ? 1 : 0);
        systemFreezeGauge.set(config.SYSTEM_FREEZE === 'true' ? 1 : 0);
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000); // Every 30 seconds
  }
}

// Main execution
async function main() {
  const controller = new SafeModeController();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    process.exit(0);
  });

  try {
    await controller.start();
  } catch (error) {
    logger.error('Failed to start Safe Mode Controller:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SafeModeController, AlertSender };