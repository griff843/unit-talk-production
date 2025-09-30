#!/usr/bin/env tsx
/**
 * Phase 8 Production Deployment Script
 * Unit Talk Syndicate-Level ML Betting System
 *
 * Deploys real-time scoring pipeline for production with:
 * - Target: 1000+ props/hour processing
 * - Latency: <2 seconds from ingestion to scored result
 * - 99.9% uptime with failover capabilities
 * - Enhanced 45-Factor scoring system
 */

import { readFile, writeFile } from 'fs/promises';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface DeploymentConfig {
  environment: 'production' | 'staging';
  scoreTargets: {
    throughputPerHour: number;
    latencyTargetMs: number;
    accuracyTarget: number;
    uptimeTarget: number;
  };
  infrastructure: {
    apiInstances: number;
    workerInstances: number;
    databaseConnections: number;
    redisMemory: string;
  };
  monitoring: {
    prometheusEnabled: boolean;
    grafanaEnabled: boolean;
    alertingEnabled: boolean;
  };
}

interface DeploymentMetrics {
  deploymentStart: Date;
  servicesDeployed: string[];
  healthChecksPassed: number;
  performanceTests: {
    latencyMs: number;
    throughputPerHour: number;
    errorRate: number;
  };
  status: 'deploying' | 'healthy' | 'degraded' | 'failed';
}

