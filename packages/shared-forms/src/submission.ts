import { z } from 'zod';

/**
 * Smart Form submission schemas and validation
 * Comprehensive validation for multi-step form wizard
 */

// Step 1: Essentials Schema
export const EssentialsSchema = z.object({
  capper_id: z.string().uuid('Invalid capper ID'),
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'WNBA'], {
    errorMap: () => ({ message: 'Please select a valid sport' }),
  }),
  bet_type: z.enum(['single', 'parlay', 'round_robin'], {
    errorMap: () => ({ message: 'Please select a bet type' }),
  }),
  confidence: z.number()
    .min(1, 'Confidence must be at least 1')
    .max(5, 'Confidence cannot exceed 5'),
  tier: z.enum(['S', 'A', 'B', 'C', 'D']).optional(),
});

export type EssentialsData = z.infer<typeof EssentialsSchema>;

// Step 2: Configuration Schema
export const ConfigurationSchema = z.object({
  units: z.number()
    .min(0.5, 'Minimum bet is 0.5 units')
    .max(10, 'Maximum bet is 10 units')
    .multipleOf(0.1, 'Units must be in 0.1 increments'),
  odds_format: z.enum(['american', 'decimal', 'fractional']).default('american'),
  bookmaker: z.string().optional(),
  kelly_sizing: z.boolean().default(false),
  max_kelly_fraction: z.number().min(0).max(0.25).default(0.1),
});

export type ConfigurationData = z.infer<typeof ConfigurationSchema>;

// Bet Details Schema (for individual legs)
export const BetLegSchema = z.object({
  player_name: z.string().min(2, 'Player name required'),
  prop_type: z.string().min(1, 'Prop type required'),
  market: z.string().min(1, 'Market required'),
  submarket: z.string().optional(),
  line: z.number().optional(),
  pick_direction: z.enum(['over', 'under', 'yes', 'no']),
  odds: z.number().int().min(-1000).max(1000),
  game_id: z.string().optional(),
  external_game_id: z.string().optional(),
  external_prop_id: z.string().optional(),
  team_name: z.string().optional(),
  matchup: z.string().optional(),
});

export type BetLegData = z.infer<typeof BetLegSchema>;

// Step 3: Bet Details Schema
export const BetDetailsSchema = z.object({
  legs: z.array(BetLegSchema)
    .min(1, 'At least one bet leg required')
    .max(10, 'Maximum 10 legs allowed')
    .refine(
      (legs) => {
        // For single bets, exactly one leg
        // For parlays, 2-10 legs
        // For round robins, 3-10 legs
        return legs.length >= 1;
      },
      'Invalid number of legs for bet type'
    ),
  parlay_size: z.number().int().min(2).max(10).optional(),
  round_robin_size: z.number().int().min(2).max(8).optional(),
});

export type BetDetailsData = z.infer<typeof BetDetailsSchema>;

// Step 4: Game Selection Schema
export const GameSelectionSchema = z.object({
  selected_games: z.array(z.object({
    game_id: z.string(),
    external_game_id: z.string().optional(),
    matchup: z.string(),
    game_date: z.string(),
    sport: z.string(),
    league: z.string(),
  })).min(1, 'At least one game must be selected'),
  game_date_filter: z.string().optional(),
  league_filter: z.string().optional(),
});

export type GameSelectionData = z.infer<typeof GameSelectionSchema>;

// Complete form submission schema
export const SmartFormSubmissionSchema = z.object({
  // Form wizard data
  essentials: EssentialsSchema,
  configuration: ConfigurationSchema,
  bet_details: BetDetailsSchema,
  game_selection: GameSelectionSchema,

  // Metadata
  bet_slip_id: z.string().uuid('Invalid bet slip ID'),
  submission_method: z.enum(['form', 'api', 'import']).default('form'),
  client_timestamp: z.string().datetime(),

  // Bridge integration
  bridge_enabled: z.boolean().default(true),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
}).refine(
  (data) => {
    // Cross-validation rules
    const { bet_type } = data.essentials;
    const { legs } = data.bet_details;

    // Single bet validation
    if (bet_type === 'single' && legs.length !== 1) {
      return false;
    }

    // Parlay validation
    if (bet_type === 'parlay' && legs.length < 2) {
      return false;
    }

    // Round robin validation
    if (bet_type === 'round_robin' && legs.length < 3) {
      return false;
    }

    return true;
  },
  {
    message: 'Bet type and number of legs must match',
    path: ['bet_details', 'legs'],
  }
);

export type SmartFormSubmission = z.infer<typeof SmartFormSubmissionSchema>;

// Validation helper functions
export function validateEssentials(data: unknown): EssentialsData {
  try {
    return EssentialsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Essentials validation failed: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateConfiguration(data: unknown): ConfigurationData {
  try {
    return ConfigurationSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Configuration validation failed: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateBetDetails(data: unknown): BetDetailsData {
  try {
    return BetDetailsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Bet details validation failed: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateGameSelection(data: unknown): GameSelectionData {
  try {
    return GameSelectionSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Game selection validation failed: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateCompleteSubmission(data: unknown): SmartFormSubmission {
  try {
    return SmartFormSubmissionSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Form submission validation failed: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}