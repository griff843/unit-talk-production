#!/usr/bin/env node
/**
 * VIP Automation System - Main Entry Point
 * Orchestrates both curated alert aggregator and VIP+ mirror bots
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Unit Talk VIP Automation System...');
console.log('=====================================');

// Bot processes
const bots = [
  {
    name: 'Curated Alert Aggregator',
    script: 'curated-alert-aggregator.js',
    process: null
  },
  {
    name: 'VIP+ Mirror Bot',
    script: 'vipplus-mirror-bot.js',
    process: null
  }
];

// Start a bot process
function startBot(bot) {
  console.log(`🤖 Starting ${bot.name}...`);

  bot.process = spawn('node', [bot.script], {
    cwd: __dirname,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  // Handle stdout
  bot.process.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`[${bot.name}] ${line}`);
    });
  });

  // Handle stderr
  bot.process.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.error(`[${bot.name}] ERROR: ${line}`);
    });
  });

  // Handle process exit
  bot.process.on('exit', (code, signal) => {
    console.log(`❌ ${bot.name} exited with code ${code} (signal: ${signal})`);

    // Restart after 5 seconds unless shutting down
    if (!isShuttingDown && code !== 0) {
      console.log(`🔄 Restarting ${bot.name} in 5 seconds...`);
      setTimeout(() => {
        if (!isShuttingDown) {
          startBot(bot);
        }
      }, 5000);
    }
  });

  // Handle process errors
  bot.process.on('error', (error) => {
    console.error(`❌ Failed to start ${bot.name}:`, error.message);
  });
}

// Graceful shutdown flag
let isShuttingDown = false;

// Graceful shutdown handler
function gracefulShutdown(signal) {
  if (isShuttingDown) return;

  console.log(`\n👋 Received ${signal}, shutting down VIP automation system...`);
  isShuttingDown = true;

  bots.forEach(bot => {
    if (bot.process && !bot.process.killed) {
      console.log(`🛑 Stopping ${bot.name}...`);
      bot.process.kill('SIGINT');
    }
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⏰ Force shutdown after timeout');
    process.exit(1);
  }, 10000);

  // Wait for all processes to exit
  const checkInterval = setInterval(() => {
    const runningBots = bots.filter(bot => bot.process && !bot.process.killed);
    if (runningBots.length === 0) {
      clearInterval(checkInterval);
      console.log('✅ All bots stopped. Goodbye!');
      process.exit(0);
    }
  }, 500);
}

// Register signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
});

// Start all bots
console.log('🎯 Starting automation bots...\n');
bots.forEach(startBot);

// Status reporting
setInterval(() => {
  if (!isShuttingDown) {
    const runningCount = bots.filter(bot => bot.process && !bot.process.killed).length;
    console.log(`📊 Status: ${runningCount}/${bots.length} bots running`);
  }
}, 60000); // Every minute

console.log('\n✅ VIP Automation System started successfully!');
console.log('📋 Running bots:');
bots.forEach(bot => {
  console.log(`   • ${bot.name}`);
});
console.log('\n💡 Press Ctrl+C to stop all bots gracefully\n');