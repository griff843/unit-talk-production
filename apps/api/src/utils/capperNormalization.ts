/**
 * Capper name normalization utilities
 *
 * Provides functions to normalize and standardize capper names
 * across different input formats and sources.
 *
 * @module utils/capperNormalization
 * @since Phase 4 - Compile Green Stabilization
 */

/**
 * Map of common capper name variations to canonical names
 */
const CAPPER_NAME_MAP: Record<string, string> = {
  griff: 'Griff843',
  griff843: 'Griff843',
  noah: 'Noahthegoon',
  noahthegoon: 'Noahthegoon',
  king: 'KingRo623',
  kingro: 'KingRo623',
  kingro623: 'KingRo623',
  jay: 'Jaybird',
  jaybird: 'Jaybird',
  dub: 'dub',
  vicgo: 'Vicgo',
  sauced: 'Sauced',
  ziplock: 'Ziplock',
  squirrel: 'Squirrel',
  polo: 'Polo',
  moneyreef: 'MoneyReef',
  money: 'MoneyReef',
};

/**
 * Normalizes a capper name to its canonical form
 *
 * @param name - Raw capper name from any source
 * @returns Normalized canonical capper name
 *
 * @example
 * ```typescript
 * normalizeCapperName('griff') // Returns 'Griff843'
 * normalizeCapperName('NOAH') // Returns 'Noahthegoon'
 * normalizeCapperName('Griff843') // Returns 'Griff843'
 * ```
 */
export function normalizeCapperName(name: string): string {
  if (!name) {
    return '';
  }

  // Convert to lowercase for lookup
  const lowerName = name.toLowerCase().trim();

  // Check if we have a mapping
  if (CAPPER_NAME_MAP[lowerName]) {
    return CAPPER_NAME_MAP[lowerName];
  }

  // If no mapping found, return the original name with proper casing
  // (first letter uppercase, rest lowercase)
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * Validates if a capper name is recognized
 *
 * @param name - Capper name to validate
 * @returns True if the capper name is recognized
 */
export function isValidCapperName(name: string): boolean {
  const normalized = normalizeCapperName(name);
  return Object.values(CAPPER_NAME_MAP).includes(normalized);
}

/**
 * Gets all recognized canonical capper names
 *
 * @returns Array of canonical capper names
 */
export function getAllCapperNames(): string[] {
  return Array.from(new Set(Object.values(CAPPER_NAME_MAP)));
}

/**
 * Finds the closest matching capper name using fuzzy matching
 *
 * @param input - Input string to match
 * @returns Closest matching capper name or null if no match
 */
export function findClosestCapperName(input: string): string | null {
  if (!input) {
    return null;
  }

  const lowerInput = input.toLowerCase().trim();
  const allNames = getAllCapperNames();

  // First try exact match
  const exactMatch = allNames.find(name => name.toLowerCase() === lowerInput);
  if (exactMatch) {
    return exactMatch;
  }

  // Try partial match
  const partialMatch = allNames.find(
    name => name.toLowerCase().includes(lowerInput) || lowerInput.includes(name.toLowerCase())
  );

  return partialMatch || null;
}
