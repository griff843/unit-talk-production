#!/usr/bin/env node

/**
 * Production Agent Startup Script
 * Starts all core agents for real-time market processing
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Production Agent Orchestration...\n');

// Start the agent orchestrator in the background
const agentProcess = spawn('npx', ['tsx', 'src/runner/startProductionAgents.ts'], {
  cwd: path.join(__dirname, 'apps', 'api'),
  stdio: ['pipe', 'pipe', 'pipe'],
  detached: false
});

// Track startup status
let startupComplete = false;
let agentCount = 0;

agentProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);

  // Track agent startup
  if (output.includes('✅') && output.includes('started successfully')) {
    agentCount++;
  }

  // Check if all agents are operational
  if (output.includes('🎉 ALL AGENTS OPERATIONAL')) {
    startupComplete = true;
    console.log('\n🎯 Production agent orchestration is now running!');
    console.log('💡 Press Ctrl+C to gracefully shutdown all agents');
  }
});

agentProcess.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

agentProcess.on('close', (code) => {
  console.log(`\n⏹️ Agent orchestration process exited with code ${code}`);
  if (code === 0) {
    console.log('✅ All agents shut down gracefully');
  } else {
    console.log('❌ Agent orchestration encountered issues');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down production agents...');
  agentProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down production agents...');
  agentProcess.kill('SIGTERM');
});

// Keep the process running
process.stdin.resume();