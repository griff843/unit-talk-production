#!/usr/bin/env tsx

/**
 * Credit Usage Monitoring Dashboard
 * 
 * Real-time monitoring of Odds API credit usage with alerts and recommendations
 */

import 'dotenv/config';
import { getCreditUsageStatus } from '../src/agents/FeedAgent/oddsApi';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('CreditMonitor');

// Configuration
const MONITORING_CONFIG = {
  checkInterval: 60000, // 1 minute
  alertThresholds: {
    warning: 70,  // 70% usage triggers warning
    critical: 85, // 85% usage triggers critical alert
    emergency: 95 // 95% usage triggers emergency mode
  },
  display: {
    clearScreen: true,
    showHistory: true,
    historyLength: 10
  }
};

// Usage history tracking
const usageHistory: Array<{
  timestamp: Date;
  used: number;
  percentage: number;
  hourlyRate: number;
}> = [];

let lastUsed = 0;
let checkCount = 0;

/**
 * Display credit usage dashboard
 */
function displayDashboard() {
  if (MONITORING_CONFIG.display.clearScreen) {
    console.clear();
  }

  const status = getCreditUsageStatus();
  const currentTime = new Date();
  
  // Calculate hourly burn rate
  const timeDiff = checkCount > 0 ? MONITORING_CONFIG.checkInterval / 1000 / 60 : 0; // minutes
  const creditsDiff = status.monthlyUsed - lastUsed;
  const hourlyRate = timeDiff > 0 ? (creditsDiff / timeDiff) * 60 : 0;

  // Update history
  if (checkCount > 0) {
    usageHistory.push({
      timestamp: currentTime,
      used: status.monthlyUsed,
      percentage: status.percentUsed,
      hourlyRate
    });

    // Keep only recent history
    while (usageHistory.length > MONITORING_CONFIG.display.historyLength) {
      usageHistory.shift();
    }
  }

  // Display header
  console.log('='.repeat(80));
  console.log('🎯 ODDS API CREDIT USAGE MONITOR - ELITE REAL-TIME DASHBOARD');
  console.log('='.repeat(80));
  console.log(`📅 Current Time: ${currentTime.toLocaleString()}`);
  console.log(`🔄 Check #${checkCount + 1} | Interval: ${MONITORING_CONFIG.checkInterval / 1000}s`);
  console.log('');

  // Current usage
  console.log('📊 CURRENT USAGE:');
  console.log(`   Credits Used: ${status.monthlyUsed} / ${status.monthlyLimit}`);
  console.log(`   Percentage: ${status.percentUsed}% ${getUsageIndicator(status.percentUsed)}`);
  console.log(`   Daily Budget: ${status.dailyBudget} credits/day`);
  console.log(`   Days Remaining: ${status.daysRemaining}`);
  console.log(`   Reset Date: ${new Date(status.resetDate).toLocaleDateString()}`);
  console.log('');

  // Burn rate analysis
  if (checkCount > 0) {
    console.log('🔥 BURN RATE ANALYSIS:');
    console.log(`   Last Interval: ${creditsDiff} credits`);
    console.log(`   Hourly Rate: ${hourlyRate.toFixed(1)} credits/hour`);
    console.log(`   Daily Projection: ${(hourlyRate * 24).toFixed(0)} credits/day`);
    
    const remainingCredits = status.monthlyLimit - status.monthlyUsed;
    const hoursUntilEmpty = hourlyRate > 0 ? remainingCredits / hourlyRate : Infinity;
    
    if (hoursUntilEmpty < Infinity) {
      console.log(`   Time Until Empty: ${hoursUntilEmpty.toFixed(1)} hours`);
    }
    console.log('');
  }

  // Alert status
  console.log('🚨 ALERT STATUS:');
  const alertLevel = getAlertLevel(status.percentUsed);
  console.log(`   Level: ${alertLevel.name} ${alertLevel.emoji}`);
  console.log(`   Message: ${alertLevel.message}`);
  if (alertLevel.action) {
    console.log(`   Action: ${alertLevel.action}`);
  }
  console.log('');

  // Usage history
  if (MONITORING_CONFIG.display.showHistory && usageHistory.length > 0) {
    console.log('📈 USAGE HISTORY:');
    usageHistory.slice(-5).forEach((entry) => {
      const time = entry.timestamp.toLocaleTimeString();
      console.log(`   ${time}: ${entry.used} credits (${entry.percentage}%) - ${entry.hourlyRate.toFixed(1)}/hr`);
    });
    console.log('');
  }

  // Recommendations
  console.log('💡 RECOMMENDATIONS:');
  const recommendations = getRecommendations(status, hourlyRate);
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });
  console.log('');

  // Footer
  console.log('='.repeat(80));
  console.log('Press Ctrl+C to exit monitoring');

  // Update tracking
  lastUsed = status.monthlyUsed;
  checkCount++;
}

