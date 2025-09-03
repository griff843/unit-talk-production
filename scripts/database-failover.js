#!/usr/bin/env node

/**
 * Database Failover Utility
 * Automatically switch between master and replica PostgreSQL instances
 */

const { Client } = require('pg');

const MASTER_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'unit_talk_dev',
  user: 'postgres',
  password: 'postgres',
};

const REPLICA_CONFIG = {
  host: 'localhost', 
  port: 5433,
  database: 'unit_talk_dev',
  user: 'postgres',
  password: 'postgres',
};

class DatabaseFailoverManager {
  constructor() {
    this.currentConnection = 'master';
    this.masterClient = null;
    this.replicaClient = null;
    this.healthCheckInterval = null;
  }

  async checkConnection(config, label) {
    const client = new Client(config);
    
    try {
      await client.connect();
      
      const startTime = Date.now();
      const result = await client.query('SELECT 1 as health_check, NOW() as timestamp');
      const responseTime = Date.now() - startTime;
      
      await client.end();
      
      return {
        status: 'healthy',
        responseTime,
        timestamp: result.rows[0].timestamp,
        connection: label
      };
    } catch (error) {
      try {
        await client.end();
      } catch (endError) {
        // Ignore connection end errors
      }
      
      return {
        status: 'failed',
        error: error.message,
        connection: label
      };
    }
  }

  async checkReplicationLag() {
    if (this.currentConnection === 'replica') {
      const client = new Client(REPLICA_CONFIG);
      
      try {
        await client.connect();
        
        const result = await client.query(`
          SELECT 
            EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS replica_lag_seconds,
            pg_is_in_recovery() AS is_in_recovery
        `);
        
        await client.end();
        
        return result.rows[0];
      } catch (error) {
        try {
          await client.end();
        } catch (endError) {
          // Ignore
        }
        return { replica_lag_seconds: null, error: error.message };
      }
    }
    
    return { replica_lag_seconds: 0, is_in_recovery: false };
  }

  async performHealthCheck() {
    console.log('🏥 Performing database health check...');
    
    const [masterHealth, replicaHealth] = await Promise.all([
      this.checkConnection(MASTER_CONFIG, 'master'),
      this.checkConnection(REPLICA_CONFIG, 'replica')
    ]);

    const replicationInfo = await this.checkReplicationLag();
    
    console.log('\n📊 Health Check Results:');
    console.log(`Master (${MASTER_CONFIG.host}:${MASTER_CONFIG.port}):`, 
      masterHealth.status === 'healthy' 
        ? `✅ Healthy (${masterHealth.responseTime}ms)`
        : `❌ Failed: ${masterHealth.error}`
    );
    
    console.log(`Replica (${REPLICA_CONFIG.host}:${REPLICA_CONFIG.port}):`, 
      replicaHealth.status === 'healthy' 
        ? `✅ Healthy (${replicaHealth.responseTime}ms)`
        : `❌ Failed: ${replicaHealth.error}`
    );

    if (replicationInfo.replica_lag_seconds !== null) {
      console.log(`Replication Lag: ${replicationInfo.replica_lag_seconds.toFixed(2)}s`);
      
      if (replicationInfo.replica_lag_seconds > 60) {
        console.log('⚠️ WARNING: High replication lag detected!');
      }
    }

    console.log(`Current Active Connection: ${this.currentConnection.toUpperCase()}`);
    
    // Determine if failover is needed
    if (this.currentConnection === 'master' && masterHealth.status === 'failed' && replicaHealth.status === 'healthy') {
      console.log('\n🚨 MASTER FAILURE DETECTED - Initiating failover to replica...');
      return this.failoverToReplica();
    }
    
    if (this.currentConnection === 'replica' && masterHealth.status === 'healthy') {
      console.log('\n🔄 MASTER RECOVERED - Consider failing back to master...');
      // Don't auto-failback, require manual intervention
      console.log('💡 Run with --failback to switch back to master');
    }

    return {
      masterHealth,
      replicaHealth,
      replicationInfo,
      currentConnection: this.currentConnection,
      actionTaken: 'none'
    };
  }

  async failoverToReplica() {
    console.log('🔄 Executing failover to replica...');
    
    // Verify replica is healthy
    const replicaHealth = await this.checkConnection(REPLICA_CONFIG, 'replica');
    if (replicaHealth.status !== 'healthy') {
      console.log('❌ FAILOVER ABORTED: Replica is not healthy');
      return { success: false, reason: 'Replica unhealthy' };
    }

    // Update connection tracking
    this.currentConnection = 'replica';
    
    console.log('✅ FAILOVER COMPLETED');
    console.log('📋 Next steps:');
    console.log('  1. Update application DATABASE_URL to use port 5433');
    console.log('  2. Restart application services');
    console.log('  3. Monitor replica performance');
    console.log('  4. Investigate and fix master database');
    
    return { success: true, newConnection: 'replica' };
  }

  async failoverToMaster() {
    console.log('🔄 Executing failback to master...');
    
    // Verify master is healthy
    const masterHealth = await this.checkConnection(MASTER_CONFIG, 'master');
    if (masterHealth.status !== 'healthy') {
      console.log('❌ FAILBACK ABORTED: Master is not healthy');
      return { success: false, reason: 'Master unhealthy' };
    }

    // Update connection tracking
    this.currentConnection = 'master';
    
    console.log('✅ FAILBACK COMPLETED');
    console.log('📋 Next steps:');
    console.log('  1. Update application DATABASE_URL to use port 5432');
    console.log('  2. Restart application services');
    console.log('  3. Verify replication is working properly');
    
    return { success: true, newConnection: 'master' };
  }

  startContinuousMonitoring(intervalMs = 30000) {
    console.log(`🔍 Starting continuous monitoring (${intervalMs / 1000}s intervals)...`);
    console.log('Press Ctrl+C to stop');
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('❌ Health check failed:', error.message);
      });
    }, intervalMs);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitoring...');
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      process.exit(0);
    });
  }
}

// CLI Interface
async function main() {
  const manager = new DatabaseFailoverManager();
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🏥 Database Failover Utility

Usage:
  node database-failover.js [options]

Options:
  --check           Perform single health check
  --monitor         Start continuous monitoring 
  --failover        Force failover to replica
  --failback        Force failback to master
  --status          Show current connection status
  --help, -h        Show this help

Examples:
  node database-failover.js --check
  node database-failover.js --monitor  
  node database-failover.js --failover
  node database-failover.js --failback
`);
    return;
  }

  if (args.includes('--failover')) {
    await manager.failoverToReplica();
    return;
  }

  if (args.includes('--failback')) {
    await manager.failoverToMaster();
    return;
  }

  if (args.includes('--monitor')) {
    await manager.performHealthCheck();
    manager.startContinuousMonitoring();
    return;
  }

  if (args.includes('--status')) {
    console.log(`Current active connection: ${manager.currentConnection.toUpperCase()}`);
    return;
  }

  // Default: single health check
  await manager.performHealthCheck();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = DatabaseFailoverManager;