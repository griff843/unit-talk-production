// src/workflows/recap-workflows.ts
import { proxyActivities, defineSignal, setHandler, sleep, CancellationScope, log } from '@temporalio/workflow';
import type { RecapType } from '../types/picks';
import { env } from '../config/env';

// Define activity interfaces
export interface RecapActivities {
  triggerDailyRecap(date?: string): Promise<void>;
  triggerWeeklyRecap(): Promise<void>;
  triggerMonthlyRecap(): Promise<void>;
  checkMicroRecapTriggers(): Promise<void>;
}

// Define state interface for persisting recap information
export interface RecapState {
  lastDailyRecap?: string;
  lastWeeklyRecap?: string;
  lastMonthlyRecap?: string;
  lastMicroRecap?: string;
  microRecapCooldownUntil?: string;
  manualTriggers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

// Create proxies for recap activities with appropriate timeouts
const recapActivities = proxyActivities<RecapActivities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
  },
});

// Define signals for manual triggering
export const triggerDailyRecapSignal = defineSignal('triggerDailyRecap');
export const triggerWeeklyRecapSignal = defineSignal('triggerWeeklyRecap');
export const triggerMonthlyRecapSignal = defineSignal('triggerMonthlyRecap');

/**
 * Daily recap workflow - runs at 9 AM every day
 * Cron: At 9:00 AM every day
 */
export async function dailyRecapWorkflow(): Promise<void> {
  // Initialize state
  const state: RecapState = {
    manualTriggers: { daily: 0, weekly: 0, monthly: 0 }
  };

  // Set up signal handlers for manual triggering
  setHandler(triggerDailyRecapSignal, async () => {
    state.manualTriggers.daily++;
    await recapActivities.triggerDailyRecap();
  });

  // Main workflow loop - continues indefinitely
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Get current date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Check if we've already run today's recap
      if (state.lastDailyRecap !== today) {
        // Execute daily recap
        await recapActivities.triggerDailyRecap();

        // Update state
        state.lastDailyRecap = today as string;
      }

      // Sleep until next check (1 hour)
      await sleep('1 hour');
    } catch (error) {
      // Log error but continue workflow
      log.error('Error in daily recap workflow:', { error });
      // Sleep before retry to avoid rapid failure loops
      await sleep('5 minutes');
    }
  }
}

/**
 * Weekly recap workflow - runs at 10 AM every Monday
 * Cron: At 10:00 AM every Monday
 */
export async function weeklyRecapWorkflow(): Promise<void> {
  // Initialize state
  const state: RecapState = {
    manualTriggers: { daily: 0, weekly: 0, monthly: 0 }
  };

  // Set up signal handlers for manual triggering
  setHandler(triggerWeeklyRecapSignal, async () => {
    state.manualTriggers.weekly++;
    await recapActivities.triggerWeeklyRecap();
  });

  // Main workflow loop - continues indefinitely
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
      const hour = now.getHours();

      // Check if it's Monday at 10 AM and we haven't run this week's recap
      if (dayOfWeek === 1 && hour === 10) {
        const weekKey = getWeekKey(now);

        if (state.lastWeeklyRecap !== weekKey) {
          // Execute weekly recap
          await recapActivities.triggerWeeklyRecap();

          // Update state
          state.lastWeeklyRecap = weekKey;
        }
      }

      // Sleep until next check (1 hour)
      await sleep('1 hour');
    } catch (error) {
      // Log error but continue workflow
      log.error('Error in weekly recap workflow:', { error });
      // Sleep before retry to avoid rapid failure loops
      await sleep('5 minutes');
    }
  }
}

/**
 * Monthly recap workflow - runs at 11 AM on the 1st of each month
 * Cron: At 11:00 AM on the 1st day of the month
 */
