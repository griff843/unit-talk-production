/**
 * @fileoverview Shared forms package for Unit Talk Smart Form
 * Provides validated schemas, types, and utilities for form integration
 * with unified_picks and cache-first architecture
 */

// Types
export type {
  PropForForm,
  AutocompleteOption,
  PlayerOption,
  MarketOption,
  GameOption,
  AutocompleteFilters,
  AutocompleteResponse,
} from './types';

// Autocomplete schemas and validation
export {
  AutocompleteQuerySchema,
  PlayerAutocompleteSchema,
  MarketAutocompleteSchema,
  GameAutocompleteSchema,
  validatePlayerAutocomplete,
  validateMarketAutocomplete,
  validateGameAutocomplete,
  generatePlayerCacheKey,
  generateMarketCacheKey,
  generateGameCacheKey,
} from './autocomplete';

export type {
  AutocompleteQuery,
  PlayerAutocompleteQuery,
  MarketAutocompleteQuery,
  GameAutocompleteQuery,
} from './autocomplete';

// Form submission schemas and validation
export {
  EssentialsSchema,
  ConfigurationSchema,
  BetLegSchema,
  BetDetailsSchema,
  GameSelectionSchema,
  SmartFormSubmissionSchema,
  validateEssentials,
  validateConfiguration,
  validateBetDetails,
  validateGameSelection,
  validateCompleteSubmission,
} from './submission';

export type {
  EssentialsData,
  ConfigurationData,
  BetLegData,
  BetDetailsData,
  GameSelectionData,
  SmartFormSubmission,
} from './submission';

// Utility functions
export function formatPlayerName(playerName: string, teamName: string): string {
  return `${playerName} (${teamName})`;
}

export function formatMarketDisplay(market: string, submarket?: string): string {
  if (submarket && submarket !== market) {
    return `${market} - ${submarket}`;
  }
  return market;
}

export function formatGameDisplay(matchup: string, gameDate: string): string {
  const date = new Date(gameDate);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  return `${matchup} - ${dateStr} ${timeStr}`;
}

export function formatOdds(odds: number, format: 'american' | 'decimal' | 'fractional' = 'american'): string {
  switch (format) {
    case 'american':
      return odds > 0 ? `+${odds}` : `${odds}`;
    case 'decimal':
      const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
      return decimal.toFixed(2);
    case 'fractional':
      if (odds > 0) {
        return `${odds}/100`;
      } else {
        return `100/${Math.abs(odds)}`;
      }
    default:
      return `${odds}`;
  }
}

export function calculateImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

// Constants
export const SUPPORTED_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'WNBA'] as const;
export const SUPPORTED_TIERS = ['S', 'A', 'B', 'C', 'D'] as const;
export const BET_TYPES = ['single', 'parlay', 'round_robin'] as const;
export const ODDS_FORMATS = ['american', 'decimal', 'fractional'] as const;
export const PICK_DIRECTIONS = ['over', 'under', 'yes', 'no'] as const;

// Performance constants
export const CACHE_TTL_AUTOCOMPLETE = 60; // 1 minute cache for autocomplete
export const CACHE_TTL_FORM_DATA = 300; // 5 minute cache for form data
export const MAX_AUTOCOMPLETE_RESULTS = 50;
export const MIN_QUERY_LENGTH = 2;