import { env } from '../config/env';

// Canonical capper names map (lowercased -> canonical key used in env.capperThreads)
const CANONICAL_MAPPINGS: Record<string, string> = {
  'griff843': 'Griff843',
  'talk2me': 'Talk2Me',
  'noahthegoon': 'Noahthegoon',
  'kingro623': 'KingRo623',
  'jaybird': 'Jaybird',
  'dub': 'dub',
  'vicgo': 'Vicgo',
  'sauced': 'Sauced',
  'ziplock': 'Ziplock',
  'squirrel': 'Squirrel',
  'polo': 'Polo',
  'moneyreef': 'MoneyReef'
};

/**
 * Normalize various capper input names or aliases to canonical keys
 * that are used in env.capperThreads mapping.
 */
export function normalizeCapperName(name: string | undefined | null): string | null {
  if (!name) return null;
  const cleaned = String(name).trim().toLowerCase();
  const canonical = CANONICAL_MAPPINGS[cleaned];
  if (canonical) return canonical;

  // If not explicitly mapped, try exact key match in env.capperThreads ignoring case
  const entries = Object.keys(env.capperThreads || {});
  const found = entries.find((k) => k.toLowerCase() === cleaned);
  return found || name;
}

