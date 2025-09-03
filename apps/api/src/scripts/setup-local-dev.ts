#!/usr/bin/env node

/**
 * Local Development Setup Script
 * Sets up and runs the complete local development environment for Unit Talk
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';

interface ServiceStatus {
  name: string;
  running: boolean;
  healthy: boolean;
  port?: number;
}

class LocalDevSetup {
  private services: Map<string, ChildProcess> = new Map();
  private isShuttingDown = false;

  async checkPrerequisites(): Promise<boolean> {
    console.log('🔍 Checking prerequisites...');
    
    try {
      // Check if Docker is running
      await this.runCommand('docker', ['--version']);
      console.log('✅ Docker is available');
      
      // Check if Docker Compose is available
      await this.runCommand('docker', ['compose', '--version']);
      console.log('✅ Docker Compose is available');
      
      return true;
    } catch (error) {
      console.error('❌ Prerequisites not met:', error);
      console.log('\n📋 Please ensure:');
      console.log('  - Docker Desktop is installed and running');
      console.log('  - Docker Compose is available');
      return false;
    }
  }

  async setupEnvironment(): Promise<void> {
    console.log('🔧 Setting up environment...');
    
    // Check if .env file exists, if not create from example
    try {
      await fs.access('.env');
      console.log('✅ .env file exists');
    } catch {
      console.log('📝 Creating .env file from .env.test...');
      try {
        const envTest = await fs.readFile('.env.test', 'utf8');
        await fs.writeFile('.env', envTest);
        console.log('✅ .env file created');
      } catch (error) {
        console.log('⚠️ Could not create .env file, using defaults');
      }
    }
  }

  async startInfrastructure(): Promise<void> {
    console.log('🚀 Starting infrastructure services...');
    
    // Start PostgreSQL and Redis first
    console.log('Starting PostgreSQL and Redis...');
    await this.runCommand('docker', ['compose', 'up', '-d', 'postgres', 'redis']);
    
    // Wait for PostgreSQL to be healthy
    console.log('⏳ Waiting for PostgreSQL to be ready...');
    await this.waitForService('postgres', 5432, 30000);
    
    // Wait for Redis to be healthy
    console.log('⏳ Waiting for Redis to be ready...');
    await this.waitForService('redis', 6379, 15000);
    
    // Start Temporal server
    console.log('Starting Temporal server...');
    await this.runCommand('docker', ['compose', 'up', '-d', 'temporal']);
    
    // Wait for Temporal to be healthy
    console.log('⏳ Waiting for Temporal server to be ready...');
    await this.waitForService('temporal', 7233, 60000);
    
    // Start Temporal Web UI
    console.log('Starting Temporal Web UI...');
    await this.runCommand('docker', ['compose', 'up', '-d', 'temporal-web']);
    
    console.log('✅ Infrastructure services started successfully!');
  }

  async checkServiceStatus(): Promise<ServiceStatus[]> {
    const services: ServiceStatus[] = [
      { name: 'PostgreSQL', running: false, healthy: false, port: 5432 },
      { name: 'Redis', running: false, healthy: false, port: 6379 },
      { name: 'Temporal Server', running: false, healthy: false, port: 7233 },
      { name: 'Temporal Web UI', running: false, healthy: false, port: 8080 }
    ];

    for (const service of services) {
      if (service.port) {
        service.running = await this.isPortOpen('localhost', service.port);
        service.healthy = service.running; // Simplified health check
      }
    }

    return services;
  }

  async runE2ETests(): Promise<void> {
    console.log('🧪 Running E2E tests...');
    
    try {
      // Run the external worker E2E test
      await this.runCommand('npx', ['tsx', 'src/scripts/e2e-test-runner-external-worker.ts'], {
        env: {
          ...process.env,
          TEMPORAL_ADDRESS: 'localhost:7233',
          TEMPORAL_NAMESPACE: 'default',
          TEMPORAL_TASK_QUEUE: 'unit-talk-test'
        }
      });
      
      console.log('✅ E2E tests completed successfully!');
    } catch (error) {
      console.error('❌ E2E tests failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.isShuttingDown) {return;}
    this.isShuttingDown = true;
    
    console.log('🧹 Cleaning up...');
    
    // Stop all spawned processes
    for (const [name, childProcess] of this.services) {
      if (!childProcess.killed) {
        console.log(`Stopping ${name}...`);
        childProcess.kill('SIGTERM');
      }
    }
    
    // Optionally stop Docker services (commented out to keep them running for development)
    // console.log('Stopping Docker services...');
    // await this.runCommand('docker', ['compose', 'down']);
    
    console.log('✅ Cleanup completed');
  }

  private async runCommand(
    command: string, 
    args: string[], 
    options: { env?: NodeJS.ProcessEnv; cwd?: string } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: { ...process.env, ...options.env },
        cwd: options.cwd
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        stdout += output;
        console.log(output.trim());
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        console.error(output.trim());
      });

      childProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', reject);
    });
  }

  private async waitForService(serviceName: string, port: number, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const isReady = await this.isPortOpen('localhost', port);
        if (isReady) {
          console.log(`✅ ${serviceName} is ready on port ${port}`);
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`${serviceName} failed to start within ${timeoutMs}ms`);
  }

  private async isPortOpen(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(1000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  async displayStatus(): Promise<void> {
    console.log('\n📊 Service Status:');
    console.log('==================');
    
    const services = await this.checkServiceStatus();
    
    for (const service of services) {
      const status = service.healthy ? '✅ Healthy' : service.running ? '⚠️ Running' : '❌ Stopped';
      const port = service.port ? ` (port ${service.port})` : '';
      console.log(`${service.name}${port}: ${status}`);
    }
    
    console.log('\n🌐 Web Interfaces:');
    console.log('==================');
    console.log('Temporal Web UI: http://localhost:8080');
    console.log('Prometheus: http://localhost:9090');
    console.log('');
  }
}

async function main(): Promise<void> {
  const setup = new LocalDevSetup();
  
  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, cleaning up...');
    await setup.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, cleaning up...');
    await setup.cleanup();
    process.exit(0);
  });

  try {
    console.log('🎯 Unit Talk Local Development Setup');
    console.log('====================================\n');
    
    // Check prerequisites
    const prereqsOk = await setup.checkPrerequisites();
    if (!prereqsOk) {
      process.exit(1);
    }
    
    // Setup environment
    await setup.setupEnvironment();
    
    // Start infrastructure
    await setup.startInfrastructure();
    
    // Display status
    await setup.displayStatus();
    
    // Ask user what to do next
    console.log('🎉 Local development environment is ready!');
    console.log('\nNext steps:');
    console.log('1. Run E2E tests: npm run test:e2e:external');
    console.log('2. Start the application: docker compose up app');
    console.log('3. View Temporal workflows: http://localhost:8080');
    console.log('\nPress Ctrl+C to stop services when done.');
    
    // Keep the process running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    await setup.cleanup();
    process.exit(1);
  }
}

// Run the setup
main().catch(console.error);