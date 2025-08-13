/**
 * @fileoverview Flags Manager
 * 
 * Manages system configuration flags for rehearsal mode testing.
 * Provides safe flag manipulation with validation and rollback capabilities.
 */

import { createClient } from '@supabase/supabase-js';

interface FlagResult {
  success: boolean;
  value?: any;
  error?: string;
}

interface MultipleFlagResult {
  success: boolean;
  results: Record<string, any>;
  errors: string[];
}

export class FlagsManager {
  private environment: 'staging' | 'prod';
  private supabase: any;
  private originalFlags: Record<string, any> = {};

  constructor(environment: 'staging' | 'prod') {
    this.environment = environment;
    this.initializeSupabase();
  }

  private initializeSupabase(): void {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = this.environment === 'prod' 
      ? process.env.SUPABASE_SERVICE_ROLE_KEY 
      : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found for flags management');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getFlag(key: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('app_system_config')
        .select('value')
        .eq('key', key)
        .single();

      if (error) {
        throw error;
      }

      return data?.value;
    } catch (error) {
      console.error(`Failed to get flag ${key}:`, error);
      return null;
    }
  }

  async setFlag(key: string, value: any): Promise<FlagResult> {
    try {
      // Store original value for potential rollback
      if (!(key in this.originalFlags)) {
        this.originalFlags[key] = await this.getFlag(key);
      }

      const { error } = await this.supabase
        .from('app_system_config')
        .upsert({ 
          key, 
          value, 
          updated_at: new Date().toISOString(),
          updated_by: 'go-live-rehearsal'
        });

      if (error) {
        throw error;
      }

      return { success: true, value };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getMultipleFlags(keys: string[]): Promise<Record<string, any>> {
    try {
      const { data, error } = await this.supabase
        .from('app_system_config')
        .select('key, value')
        .in('key', keys);

      if (error) {
        throw error;
      }

      const result: Record<string, any> = {};
      for (const row of data || []) {
        result[row.key] = row.value;
      }

      // Fill in missing keys with null
      for (const key of keys) {
        if (!(key in result)) {
          result[key] = null;
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to get multiple flags:', error);
      const result: Record<string, any> = {};
      for (const key of keys) {
        result[key] = null;
      }
      return result;
    }
  }

  async setMultipleFlags(flags: Record<string, any>): Promise<MultipleFlagResult> {
    const results: Record<string, any> = {};
    const errors: string[] = [];

    for (const [key, value] of Object.entries(flags)) {
      const result = await this.setFlag(key, value);
      if (result.success) {
        results[key] = result.value;
      } else {
        errors.push(`${key}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors
    };
  }

  async rollbackFlags(): Promise<MultipleFlagResult> {
    const results: Record<string, any> = {};
    const errors: string[] = [];

    for (const [key, originalValue] of Object.entries(this.originalFlags)) {
      const result = await this.setFlag(key, originalValue);
      if (result.success) {
        results[key] = result.value;
      } else {
        errors.push(`${key}: ${result.error}`);
      }
    }

    // Clear original flags after rollback
    this.originalFlags = {};

    return {
      success: errors.length === 0,
      results,
      errors
    };
  }

  async ensureSafeDefaults(): Promise<MultipleFlagResult> {
    const safeDefaults = {
      SHADOW_MODE: true,
      PUBLISH_TO_DISCORD: false,
      PUBLISH_TO_NOTION: false,
      SAFE_MODE: true,
      SYSTEM_FREEZE: false
    };

    return this.setMultipleFlags(safeDefaults);
  }

  async createFlagBackup(): Promise<Record<string, any>> {
    try {
      const { data, error } = await this.supabase
        .from('app_system_config')
        .select('key, value');

      if (error) {
        throw error;
      }

      const backup: Record<string, any> = {};
      for (const row of data || []) {
        backup[row.key] = row.value;
      }

      return backup;
    } catch (error) {
      console.error('Failed to create flag backup:', error);
      return {};
    }
  }

  async restoreFromBackup(backup: Record<string, any>): Promise<MultipleFlagResult> {
    return this.setMultipleFlags(backup);
  }

  async validateFlags(expectedFlags: Record<string, any>): Promise<{ valid: boolean; mismatches: string[] }> {
    const currentFlags = await this.getMultipleFlags(Object.keys(expectedFlags));
    const mismatches: string[] = [];

    for (const [key, expectedValue] of Object.entries(expectedFlags)) {
      const currentValue = currentFlags[key];
      if (currentValue !== expectedValue) {
        mismatches.push(`${key}: expected ${expectedValue}, got ${currentValue}`);
      }
    }

    return {
      valid: mismatches.length === 0,
      mismatches
    };
  }

  async waitForFlag(key: string, expectedValue: any, timeoutMs: number = 30000): Promise<{ success: boolean; actualValue?: any; timeMs: number }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const currentValue = await this.getFlag(key);
      if (currentValue === expectedValue) {
        return {
          success: true,
          actualValue: currentValue,
          timeMs: Date.now() - startTime
        };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const finalValue = await this.getFlag(key);
    return {
      success: false,
      actualValue: finalValue,
      timeMs: timeoutMs
    };
  }

  getOriginalFlags(): Record<string, any> {
    return { ...this.originalFlags };
  }

  clearOriginalFlags(): void {
    this.originalFlags = {};
  }
}