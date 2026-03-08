/**
 * Claude OS — Drift Sentinel
 *
 * Initial drift/risk evaluator based on governance config and laws.
 * Phase B: config/law-driven evaluation only — no full code semantic analysis.
 * Evaluates sprint requests against ownership map, laws, and dataflow knowledge.
 */

import type {
  DriftSignal,
  PackageOwnershipMap,
  PackageOwnershipEntry,
  LawReference,
  SprintExecutionRequest,
} from './types.js';

// ---------------------------------------------------------------------------
// Deprecated Path Detection
// ---------------------------------------------------------------------------

/** Known deprecated tables/paths per canonical governance */
interface DeprecatedPathEntry {
  path: string;
  canonical: string;
  context: string;
  alternateCanonical: { trigger: string; target: string; context: string }[];
}

const DEPRECATED_PATHS: DeprecatedPathEntry[] = [
  {
    path: 'raw_props',
    canonical: 'provider_offers',
    context: 'ingestion landing table',
    alternateCanonical: [
      { trigger: 'unified_picks', target: 'unified_picks', context: 'settlement/lifecycle target' },
      {
        trigger: 'settlement',
        target: 'unified_picks',
        context: 'settlement reads from canonical tables',
      },
    ],
  },
  {
    path: 'daily_picks',
    canonical: 'unified_picks',
    context: 'pick lifecycle table',
    alternateCanonical: [],
  },
  { path: 'players', canonical: 'participants', context: 'entity table', alternateCanonical: [] },
  { path: 'teams', canonical: 'participants', context: 'entity table', alternateCanonical: [] },
];

/** Runtime-sensitive areas that require extra verification */
const RUNTIME_SENSITIVE_AREAS = [
  'apps/api/src/lib/lifecycle/',
  'apps/api/src/agents/',
  'apps/api/src/activities/',
  'packages/distribution/',
  'packages/intelligence/',
  'supabase/migrations/',
  'runtime_config/',
] as const;

// ---------------------------------------------------------------------------
// Drift Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate drift signals for a sprint execution request.
 * Uses ownership map and law references to identify risk areas.
 *
 * @param request - Sprint execution request
 * @param ownership - Package ownership map
 * @param laws - Parsed law references
 */
