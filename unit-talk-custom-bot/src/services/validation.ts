import {
  PickValidationResult,
  ValidationError,
  PickData,
  EnhancedTicketFormData,
  UserTier,
  EnhancedPermissions
} from '../types';

/**
 * Validation Service - Comprehensive validation for picks, forms, and user permissions
 */
export class ValidationService {
  private sportConfigs: Map<string, any> = new Map();
  private userPermissions: Map<string, EnhancedPermissions> = new Map();

  constructor() {
    this.initializeSportConfigs();
  }

  /**
   * Validate a pick submission
   */
  async validatePick(pickData: PickData, userId: string): Promise<PickValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Basic field validation
      this.validateRequiredFields(pickData, errors);
      
      // User permissions validation
      await this.validateUserPermissions(userId, pickData, errors);
      
      // Sport-specific validation
      this.validateSportSpecific(pickData, errors, warnings);
      
      // Odds validation
      this.validateOdds(pickData, errors, warnings);
      
      // Stake validation
      this.validateStake(pickData, userId, errors, warnings);
      
      // Confidence validation
      this.validateConfidence(pickData, errors, warnings);
      
      // Business logic validation
      this.validateBusinessLogic(pickData, errors, warnings, suggestions);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        confidenceScore: this.calculateConfidenceScore(pickData, errors, warnings),
        riskLevel: this.calculateRiskLevel(pickData, errors, warnings)
      };
    } catch (error) {
      console.error('Validation error:', error);
      errors.push({
        field: 'general',
        message: 'Validation service error occurred',
        code: 'VALIDATION_ERROR',
        severity: 'ERROR'
      });

      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        confidenceScore: 0,
        riskLevel: 'HIGH'
      };
    }
  }

  /**
   * Validate enhanced ticket form data
   */
  async validateEnhancedTicket(formData: EnhancedTicketFormData, userId: string): Promise<PickValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Basic form validation
      this.validateEnhancedFormFields(formData, errors);
      
      // Leg validation
      if (formData.legs) {
        this.validateTicketLegs(formData.legs, errors, warnings);
      }

      // Parlay-specific validation
      if (formData.legs && formData.legs.length > 1) {
        this.validateParlayRules(formData, errors, warnings, suggestions);
      }

      // User permissions for parlays
      await this.validateParlayPermissions(userId, formData, errors);

      // Image attachment validation
      if (formData.imageAttachments) {
        this.validateImageAttachments(formData.imageAttachments, errors, warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        confidenceScore: this.calculateConfidenceScore(formData, errors, warnings),
        riskLevel: this.calculateRiskLevel(formData, errors, warnings)
      };
    } catch (error) {
      console.error('Enhanced ticket validation error:', error);
      errors.push({
        field: 'general',
        message: 'Enhanced ticket validation error occurred',
        code: 'VALIDATION_ERROR',
        severity: 'ERROR'
      });

      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        confidenceScore: 0,
        riskLevel: 'HIGH'
      };
    }
  }

  /**
   * Validate user permissions for specific actions
   */
  async validateUserPermissions(userId: string, pickData: PickData, errors: ValidationError[]): Promise<void> {
    const permissions = await this.getUserPermissions(userId);
    
    if (!permissions.canSubmitPicks) {
      errors.push({
        field: 'user',
        message: 'User does not have permission to submit picks',
        code: 'PERMISSION_DENIED',
        severity: 'ERROR'
      });
    }

    if (pickData.stake > permissions.maxStakeAmount) {
      errors.push({
        field: 'stake',
        message: `Stake amount exceeds maximum allowed (${permissions.maxStakeAmount})`,
        code: 'STAKE_LIMIT_EXCEEDED',
        severity: 'ERROR'
      });
    }

    // Check daily pick limit
    const todayPickCount = await this.getTodayPickCount(userId);
    if (todayPickCount >= permissions.maxPicksPerDay) {
      errors.push({
        field: 'user',
        message: `Daily pick limit reached (${permissions.maxPicksPerDay})`,
        code: 'DAILY_LIMIT_EXCEEDED',
        severity: 'ERROR'
      });
    }
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(pickData: PickData, errors: ValidationError[]): void {
    const requiredFields = ['userId', 'sport', 'betType', 'description', 'odds', 'stake', 'confidence'];

    requiredFields.forEach(field => {
      if (!pickData[field as keyof PickData]) {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'ERROR'
        });
      }
    });
  }

  /**
   * Validate sport-specific rules
   */
  private validateSportSpecific(pickData: PickData, errors: ValidationError[], warnings: string[]): void {
    const sportConfig = this.sportConfigs.get(pickData.sport.toUpperCase());
    
    if (!sportConfig) {
      errors.push({
        field: 'sport',
        message: `Unsupported sport: ${pickData.sport}`,
        code: 'INVALID_SPORT',
        severity: 'ERROR'
      });
      return;
    }

    // Validate bet type for sport
    const validBetTypes = sportConfig.betTypes.map((bt: any) => bt.id);
    if (!validBetTypes.includes(pickData.betType)) {
      errors.push({
        field: 'betType',
        message: `Invalid bet type for ${pickData.sport}: ${pickData.betType}`,
        code: 'INVALID_BET_TYPE',
        severity: 'ERROR'
      });
    }
    
    // Season validation
    const now = new Date();
    const seasonStart = new Date(sportConfig.season.start);
    const seasonEnd = new Date(sportConfig.season.end);
    
    if (now < seasonStart || now > seasonEnd) {
      warnings.push(`${pickData.sport} season may not be active`);
    }
  }

  /**
   * Validate odds format and reasonableness
   */
  private validateOdds(pickData: PickData, errors: ValidationError[], warnings: string[]): void {
    const odds = pickData.odds;
    
    // Check odds format
    if (typeof odds !== 'number' || isNaN(odds)) {
      errors.push({
        field: 'odds',
        message: 'Odds must be a valid number',
        code: 'INVALID_ODDS_FORMAT',
        severity: 'ERROR'
      });
      return;
    }

    // Check odds range
    if (odds === 0) {
      errors.push({
        field: 'odds',
        message: 'Odds cannot be zero',
        code: 'INVALID_ODDS_VALUE',
        severity: 'ERROR'
      });
    }
    
    // Warn about extreme odds
    if (Math.abs(odds) > 2000) {
      warnings.push('Extremely high odds detected - verify accuracy');
    }
    
    if (Math.abs(odds) < 101 && odds !== 100 && odds !== -100) {
      warnings.push('Unusual odds format detected');
    }
  }

  /**
   * Validate stake amount
   */
  private validateStake(pickData: PickData, userId: string, errors: ValidationError[], warnings: string[]): void {
    const stake = pickData.stake;
    
    if (typeof stake !== 'number' || isNaN(stake) || stake <= 0) {
      errors.push({
        field: 'stake',
        message: 'Stake must be a positive number',
        code: 'INVALID_STAKE',
        severity: 'ERROR'
      });
      return;
    }

    // Minimum stake
    if (stake < 1) {
      errors.push({
        field: 'stake',
        message: 'Minimum stake is $1',
        code: 'STAKE_TOO_LOW',
        severity: 'ERROR'
      });
    }
    
    // Warn about large stakes
    if (stake > 500) {
      warnings.push('Large stake amount - ensure proper bankroll management');
    }
    
    // Warn about unusual stake amounts
    if (stake % 1 !== 0 && stake < 10) {
      warnings.push('Consider using whole dollar amounts for small stakes');
    }
  }

  /**
   * Validate confidence level
   */
  private validateConfidence(pickData: PickData, errors: ValidationError[], warnings: string[]): void {
    const confidence = pickData.confidence;
    
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      errors.push({
        field: 'confidence',
        message: 'Confidence must be a number',
        code: 'INVALID_CONFIDENCE_FORMAT',
        severity: 'ERROR'
      });
      return;
    }

    if (confidence < 1 || confidence > 10) {
      errors.push({
        field: 'confidence',
        message: 'Confidence must be between 1 and 10',
        code: 'CONFIDENCE_OUT_OF_RANGE',
        severity: 'ERROR'
      });
    }
    
    // Warn about extreme confidence
    if (confidence >= 9) {
      warnings.push('Very high confidence - ensure this reflects true conviction');
    }
    
    if (confidence <= 3) {
      warnings.push('Low confidence pick - consider passing or reducing stake');
    }
  }

  /**
   * Validate business logic rules
   */
  private validateBusinessLogic(
    pickData: PickData, 
    errors: ValidationError[], 
    warnings: string[], 
    suggestions: string[]
  ): void {
    // Kelly Criterion suggestion
    const impliedProb = this.calculateImpliedProbability(pickData.odds);
    const estimatedProb = pickData.confidence / 10; // Simple conversion
    
    if (estimatedProb > impliedProb + 0.1) {
      suggestions.push('Strong value detected - consider increasing stake');
    } else if (estimatedProb < impliedProb - 0.05) {
      warnings.push('Negative expected value detected');
    }
    
    // Reasoning validation
    if (!pickData.reasoning || pickData.reasoning.length < 10) {
      warnings.push('Consider adding more detailed reasoning for better tracking');
    }
    
    // Same game parlay warning (if applicable)
    if (pickData.bet_type && pickData.bet_type.includes('parlay') && pickData.selection.includes('same game')) {
      warnings.push('Same game parlays have higher correlation risk');
    }
  }

  /**
   * Validate enhanced form fields
   */
  private validateEnhancedFormFields(formData: EnhancedTicketFormData, errors: ValidationError[]): void {
    if (!formData.sport) {
      errors.push({
        field: 'sport',
        message: 'Sport is required',
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'ERROR'
      });
    }

    if (!formData.bet_type && !formData.betType) {
      errors.push({
        field: 'bet_type',
        message: 'Bet type is required',
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'ERROR'
      });
    }

    if (!formData.legs || formData.legs.length === 0) {
      errors.push({
        field: 'legs',
        message: 'At least one leg is required',
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'ERROR'
      });
    }

    if (formData.stake && (typeof formData.stake !== 'number' || formData.stake <= 0)) {
      errors.push({
        field: 'stake',
        message: 'Valid stake amount is required',
        code: 'INVALID_STAKE',
        severity: 'ERROR'
      });
    }

    if (formData.confidence && (typeof formData.confidence !== 'number' || formData.confidence < 1 || formData.confidence > 10)) {
      errors.push({
        field: 'confidence',
        message: 'Confidence must be between 1 and 10',
        code: 'INVALID_CONFIDENCE',
        severity: 'ERROR'
      });
    }
  }

  /**
   * Validate ticket legs
   */
  private validateTicketLegs(legs: any[], errors: ValidationError[], warnings: string[]): void {
    if (legs.length > 10) {
      errors.push({
        field: 'legs',
        message: 'Maximum 10 legs allowed per ticket',
        code: 'TOO_MANY_LEGS',
        severity: 'ERROR'
      });
    }

    legs.forEach((leg, index) => {
      if (!leg.selection) {
        errors.push({
          field: `legs[${index}].selection`,
          message: `Leg ${index + 1} selection is required`,
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'ERROR'
        });
      }

      if (typeof leg.odds !== 'number') {
        errors.push({
          field: `legs[${index}].odds`,
          message: `Leg ${index + 1} odds must be a number`,
          code: 'INVALID_ODDS_FORMAT',
          severity: 'ERROR'
        });
      }
    });

    // Check for duplicate legs
    const selections = legs.map(leg => leg.selection);
    const duplicates = selections.filter((selection, index) => selections.indexOf(selection) !== index);

    if (duplicates.length > 0) {
      warnings.push('Duplicate selections detected in parlay legs');
    }
  }

  /**
   * Validate parlay-specific rules
   */
  private validateParlayRules(
    formData: EnhancedTicketFormData, 
    errors: ValidationError[], 
    warnings: string[], 
    suggestions: string[]
  ): void {
    if (!formData.legs) return;

    const legCount = formData.legs.length;

    // Maximum legs warning
    if (legCount > 6) {
      warnings.push('High leg count reduces win probability significantly');
    }

    // Same game correlation check
    const games = formData.legs.map(leg => leg.game).filter(Boolean);
    const uniqueGames = [...new Set(games)];

    if (games.length > uniqueGames.length) {
      warnings.push('Multiple bets on same game may be correlated');
      suggestions.push('Consider correlation between legs from the same game');
    }

    // Odds calculation
    const totalOdds = this.calculateParlayOdds(formData.legs);
    if (totalOdds > 5000) {
      warnings.push('Extremely high parlay odds - consider reducing legs');
    }

    // Expected value warning
    const ev = this.calculateParlayEV(formData.legs);
    if (ev < -0.2) {
      warnings.push('Negative expected value parlay');
    }
  }

  /**
   * Validate parlay permissions
   */
  private async validateParlayPermissions(
    userId: string,
    formData: EnhancedTicketFormData,
    errors: ValidationError[]
  ): Promise<void> {
    const permissions = await this.getUserPermissions(userId);

    if (formData.legs && formData.legs.length > 1 && !permissions.canCreateParlays) {
      errors.push({
        field: 'legs',
        message: 'User does not have permission to create parlays',
        code: 'PARLAY_PERMISSION_DENIED',
        severity: 'ERROR'
      });
    }
  }

  /**
   * Validate image attachments
   */
  private validateImageAttachments(files: File[], errors: ValidationError[], warnings: string[]): void {
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (files.length > maxFiles) {
      errors.push({
        field: 'image_attachments',
        message: `Maximum ${maxFiles} images allowed`,
        code: 'TOO_MANY_ATTACHMENTS',
        severity: 'ERROR'
      });
    }
    
    files.forEach((file, index) => {
      if (file.size > maxSize) {
        errors.push({
          field: `image_attachments[${index}]`,
          message: `Image ${index + 1} exceeds 10MB limit`,
          code: 'FILE_TOO_LARGE',
          severity: 'ERROR'
        });
      }
      
      if (!allowedTypes.includes(file.type)) {
        errors.push({
          field: `image_attachments[${index}]`,
          message: `Image ${index + 1} has unsupported format`,
          code: 'INVALID_FILE_TYPE',
          severity: 'ERROR'
        });
      }
    });
    
    if (files.length > 0) {
      warnings.push('Image attachments will be processed for OCR analysis');
    }
  }

  /**
   * Get user permissions (mock implementation)
   */
  private async getUserPermissions(userId: string): Promise<EnhancedPermissions> {
    // Mock implementation - replace with actual database lookup
    return {
      canSubmitPicks: true,
      canViewAnalytics: true,
      canAccessAI: true,
      canCreateParlays: true,
      canViewCoaching: true,
      canExportData: true,
      canUploadImages: true,
      canAccessPremiumFeatures: true,
      maxPicksPerDay: 10,
      maxStakeAmount: 1000
    };
  }

  /**
   * Get today's pick count for user (mock implementation)
   */
  private async getTodayPickCount(userId: string): Promise<number> {
    // Mock implementation - replace with actual database query
    return 0;
  }

  /**
   * Initialize sport configurations
   */
  private initializeSportConfigs(): void {
    this.sportConfigs.set('NFL', {
      betTypes: [
        { id: 'spread', name: 'Point Spread' },
        { id: 'total', name: 'Total Points' },
        { id: 'moneyline', name: 'Moneyline' },
        { id: 'player_props', name: 'Player Props' }
      ],
      season: { start: '2024-09-01', end: '2025-02-15' }
    });
    
    this.sportConfigs.set('NBA', {
      betTypes: [
        { id: 'spread', name: 'Point Spread' },
        { id: 'total', name: 'Total Points' },
        { id: 'moneyline', name: 'Moneyline' },
        { id: 'player_props', name: 'Player Props' }
      ],
      season: { start: '2024-10-01', end: '2025-06-30' }
    });
    
    this.sportConfigs.set('MLB', {
      betTypes: [
        { id: 'runline', name: 'Run Line' },
        { id: 'total', name: 'Total Runs' },
        { id: 'moneyline', name: 'Moneyline' },
        { id: 'player_props', name: 'Player Props' }
      ],
      season: { start: '2024-03-01', end: '2024-11-30' }
    });
  }

  /**
   * Calculate implied probability from odds
   */
  private calculateImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  /**
   * Calculate parlay odds
   */
  private calculateParlayOdds(legs: any[]): number {
    return legs.reduce((total, leg) => {
      const decimal = leg.odds > 0 ? (leg.odds / 100) + 1 : (100 / Math.abs(leg.odds)) + 1;
      return total * decimal;
    }, 1);
  }

  /**
   * Calculate parlay expected value (simplified)
   */
  private calculateParlayEV(legs: any[]): number {
    // Simplified EV calculation - in reality this would be more complex
    const avgEV = legs.reduce((sum, leg) => {
      const impliedProb = this.calculateImpliedProbability(leg.odds);
      return sum + (0.52 - impliedProb); // Assuming 52% win rate
    }, 0) / legs.length;
    
    return avgEV * Math.pow(0.95, legs.length); // Adjust for parlay difficulty
  }

  /**
   * Calculate confidence score based on validation results
   */
  private calculateConfidenceScore(pickData: PickData | EnhancedTicketFormData, errors: ValidationError[], warnings: string[]): number {
    let baseScore = 100;

    // Reduce score for errors
    baseScore -= errors.length * 20;

    // Reduce score for warnings
    baseScore -= warnings.length * 5;

    // Adjust based on pick characteristics
    const confidence = 'confidence' in pickData ? pickData.confidence : 50;
    if (confidence && confidence > 80) baseScore += 10;
    if (confidence && confidence < 50) baseScore -= 15;

    // Adjust based on odds (extreme odds are riskier)
    const odds = 'odds' in pickData ? pickData.odds : ('legs' in pickData && pickData.legs?.length ? 100 : 100);
    if (odds > 300 || odds < -300) baseScore -= 10;

    return Math.max(0, Math.min(100, baseScore));
  }

  /**
   * Calculate risk level based on validation results
   */
  private calculateRiskLevel(pickData: PickData | EnhancedTicketFormData, errors: ValidationError[], warnings: string[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (errors.length > 0) return 'HIGH';

    let riskScore = 0;

    // Add risk for warnings
    riskScore += warnings.length * 2;

    // Add risk for extreme odds
    const odds = 'odds' in pickData ? pickData.odds : ('legs' in pickData && pickData.legs?.length ? 100 : 100);
    if (odds > 300 || odds < -300) riskScore += 3;

    // Add risk for high stakes
    const stake = 'stake' in pickData ? pickData.stake : ('totalStake' in pickData ? pickData.totalStake : 0);
    if (typeof stake === 'number' && stake > 100) riskScore += 2;

    // Add risk for low confidence
    const confidence = 'confidence' in pickData ? pickData.confidence : 50;
    if (confidence && confidence < 60) riskScore += 2;

    if (riskScore >= 6) return 'HIGH';
    if (riskScore >= 3) return 'MEDIUM';
    return 'LOW';
  }
}