/**
 * Get usage indicator emoji
 */
function getUsageIndicator(percentage: number): string {
  if (percentage < 50) return '🟢';
  if (percentage < 70) return '🟡';
  if (percentage < 85) return '🟠';
  return '🔴';
}

/**
 * Get alert level based on usage percentage
 */
function getAlertLevel(percentage: number): {
  name: string;
  emoji: string;
  message: string;
  action?: string;
} {
  if (percentage >= MONITORING_CONFIG.alertThresholds.emergency) {
    return {
      name: 'EMERGENCY',
      emoji: '🚨',
      message: 'Credit usage critical! Immediate action required.',
      action: 'Enable emergency optimization mode NOW'
    };
  }
  
  if (percentage >= MONITORING_CONFIG.alertThresholds.critical) {
    return {
      name: 'CRITICAL',
      emoji: '⚠️',
      message: 'High credit usage detected. Optimization needed.',
      action: 'Reduce update frequency or upgrade plan'
    };
  }
  
  if (percentage >= MONITORING_CONFIG.alertThresholds.warning) {
    return {
      name: 'WARNING',
      emoji: '📢',
      message: 'Approaching credit limit. Monitor closely.',
      action: 'Review usage patterns and optimize'
    };
  }
  
  return {
    name: 'NORMAL',
    emoji: '✅',
    message: 'Credit usage within normal parameters.'
  };
}

/**
 * Get recommendations based on current usage
 */
function getRecommendations(status: any, hourlyRate: number): string[] {
  const recommendations: string[] = [];
  
  // Based on usage percentage
  if (status.percentUsed > 80) {
    recommendations.push('🚨 Consider upgrading to $49/month plan (50K credits)');
    recommendations.push('⚡ Enable aggressive caching to reduce API calls');
    recommendations.push('🎯 Focus on high-value games only');
  } else if (status.percentUsed > 60) {
    recommendations.push('📊 Current usage sustainable with optimization');
    recommendations.push('💾 Increase cache TTL for pre-game data');
    recommendations.push('🔄 Consider reducing update frequency for low-priority sports');
  } else {
    recommendations.push('✅ Usage is healthy - room for expansion');
    recommendations.push('🚀 Can enable 1-minute updates for more sports');
    recommendations.push('📈 Consider testing additional markets');
  }

  // Based on burn rate
  const dailyProjection = hourlyRate * 24;
  if (dailyProjection > status.dailyBudget * 1.2) {
    recommendations.push(`⚠️ Current burn rate (${dailyProjection.toFixed(0)}/day) exceeds budget`);
  }

  // Time-based recommendations
  const hour = new Date().getHours();
  if (hour >= 18 && hour <= 22) {
    recommendations.push('🏈 Prime time - expect higher usage for live games');
  }

  return recommendations;
}

/**
 * Start monitoring
 */
async function startMonitoring() {
  logger.info('Starting credit usage monitoring...');
  
  // Initial display
  displayDashboard();

  // Set up interval
  const interval = setInterval(() => {
    try {
      displayDashboard();
    } catch (error) {
      logger.error('Monitor error:', error);
    }
  }, MONITORING_CONFIG.checkInterval);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping credit monitor...');
    clearInterval(interval);
    
    // Final summary
    const status = getCreditUsageStatus();
    console.log(`\n📊 Final Status: ${status.monthlyUsed}/${status.monthlyLimit} credits used (${status.percentUsed}%)`);
    console.log('✅ Monitor stopped successfully\n');
    
    process.exit(0);
  });
}

// Run if called directly
if (require.main === module) {
  startMonitoring().catch((error) => {
    logger.error('Failed to start monitoring:', error);
    process.exit(1);
  });
}

export { startMonitoring, displayDashboard };