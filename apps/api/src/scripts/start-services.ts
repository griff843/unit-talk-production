#!/usr/bin/env node

/**
 * Quick Local Services Starter
 * Starts just the essential services needed for E2E testing
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

// Common Docker paths on Windows
const DOCKER_PATHS = [
  'docker',
  'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
  join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
  join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe')
];

function findDockerPath(): string {
  for (const path of DOCKER_PATHS) {
    if (path === 'docker') {
      // Try the PATH first
      continue;
    }
    if (existsSync(path)) {
      return path;
    }
  }
  return 'docker'; // Fallback to PATH
}

async function checkPortOpen(port: number, host = 'localhost'): Promise<boolean> {
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

async function waitForService(serviceName: string, port: number, maxWaitMs = 60000): Promise<void> {
  console.log(`⏳ Waiting for ${serviceName} on port ${port}...`);
  
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (await checkPortOpen(port)) {
      console.log(`✅ ${serviceName} is ready!`);
      return;
    }
    await sleep(2000);
  }
  
  throw new Error(`${serviceName} failed to start within ${maxWaitMs}ms`);
}

async function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    process.on('error', reject);
  });
}

async function checkDockerDesktop(): Promise<boolean> {
  console.log('🔍 Checking Docker Desktop...');
  
  // Check if Docker Desktop is running by looking for the process
  try {
    await runCommand('tasklist', ['/FI', 'IMAGENAME eq Docker Desktop.exe']);
    console.log('✅ Docker Desktop appears to be running');
    return true;
  } catch {
    console.log('⚠️ Docker Desktop may not be running');
    return false;
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting Unit Talk Local Services');
  console.log('===================================\n');
  
  try {
    // Find Docker executable
    const dockerPath = findDockerPath();
    console.log(`🐳 Using Docker at: ${dockerPath}`);
    
    // Check if Docker Desktop is running
    const dockerRunning = await checkDockerDesktop();
    if (!dockerRunning) {
      console.log('\n⚠️ Docker Desktop may not be running.');
      console.log('Please start Docker Desktop and try again.');
      console.log('\nAlternatively, you can start services manually:');
      console.log('1. Open Docker Desktop');
      console.log('2. Run: docker compose up -d postgres redis temporal temporal-web');
      return;
    }
    
    // Check if Docker is available
    console.log('\n🔍 Checking Docker...');
    try {
      await runCommand(dockerPath, ['--version']);
    } catch (error) {
      throw new Error('Docker is not available. Please install Docker Desktop and make sure it\'s running.');
    }
    
    // Start essential services
    console.log('\n📦 Starting essential services...');
    await runCommand(dockerPath, ['compose', 'up', '-d', 'postgres', 'redis']);
    
    // Wait for PostgreSQL
    await waitForService('PostgreSQL', 5432, 30000);
    
    // Wait for Redis
    await waitForService('Redis', 6379, 15000);
    
    // Start Temporal
    console.log('\n🕐 Starting Temporal server...');
    await runCommand(dockerPath, ['compose', 'up', '-d', 'temporal']);
    
    // Wait for Temporal
    await waitForService('Temporal Server', 7233, 60000);
    
    // Start Temporal Web UI
    console.log('\n🌐 Starting Temporal Web UI...');
    await runCommand(dockerPath, ['compose', 'up', '-d', 'temporal-web']);
    
    // Wait for Web UI
    await waitForService('Temporal Web UI', 8080, 30000);
    
    console.log('\n🎉 All services are ready!');
    console.log('\n📊 Service Status:');
    console.log('==================');
    console.log('✅ PostgreSQL: localhost:5432');
    console.log('✅ Redis: localhost:6379');
    console.log('✅ Temporal Server: localhost:7233');
    console.log('✅ Temporal Web UI: http://localhost:8080');
    
    console.log('\n🧪 Ready for E2E testing!');
    console.log('Run: npm run test:e2e:external');
    
    console.log('\n📝 Next Steps:');
    console.log('1. Run E2E tests: npm run test:e2e:external');
    console.log('2. View Temporal UI: http://localhost:8080');
    console.log('3. Stop services: npm run dev:stop');
    
  } catch (error) {
    console.error('❌ Failed to start services:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure Docker Desktop is installed and running');
    console.log('2. Check if ports 5432, 6379, 7233, 8080 are available');
    console.log('3. Try manually: docker compose up -d postgres redis temporal temporal-web');
    console.log('4. Check Docker Desktop is running in system tray');
    process.exit(1);
  }
}

main().catch(console.error);