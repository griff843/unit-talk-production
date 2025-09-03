/**
 * Data Validation Gates
 * Comprehensive validation system to prevent corrupted data from entering the system
 * Production-ready data integrity enforcement
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('DataValidationGates');

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedData?: any;
}

export interface PropValidationRules {
  requiredFields: string[];
  numericFields: string[];
  stringFields: string[];
  maxStringLength: number;
  validSports: string[];
  validStatTypes: string[];
  oddsRange: { min: number; max: number };
}

export class DataValidationGates {
  private static readonly PROP_VALIDATION_RULES: PropValidationRules = {
    requiredFields: ['player_name', 'stat_type', 'line', 'over_odds', 'under_odds', 'sport'],
    numericFields: ['line', 'over_odds', 'under_odds'],
    stringFields: ['player_name', 'stat_type', 'sport', 'team', 'opponent'],
    maxStringLength: 100,
    validSports: ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'Soccer', 'Tennis', 'Golf'],
    validStatTypes: [
      'Points', 'Rebounds', 'Assists', 'Passing Yards', 'Rushing Yards', 'Receiving Yards',
      'Touchdowns', 'Receptions', 'Tackles', 'Sacks', 'Interceptions', 'Field Goals',
      'Three Pointers Made', 'Steals', 'Blocks', 'Turnovers', 'Minutes', 'Hits',
      'Home Runs', 'RBIs', 'Strikeouts', 'Walks', 'Saves', 'Goals', 'Shots on Goal'
    ],
    oddsRange: { min: -1000, max: 1000 }
  };

  /**
   * Validate raw prop data before processing
   */
  static validateRawProp(propData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let correctedData = { ...propData };

    // Check required fields
    for (const field of this.PROP_VALIDATION_RULES.requiredFields) {
      if (!propData[field] || propData[field] === null || propData[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate numeric fields
    for (const field of this.PROP_VALIDATION_RULES.numericFields) {
      if (propData[field] !== null && propData[field] !== undefined) {
        const numValue = Number(propData[field]);
        if (isNaN(numValue)) {
          errors.push(`Invalid numeric value for ${field}: ${propData[field]}`);
        } else {
          correctedData[field] = numValue;
        }
      }
    }

    // Validate string fields
    for (const field of this.PROP_VALIDATION_RULES.stringFields) {
      if (propData[field]) {
        const strValue = String(propData[field]).trim();
        
        // Check length
        if (strValue.length > this.PROP_VALIDATION_RULES.maxStringLength) {
          warnings.push(`${field} exceeds maximum length (${this.PROP_VALIDATION_RULES.maxStringLength}): ${strValue.substring(0, 20)}...`);
          correctedData[field] = strValue.substring(0, this.PROP_VALIDATION_RULES.maxStringLength);
        } else {
          correctedData[field] = strValue;
        }

        // Check for suspicious content
        if (this.containsSuspiciousContent(strValue)) {
          warnings.push(`${field} contains suspicious content: ${strValue}`);
        }
      }
    }

    // Validate sport
    if (propData.sport && !this.PROP_VALIDATION_RULES.validSports.includes(propData.sport)) {
      warnings.push(`Unknown sport: ${propData.sport}`);
    }

    // Validate stat type
    if (propData.stat_type && !this.PROP_VALIDATION_RULES.validStatTypes.includes(propData.stat_type)) {
      warnings.push(`Unknown stat type: ${propData.stat_type}`);
    }

    // Validate odds range
    if (propData.over_odds) {
      const overOdds = Number(propData.over_odds);
      if (overOdds < this.PROP_VALIDATION_RULES.oddsRange.min || overOdds > this.PROP_VALIDATION_RULES.oddsRange.max) {
        errors.push(`Over odds out of valid range: ${overOdds}`);
      }
    }

    if (propData.under_odds) {
      const underOdds = Number(propData.under_odds);
      if (underOdds < this.PROP_VALIDATION_RULES.oddsRange.min || underOdds > this.PROP_VALIDATION_RULES.oddsRange.max) {
        errors.push(`Under odds out of valid range: ${underOdds}`);
      }
    }

    // Validate odds relationship (over + under should be reasonable)
    if (propData.over_odds && propData.under_odds) {
      const overOdds = Number(propData.over_odds);
      const underOdds = Number(propData.under_odds);
      const impliedTotal = this.calculateImpliedProbability(overOdds) + this.calculateImpliedProbability(underOdds);
      
      if (impliedTotal < 1.8 || impliedTotal > 2.2) {
        warnings.push(`Unusual odds relationship - implied total: ${impliedTotal.toFixed(3)}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      correctedData: errors.length === 0 ? correctedData : undefined
    };
  }

  /**
   * Validate pick data before processing
   */
  static validatePickData(pickData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let correctedData = { ...pickData };

    // Required fields for picks
    const requiredPickFields = ['user_id', 'prop_id', 'pick_type', 'confidence'];
    
    for (const field of requiredPickFields) {
      if (!pickData[field]) {
        errors.push(`Missing required pick field: ${field}`);
      }
    }

    // Validate pick type
    const validPickTypes = ['over', 'under'];
    if (pickData.pick_type && !validPickTypes.includes(pickData.pick_type.toLowerCase())) {
      errors.push(`Invalid pick type: ${pickData.pick_type}`);
    } else if (pickData.pick_type) {
      correctedData.pick_type = pickData.pick_type.toLowerCase();
    }

    // Validate confidence
    if (pickData.confidence !== null && pickData.confidence !== undefined) {
      const confidence = Number(pickData.confidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 100) {
        errors.push(`Invalid confidence value: ${pickData.confidence} (must be 0-100)`);
      } else {
        correctedData.confidence = confidence;
      }
    }

    // Validate user_id format (UUID)
    if (pickData.user_id && !this.isValidUUID(pickData.user_id)) {
      errors.push(`Invalid user_id format: ${pickData.user_id}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      correctedData: errors.length === 0 ? correctedData : undefined
    };
  }

  /**
   * Check for suspicious content in strings
   */
  private static containsSuspiciousContent(value: string): boolean {
    const suspiciousPatterns = [
      /\d{3,}/,           // Long numbers
      /http[s]?:\/\//,    // URLs
      /<[^>]*>/,          // HTML tags
      /[^\x00-\x7F]/,     // Non-ASCII characters (might be encoding issues)
      /^\s*$/,            // Only whitespace
      /(.)\1{10,}/        // Repeated characters (10+ times)
    ];

    return suspiciousPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Calculate implied probability from American odds
   */
  private static calculateImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  /**
   * Validate UUID format
   */
  private static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Batch validate multiple props
   */
  static validatePropBatch(props: any[]): {
    validProps: any[];
    invalidProps: { prop: any; validation: ValidationResult }[];
    correctedProps: any[];
  } {
    const validProps: any[] = [];
    const invalidProps: { prop: any; validation: ValidationResult }[] = [];
    const correctedProps: any[] = [];

    for (const prop of props) {
      const validation = this.validateRawProp(prop);
      
      if (validation.isValid && validation.correctedData) {
        validProps.push(prop);
        correctedProps.push(validation.correctedData);
      } else {
        invalidProps.push({ prop, validation });
      }

      // Log warnings even for valid props
      if (validation.warnings.length > 0) {
        logger.warn('Data validation warnings', {
          propId: prop.id,
          warnings: validation.warnings
        });
      }
    }

    // Log validation summary
    logger.info('Batch validation completed', {
      totalProps: props.length,
      validProps: validProps.length,
      invalidProps: invalidProps.length,
      correctedProps: correctedProps.length
    });

    return { validProps, invalidProps, correctedProps };
  }
}
