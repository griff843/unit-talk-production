/**
 * In-memory deduplication utilities for FeedAgent
 *
 * Ensures picks are deduplicated using the EXACT same key as the database unique constraint:
 * (external_game_id, external_prop_id, market, selection, odds, bookmaker_key)
 */

export interface PickIdentity {
  external_game_id: string;
  external_prop_id: string | null;
  market: string;
  selection?: string;
  odds?: number;
  metadata?: {
    bookmaker_key?: string;
    [key: string]: any;
  };
}

export interface DedupResult<T> {
  kept: T[];
  inMemoryDropped: number;
  invalidDropped: number;
  samples: Array<{
    key: string;
    reason: string;
    pick: Partial<T>;
  }>;
}

/**
 * Normalize a string field for consistent comparison
 * - Convert to lowercase
 * - Trim whitespace
 * - Collapse inner whitespace to single space
 */
function normalizeString(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalize odds to integer American odds format
 */
function normalizeOdds(odds: number | null | undefined): number {
  if (odds === null || odds === undefined || isNaN(odds)) {
    return 0;
  }
  return Math.round(odds);
}

/**
 * Generate canonical key that matches DB unique constraint
 *
 * Key format: game_id|prop_id|market|selection|odds|bookmaker
 * All components normalized for case/whitespace consistency
 */
export function canonicalPickKey(pick: PickIdentity): string {
  const gameId = (pick.external_game_id || '').trim();
  const propId = (pick.external_prop_id || '').trim();
  const market = normalizeString(pick.market);
  const selection = normalizeString(pick.selection);
  const odds = normalizeOdds(pick.odds);
  const bookmaker = normalizeString(pick.metadata?.bookmaker_key);

  return `${gameId}|${propId}|${market}|${selection}|${odds}|${bookmaker}`;
}

/**
 * Validate that a pick has all required identity fields
 */
function isValidPick(pick: PickIdentity): { valid: boolean; reason?: string } {
  // Must have game ID
  if (!pick.external_game_id?.trim()) {
    return { valid: false, reason: 'missing game_id' };
  }

  // Must have market
  if (!pick.market?.trim()) {
    return { valid: false, reason: 'missing market' };
  }

  // Must have valid odds
  if (pick.odds === null || pick.odds === undefined || isNaN(pick.odds)) {
    return { valid: false, reason: 'invalid odds' };
  }

  // For market picks (null prop_id), must have selection
  if (!pick.external_prop_id && !pick.selection?.trim()) {
    return { valid: false, reason: 'missing selection for market pick' };
  }

  // Must have bookmaker
  if (!pick.metadata?.bookmaker_key?.trim()) {
    return { valid: false, reason: 'missing bookmaker_key' };
  }

  return { valid: true };
}

/**
 * Deduplicate an array of picks in-memory
 *
 * Uses the same canonicalization as the database unique constraint
 * to prevent 23505 errors on insert.
 *
 * @param picks Array of picks to deduplicate
 * @returns Deduplicated picks with statistics
 */
export function dedupPicks<T extends PickIdentity>(picks: T[]): DedupResult<T> {
  const seen = new Map<string, T>();
  const invalidSamples: Array<{ key: string; reason: string; pick: Partial<T> }> = [];
  const dupSamples: Array<{ key: string; reason: string; pick: Partial<T> }> = [];
  let invalidDropped = 0;
  let inMemoryDropped = 0;

  for (const pick of picks) {
    // Validate pick has required fields
    const validation = isValidPick(pick);
    if (!validation.valid) {
      invalidDropped++;
      if (invalidSamples.length < 3) {
        invalidSamples.push({
          key: '',
          reason: validation.reason!,
          pick: {
            external_game_id: pick.external_game_id,
            market: pick.market,
            selection: pick.selection,
            odds: pick.odds,
            metadata: pick.metadata
          }
        });
      }
      continue;
    }

    // Generate canonical key
    const key = canonicalPickKey(pick);

    // Check for duplicate
    if (seen.has(key)) {
      inMemoryDropped++;
      if (dupSamples.length < 3) {
        dupSamples.push({
          key,
          reason: 'duplicate in batch',
          pick: {
            external_game_id: pick.external_game_id,
            external_prop_id: pick.external_prop_id,
            market: pick.market,
            selection: pick.selection,
            odds: pick.odds,
            metadata: pick.metadata
          }
        });
      }
      continue;
    }

    // Keep first occurrence
    seen.set(key, pick);
  }

  return {
    kept: Array.from(seen.values()),
    inMemoryDropped,
    invalidDropped,
    samples: [...invalidSamples, ...dupSamples]
  };
}
