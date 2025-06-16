#!/usr/bin/env tsx

/**
 * Infrastructure Setup Script
 * Sets up Redis, monitoring, and other production infrastructure
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

class InfrastructureSetup {
  
  async setupRedis(): Promise<void> {
    console.log('🔴 Setting up Redis configuration...');
    
    const redisConfig = `
import Redis from 'ioredis';
import { logger } from './logging';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

class RedisService {
  private client: Redis;
  private config: RedisConfig;

  constructor(config?: Partial<RedisConfig>) {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      ...config
    };

    this.client = new Redis(this.config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.client.on('ready', () => {
      logger.info('Redis ready for operations');
    });
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error('Redis SET error:', error);
      throw error;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

// Singleton instance
export const redis = new RedisService();
export { RedisService };
`;

    const servicesDir = 'src/services';
    if (!existsSync(servicesDir)) {
      mkdirSync(servicesDir, { recursive: true });
    }

    writeFileSync(join(servicesDir, 'redis.ts'), redisConfig);
    console.log('✅ Created Redis service configuration');
  }

  async setupMonitoring(): Promise<void> {
    console.log('📊 Setting up monitoring infrastructure...');
    
    const monitoringService = `
import express from 'express';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from './logging';
import { redis } from './redis';

// Collect default Node.js metrics
collectDefaultMetrics();

// Custom metrics
export const metrics = {
  httpRequests: new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),

  httpDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5]
  }),

  agentHealth: new Gauge({
    name: 'agent_health_status',
    help: 'Health status of agents (1 = healthy, 0 = unhealthy)',
    labelNames: ['agent_name']
  }),

  agentOperations: new Counter({
    name: 'agent_operations_total',
    help: 'Total number of agent operations',
    labelNames: ['agent_name', 'operation', 'status']
  }),

  cacheHits: new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type']
  }),

  cacheMisses: new Counter({
    name: 'cache_misses_total', 
    help: 'Total number of cache misses',
    labelNames: ['cache_type']
  })
};

export class MonitoringService {
  private app: express.Application;
  private port: number;

  constructor(port: number = 9090) {
    this.app = express();
    this.port = port;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Metrics endpoint for Prometheus
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        redis: await redis.healthCheck()
      };

      res.json(health);
    });

    // Ready check endpoint
    this.app.get('/ready', async (req, res) => {
      const ready = {
        status: 'ready',
        services: {
          redis: await redis.healthCheck()
        }
      };

      const allReady = Object.values(ready.services).every(Boolean);
      res.status(allReady ? 200 : 503).json(ready);
    });
  }

  start(): void {
    this.app.listen(this.port, () => {
      logger.info(\`Monitoring service started on port \${this.port}\`);
      console.log(\`📊 Metrics: http://localhost:\${this.port}/metrics\`);
      console.log(\`🏥 Health: http://localhost:\${this.port}/health\`);
      console.log(\`✅ Ready: http://localhost:\${this.port}/ready\`);
    });
  }
}

export const monitoring = new MonitoringService();
`;

    writeFileSync(join('src/services', 'monitoring.ts'), monitoringService);
    console.log('✅ Created monitoring service');
  }

  async setupAlertDelivery(): Promise<void> {
    console.log('📧 Setting up alert delivery services...');
    
    const emailService = `
import nodemailer from 'nodemailer';
import { logger } from './logging';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    };

    this.transporter = nodemailer.createTransporter(this.config);
  }

  async sendAlert(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || this.config.auth.user,
        to,
        subject,
        html
      });

      logger.info('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      logger.error('Email send failed:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email service health check failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
`;

    writeFileSync(join('src/services', 'email.ts'), emailService);
    console.log('✅ Created email service');

    const smsService = `
import twilio from 'twilio';
import { logger } from './logging';

export class SMSService {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '';

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    } else {
      logger.warn('Twilio credentials not configured, SMS service disabled');
    }
  }

  async sendAlert(to: string, message: string): Promise<boolean> {
    if (!this.client) {
      logger.warn('SMS service not configured');
      return false;
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to
      });

      logger.info('SMS sent successfully:', result.sid);
      return true;
    } catch (error) {
      logger.error('SMS send failed:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return true;
    } catch (error) {
      logger.error('SMS service health check failed:', error);
      return false;
    }
  }
}

export const smsService = new SMSService();
`;

    writeFileSync(join('src/services', 'sms.ts'), smsService);
    console.log('✅ Created SMS service');
  }

  async installDependencies(): Promise<void> {
    console.log('📦 Installing infrastructure dependencies...');
    
    const dependencies = [
      'ioredis',
      'prom-client', 
      'nodemailer',
      'twilio',
      '@types/nodemailer'
    ];

    try {
      execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'inherit' });
      console.log('✅ Dependencies installed successfully');
    } catch (error) {
      console.log('⚠️ Some dependencies may need manual installation');
    }
  }

  async updateEnvironmentConfig(): Promise<void> {
    console.log('🔧 Updating environment configuration...');
    
    const additionalEnvVars = `

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Monitoring Configuration  
MONITOR_PORT=9090
METRICS_ENABLED=true

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Unit Talk <noreply@unittalk.com>

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+1234567890

# Infrastructure Health Checks
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
`;

    // Append to .env if it exists
    if (existsSync('.env')) {
      const fs = require('fs');
      fs.appendFileSync('.env', additionalEnvVars);
      console.log('✅ Updated .env with infrastructure variables');
    } else {
      console.log('⚠️ .env file not found, please add infrastructure variables manually');
    }
  }

  async runSetup(): Promise<void> {
    console.log('🚀 Starting Infrastructure Setup\n');
    
    await this.setupRedis();
    await this.setupMonitoring();
    await this.setupAlertDelivery();
    await this.installDependencies();
    await this.updateEnvironmentConfig();
    
    console.log('\n✅ Infrastructure Setup Complete!');
    console.log('🔄 Next: Start monitoring service and test alert delivery');
  }
}

async function main() {
  const setup = new InfrastructureSetup();
  await setup.runSetup();
}

if (require.main === module) {
  main().catch(console.error);
}