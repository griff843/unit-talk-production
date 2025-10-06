/**
 * Settlement Progress Monitor
 *
 * Real-time monitoring of settlement job progress
 * Displays live metrics and estimates completion time
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const CHECKPOINT_FILE = 'apps/api/out/ops/settlement-ultra/checkpoint.json';
const REFRESH_INTERVAL = 5000; // 5 seconds

interface CheckpointData {
  jobId: string;
  startTime: number;
  totalProps: number;
  processed: number;
  settled: number;
  skipped: number;
  errors: number;
  elapsed: number;
  propsPerSec: string;
  estimatedCompletionTime: string;
  settlementRate: string;
  settlementByDate: Record<string, number>;
}

async function getDatabaseStats() {
  // Total props
  const { count: totalRawProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  // Settled in unified_picks
  const { count: settledInDB } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .not('settled_at', 'is', null);

  // Settlement by sport
  const { data: bySport } = await supabase
    .from('unified_picks')
    .select('sport')
    .not('settled_at', 'is', null);

  const sportCounts: Record<string, number> = {};
  bySport?.forEach(row => {
    const sport = row.sport || 'UNKNOWN';
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  });

  return {
    totalRawProps: totalRawProps || 0,
    settledInDB: settledInDB || 0,
    unsettled: (totalRawProps || 0) - (settledInDB || 0),
    settlementRate: ((settledInDB || 0) / (totalRawProps || 1)) * 100,
    sportCounts
  };
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function displayProgress(checkpoint: CheckpointData, dbStats: any) {
  console.clear();

  const now = Date.now();
  const elapsed = (now - checkpoint.startTime) / 1000;
  const remaining = checkpoint.totalProps - checkpoint.processed;
  const propsPerSec = checkpoint.settled / elapsed;
  const estimatedRemaining = remaining / (propsPerSec || 1);

  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'SETTLEMENT PROGRESS MONITOR' + ' '.repeat(31) + '║');
  console.log('╠' + '═'.repeat(78) + '╣');

  // Job Info
  console.log(`║ Job ID: ${checkpoint.jobId.padEnd(66)} ║`);
  console.log('╠' + '═'.repeat(78) + '╣');

  // Progress Bar
  const pct = (checkpoint.processed / checkpoint.totalProps) * 100;
  const barWidth = 60;
  const filled = Math.floor((pct / 100) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  console.log(`║ Progress: [${bar}] ${pct.toFixed(1)}%`.padEnd(79) + '║');

  // Stats
  console.log('╠' + '═'.repeat(78) + '╣');
  console.log(`║ Total Props:      ${checkpoint.totalProps.toLocaleString().padStart(15)} ║`);
  console.log(`║ Processed:        ${checkpoint.processed.toLocaleString().padStart(15)} ║`);
  console.log(`║ Settled:          ${checkpoint.settled.toLocaleString().padStart(15)} (${checkpoint.settlementRate}%)`.padEnd(79) + '║');
  console.log(`║ Skipped:          ${checkpoint.skipped.toLocaleString().padStart(15)} ║`);
  console.log(`║ Errors:           ${checkpoint.errors.toLocaleString().padStart(15)} ║`);

  // Performance
  console.log('╠' + '═'.repeat(78) + '╣');
  console.log(`║ Speed:            ${propsPerSec.toFixed(0).padStart(15)} props/sec ║`);
  console.log(`║ Elapsed:          ${formatTime(elapsed).padStart(15)} ║`);
  console.log(`║ Remaining:        ${formatTime(estimatedRemaining).padStart(15)} (estimated) ║`);
  console.log(`║ Est. Completion:  ${new Date(now + estimatedRemaining * 1000).toLocaleTimeString().padStart(15)} ║`);

  // Database Stats
  console.log('╠' + '═'.repeat(78) + '╣');
  console.log(`║ DB Settled:       ${dbStats.settledInDB.toLocaleString().padStart(15)} ║`);
  console.log(`║ DB Unsettled:     ${dbStats.unsettled.toLocaleString().padStart(15)} ║`);
  console.log(`║ DB Settlement %:  ${dbStats.settlementRate.toFixed(2).padStart(15)}% ║`);

  // Sport Breakdown
  if (Object.keys(dbStats.sportCounts).length > 0) {
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log('║ Settlement by Sport:' + ' '.repeat(57) + '║');
    Object.entries(dbStats.sportCounts).forEach(([sport, count]: [string, any]) => {
      console.log(`║   ${sport.padEnd(10)}: ${count.toLocaleString().padStart(10)}`.padEnd(79) + '║');
    });
  }

  // Recent Dates
  if (checkpoint.settlementByDate && Object.keys(checkpoint.settlementByDate).length > 0) {
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log('║ Recent Dates Processed:' + ' '.repeat(54) + '║');

    const recentDates = Object.entries(checkpoint.settlementByDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 5);

    recentDates.forEach(([date, count]: [string, any]) => {
      console.log(`║   ${date}: ${count.toLocaleString().padStart(10)}`.padEnd(79) + '║');
    });
  }

  console.log('╚' + '═'.repeat(78) + '╝');

  // Status indicators
  if (pct >= 100) {
    console.log('\n🎉 SETTLEMENT COMPLETE!\n');
  } else if (propsPerSec < 10) {
    console.log('\n⚠️  Warning: Low processing speed. Check system resources.\n');
  } else if (checkpoint.errors > checkpoint.settled * 0.05) {
    console.log('\n⚠️  Warning: High error rate (>5%). Check error logs.\n');
  } else {
    console.log('\n✅ Settlement running normally. Press Ctrl+C to stop monitoring.\n');
  }
}

async function monitor() {
  console.log('🔍 Starting settlement progress monitor...\n');

  if (!fs.existsSync(CHECKPOINT_FILE)) {
    console.error(`❌ Checkpoint file not found: ${CHECKPOINT_FILE}`);
    console.error('   Make sure settlement job is running.');
    process.exit(1);
  }

  let lastCheckpoint: CheckpointData | null = null;

  const interval = setInterval(async () => {
    try {
      // Read checkpoint file
      const checkpointData = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      const checkpoint: CheckpointData = JSON.parse(checkpointData);

      // Get database stats
      const dbStats = await getDatabaseStats();

      // Display progress
      displayProgress(checkpoint, dbStats);

      // Check if complete
      if (checkpoint.processed >= checkpoint.totalProps) {
        console.log('Settlement job complete. Monitor exiting...\n');
        clearInterval(interval);
        process.exit(0);
      }

      // Check if stalled
      if (lastCheckpoint && checkpoint.processed === lastCheckpoint.processed) {
        console.log('\n⚠️  Warning: No progress since last check. Job may be stalled.\n');
      }

      lastCheckpoint = checkpoint;
    } catch (error: any) {
      console.error('Error reading checkpoint:', error.message);
    }
  }, REFRESH_INTERVAL);

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\nMonitoring stopped by user.\n');
    process.exit(0);
  });
}

monitor();
