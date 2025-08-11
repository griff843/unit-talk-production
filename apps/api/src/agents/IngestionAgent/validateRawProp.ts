import { RawProp, RawPropSchema, ValidationResult } from './types';

/**
 * Validate a raw prop against the schema
 * @param prop - The prop to validate
 * @returns boolean - True if valid, false otherwise
 */
export function validateRawProp(prop: unknown): prop is RawProp {
  try {
    RawPropSchema.parse(prop);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a raw prop with detailed error information
 * @param prop - The prop to validate
 * @returns ValidationResult - Detailed validation result
 */
export function validateRawPropDetailed(prop: unknown): ValidationResult {
  try {
    RawPropSchema.parse(prop);
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  } catch (error) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (error && typeof error === 'object' && 'errors' in error) {
      for (const err of (error as any).errors) {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      }
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      errors.push(errorMessage);
    }

    // Add business logic warnings
    if (prop && typeof prop === 'object') {
      const p = prop as any;
      
      // Check for missing critical fields
      if (!p.player_name) {
        warnings.push('Missing player name');
      }
      if (!p.stat_type) {
        warnings.push('Missing stat type');
      }
      if (!p.line && p.line !== 0) {
        warnings.push('Missing line value');
      }
      if (!p.sport) {
        warnings.push('Missing sport');
      }
    }

    return {
      isValid: false,
      errors,
      warnings
    };
  }
}

/**
 * Validate required fields for ingestion
 * @param prop - The prop to validate
 * @returns boolean - True if all required fields are present
 */
export function validateRequiredFields(prop: RawProp): boolean {
  const requiredFields = ['player_name', 'stat_type', 'line', 'sport'];
  
  for (const field of requiredFields) {
    const value = (prop as any)[field];
    if (value === null || value === undefined || value === '') {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate business rules for props
 * @param prop - The prop to validate
 * @returns ValidationResult - Business validation result
 */
export function validateBusinessRules(prop: RawProp): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check line value is reasonable
  if (prop.line !== null && prop.line !== undefined) {
    if (prop.line < 0) {
      errors.push('Line value cannot be negative');
    }
    if (prop.line > 1000) {
      warnings.push('Line value seems unusually high');
    }
  }

  // Check odds format
  if (prop.over_odds !== null && prop.over_odds !== undefined) {
    if (prop.over_odds > 0 || prop.over_odds < -10000) {
      warnings.push('Over odds format may be incorrect');
    }
  }

  if (prop.under_odds !== null && prop.under_odds !== undefined) {
    if (prop.under_odds > 0 || prop.under_odds < -10000) {
      warnings.push('Under odds format may be incorrect');
    }
  }

  // Check game time is not in the past (with some tolerance)
  if (prop.game_time) {
    const gameTime = new Date(prop.game_time);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    if (gameTime < hourAgo) {
      warnings.push('Game time appears to be in the past');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}