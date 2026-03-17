/**
 * Embed Presentation Contract
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 * EMBED-PRODUCTION-CONTRACT-030: Production embed format
 *
 * Enforces:
 * - No forbidden phrases in embeds
 * - No dev/technical metadata in user-facing embeds
 * - Required fields present
 * - Footer contains build/env stamp + "Not Financial Advice"
 */

import { getBuildInfo, formatEmbedFooter } from './buildInfo';

/**
 * Forbidden phrases that MUST NOT appear in any embed
 * Legacy marketing language that creates false impressions
 */
export const FORBIDDEN_PHRASES = [
  'LOCK OF THE DAY',
  'LOCK OF THE WEEK',
  'GUARANTEED',
  'GUARANTEED WIN',
  "CAN'T LOSE",
  'FREE MONEY',
  '100% SURE',
  'ABSOLUTE LOCK',
  'MONEY LOCK',
  'SLAM DUNK',
  'STONE COLD LOCK',
] as const;

/**
 * EMBED-PRODUCTION-CONTRACT-030: Forbidden field patterns
 * Technical/dev metadata that MUST NOT appear in user-facing embed fields
 */
export const FORBIDDEN_FIELD_PATTERNS = [
  // Dev-only field names from canary scripts
  'DIRECTION FIELD',
  'TEAM FIELD',
  // Technical metadata
  'DB INSERT',
  'DB VERIFIED',
  'VERIFIED',
  'INDEX',
  'Index Fix',
  'LEG_INDEX',
  'CONSTRAINT',
  'SCHEMA',
  // Internal identifiers that should not be displayed
  'bet_slip_id',
  'uuid',
  'pick_id',
  // Database error codes
  '23505',
  '23503',
  // Other technical terms
  'CANARY',
  'DEBUG',
  'TEST',
] as const;

/**
 * Required embed fields for presentation compliance
 */
export interface RequiredEmbedFields {
  title: string;
  description?: string;
  footer: {
    text: string;
  };
}

/**
 * Presentation contract validation result
 */
export interface ContractValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
}

/**
 * Check if text contains any forbidden phrases
 */
export function containsForbiddenPhrase(text: string): string | null {
  const upperText = text.toUpperCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (upperText.includes(phrase.toUpperCase())) {
      return phrase;
    }
  }
  return null;
}

/**
 * EMBED-PRODUCTION-CONTRACT-030: Check if text contains forbidden technical patterns
 */
export function containsForbiddenFieldPattern(text: string): string | null {
  const upperText = text.toUpperCase();
  for (const pattern of FORBIDDEN_FIELD_PATTERNS) {
    if (upperText.includes(pattern.toUpperCase())) {
      return pattern;
    }
  }
  return null;
}

/**
 * Validate embed against presentation contract
 */
