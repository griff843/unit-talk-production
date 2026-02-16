/**
 * Embed Presentation Contract
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 *
 * Enforces:
 * - No forbidden phrases in embeds
 * - Required fields present
 * - Footer contains build/env stamp
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
  'CAN\'T LOSE',
  'FREE MONEY',
  '100% SURE',
  'ABSOLUTE LOCK',
  'MONEY LOCK',
  'SLAM DUNK',
  'STONE COLD LOCK',
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
 * Build a compliant embed with proper footer
 */
export function buildCompliantEmbed(
  options: {
    title: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    image?: { url: string };
    thumbnail?: { url: string };
    gauntletRunId?: string;
  }
): any {
  const buildInfo = getBuildInfo('embed-builder');
  const footerText = formatEmbedFooter(buildInfo, options.gauntletRunId);

  // Validate title doesn't have forbidden phrases
  const forbiddenCheck = containsForbiddenPhrase(options.title);
  if (forbiddenCheck) {
    throw new Error(`PRESENTATION_CONTRACT_VIOLATION: Title contains forbidden phrase "${forbiddenCheck}"`);
  }

  if (options.description) {
    const descCheck = containsForbiddenPhrase(options.description);
    if (descCheck) {
      throw new Error(`PRESENTATION_CONTRACT_VIOLATION: Description contains forbidden phrase "${descCheck}"`);
    }
  }

  return {
    title: options.title,
    description: options.description,
    color: options.color ?? 0x00AA00,
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
export function getCompliantPickTitle(
  tier: string,
  isParlay: boolean,
  legCount?: number
): string {
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
      return 0xFF5252; // Red
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

export default {
  FORBIDDEN_PHRASES,
  containsForbiddenPhrase,
  validateEmbedContract,
  buildCompliantEmbed,
  getCompliantPickTitle,
  getTierColor,
};