export async function monthlyRecapWorkflow(): Promise<void> {
  // Initialize state
  const state: RecapState = {
    manualTriggers: { daily: 0, weekly: 0, monthly: 0 }
  };

  // Set up signal handlers for manual triggering
  setHandler(triggerMonthlyRecapSignal, async () => {
    state.manualTriggers.monthly++;
    await recapActivities.triggerMonthlyRecap();
  });

  // Main workflow loop - continues indefinitely
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const now = new Date();
      const dayOfMonth = now.getDate();
      const hour = now.getHours();

      // Check if it's the 1st of the month at 11 AM and we haven't run this month's recap
      if (dayOfMonth === 1 && hour === 11) {
        const monthKey = getMonthKey(now);

        if (state.lastMonthlyRecap !== monthKey) {
          // Execute monthly recap
          await recapActivities.triggerMonthlyRecap();

          // Update state
          state.lastMonthlyRecap = monthKey;
        }
      }

      // Sleep until next check (1 hour)
      await sleep('1 hour');
    } catch (error) {
      // Log error but continue workflow
      log.error('Error in monthly recap workflow:', { error });
      // Sleep before retry to avoid rapid failure loops
      await sleep('5 minutes');
    }
  }
}

/**
 * Micro recap workflow - checks for micro recap triggers every 5 minutes
 */
export async function microRecapWorkflow(): Promise<void> {
  // Initialize state
  const state: RecapState = {
    manualTriggers: { daily: 0, weekly: 0, monthly: 0 }
  };

  // Main workflow loop - continues indefinitely
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const now = new Date();

      // Check if cooldown period has passed
      const cooldownUntil = state.microRecapCooldownUntil ? new Date(state.microRecapCooldownUntil) : null;
      if (!cooldownUntil || now > cooldownUntil) {
        // Execute micro recap check
        await recapActivities.checkMicroRecapTriggers();

        // Update state with current timestamp
        state.lastMicroRecap = now.toISOString();

        // Set cooldown (5 minutes from now)
        const cooldownMinutes = env.MICRO_RECAP_COOLDOWN || 5;
        const cooldownMs = cooldownMinutes * 60 * 1000;
        const newCooldown = new Date(now.getTime() + cooldownMs);
        state.microRecapCooldownUntil = newCooldown.toISOString();
      }

      // Sleep until next check (1 minute)
      await sleep('1 minute');
    } catch (error) {
      // Log error but continue workflow
      log.error('Error in micro recap workflow:', { error });
      // Sleep before retry to avoid rapid failure loops
      await sleep('1 minute');
    }
  }
}

/**
 * Combined recap workflow that handles all recap types
 * This is the main entry point for the RecapAgent's Temporal workflows
 */
export async function combinedRecapWorkflow(): Promise<void> {
  // Run all recap workflows in parallel, each in its own cancellation scope
  await Promise.all([
    CancellationScope.cancellable(async () => {
      await dailyRecapWorkflow();
    }),
    CancellationScope.cancellable(async () => {
      await weeklyRecapWorkflow();
    }),
    CancellationScope.cancellable(async () => {
      await monthlyRecapWorkflow();
    }),
    CancellationScope.cancellable(async () => {
      await microRecapWorkflow();
    })
  ]);
}

/**
 * Manual trigger workflow for on-demand recaps
 * @param type - Type of recap to trigger (daily, weekly, monthly)
 * @param date - Optional date for daily recap
 */
export async function triggerRecapWorkflow(type: RecapType, date?: string): Promise<void> {
  try {
    switch (type) {
      case 'daily':
        await recapActivities.triggerDailyRecap(date);
        break;
      case 'weekly':
        await recapActivities.triggerWeeklyRecap();
        break;
      case 'monthly':
        await recapActivities.triggerMonthlyRecap();
        break;
      default:
        throw new Error(`Invalid recap type: ${type}`);
    }
  } catch (error) {
    log.error(`Error triggering ${type} recap:`, { error, type });
    throw error;
  }
}

// Helper function to generate a unique key for the current week
// Format: YYYY-WW (e.g., 2025-25 for the 25th week of 2025)
function getWeekKey(date: Date): string {
  const d = new Date(date);
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-${weekNumber.toString().padStart(2, '0')}`;
}

// Helper function to generate a unique key for the current month
// Format: YYYY-MM (e.g., 2025-06 for June 2025)
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}