export function validateEmbedContract(embed: any): ContractValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check title for forbidden phrases
  if (embed.title) {
    const forbiddenInTitle = containsForbiddenPhrase(embed.title);
    if (forbiddenInTitle) {
      violations.push(`Title contains forbidden phrase: "${forbiddenInTitle}"`);
    }
  } else {
    violations.push('Embed missing required title');
  }

  // Check description for forbidden phrases
  if (embed.description) {
    const forbiddenInDesc = containsForbiddenPhrase(embed.description);
    if (forbiddenInDesc) {
      violations.push(`Description contains forbidden phrase: "${forbiddenInDesc}"`);
    }
  }

  // Check footer requirements
  if (!embed.footer || !embed.footer.text) {
    violations.push('Embed missing required footer');
  } else {
    // Verify footer contains build stamp
    const footerText = embed.footer.text;
    if (!footerText.includes('build:')) {
      warnings.push('Footer missing build stamp');
    }
    if (!footerText.includes('env:')) {
      warnings.push('Footer missing environment stamp');
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * EMBED-PRODUCTION-CONTRACT-030: Production embed validation result
 */
export interface ProductionValidationResult {
  valid: boolean;
  violations: string[];
  field: string | null;
}

/**
 * EMBED-PRODUCTION-CONTRACT-030: Validate embed for production compliance
 *
 * Checks ALL embed content:
 * - title
 * - description
 * - fields[].name
 * - fields[].value
 * - footer.text
 *
 * Enforces:
 * - No forbidden phrases (marketing)
 * - No forbidden field patterns (technical/dev metadata)
 * - Footer must be EXACTLY: "build:<sha> | env:<env> | Not Financial Advice"
 */
export function validateProductionEmbed(embed: any): ProductionValidationResult {
  const violations: string[] = [];

  // Check title
  if (embed.title) {
    const forbiddenPhrase = containsForbiddenPhrase(embed.title);
    if (forbiddenPhrase) {
      violations.push(`Title contains forbidden phrase: "${forbiddenPhrase}"`);
    }
    const forbiddenPattern = containsForbiddenFieldPattern(embed.title);
    if (forbiddenPattern) {
      violations.push(`Title contains forbidden pattern: "${forbiddenPattern}"`);
    }
  }

  // Check description
  if (embed.description) {
    const forbiddenPhrase = containsForbiddenPhrase(embed.description);
    if (forbiddenPhrase) {
      violations.push(`Description contains forbidden phrase: "${forbiddenPhrase}"`);
    }
    const forbiddenPattern = containsForbiddenFieldPattern(embed.description);
    if (forbiddenPattern) {
      violations.push(`Description contains forbidden pattern: "${forbiddenPattern}"`);
    }
  }

  // Check all fields
  if (embed.fields && Array.isArray(embed.fields)) {
    for (let i = 0; i < embed.fields.length; i++) {
      const field = embed.fields[i];

      // Check field name
      if (field.name) {
        const forbiddenPhrase = containsForbiddenPhrase(field.name);
        if (forbiddenPhrase) {
          violations.push(`Field[${i}].name contains forbidden phrase: "${forbiddenPhrase}"`);
        }
        const forbiddenPattern = containsForbiddenFieldPattern(field.name);
        if (forbiddenPattern) {
          violations.push(
            `Field[${i}].name "${field.name}" contains forbidden pattern: "${forbiddenPattern}"`
          );
        }
      }

      // Check field value
      if (field.value) {
        const forbiddenPhrase = containsForbiddenPhrase(field.value);
        if (forbiddenPhrase) {
          violations.push(`Field[${i}].value contains forbidden phrase: "${forbiddenPhrase}"`);
        }
        const forbiddenPattern = containsForbiddenFieldPattern(field.value);
        if (forbiddenPattern) {
          violations.push(`Field[${i}].value contains forbidden pattern: "${forbiddenPattern}"`);
        }
      }
    }
  }

  // Check footer format
  if (embed.footer?.text) {
    const footerText = embed.footer.text;

    // Must contain build stamp
    if (!footerText.includes('build:')) {
      violations.push('Footer missing required build stamp (build:<sha>)');
    }

    // Must contain env stamp
    if (!footerText.includes('env:')) {
      violations.push('Footer missing required env stamp (env:<env>)');
    }

    // Must contain disclaimer
    if (!footerText.includes('Not Financial Advice')) {
      violations.push('Footer missing required disclaimer (Not Financial Advice)');
    }

    // Footer should not contain forbidden patterns
    const forbiddenPattern = containsForbiddenFieldPattern(footerText);
    if (forbiddenPattern) {
      violations.push(`Footer contains forbidden pattern: "${forbiddenPattern}"`);
    }
  } else {
    violations.push('Embed missing required footer');
  }

  return {
    valid: violations.length === 0,
    violations,
    field: violations.length > 0 ? violations[0] : null,
  };
}

/**
 * EMBED-PRODUCTION-CONTRACT-030: Build production-compliant footer
 */
export function buildProductionFooter(gauntletRunId?: string): string {
  const buildInfo = getBuildInfo('embed-builder');
  const parts: string[] = [];

  // SPRINT-070-EMBED-CONTRACT-FIX Defect 1: suppress 'build:unknown' — only include
  // when a real SHA is available (set via GIT_COMMIT_SHORT build arg)
  if (buildInfo.commitShort && buildInfo.commitShort !== 'unknown') {
    parts.push(`build:${buildInfo.commitShort}`);
  }

  // SPRINT-070-EMBED-CONTRACT-FIX Defect 2: suppress 'env:development' — only show
  // non-default environments (production/staging) to avoid leaking local dev context
  if (buildInfo.environment && buildInfo.environment !== 'development') {
    parts.push(`env:${buildInfo.environment}`);
  }

  if (gauntletRunId) {
    parts.push(`run:${gauntletRunId}`);
  }

  parts.push('Not Financial Advice');
  return parts.join(' | ');
}

/**
 * Build a compliant embed with proper footer
 */
export function buildCompliantEmbed(options: {
  title: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  image?: { url: string };
  thumbnail?: { url: string };
  gauntletRunId?: string;
}): any {
  const buildInfo = getBuildInfo('embed-builder');
  const footerText = formatEmbedFooter(buildInfo, options.gauntletRunId);

  // Validate title doesn't have forbidden phrases
  const forbiddenCheck = containsForbiddenPhrase(options.title);
  if (forbiddenCheck) {
    throw new Error(
      `PRESENTATION_CONTRACT_VIOLATION: Title contains forbidden phrase "${forbiddenCheck}"`
    );
  }

  if (options.description) {
    const descCheck = containsForbiddenPhrase(options.description);
    if (descCheck) {
      throw new Error(
        `PRESENTATION_CONTRACT_VIOLATION: Description contains forbidden phrase "${descCheck}"`
      );
    }
  }

  return {
    title: options.title,
    description: options.description,
    color: options.color ?? 0x00aa00,
    fields: options.fields ?? [],
    image: options.image,
    thumbnail: options.thumbnail,
    footer: {
      text: `${footerText} | Not Financial Advice`,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get pick embed title based on tier and type
 * This replaces legacy "LOCK OF THE DAY" language
 */
export function getCompliantPickTitle(tier: string, isParlay: boolean, legCount?: number): string {
  if (isParlay && legCount) {
    const tierEmoji = getTierEmoji(tier);
    return `${tierEmoji} ${tier.toUpperCase()} PARLAY • ${legCount} Legs`;
  }

  const tierEmoji = getTierEmoji(tier);
  return `${tierEmoji} ${tier.toUpperCase()}-TIER PICK`;
}

/**
 * Get emoji for tier
 */
function getTierEmoji(tier: string): string {
  const tierUpper = tier.toUpperCase();
  switch (tierUpper) {
    case 'S':
    case 'S+':
    case 'S-TIER':
      return '🔥';
    case 'A':
    case 'A+':
    case 'A-TIER':
      return '💎';
    case 'B':
    case 'B+':
    case 'B-TIER':
      return '📊';
    default:
      return '📈';
  }
}

/**
 * Get tier color
 */
export function getTierColor(tier: string): number {
  const tierUpper = tier.toUpperCase();
  switch (tierUpper) {
    case 'S':
    case 'S+':
    case 'S-TIER':
      return 0xff5252; // Red
    case 'A':
    case 'A+':
    case 'A-TIER':
      return 0x4fc3f7; // Cyan
    case 'B':
    case 'B+':
    case 'B-TIER':
      return 0x66bb6a; // Green
    default:
      return 0xfbc02d; // Gold
  }
}

/**
 * EMBED-FIX-031: Market label validation
 * Ensures market labels match expected patterns for each market type
 */
export const VALID_MARKET_LABELS: Record<string, string[]> = {
  player_prop: [
    'PTS',
    'AST',
    'REB',
    '3PM',
    'STL',
    'BLK',
    'TO',
    'PRA',
    'P+R',
    'P+A',
    'R+A',
    'DD',
    'TD',
    'Player Prop',
  ],
  spread: ['Spread'],
  moneyline: ['Moneyline', 'ML'],
  total: ['Game Total', 'Total'],
  team_total: ['Team Total'],
};

/**
 * EMBED-FIX-031: Validate that market label matches market type
 */
export function validateMarketLabel(
  marketType: string,
  marketLabel: string
): { valid: boolean; error?: string } {
  const validLabels = VALID_MARKET_LABELS[marketType];

  if (!validLabels) {
    // Unknown market type - allow any label that's not empty
    return marketLabel ? { valid: true } : { valid: false, error: 'Empty market label' };
  }

  // Check if the label matches any valid pattern (case-insensitive)
  const isValid = validLabels.some(valid =>
    marketLabel.toUpperCase().includes(valid.toUpperCase())
  );

  if (!isValid) {
    return {
      valid: false,
      error: `Market label "${marketLabel}" invalid for type "${marketType}". Expected one of: ${validLabels.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * EMBED-FIX-031: Thumbnail URL validation
 * Ensures thumbnails follow the expected URL patterns
 */
const VALID_THUMBNAIL_PATTERNS = [
  // ESPN CDN patterns
  /^https:\/\/a\.espncdn\.com\/i\/teamlogos\//,
  /^https:\/\/a\.espncdn\.com\/combiner\//,
  /^https:\/\/a\.espncdn\.com\/i\/headshots\//,
  // NBA CDN patterns
  /^https:\/\/ak-static\.cms\.nba\.com\//,
  // MLB CDN patterns
  /^https:\/\/img\.mlbstatic\.com\//,
  // NHL CDN patterns
  /^https:\/\/assets\.nhle\.com\//,
  // Unit Talk logo
  /^https:\/\/i\.imgur\.com\/YQKdYUn\.png$/,
];

/**
 * EMBED-FIX-031: Validate thumbnail URL matches expected patterns
 */
export function validateThumbnailUrl(thumbnailUrl: string | undefined | null): {
  valid: boolean;
  warning?: string;
} {
  if (!thumbnailUrl) {
    return { valid: true, warning: 'No thumbnail URL provided' };
  }

  const matchesPattern = VALID_THUMBNAIL_PATTERNS.some(pattern => pattern.test(thumbnailUrl));

  if (!matchesPattern) {
    return {
      valid: false,
      warning: `Thumbnail URL "${thumbnailUrl}" does not match expected CDN patterns`,
    };
  }

  return { valid: true };
}

/**
 * EMBED-FIX-031: Full presentation validation
 * Validates all aspects of a pick presentation
 */
export interface PresentationValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
}

export function validatePickPresentation(presentation: {
  title: string;
  market_label: string;
  market_type: string;
  thumbnail_url?: string;
  context_line?: string;
}): PresentationValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check title for forbidden phrases
  if (presentation.title) {
    const forbiddenPhrase = containsForbiddenPhrase(presentation.title);
    if (forbiddenPhrase) {
      violations.push(`Title contains forbidden phrase: "${forbiddenPhrase}"`);
    }
    const forbiddenPattern = containsForbiddenFieldPattern(presentation.title);
    if (forbiddenPattern) {
      violations.push(`Title contains forbidden pattern: "${forbiddenPattern}"`);
    }
  } else {
    violations.push('Missing required title');
  }

  // Validate market label
  const marketLabelResult = validateMarketLabel(
    presentation.market_type,
    presentation.market_label
  );
  if (!marketLabelResult.valid) {
    warnings.push(marketLabelResult.error || 'Invalid market label');
  }

  // Validate thumbnail URL
  const thumbnailResult = validateThumbnailUrl(presentation.thumbnail_url);
  if (!thumbnailResult.valid) {
    warnings.push(thumbnailResult.warning || 'Invalid thumbnail URL');
  }

  // Check context line for forbidden patterns
  if (presentation.context_line) {
    const forbiddenPattern = containsForbiddenFieldPattern(presentation.context_line);
    if (forbiddenPattern) {
      violations.push(`Context line contains forbidden pattern: "${forbiddenPattern}"`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * EMBED-TRUTH-FIX-031: Required fields validation for posting gate
 * This validation REFUSES to post if critical fields are missing
 *
 * Rules:
 * - Player Props MUST have: player_name (or parseable from selection), direction, line
 * - Spreads MUST have: team (or parseable from selection), line
 * - Totals MUST have: direction, line
 * - Team Totals MUST have: team, direction, line
 * - Build SHA MUST NOT be "unknown" in production
 */
export interface PostingGateResult {
  canPost: boolean;
  violations: string[];
  warnings: string[];
  marketType: string;
  parsedFields: {
    player_name?: string | null;
    team?: string | null;
    direction?: string | null;
    line?: number | null;
    bet_type?: string | null;
  };
}

/**
 * EMBED-TRUTH-FIX-031: Parse player name from selection string
 */
function parsePlayerNameFromSelection(selection: string | undefined): string | null {
  if (!selection) return null;
  // Pattern: "Player Name Over/Under Line Stat" e.g., "LeBron James Over 27.5 PTS"
  const playerPropPattern = /^([A-Za-z\s\.\-']+)\s+(over|under)\s+[\d\.]+/i;
  const match = selection.match(playerPropPattern);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * EMBED-TRUTH-FIX-031: Parse direction from selection string
 */
function parseDirectionFromSelection(selection: string | undefined): string | null {
  if (!selection) return null;
  const lower = selection.toLowerCase();
  if (lower.includes('over')) return 'over';
  if (lower.includes('under')) return 'under';
  return null;
}

/**
 * EMBED-TRUTH-FIX-031: Parse team from selection string
 */
function parseTeamFromSelection(selection: string | undefined): string | null {
  if (!selection) return null;
  // Spread pattern: "Lakers -3.5" or "Celtics +5.5"
  const spreadPattern = /^([A-Za-z\s]+)\s+[\-\+]\d+\.?\d*$/;
  const match = selection.match(spreadPattern);
  if (match && match[1]) {
    return match[1].trim();
  }
  // ML pattern: just team name
  if (!selection.match(/\s+(over|under)\s+/i) && !selection.match(/^(over|under)\s+/i)) {
    return selection.trim();
  }
  return null;
}

/**
 * EMBED-TRUTH-FIX-031: Detect bet type from pick data
 */
function detectBetType(pick: {
  selection?: string;
  stat_type?: string;
  bet_type?: string;
  player_name?: string;
}): string {
  const selection = (pick.selection || '').toLowerCase();
  const statType = (pick.stat_type || '').toLowerCase();
  const betType = (pick.bet_type || '').toLowerCase();

  // Explicit bet_type takes precedence
  if (betType && betType !== 'moneyline') {
    return betType;
  }

  // Player prop detection
  const playerPropPattern = /^[a-z\s\.\-']+\s+(over|under)\s+[\d\.]+/i;
  if (playerPropPattern.test(selection)) return 'player_prop';

  const propStats = ['pts', 'ast', 'reb', '3pm', 'stl', 'blk', 'to', 'pra'];
  if (propStats.includes(statType)) return 'player_prop';
  if (pick.player_name) return 'player_prop';

  // Spread pattern
  if (selection.match(/[\-\+]\d+\.?\d*$/) || statType === 'spread') return 'spread';

  // Total pattern
  if (selection.match(/^(over|under)\s+\d+\.?\d*$/i) || statType === 'total') return 'total';

  // Team total
  if (statType === 'team_total') return 'team_total';

  return 'moneyline';
}

/**
 * EMBED-TRUTH-FIX-031: Posting Gate Validation
 *
 * This is the HARD GATE that prevents posting if critical fields are missing.
 * Called before any Discord embed is sent.
 */
export function validatePostingGate(pick: {
  player_name?: string | null;
  team?: string | null;
  selection?: string;
  stat_type?: string;
  bet_type?: string;
  line?: number | null;
  direction?: string | null;
  side?: string | null;
}): PostingGateResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Parse fields from selection as fallback
  const parsedPlayerName = parsePlayerNameFromSelection(pick.selection);
  const parsedDirection = parseDirectionFromSelection(pick.selection);
  const parsedTeam = parseTeamFromSelection(pick.selection);
  const detectedBetType = detectBetType(pick);

  const effectivePlayerName = pick.player_name || parsedPlayerName;
  const effectiveDirection = pick.direction || pick.side || parsedDirection;
  const effectiveTeam = pick.team || parsedTeam;
  const effectiveLine = pick.line;

  const parsedFields = {
    player_name: effectivePlayerName,
    team: effectiveTeam,
    direction: effectiveDirection,
    line: effectiveLine,
    bet_type: detectedBetType,
  };

  // Validate based on bet type
  switch (detectedBetType) {
    case 'player_prop':
      if (!effectivePlayerName) {
        violations.push('PLAYER_PROP_MISSING_PLAYER: Player name required for player prop bets');
      }
      if (!effectiveDirection) {
        violations.push(
          'PLAYER_PROP_MISSING_DIRECTION: Direction (over/under) required for player prop bets'
        );
      }
      if (effectiveLine === null || effectiveLine === undefined) {
        violations.push('PLAYER_PROP_MISSING_LINE: Line required for player prop bets');
      }
      break;

    case 'spread':
      if (!effectiveTeam) {
        violations.push('SPREAD_MISSING_TEAM: Team name required for spread bets');
      }
      if (effectiveLine === null || effectiveLine === undefined) {
        violations.push('SPREAD_MISSING_LINE: Line required for spread bets');
      }
      break;

    case 'total':
      if (!effectiveDirection) {
        violations.push('TOTAL_MISSING_DIRECTION: Direction (over/under) required for total bets');
      }
      if (effectiveLine === null || effectiveLine === undefined) {
        violations.push('TOTAL_MISSING_LINE: Line required for total bets');
      }
      break;

    case 'team_total':
      if (!effectiveTeam) {
        violations.push('TEAM_TOTAL_MISSING_TEAM: Team name required for team total bets');
      }
      if (!effectiveDirection) {
        violations.push(
          'TEAM_TOTAL_MISSING_DIRECTION: Direction (over/under) required for team total bets'
        );
      }
      if (effectiveLine === null || effectiveLine === undefined) {
        violations.push('TEAM_TOTAL_MISSING_LINE: Line required for team total bets');
      }
      break;

    case 'moneyline':
      if (!effectiveTeam) {
        warnings.push('MONEYLINE_MISSING_TEAM: Team name recommended for moneyline bets');
      }
      break;
  }

  return {
    canPost: violations.length === 0,
    violations,
    warnings,
    marketType: detectedBetType,
    parsedFields,
  };
}

/**
 * EMBED-TRUTH-FIX-031: Validate build provenance
 * Returns false if build SHA is "unknown" in production environment
 */
export function validateBuildProvenance(
  commitShort: string,
  environment: string
): {
  valid: boolean;
  error?: string;
} {
  // In production, we MUST have a valid build SHA
  if (environment === 'production' && (commitShort === 'unknown' || !commitShort)) {
    return {
      valid: false,
      error:
        'BUILD_SHA_UNKNOWN: Build provenance required in production. Set GIT_COMMIT_SHORT env var.',
    };
  }

  // In development, warn but allow
  if (environment !== 'production' && (commitShort === 'unknown' || !commitShort)) {
    // This is a warning, not a failure
    return { valid: true };
  }

  return { valid: true };
}

// ---- SPRINT-EMBED-MIN-REQ-GATE-ENFORCEMENT-051: Embed Readiness Gate ----

/**
 * EMBED_STRICT_MODE environment variable
 * - true (strict): Block posting if required fields missing, set blocked_reason
 * - false (soft): Allow posting with fallbacks ("TBD"), log warnings
 */
// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
export function isEmbedStrictMode(): boolean {
  return process.env['EMBED_STRICT_MODE'] !== 'false';
}

/**
 * SPRINT-EMBED-MIN-REQ-GATE-ENFORCEMENT-051: Embed readiness result
 */
export interface EmbedReadinessResult {
  ready: boolean;
  mode: 'strict' | 'soft';
  missingFields: string[];
  violations: string[];
  warnings: string[];
  sanitizedValues: {
    league: string;
    matchup: string;
    eventTime: string;
  };
}

/**
 * SPRINT-EMBED-MIN-REQ-GATE-ENFORCEMENT-051: Check for "undefined" strings
 * Returns field names that contain literal "undefined" text
 */
function findUndefinedStrings(values: Record<string, any>): string[] {
  const violations: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') {
      if (value.toLowerCase().includes('undefined')) {
        violations.push(key);
      }
    }
  }
  return violations;
}

/**
 * SPRINT-EMBED-MIN-REQ-GATE-ENFORCEMENT-051: Check for duplicate line formatting
 * e.g., "Over 27.5 Over 27.5" or "Line: 27.5 Line: 27.5"
 */
function findDuplicateLineFormatting(text: string | undefined | null): boolean {
  if (!text) return false;
  // Pattern: same numeric line appears twice with over/under
  const duplicatePattern = /(over|under)\s+[\d\.]+.*\1\s+[\d\.]+/i;
  // Pattern: same line value appears twice
  const linePattern = /(\d+\.?\d*)/g;
  const matches = text.match(linePattern);
  if (matches && matches.length >= 2) {
    // Check if consecutive matches are identical
    for (let i = 0; i < matches.length - 1; i++) {
      if (matches[i] === matches[i + 1]) {
        return true;
      }
    }
  }
  return duplicatePattern.test(text);
}

/**
 * SPRINT-EMBED-MIN-REQ-GATE-ENFORCEMENT-051: Format event time for display
 */
function formatEventTime(
  gameDate: string | Date | undefined | null,
  gameTime: string | undefined | null,
  placedAt: string | Date | undefined | null
): string | null {
  // Priority 1: game_date + game_time
  if (gameDate) {
    try {
      const date = new Date(gameDate);
      if (!isNaN(date.getTime())) {
        const timeStr = gameTime || '';
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${timeStr ? ' ' + timeStr : ''}`;
      }
    } catch {
      // Fall through
    }
  }

  // Priority 2: Use placed_at date (shows when bet was placed, not event time)
  if (placedAt) {
    try {
      const date = new Date(placedAt);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

// Pick type for embed readiness validation
type EmbedReadinessPick = {
  id?: string;
  sport?: string | null;
  league?: string | null;
  matchup?: string | null;
  manual_matchup_home?: string | null;
  manual_matchup_away?: string | null;
  manual_fields_blob?: { matchup?: string } | null;
  meta?: { matchup?: string; game_time?: string } | null;
  game_date?: string | Date | null;
  manual_game_date?: string | null;
  game_time?: string | null;
  game_start_time?: string | null;
  placed_at?: string | Date | null;
  selection?: string | null;
  title?: string | null;
  line?: number | null;
  direction?: string | null;
};

/**
 * SPRINT-EMBED-MIN-REQ-051: Resolve matchup from multiple sources
 */
function resolveMatchup(pick: EmbedReadinessPick): string | null {
  if (pick.matchup) return pick.matchup;
  if (pick.manual_fields_blob?.matchup) return pick.manual_fields_blob.matchup;
  if (pick.manual_matchup_home && pick.manual_matchup_away) {
    return `${pick.manual_matchup_away} @ ${pick.manual_matchup_home}`;
  }
  if (pick.meta?.matchup) return pick.meta.matchup;
  return null;
}

/**
 * SPRINT-EMBED-MIN-REQ-051: Check for missing required fields
 */
function checkMissingFields(
  league: string | null | undefined,
  matchup: string | null,
  eventTime: string | null
): string[] {
  const missing: string[] = [];
  if (!league || league.trim() === '') missing.push('league');
  if (!matchup || matchup.trim() === '') missing.push('matchup');
  if (!eventTime) missing.push('event_start_time');
  return missing;
}

/**
 * SPRINT-EMBED-MIN-REQ-051: Check for content violations
 */
function checkContentViolations(
  pick: EmbedReadinessPick,
  league: string | null | undefined,
  matchup: string | null
): string[] {
  const violations: string[] = [];
  const fieldsToCheck = { league, matchup, selection: pick.selection, title: pick.title };
  const undefinedFields = findUndefinedStrings(fieldsToCheck);
  if (undefinedFields.length > 0) {
    violations.push(`Contains literal "undefined" in: ${undefinedFields.join(', ')}`);
  }
  const textsToCheck = [pick.selection, pick.title].filter(Boolean);
  for (const text of textsToCheck) {
    if (findDuplicateLineFormatting(text)) {
      violations.push(`Duplicate line formatting detected in: "${text?.substring(0, 50)}..."`);
    }
  }
  return violations;
}

/**
 * SPRINT-EMBED-MIN-REQ-051: Determine readiness based on mode
 */
function determineReadiness(
  mode: 'strict' | 'soft',
  missingFields: string[],
  violations: string[]
): { ready: boolean; warnings: string[] } {
  const hasBlockingIssues = missingFields.length > 0 || violations.length > 0;
  const ready = mode === 'strict' ? !hasBlockingIssues : violations.length === 0;
  const warnings: string[] = [];
  if (mode === 'soft' && missingFields.length > 0) {
    warnings.push(`Missing fields (using TBD fallback): ${missingFields.join(', ')}`);
  }
  return { ready, warnings };
}

/**
 * SPRINT-EMBED-MIN-REQ-GATE-ENFORCEMENT-051: Assert embed readiness
 *
 * Validates minimum required fields for Discord embeds.
 */
export function assertEmbedReadiness(pick: EmbedReadinessPick): EmbedReadinessResult {
  const mode: 'strict' | 'soft' = isEmbedStrictMode() ? 'strict' : 'soft';
  const league = pick.sport || pick.league;
  const matchup = resolveMatchup(pick);
  const effectiveGameDate = pick.game_date || pick.manual_game_date;
  const effectiveTime = pick.game_time || pick.game_start_time || pick.meta?.game_time;
  const eventTime = formatEventTime(effectiveGameDate, effectiveTime, pick.placed_at);

  const missingFields = checkMissingFields(league, matchup, eventTime);
  const violations = checkContentViolations(pick, league, matchup);
  const { ready, warnings } = determineReadiness(mode, missingFields, violations);

  return {
    ready,
    mode,
    missingFields,
    violations,
    warnings,
    sanitizedValues: {
      league: league?.trim() || 'TBD',
      matchup: matchup?.trim() || 'TBD',
      eventTime: eventTime || 'TBD',
    },
  };
}

export default {
  FORBIDDEN_PHRASES,
  FORBIDDEN_FIELD_PATTERNS,
  VALID_MARKET_LABELS,
  isEmbedStrictMode,
  containsForbiddenPhrase,
  containsForbiddenFieldPattern,
  validateEmbedContract,
  validateProductionEmbed,
  validateMarketLabel,
  validateThumbnailUrl,
  validatePickPresentation,
  validatePostingGate,
  validateBuildProvenance,
  assertEmbedReadiness,
  buildCompliantEmbed,
  buildProductionFooter,
  getCompliantPickTitle,
  getTierColor,
};
