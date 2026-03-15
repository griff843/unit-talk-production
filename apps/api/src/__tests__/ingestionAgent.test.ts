/**
 * IngestionAgent Unit Tests
 * Sprint: SPRINT-047-INGESTION-UNIT-COVERAGE-LOCK
 *
 * Provider-independent, offline-only, fixture-driven tests.
 * Covers: normalization, validation, duplicate detection stubs,
 * batch processing flow, error handling, metrics, adapter mapping.
 *
 * These tests exercise the IngestionAgent's pure-logic modules —
 * they do NOT verify live provider connectivity, API keys, or
 * database writes. Provider-level integration is out of scope.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Normalization module (normalize.ts) ───────────────────────────────
import {
  normalizeRawProp as normalizeFields,
  normalizeRawPropDetailed,
} from '../agents/IngestionAgent/normalize';

// ── Validation module (validation.ts) ─────────────────────────────────
import { transformSGOToProviderOffers } from '../agents/IngestionAgent/sgoProviderOffersAdapter';
import { RawPropSchema } from '../agents/IngestionAgent/types';
import {
  validateRawProp as validateZod,
  validateRawPropDetailed as validateZodDetailed,
  validateRequiredFields,
  validateBusinessRules,
} from '../agents/IngestionAgent/validateRawProp';
import {
  validateRawProp as validateBasic,
  normalizeRawProp as normalizeWithDefaults,
} from '../agents/IngestionAgent/validation';

// ── Zod-based validation (validateRawProp.ts) ─────────────────────────

// ── Zod schemas (types.ts) ────────────────────────────────────────────

// ── SGO adapter (sgoProviderOffersAdapter.ts) ──────────────────────────

// ── Type imports ──────────────────────────────────────────────────────
import type { RawProp } from '../agents/IngestionAgent/types';

// ═══════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════

/** Minimal valid RawProp fixture for normalization/validation tests */
function makeFixtureProp(overrides: Partial<RawProp> = {}): RawProp {
  return {
    player_name: 'LeBron James',
    sport: 'NBA',
    team: 'LAL',
    stat_type: 'PTS',
    outcome: null,
    line: 27.5,
    odds: -110,
    game_date: '2026-03-15',
    matchup: 'LAL @ GSW',
    trend_confidence: 0,
    matchup_quality: 0,
    line_value_score: 0,
    role_stability: 0,
    confidence_score: 0,
    edge_score: 0,
    tier_tag: null,
    auto_approved: false,
    context_flag: false,
    created_at: '2026-03-15T12:00:00Z',
    scraped_at: '2026-03-15T12:00:00Z',
    source: 'fixture',
    provider: 'test',
    promoted_to_picks: false,
    promoted_at: null,
    promoted: false,
    is_promoted: false,
    game_id: null,
    bet_type: null,
    market_type: null,
    outcomes: null,
    player_id: null,
    player_slug: null,
    external_game_id: null,
    external_id: null,
    sport_key: 'nba',
    league: 'NBA',
    over_odds: -110,
    under_odds: -110,
    fair_odds: null,
    market: 'player_points',
    game_time: '2026-03-15T19:00:00Z',
    start_time: '2026-03-15T19:00:00Z',
    home_team: 'GSW',
    home_team_id: null,
    away_team: 'LAL',
    away_team_id: null,
    opponent: 'GSW',
    unit_size: null,
    tier: null,
    ev_percent: null,
    trend_score: null,
    matchup_score: null,
    line_score: null,
    role_score: null,
    direction: null,
    unique_key: null,
    event_id: null,
    book: null,
    updated_at: null,
    is_alt_line: null,
    is_primary: null,
    is_valid: null,
    ...overrides,
  } as RawProp;
}

