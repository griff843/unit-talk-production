import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
/**
 * Interface defining the structure of recap state
 * Used to ensure idempotent operation across restarts
 */
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
    updatedAt?: string;
    version?: number;
}
/**
 * Options for the RecapStateManager
 */
export interface RecapStateManagerOptions {
    tableName?: string;
    stateKey?: string;
    version?: number;
}
/**
 * RecapStateManager - Handles persisting and retrieving recap state
 * to ensure idempotent operation across system restarts
 */
export declare class RecapStateManager {
    private supabase;
    private logger;
    private tableName;
    private stateKey;
    private version;
    /**
     * Create a new RecapStateManager
     * @param supabase - Supabase client
     * @param logger - Logger instance
     * @param options - Configuration options
     */
    constructor(supabase: SupabaseClient, logger: Logger, options?: RecapStateManagerOptions);
    /**
     * Load recap state from Supabase
     * @returns RecapState or default state if none exists
     */
    loadState(): Promise<RecapState>;
    /**
     * Persist recap state to Supabase
     * @param state - Current recap state
     * @returns Success indicator
     */
    persistState(state: RecapState): Promise<boolean>;
    /**
     * Save state (alias for persistState for compatibility)
     * @param state - The recap state to save
     * @returns Success indicator
     */
    saveState(state: RecapState): Promise<void>;
    /**
     * Update specific fields in the recap state
     * @param updates - Partial state updates
     * @returns Success indicator
     */
    updateState(updates: Partial<RecapState>): Promise<boolean>;
    /**
     * Update micro-recap cooldown timestamp
     * @param cooldownMinutes - Cooldown duration in minutes
     * @returns Success indicator
     */
    updateMicroRecapCooldown(cooldownMinutes?: number): Promise<boolean>;
    /**
     * Check if micro-recap is in cooldown period
     * @returns Boolean indicating if cooldown is active
     */
    isMicroRecapInCooldown(): Promise<boolean>;
    /**
     * Record a recap run
     * @param type - Type of recap (daily, weekly, monthly)
     * @param date - Optional date identifier (for daily recaps)
     * @returns Success indicator
     */
    recordRecapRun(type: 'daily' | 'weekly' | 'monthly', date?: string): Promise<boolean>;
    /**
     * Record a manual trigger
     * @param type - Type of recap triggered
     * @returns Success indicator
     */
    recordManualTrigger(type: 'daily' | 'weekly' | 'monthly'): Promise<boolean>;
    /**
     * Initialize the state table if it doesn't exist
     * @returns Success indicator
     */
    initializeStateTable(): Promise<boolean>;
    /**
     * Get default state when none exists
     * @returns Default RecapState
     */
    private getDefaultState;
    /**
     * Generate a unique key for the current week
     * Format: YYYY-WW (e.g., 2025-25 for the 25th week of 2025)
     * @param date - Date to generate key for
     * @returns Week key string
     */
    private getWeekKey;
    /**
     * Generate a unique key for the current month
     * Format: YYYY-MM (e.g., 2025-06 for June 2025)
     * @param date - Date to generate key for
     * @returns Month key string
     */
    private getMonthKey;
}
//# sourceMappingURL=recapStateManager.d.ts.map