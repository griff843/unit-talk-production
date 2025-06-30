// src/agents/RecapAgent/recapStateManager.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';

/**
 * Interface defining the structure of recap state
 * Used to ensure idempotent operation across restarts
 */
export interface RecapState {
  // Last run timestamps for scheduled recaps
  lastDailyRecap?: string;
  lastWeeklyRecap?: string;
  lastMonthlyRecap?: string;
  
  // Micro-recap state
  lastMicroRecap?: string;
  microRecapCooldownUntil?: string;
  
  // Manual trigger tracking
  manualTriggers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  
  // Additional metadata
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
export class RecapStateManager {
  private supabase: SupabaseClient;
  private logger: Logger;
  private tableName: string;
  private stateKey: string;
  private version: number;
  
  /**
   * Create a new RecapStateManager
   * @param supabase - Supabase client
   * @param logger - Logger instance
   * @param options - Configuration options
   */
  constructor(
    supabase: SupabaseClient,
    logger: Logger,
    options: RecapStateManagerOptions = {}
  ) {
    this.supabase = supabase;
    this.logger = logger;
    this.tableName = options.tableName || 'recap_state';
    this.stateKey = options.stateKey || 'default';
    this.version = options.version || 1;
  }
  
  /**
   * Load recap state from Supabase
   * @returns RecapState or default state if none exists
   */
  async loadState(): Promise<RecapState> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('key', this.stateKey)
        .maybeSingle();
        
      if (error) {
        this.logger.warn(`Error loading recap state: ${error.message}`, { error });
        return this.getDefaultState();
      }
      
      if (!data) {
        this.logger.info('No recap state found, using defaults');
        return this.getDefaultState();
      }
      
      // Parse the state data
      const state: RecapState = data.state_data || this.getDefaultState();
      