export function evaluateDrift(
  request: SprintExecutionRequest,
  ownership: PackageOwnershipMap | null,
  _laws: LawReference[]
): DriftSignal[] {
  const signals: DriftSignal[] = [];
  const touchedAreas = request.touchedAreas ?? [];
  const summary = request.summary.toLowerCase();
  const objective = (request.objective ?? '').toLowerCase();
  const combinedText = `${summary} ${objective}`;

  // --- Check 1: Deprecated path references in summary/objective ---
  for (const dep of DEPRECATED_PATHS) {
    if (combinedText.includes(dep.path)) {
      // Context-aware canonical target: check if an alternate canonical applies
      let canonicalTarget = dep.canonical;
      let canonicalContext = dep.context;
      for (const alt of dep.alternateCanonical) {
        if (combinedText.includes(alt.trigger)) {
          canonicalTarget = alt.target;
          canonicalContext = alt.context;
          break;
        }
      }

      signals.push({
        type: 'deprecated_path_risk',
        severity: 'high',
        area: dep.path,
        description: `Sprint references deprecated path '${dep.path}'. Canonical target is '${canonicalTarget}' (${canonicalContext}).`,
        recommendation: `Verify that implementation targets '${canonicalTarget}', not '${dep.path}'. If compatibility work on '${dep.path}' is required, it must be explicitly authorized in the sprint contract.`,
        lawReference: 'Law 5: Canonical-Path Law',
      });
    }
  }

  // --- Check 2: Runtime-sensitive area risk ---
  for (const area of touchedAreas) {
    const isRuntimeSensitive = RUNTIME_SENSITIVE_AREAS.some(
      sensitive => area.includes(sensitive) || sensitive.includes(area)
    );
    if (isRuntimeSensitive) {
      signals.push({
        type: 'runtime_build_boundary',
        severity: 'medium',
        area,
        description: `Touched area '${area}' is runtime-sensitive. Runtime proof will be required.`,
        recommendation:
          'Ensure sprint contract declares runtime proof as required. Build-time verification alone is insufficient.',
        lawReference: 'Law 4: Build/Runtime Separation Law',
      });
    }
  }

  // --- Check 3: Cross-boundary risk from ownership map ---
  if (ownership) {
    for (const area of touchedAreas) {
      const ownerEntry = findOwnershipEntry(ownership, area);
      if (ownerEntry) {
        if (ownerEntry.change_risk === 'critical') {
          signals.push({
            type: 'high_risk_area',
            severity: 'critical',
            area: ownerEntry.area,
            description: `Area '${ownerEntry.area}' has CRITICAL change risk: ${ownerEntry.responsibility}`,
            recommendation:
              ownerEntry.notes ||
              'Extra verification required. Review sprint contract boundaries carefully.',
            lawReference: 'Law 7: Role-Boundary Law',
          });
        } else if (ownerEntry.change_risk === 'high') {
          signals.push({
            type: 'high_risk_area',
            severity: 'high',
            area: ownerEntry.area,
            description: `Area '${ownerEntry.area}' has HIGH change risk: ${ownerEntry.responsibility}`,
            recommendation: ownerEntry.notes || 'Extra verification recommended.',
          });
        }

        if (ownerEntry.requires_extra_verification) {
          signals.push({
            type: 'cross_boundary_risk',
            severity: 'medium',
            area: ownerEntry.area,
            description: `Area '${ownerEntry.area}' requires extra verification per ownership map.`,
            recommendation: 'Ensure verification tier is appropriate for this area.',
          });
        }
      }
    }

    // Check for cross-category changes (e.g., changing both governance and runtime)
    const categories = new Set<string>();
    for (const area of touchedAreas) {
      const entry = findOwnershipEntry(ownership, area);
      if (entry) categories.add(entry.category);
    }
    if (categories.size > 2) {
      signals.push({
        type: 'cross_boundary_risk',
        severity: 'high',
        area: `${categories.size} categories: ${[...categories].join(', ')}`,
        description: `Sprint touches ${categories.size} different ownership categories. Cross-boundary changes increase risk.`,
        recommendation:
          'Verify that all boundaries are explicitly authorized in the sprint contract.',
        lawReference: 'Law 7: Role-Boundary Law',
      });
    }
  }

  // --- Check 4: Lifecycle/settlement keywords trigger elevated scrutiny ---
  const lifecycleKeywords = ['lifecycle', 'settlement', 'settle', 'lifecycle_adapter'];
  for (const kw of lifecycleKeywords) {
    if (combinedText.includes(kw)) {
      signals.push({
        type: 'high_risk_area',
        severity: 'high',
        area: 'lifecycle/settlement',
        description: `Sprint references '${kw}' — lifecycle and settlement changes require elevated verification.`,
        recommendation:
          'Verify lifecycle gate will be run. All writes must use lifecycle adapters. Settlement fields are immutable once set.',
        lawReference: 'Law 5: Canonical-Path Law',
      });
      break; // One signal for lifecycle keywords is enough
    }
  }

  // --- Check 4b: Canonical write target detection ---
  const canonicalWriteTargets = [
    {
      table: 'unified_picks',
      discipline: 'single-writer via lifecycle adapters',
      risk: 'Immutable settlement fields, atomic claim pattern required',
    },
    {
      table: 'participants',
      discipline: 'SGO Sync exclusive writer',
      risk: 'Player/team entity integrity',
    },
    {
      table: 'participant_memberships',
      discipline: 'SGO Sync exclusive writer',
      risk: 'Player-team link integrity',
    },
  ];
  for (const target of canonicalWriteTargets) {
    if (combinedText.includes(target.table)) {
      signals.push({
        type: 'canonical_write_target',
        severity: 'high',
        area: target.table,
        description: `Sprint targets canonical table '${target.table}'. Write discipline: ${target.discipline}. Risk: ${target.risk}.`,
        recommendation: `All writes to '${target.table}' must go through designated writer path. Lifecycle gate (single-writer --strict) is mandatory.`,
        lawReference: 'Law 5: Canonical-Path Law',
      });
    }
  }

  // --- Check 5: Schema change detection ---
  // Require concrete schema evidence — "migration" alone is too broad (code/data migrations
  // are common and don't involve DDL). Schema signals require either:
  // - Explicit schema keywords (schema, alter table, ddl, add column, drop column)
  // - "migration" co-occurring with schema-related terms
  // - Touched areas including supabase/migrations/
  const schemaKeywords = [
    'schema',
    'alter table',
    'ddl',
    'add column',
    'drop column',
    'create table',
  ];
  const hasSchemaTerm = schemaKeywords.some(kw => combinedText.includes(kw));
  const hasMigrationWithSchemaContext =
    combinedText.includes('migration') &&
    (combinedText.includes('schema') ||
      combinedText.includes('column') ||
      combinedText.includes('table') ||
      combinedText.includes('supabase') ||
      combinedText.includes('sql'));
  const touchesSchemaDir = touchedAreas.some(a => a.includes('supabase/migrations'));

  if (hasSchemaTerm || hasMigrationWithSchemaContext || touchesSchemaDir) {
    signals.push({
      type: 'high_risk_area',
      severity: 'critical',
      area: 'supabase/migrations/',
      description:
        'Sprint involves schema changes. Migrations are effectively irreversible in production.',
      recommendation:
        'Ensure migration has documented rollback. Schema guard verification is required. Test in development before staging/prod.',
      lawReference: 'Law 8: Drift Detection Law',
    });
  }

  // Deduplicate signals by type+area
  return deduplicateSignals(signals);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findOwnershipEntry(
  ownership: PackageOwnershipMap,
  area: string
): PackageOwnershipEntry | null {
  // Try exact match first, then prefix match
  const exact = ownership.areas.find(e => e.area === area);
  if (exact) return exact;

  // Prefix match — find the most specific matching area
  const matches = ownership.areas
    .filter(e => area.startsWith(e.area) || e.area.startsWith(area))
    .sort((a, b) => b.area.length - a.area.length);

  return matches[0] ?? null;
}

function deduplicateSignals(signals: DriftSignal[]): DriftSignal[] {
  const seen = new Set<string>();
  return signals.filter(s => {
    const key = `${s.type}:${s.area}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