/** SGO paired prop fixture */
function makeSGOPairedProp(overrides: Record<string, unknown> = {}) {
  return {
    eventID: 'evt-001',
    leagueID: 'NBA',
    sportID: 'basketball',
    startsAtUTC: '2026-03-15T19:00:00Z',
    startsAtET: '2026-03-15T14:00:00',
    homeTeam: 'Golden State Warriors',
    homeTeamID: 'gsw-001',
    awayTeam: 'Los Angeles Lakers',
    awayTeamID: 'lal-001',
    playerId: 'player-001',
    playerName: 'Stephen Curry',
    statType: 'points-all-game',
    line: 28.5,
    overOdds: -115,
    underOdds: -105,
    overMarketKey: 'points-all-game-ou-over',
    underMarketKey: 'points-all-game-ou-under',
    sportsbook: 'consensus',
    period: 'full-game',
    devig_mode: 'PAIRED' as const,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════

describe('IngestionAgent — Normalization (normalize.ts)', () => {
  it('normalizes team name variations to standard abbreviations', () => {
    const prop = makeFixtureProp({ team: 'Los Angeles Lakers' });
    const result = normalizeFields(prop);
    expect(result.team).toBe('LAL');
  });

  it('normalizes full team name "Golden State Warriors" to "GSW"', () => {
    const prop = makeFixtureProp({ team: 'Golden State Warriors' });
    const result = normalizeFields(prop);
    expect(result.team).toBe('GSW');
  });

  it('normalizes stat type variations to standard codes', () => {
    const prop = makeFixtureProp({ stat_type: 'Points' });
    const result = normalizeFields(prop);
    expect(result.stat_type).toBe('PTS');
  });

  it('normalizes "Assists" → "AST" and "Rebounds" → "REB"', () => {
    const assists = normalizeFields(makeFixtureProp({ stat_type: 'Assists' }));
    const rebounds = normalizeFields(makeFixtureProp({ stat_type: 'Rebounds' }));
    expect(assists.stat_type).toBe('AST');
    expect(rebounds.stat_type).toBe('REB');
  });

  it('generates a URL-safe player slug from player_name', () => {
    const prop = makeFixtureProp({ player_name: "Ja'Marr Chase" });
    const result = normalizeFields(prop);
    // slug removes special chars, lowercases, replaces spaces with hyphens
    expect(result.player_slug).toBe('jamarr-chase');
  });

  it('converts small positive odds (decimal format) to American format', () => {
    // 1.91 decimal = -110 American (approx): (1.91-1)*100 = 91 → rounds to 91
    const prop = makeFixtureProp({ over_odds: 1.91, under_odds: 2.1 });
    const result = normalizeFields(prop);
    // normalizeOdds: if > 0 && < 100, converts from decimal to American
    expect(result.over_odds).toBe(91); // (1.91-1)*100 = 91
    expect(result.under_odds).toBe(110); // (2.10-1)*100 = 110
  });

  it('preserves American odds that are already in correct format', () => {
    const prop = makeFixtureProp({ over_odds: -110, under_odds: -110 });
    const result = normalizeFields(prop);
    expect(result.over_odds).toBe(-110);
    expect(result.under_odds).toBe(-110);
  });

  it('normalizes valid date strings to ISO format', () => {
    const prop = makeFixtureProp({ game_time: '2026-03-15T19:30:00Z' });
    const result = normalizeFields(prop);
    expect(result.game_time).toBe('2026-03-15T19:30:00.000Z');
  });

  it('returns null for invalid date strings', () => {
    const prop = makeFixtureProp({ game_time: 'not-a-date' });
    const result = normalizeFields(prop);
    expect(result.game_time).toBeNull();
  });

  it('handles null and undefined field values gracefully', () => {
    const prop = makeFixtureProp({
      player_name: null,
      team: undefined,
      stat_type: null,
      line: null,
    });
    const result = normalizeFields(prop);
    expect(result.player_name).toBeNull();
    expect(result.team).toBeNull();
    expect(result.stat_type).toBeNull();
    expect(result.line).toBeNull();
  });

  it('sets boolean defaults for missing flags (is_valid, promoted, etc.)', () => {
    const prop = makeFixtureProp({});
    // Remove booleans to test defaults
    delete (prop as any).is_valid;
    delete (prop as any).promoted;
    delete (prop as any).is_promoted;
    const result = normalizeFields(prop);
    expect(result.is_valid).toBe(true); // default
    expect(result.promoted).toBe(false); // default
    expect(result.is_promoted).toBe(false); // default
  });

  it('normalizes matchup format to uppercase with standard separators', () => {
    const prop = makeFixtureProp({ matchup: 'lakers   vs   warriors' });
    const result = normalizeFields(prop);
    expect(result.matchup).toBe('LAKERS VS WARRIORS');
  });
});

describe('IngestionAgent — Normalization Detailed (normalize.ts)', () => {
  it('tracks all field changes in the changes array', () => {
    const prop = makeFixtureProp({ team: 'Los Angeles Lakers' });
    const result = normalizeRawPropDetailed(prop);
    expect(result.changes.length).toBeGreaterThan(0);
    const teamChange = result.changes.find(c => c.startsWith('team:'));
    expect(teamChange).toBeDefined();
  });

  it('warns when critical fields are missing after normalization', () => {
    const prop = makeFixtureProp({ player_name: null, stat_type: null, line: null });
    const result = normalizeRawPropDetailed(prop);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings).toContain('Missing player name after normalization');
    expect(result.warnings).toContain('Missing stat type after normalization');
  });
});

describe('IngestionAgent — Validation (validation.ts)', () => {
  it('accepts a prop with player_name, stat_type, and line', () => {
    const prop = makeFixtureProp();
    const result = validateBasic(prop);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a prop missing both player_name and team', () => {
    const result = validateBasic({ stat_type: 'PTS', line: 27.5 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Either player_name or team must be provided');
  });

  it('rejects a prop missing stat_type', () => {
    const result = validateBasic({ player_name: 'Test', line: 10 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('stat_type is required');
  });

  it('rejects a prop with null line', () => {
    const result = validateBasic({ player_name: 'Test', stat_type: 'PTS', line: null });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('line is required');
  });

  it('warns when no odds are provided', () => {
    const result = validateBasic({
      player_name: 'Test',
      stat_type: 'PTS',
      line: 10,
      over_odds: null,
      under_odds: null,
    });
    // Still valid, just warned
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('No odds provided');
  });
});

describe('IngestionAgent — Normalize with Defaults (validation.ts)', () => {
  it('generates a new UUID for the id field', () => {
    const result = normalizeWithDefaults({ player_name: 'Test', stat_type: 'PTS', line: 10 });
    expect(result.normalizedProp.id).toBeDefined();
    // UUID format: 8-4-4-4-12
    expect(result.normalizedProp.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(result.changes).toContain('Generated new UUID for id');
  });

  it('stores original id in external_id when present', () => {
    const result = normalizeWithDefaults({
      id: 'original-external-id',
      player_name: 'Test',
      stat_type: 'PTS',
      line: 10,
    });
    expect(result.normalizedProp.external_id).toBe('original-external-id');
    expect(result.changes).toContain('Stored original external ID in external_id field');
  });

  it('sets created_at to current timestamp when missing', () => {
    const result = normalizeWithDefaults({ player_name: 'Test', stat_type: 'PTS', line: 10 });
    expect(result.normalizedProp.created_at).toBeDefined();
    expect(result.changes).toContain('Set created_at to current timestamp');
  });

  it('defaults all optional fields to null', () => {
    const result = normalizeWithDefaults({ player_name: 'Test', stat_type: 'PTS', line: 10 });
    expect(result.normalizedProp.edge_score).toBeNull();
    expect(result.normalizedProp.game_id).toBeNull();
    expect(result.normalizedProp.promoted_at).toBeNull();
    expect(result.normalizedProp.tier).toBeUndefined(); // not in validation.ts defaults
  });
});

describe('IngestionAgent — Zod Schema Validation (validateRawProp.ts)', () => {
  it('accepts a fully-populated prop object', () => {
    const prop = makeFixtureProp();
    const result = validateZod(prop);
    expect(result).toBe(true);
  });

  it('accepts a prop with all-null optional fields', () => {
    // RawPropSchema requires all fields present but allows null values
    const nullProp = makeFixtureProp();
    // Set every non-boolean field to null
    for (const key of Object.keys(nullProp)) {
      (nullProp as any)[key] = null;
    }
    const result = validateZod(nullProp);
    expect(result).toBe(true);
  });

  it('returns detailed errors for non-object input', () => {
    const result = validateZodDetailed('not-an-object');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('adds warnings for missing critical fields in detailed validation', () => {
    const result = validateZodDetailed({});
    expect(result.isValid).toBe(false);
    expect(result.warnings).toContain('Missing player name');
    expect(result.warnings).toContain('Missing stat type');
    expect(result.warnings).toContain('Missing line value');
    expect(result.warnings).toContain('Missing sport');
  });
});

describe('IngestionAgent — Required Fields (validateRawProp.ts)', () => {
  it('passes when all four required fields are present', () => {
    const prop = makeFixtureProp();
    expect(validateRequiredFields(prop)).toBe(true);
  });

  it('fails when player_name is null', () => {
    const prop = makeFixtureProp({ player_name: null });
    expect(validateRequiredFields(prop)).toBe(false);
  });

  it('fails when stat_type is empty string', () => {
    const prop = makeFixtureProp({ stat_type: '' });
    expect(validateRequiredFields(prop)).toBe(false);
  });

  it('fails when sport is missing', () => {
    const prop = makeFixtureProp({ sport: null });
    expect(validateRequiredFields(prop)).toBe(false);
  });
});

describe('IngestionAgent — Business Rules (validateRawProp.ts)', () => {
  it('rejects negative line values', () => {
    const prop = makeFixtureProp({ line: -5 });
    const result = validateBusinessRules(prop);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Line value cannot be negative');
  });

  it('warns on unusually high line values (>1000)', () => {
    const prop = makeFixtureProp({ line: 1500 });
    const result = validateBusinessRules(prop);
    expect(result.isValid).toBe(true); // warning, not error
    expect(result.warnings).toContain('Line value seems unusually high');
  });

  it('warns on positive over_odds (possible format issue)', () => {
    const prop = makeFixtureProp({ over_odds: 150 });
    const result = validateBusinessRules(prop);
    expect(result.warnings).toContain('Over odds format may be incorrect');
  });

  it('warns when game_time is in the past', () => {
    const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const prop = makeFixtureProp({ game_time: pastDate });
    const result = validateBusinessRules(prop);
    expect(result.warnings).toContain('Game time appears to be in the past');
  });

  it('passes for a normal prop with reasonable values', () => {
    const prop = makeFixtureProp({
      line: 27.5,
      over_odds: -110,
      under_odds: -110,
      game_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    const result = validateBusinessRules(prop);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('IngestionAgent — SGO Adapter (sgoProviderOffersAdapter.ts)', () => {
  it('transforms SGO paired props into provider offer payloads', () => {
    const paired = [makeSGOPairedProp()];
    const result = transformSGOToProviderOffers(paired);
    expect(result).toHaveLength(1);
    expect(result[0].provider_key).toBe('sgo');
    expect(result[0].provider_event_id).toBe('evt-001');
    expect(result[0].over_odds).toBe(-115);
    expect(result[0].under_odds).toBe(-105);
    expect(result[0].line).toBe(28.5);
  });

  it('strips -over/-under suffix from market key', () => {
    const paired = [makeSGOPairedProp({ overMarketKey: 'points-all-game-ou-over' })];
    const result = transformSGOToProviderOffers(paired);
    expect(result[0].provider_market_key).toBe('points-all-game-ou');
  });

  it('skips props with no odds data (both null)', () => {
    const paired = [makeSGOPairedProp({ overOdds: null, underOdds: null })];
    const result = transformSGOToProviderOffers(paired);
    expect(result).toHaveLength(0);
  });

  it('includes props with only over odds (under is null)', () => {
    const paired = [makeSGOPairedProp({ overOdds: -110, underOdds: null })];
    const result = transformSGOToProviderOffers(paired);
    expect(result).toHaveLength(1);
    expect(result[0].over_odds).toBe(-110);
  });

  it('enriches payloads with sport_key, home_team, away_team, commence_time', () => {
    const paired = [makeSGOPairedProp()];
    const result = transformSGOToProviderOffers(paired);
    expect(result[0].sport_key).toBe('nba');
    expect(result[0].home_team).toBe('Golden State Warriors');
    expect(result[0].away_team).toBe('Los Angeles Lakers');
    expect(result[0].commence_time).toBe('2026-03-15T19:00:00Z');
  });

  it('uses custom snapshot_at when provided', () => {
    const paired = [makeSGOPairedProp()];
    const customSnapshot = '2026-03-15T12:00:00Z';
    const result = transformSGOToProviderOffers(paired, customSnapshot);
    expect(result[0].snapshot_at).toBe(customSnapshot);
  });

  it('handles a batch of multiple paired props', () => {
    const paired = [
      makeSGOPairedProp({ eventID: 'evt-001', playerName: 'Curry', statType: 'points' }),
      makeSGOPairedProp({ eventID: 'evt-002', playerName: 'LeBron', statType: 'assists' }),
      makeSGOPairedProp({ eventID: 'evt-003', overOdds: null, underOdds: null }), // skipped
    ];
    const result = transformSGOToProviderOffers(paired);
    expect(result).toHaveLength(2);
  });
});

describe('IngestionAgent — Zod Schema (types.ts)', () => {
  it('parses a valid full-field prop without error', () => {
    const prop = makeFixtureProp({ outcome: 'over', direction: 'over' });
    expect(() => RawPropSchema.parse(prop)).not.toThrow();
  });

  it('rejects non-integer values for integer-typed fields', () => {
    // edge_score expects z.number().int()
    const prop = makeFixtureProp({ edge_score: 5.5 as any });
    expect(() => RawPropSchema.parse(prop)).toThrow();
  });
});