      this.logger.debug('Loaded recap state', { state });
      return state;
      
    } catch (error) {
      this.logger.error('Failed to load recap state', error instanceof Error ? error : new Error(String(error)));
      return this.getDefaultState();
    }
  }
  
  /**
   * Persist recap state to Supabase
   * @param state - Current recap state
   * @returns Success indicator
   */
  async persistState(state: RecapState): Promise<boolean> {
    try {
      // Update metadata
      const updatedState: RecapState = {
        ...state,
        updatedAt: new Date().toISOString(),
        version: this.version
      };
      
      // Upsert to handle both insert and update cases
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert({
          key: this.stateKey,
          state_data: updatedState,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });
        
      if (error) {
        this.logger.error(`Error persisting recap state: ${error.message}`, { error });
        return false;
      }
      
      this.logger.debug('Persisted recap state successfully', { state: updatedState });
      return true;
      
    } catch (error) {
      this.logger.error('Failed to persist recap state', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Save state (alias for persistState for compatibility)
   * @param state - The recap state to save
   * @returns Success indicator
   */
  async saveState(state: RecapState): Promise<void> {
    const success = await this.persistState(state);
    if (!success) {
      throw new Error('Failed to save recap state');
    }
  }
  
  /**
   * Update specific fields in the recap state
   * @param updates - Partial state updates
   * @returns Success indicator
   */
  async updateState(updates: Partial<RecapState>): Promise<boolean> {
    try {
      // Load current state
      const currentState = await this.loadState();
      
      // Apply updates
      const updatedState: RecapState = {
        ...currentState,
        ...updates,
        updatedAt: new Date().toISOString(),
        version: this.version
      };
      
      // Persist the updated state
      return this.persistState(updatedState);
      
    } catch (error) {
      this.logger.error('Failed to update recap state', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
  
  /**
   * Update micro-recap cooldown timestamp
   * @param cooldownMinutes - Cooldown duration in minutes
   * @returns Success indicator
   */
  async updateMicroRecapCooldown(cooldownMinutes: number = 5): Promise<boolean> {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + cooldownMinutes * 60 * 1000);
    
    return this.updateState({
      lastMicroRecap: now.toISOString(),
      microRecapCooldownUntil: cooldownUntil.toISOString()
    });
  }
  
  /**
   * Check if micro-recap is in cooldown period
   * @returns Boolean indicating if cooldown is active
   */
  async isMicroRecapInCooldown(): Promise<boolean> {
    try {
      const state = await this.loadState();
      
      if (!state.microRecapCooldownUntil) {
        return false;
      }
      
      const cooldownUntil = new Date(state.microRecapCooldownUntil);
      const now = new Date();
      
      return now < cooldownUntil;
      
    } catch (error) {
      this.logger.error('Failed to check micro-recap cooldown', error instanceof Error ? error : new Error(String(error)));
      return false; // Default to not in cooldown if check fails
    }
  }
  
  /**
   * Record a recap run
   * @param type - Type of recap (daily, weekly, monthly)
   * @param date - Optional date identifier (for daily recaps)
   * @returns Success indicator
   */
  async recordRecapRun(type: 'daily' | 'weekly' | 'monthly', date?: string): Promise<boolean> {
    const updates: Partial<RecapState> = {};
    
    switch (type) {
      case 'daily':
        updates.lastDailyRecap = date || new Date().toISOString().split('T')[0]!;
        break;
      case 'weekly':
        updates.lastWeeklyRecap = this.getWeekKey(new Date());
        break;
      case 'monthly':
        updates.lastMonthlyRecap = this.getMonthKey(new Date());
        break;
    }
    
    return this.updateState(updates);
  }
  
  /**
   * Record a manual trigger
   * @param type - Type of recap triggered
   * @returns Success indicator
   */
  async recordManualTrigger(type: 'daily' | 'weekly' | 'monthly'): Promise<boolean> {
    const state = await this.loadState();
    
    const manualTriggers = {
      ...state.manualTriggers
    };
    
    manualTriggers[type]++;
    
    return this.updateState({ manualTriggers });
  }
  
  /**
   * Initialize the state table if it doesn't exist
   * @returns Success indicator
   */
  async initializeStateTable(): Promise<boolean> {
    try {
      // Check if table exists
      const { error: checkError } = await this.supabase
        .from(this.tableName)
        .select('key')
        .limit(1);
        
      // If table doesn't exist, we'll get an error
      if (checkError) {
        this.logger.warn(`Recap state table may not exist: ${checkError.message}`);
        
        // Create default state
        const defaultState = this.getDefaultState();
        
        // Attempt to insert default state
        const { error: insertError } = await this.supabase
          .from(this.tableName)
          .insert({
            key: this.stateKey,
            state_data: defaultState,
            updated_at: new Date().toISOString()
          });
          
        if (insertError) {
          this.logger.error(`Failed to initialize state table: ${insertError.message}`);
          return false;
        }
        
        this.logger.info('Initialized recap state table with default state');
      }
      
      return true;
      
    } catch (error) {
      this.logger.error('Failed to initialize state table', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
  
  /**
   * Get default state when none exists
   * @returns Default RecapState
   */
  private getDefaultState(): RecapState {
    return {
      manualTriggers: {
        daily: 0,
        weekly: 0,
        monthly: 0
      },
      updatedAt: new Date().toISOString(),
      version: this.version
    };
  }
  
  /**
   * Generate a unique key for the current week
   * Format: YYYY-WW (e.g., 2025-25 for the 25th week of 2025)
   * @param date - Date to generate key for
   * @returns Week key string
   */
  private getWeekKey(date: Date): string {
    const d = new Date(date);
    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${d.getFullYear()}-${weekNumber.toString().padStart(2, '0')}`;
  }
  
  /**
   * Generate a unique key for the current month
   * Format: YYYY-MM (e.g., 2025-06 for June 2025)
   * @param date - Date to generate key for
   * @returns Month key string
   */
  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}