class ProductionDeployment {
  private config: DeploymentConfig;
  private metrics: DeploymentMetrics;
  private rootPath: string;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.rootPath = path.resolve(__dirname, '../../..');
    this.metrics = {
      deploymentStart: new Date(),
      servicesDeployed: [],
      healthChecksPassed: 0,
      performanceTests: {
        latencyMs: 0,
        throughputPerHour: 0,
        errorRate: 0
      },
      status: 'deploying'
    };
  }

  /**
   * Main deployment orchestration method
   */
  async deploy(): Promise<void> {
    console.log('🚀 Starting Phase 8 Production Deployment');
    console.log('📊 Target Performance:');
    console.log(`   • Throughput: ${this.config.scoreTargets.throughputPerHour}+ props/hour`);
    console.log(`   • Latency: <${this.config.scoreTargets.latencyTargetMs}ms`);
    console.log(`   • Accuracy: ${this.config.scoreTargets.accuracyTarget}%+`);
    console.log(`   • Uptime: ${this.config.scoreTargets.uptimeTarget}%`);
    console.log('');

    try {
      // Phase 1: Infrastructure Setup
      await this.setupInfrastructure();

      // Phase 2: Database Migration & Optimization
      await this.setupDatabase();

      // Phase 3: Deploy Core Services
      await this.deployCoreServices();

      // Phase 4: Deploy Scoring Pipeline
      await this.deployScoringPipeline();

      // Phase 5: Deploy Agent Orchestration
      await this.deployAgentOrchestration();

      // Phase 6: Setup Monitoring & Alerting
      await this.setupMonitoring();

      // Phase 7: Deploy API Integration Layer
      await this.deployAPIIntegration();

      // Phase 8: Deploy Command Center
      await this.deployCommandCenter();

      // Phase 9: Production Validation
      await this.validateProductionDeployment();

      // Phase 10: Performance Testing
      await this.runPerformanceTests();

      this.metrics.status = 'healthy';
      console.log('✅ Phase 8 Production Deployment Completed Successfully!');
      await this.generateDeploymentReport();

    } catch (error) {
      this.metrics.status = 'failed';
      console.error('❌ Production Deployment Failed:', error);
      await this.handleDeploymentFailure(error);
      throw error;
    }
  }

  /**
   * Setup production infrastructure with optimizations
   */
  private async setupInfrastructure(): Promise<void> {
    console.log('🏗️ Phase 1: Setting up production infrastructure...');

    // Create production configuration directories
    await this.createProductionDirectories();

    // Generate production configuration files
    await this.generateProductionConfigs();

    // Setup Docker networks and volumes
    await this.setupDockerInfrastructure();

    console.log('✅ Infrastructure setup completed');
  }

  /**
   * Setup and optimize database for production
   */
  private async setupDatabase(): Promise<void> {
    console.log('🗄️ Phase 2: Setting up production database...');

    // Deploy PostgreSQL with production optimizations
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d postgres-primary postgres-replica');

    // Wait for database health
    await this.waitForServiceHealth('postgres-primary', 60000);

    // Run production migrations
    await this.runDatabaseMigrations();

    // Optimize database for high-performance queries
    await this.optimizeDatabaseForProduction();

    console.log('✅ Database setup completed');
    this.metrics.servicesDeployed.push('postgres-primary', 'postgres-replica');
  }

  /**
   * Deploy core services (Redis, Temporal)
   */
  private async deployCoreServices(): Promise<void> {
    console.log('⚙️ Phase 3: Deploying core services...');

    // Deploy Redis cluster
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d redis-primary');
    await this.waitForServiceHealth('redis-primary', 30000);

    // Deploy Temporal orchestration
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d temporal-postgres temporal');
    await this.waitForServiceHealth('temporal', 60000);

    console.log('✅ Core services deployed');
    this.metrics.servicesDeployed.push('redis-primary', 'temporal', 'temporal-postgres');
  }

  /**
   * Deploy the real-time scoring pipeline
   */
  private async deployScoringPipeline(): Promise<void> {
    console.log('🎯 Phase 4: Deploying real-time scoring pipeline...');

    // Deploy main API with enhanced scoring
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d api');
    await this.waitForServiceHealth('api', 90000);

    // Deploy scoring workers (scaled for high throughput)
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d workers-scoring');
    await this.waitForServiceHealth('workers-scoring', 60000);

    // Validate Enhanced 45-Factor system is operational
    await this.validateEnhanced45FactorSystem();

    console.log('✅ Real-time scoring pipeline deployed');
    this.metrics.servicesDeployed.push('api', 'workers-scoring');
  }

  /**
   * Deploy agent orchestration system
   */
  private async deployAgentOrchestration(): Promise<void> {
    console.log('🤖 Phase 5: Deploying agent orchestration...');

    // Deploy alert workers
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d workers-alerts');
    await this.waitForServiceHealth('workers-alerts', 60000);

    // Deploy Discord bot
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d discord-bot');
    await this.waitForServiceHealth('discord-bot', 60000);

    // Validate all agents are healthy
    await this.validateAgentHealth();

    console.log('✅ Agent orchestration deployed');
    this.metrics.servicesDeployed.push('workers-alerts', 'discord-bot');
  }

  /**
   * Setup production monitoring and alerting
   */
  private async setupMonitoring(): Promise<void> {
    console.log('📊 Phase 6: Setting up monitoring and alerting...');

    // Deploy Prometheus
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d prometheus');
    await this.waitForServiceHealth('prometheus', 60000);

    // Deploy Alertmanager
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d alertmanager');
    await this.waitForServiceHealth('alertmanager', 30000);

    // Deploy Grafana with dashboards
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d grafana');
    await this.waitForServiceHealth('grafana', 60000);

    // Configure production alerts
    await this.configureProductionAlerts();

    console.log('✅ Monitoring and alerting setup completed');
    this.metrics.servicesDeployed.push('prometheus', 'alertmanager', 'grafana');
  }

  /**
   * Deploy API integration layer with rate limiting
   */
  private async deployAPIIntegration(): Promise<void> {
    console.log('🔌 Phase 7: Deploying API integration layer...');

    // Deploy NGINX load balancer
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d nginx');
    await this.waitForServiceHealth('nginx', 30000);

    // Configure rate limiting and failover
    await this.configureAPIIntegration();

    console.log('✅ API integration layer deployed');
    this.metrics.servicesDeployed.push('nginx');
  }

  /**
   * Deploy Command Center for operational control
   */
  private async deployCommandCenter(): Promise<void> {
    console.log('💻 Phase 8: Deploying Command Center...');

    // Deploy Command Center
    await this.executeCommand('docker-compose -f docker-compose.production.yml up -d command-center');
    await this.waitForServiceHealth('command-center', 90000);

    // Validate Command Center integration
    await this.validateCommandCenterIntegration();

    console.log('✅ Command Center deployed');
    this.metrics.servicesDeployed.push('command-center');
  }

  /**
   * Validate production deployment health
   */
  private async validateProductionDeployment(): Promise<void> {
    console.log('🔍 Phase 9: Validating production deployment...');

    const services = [
      'postgres-primary', 'postgres-replica', 'redis-primary', 'temporal',
      'api', 'workers-scoring', 'workers-alerts', 'discord-bot',
      'prometheus', 'alertmanager', 'grafana', 'nginx', 'command-center'
    ];

    let healthyServices = 0;
    for (const service of services) {
      try {
        await this.checkServiceHealth(service);
        healthyServices++;
        console.log(`✅ ${service}: Healthy`);
      } catch (error) {
        console.log(`❌ ${service}: Unhealthy - ${error}`);
      }
    }

    this.metrics.healthChecksPassed = healthyServices;

    if (healthyServices === services.length) {
      console.log('✅ All services healthy - Production deployment validated');
    } else {
      throw new Error(`Only ${healthyServices}/${services.length} services healthy`);
    }
  }

  /**
   * Run comprehensive performance tests
   */
  private async runPerformanceTests(): Promise<void> {
    console.log('🚀 Phase 10: Running performance tests...');

    // Test scoring pipeline latency
    const latencyTest = await this.testScoringLatency();
    this.metrics.performanceTests.latencyMs = latencyTest.averageLatencyMs;

    // Test throughput capacity
    const throughputTest = await this.testScoringThroughput();
    this.metrics.performanceTests.throughputPerHour = throughputTest.propsPerHour;

    // Test error rates
    const errorTest = await this.testErrorRates();
    this.metrics.performanceTests.errorRate = errorTest.errorRate;

    // Validate performance targets
    await this.validatePerformanceTargets();

    console.log('✅ Performance tests completed');
    console.log(`📊 Results:`);
    console.log(`   • Latency: ${this.metrics.performanceTests.latencyMs}ms`);
    console.log(`   • Throughput: ${this.metrics.performanceTests.throughputPerHour} props/hour`);
    console.log(`   • Error Rate: ${this.metrics.performanceTests.errorRate}%`);
  }

  // Helper methods

  private async createProductionDirectories(): Promise<void> {
    const directories = [
      'config/postgres',
      'config/redis',
      'config/nginx',
      'config/temporal/production',
      'monitoring',
      'ssl',
      'logs/production'
    ];

    for (const dir of directories) {
      await this.executeCommand(`mkdir -p ${path.join(this.rootPath, dir)}`);
    }
  }

  private async generateProductionConfigs(): Promise<void> {
    // Generate PostgreSQL production config
    const postgresConfig = this.generatePostgreSQLConfig();
    await writeFile(path.join(this.rootPath, 'config/postgres/postgresql.conf'), postgresConfig);

    // Generate Redis production config
    const redisConfig = this.generateRedisConfig();
    await writeFile(path.join(this.rootPath, 'config/redis/redis.conf'), redisConfig);

    // Generate NGINX production config
    const nginxConfig = this.generateNginxConfig();
    await writeFile(path.join(this.rootPath, 'config/nginx/nginx.conf'), nginxConfig);

    // Generate Prometheus production config
    const prometheusConfig = this.generatePrometheusConfig();
    await writeFile(path.join(this.rootPath, 'monitoring/prometheus.production.yml'), prometheusConfig);
  }

  private async setupDockerInfrastructure(): Promise<void> {
    // Create production Docker network
    await this.executeCommand('docker network create production-network --driver bridge --subnet 172.21.0.0/16 || true');

    // Create production volumes
    const volumes = [
      'postgres_production_data',
      'postgres_replica_production_data',
      'redis_production_data',
      'prometheus_production_data',
      'grafana_production_data'
    ];

    for (const volume of volumes) {
      await this.executeCommand(`docker volume create ${volume} || true`);
    }
  }

  private async runDatabaseMigrations(): Promise<void> {
    console.log('🔄 Running database migrations...');
    await this.executeCommand('docker-compose -f docker-compose.production.yml exec -T api npm run db:migrate');
  }

  private async optimizeDatabaseForProduction(): Promise<void> {
    console.log('⚡ Optimizing database for production...');

    const optimizationQueries = [
      "ALTER SYSTEM SET shared_buffers = '256MB';",
      "ALTER SYSTEM SET effective_cache_size = '1GB';",
      "ALTER SYSTEM SET maintenance_work_mem = '64MB';",
      "ALTER SYSTEM SET checkpoint_completion_target = 0.7;",
      "ALTER SYSTEM SET wal_buffers = '16MB';",
      "ALTER SYSTEM SET default_statistics_target = 100;",
      "SELECT pg_reload_conf();"
    ];

    for (const query of optimizationQueries) {
      await this.executeCommand(`docker-compose -f docker-compose.production.yml exec -T postgres-primary psql -U postgres -c "${query}"`);
    }
  }

  private async validateEnhanced45FactorSystem(): Promise<void> {
    console.log('🏆 Validating Enhanced 45-Factor scoring system...');

    const response = await this.executeCommand('curl -s http://localhost:3000/api/scoring/enhanced-45-factor/status');
    const status = JSON.parse(response.stdout);

    if (!status.enabled) {
      throw new Error('Enhanced 45-Factor system not enabled');
    }

    console.log('✅ Enhanced 45-Factor system operational');
  }

  private async validateAgentHealth(): Promise<void> {
    console.log('🤖 Validating agent health...');

    const response = await this.executeCommand('curl -s http://localhost:3000/api/agents/health');
    const agentHealth = JSON.parse(response.stdout);

    const requiredAgents = ['ScoringAgent', 'AlertAgent', 'FeedAgent', 'RecapAgent', 'OperatorAgent'];
    for (const agent of requiredAgents) {
      if (!agentHealth[agent] || agentHealth[agent].status !== 'healthy') {
        throw new Error(`Agent ${agent} is not healthy`);
      }
    }

    console.log('✅ All agents healthy');
  }

  private async configureProductionAlerts(): Promise<void> {
    console.log('🚨 Configuring production alerts...');

    const alertRules = this.generateAlertRules();
    await writeFile(path.join(this.rootPath, 'monitoring/alert_rules.production.yml'), alertRules);

    const alertmanagerConfig = this.generateAlertmanagerConfig();
    await writeFile(path.join(this.rootPath, 'monitoring/alertmanager.production.yml'), alertmanagerConfig);
  }

  private async configureAPIIntegration(): Promise<void> {
    console.log('🔌 Configuring API integration...');

    // Configure rate limiting rules
    const rateLimitConfig = this.generateRateLimitConfig();
    await writeFile(path.join(this.rootPath, 'config/nginx/rate-limit.conf'), rateLimitConfig);

    // Configure failover rules
    const failoverConfig = this.generateFailoverConfig();
    await writeFile(path.join(this.rootPath, 'config/nginx/failover.conf'), failoverConfig);
  }

  private async validateCommandCenterIntegration(): Promise<void> {
    console.log('💻 Validating Command Center integration...');

    const response = await this.executeCommand('curl -s http://localhost:3004/api/health');
    const health = JSON.parse(response.stdout);

    if (health.status !== 'healthy') {
      throw new Error('Command Center not healthy');
    }

    console.log('✅ Command Center integration validated');
  }

  private async testScoringLatency(): Promise<{ averageLatencyMs: number }> {
    console.log('⏱️ Testing scoring latency...');

    const testResults = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await this.executeCommand('curl -s http://localhost:3000/api/scoring/test-latency');
      const latency = Date.now() - start;
      testResults.push(latency);
    }

    const averageLatencyMs = testResults.reduce((sum, lat) => sum + lat, 0) / testResults.length;
    return { averageLatencyMs };
  }

  private async testScoringThroughput(): Promise<{ propsPerHour: number }> {
    console.log('🚀 Testing scoring throughput...');

    const start = Date.now();
    const response = await this.executeCommand('curl -s http://localhost:3000/api/scoring/test-throughput');
    const result = JSON.parse(response.stdout);

    return { propsPerHour: result.propsPerHour };
  }

  private async testErrorRates(): Promise<{ errorRate: number }> {
    console.log('🎯 Testing error rates...');

    const response = await this.executeCommand('curl -s http://localhost:3000/api/scoring/error-rate');
    const result = JSON.parse(response.stdout);

    return { errorRate: result.errorRate };
  }

  private async validatePerformanceTargets(): Promise<void> {
    const { latencyMs, throughputPerHour, errorRate } = this.metrics.performanceTests;

    if (latencyMs > this.config.scoreTargets.latencyTargetMs) {
      throw new Error(`Latency ${latencyMs}ms exceeds target ${this.config.scoreTargets.latencyTargetMs}ms`);
    }

    if (throughputPerHour < this.config.scoreTargets.throughputPerHour) {
      throw new Error(`Throughput ${throughputPerHour}/hour below target ${this.config.scoreTargets.throughputPerHour}/hour`);
    }

    if (errorRate > 5.0) {
      throw new Error(`Error rate ${errorRate}% exceeds maximum 5%`);
    }

    console.log('✅ All performance targets met');
  }

  private async waitForServiceHealth(serviceName: string, timeoutMs: number): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        await this.checkServiceHealth(serviceName);
        return;
      } catch (error) {
        await this.sleep(5000);
      }
    }

    throw new Error(`Service ${serviceName} failed to become healthy within ${timeoutMs}ms`);
  }

  private async checkServiceHealth(serviceName: string): Promise<void> {
    const { stdout } = await this.executeCommand(`docker-compose -f docker-compose.production.yml ps ${serviceName}`);

    if (!stdout.includes('(healthy)')) {
      throw new Error(`Service ${serviceName} is not healthy`);
    }
  }

  private async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(command, { cwd: this.rootPath });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async generateDeploymentReport(): Promise<void> {
    const report = {
      deployment: {
        timestamp: this.metrics.deploymentStart.toISOString(),
        duration: Date.now() - this.metrics.deploymentStart.getTime(),
        status: this.metrics.status
      },
      services: this.metrics.servicesDeployed,
      healthChecks: this.metrics.healthChecksPassed,
      performance: this.metrics.performanceTests,
      targets: this.config.scoreTargets
    };

    await writeFile(
      path.join(this.rootPath, `logs/production/deployment-report-${Date.now()}.json`),
      JSON.stringify(report, null, 2)
    );

    console.log('📄 Deployment report generated');
  }

  private async handleDeploymentFailure(error: any): Promise<void> {
    console.error('❌ Deployment failed, generating failure report...');

    const failureReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      servicesDeployed: this.metrics.servicesDeployed,
      healthChecksPassed: this.metrics.healthChecksPassed,
      lastKnownState: this.metrics.status
    };

    await writeFile(
      path.join(this.rootPath, `logs/production/deployment-failure-${Date.now()}.json`),
      JSON.stringify(failureReport, null, 2)
    );
  }

  // Configuration generators

  private generatePostgreSQLConfig(): string {
    return `
# PostgreSQL Production Configuration
# Optimized for high-performance betting system

max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.7
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4
`;
  }

  private generateRedisConfig(): string {
    return `
# Redis Production Configuration
maxmemory 1gb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000
tcp-keepalive 300
timeout 0
databases 16
maxclients 10000
`;
  }

  private generateNginxConfig(): string {
    return `
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        server api:3000;
    }

    upstream command_center_backend {
        server command-center:3000;
    }

    server {
        listen 80;
        server_name api.unittalk.com;

        location / {
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    server {
        listen 80;
        server_name command.unittalk.com;

        location / {
            proxy_pass http://command_center_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
`;
  }

  private generatePrometheusConfig(): string {
    return `
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.production.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:9464']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-primary:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-primary:6379']
`;
  }

  private generateAlertRules(): string {
    return `
groups:
  - name: production_alerts
    rules:
      - alert: HighLatency
        expr: scoring_latency_ms > 2000
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Scoring latency exceeds 2 seconds

      - alert: LowThroughput
        expr: scoring_throughput_per_hour < 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Scoring throughput below target
`;
  }

  private generateAlertmanagerConfig(): string {
    return `
global:
  discord_api_url: $DISCORD_WEBHOOK_URL

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    discord_configs:
      - webhook_url: '$DISCORD_WEBHOOK_URL'
        title: 'Unit Talk Production Alert'
`;
  }

  private generateRateLimitConfig(): string {
    return `
# Rate limiting configuration
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=scoring:10m rate=50r/s;
`;
  }

  private generateFailoverConfig(): string {
    return `
# Failover configuration
upstream api_failover {
    server api:3000 max_fails=3 fail_timeout=30s;
    server api-backup:3000 backup;
}
`;
  }
}

// Production deployment configuration
const productionConfig: DeploymentConfig = {
  environment: 'production',
  scoreTargets: {
    throughputPerHour: 1000,
    latencyTargetMs: 2000,
    accuracyTarget: 55,
    uptimeTarget: 99.9
  },
  infrastructure: {
    apiInstances: 2,
    workerInstances: 4,
    databaseConnections: 200,
    redisMemory: '1GB'
  },
  monitoring: {
    prometheusEnabled: true,
    grafanaEnabled: true,
    alertingEnabled: true
  }
};

// Execute deployment
async function main() {
  const deployment = new ProductionDeployment(productionConfig);

  try {
    await deployment.deploy();
    console.log('🎉 Phase 8 Production Deployment Successful!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Phase 8 Production Deployment Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ProductionDeployment, type DeploymentConfig, type DeploymentMetrics };