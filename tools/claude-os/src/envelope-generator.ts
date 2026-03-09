/**
 * Claude OS — Envelope Generator
 *
 * Generates a validated TaskEnvelope from a loaded issue + project profile.
 * Cross-validates with the existing envelope validator to ensure pipeline
 * compatibility. Fail-closed: ineligible issue → error block.
 */

import { checkEligibility } from './eligibility-checker.js';
import { validateEnvelope } from './envelope-loader.js';
import { safeWriteJson, resolveRepoPath } from './fs-utils.js';

import type {
  IssueFile,
  ProjectProfile,
  TaskEnvelope,
  VerificationTier,
  EnvelopeGenerationResult,
  EligibilityResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENVELOPES_DIR = 'governance/claude-os/envelopes';
const ENVELOPE_VERSION = '1.0.0';

/** Default tier mapping when profile doesn't specify */
const DEFAULT_SPRINT_TYPE_TIERS: Record<string, VerificationTier> = {
  docs: 'T1',
  build_fix: 'T2',
  ui: 'T2',
  runtime: 'T3',
  schema: 'T3',
  e2e_lifecycle: 'T4',
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EnvelopeGenerateOptions {
  /** Write generated envelope to disk */
  write?: boolean;
  /** Override output directory (default: governance/claude-os/envelopes) */
  outputDir?: string;
  /** Override the taskId (instead of using issueId) */
  sprintIdOverride?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a TaskEnvelope from a loaded issue and project profile.
 *
 * 1. Checks eligibility (fail-closed if not ELIGIBLE)
 * 2. Maps issue fields to envelope fields
 * 3. Applies profile defaults (tier, runtime proof, truth sources)
 * 4. Cross-validates with existing validateEnvelope()
 * 5. Optionally writes to disk
 */
export function generateEnvelope(
  issue: IssueFile,
  profile: ProjectProfile,
  options?: EnvelopeGenerateOptions
): EnvelopeGenerationResult {
  // Gate: eligibility check
  const eligibility = checkEligibility(issue, profile);
  if (eligibility.status !== 'ELIGIBLE') {
    return {
      success: false,
      envelope: null,
      issueId: issue.issueId,
      eligibility,
      errors: [`Issue is not eligible: ${eligibility.status}`, ...eligibility.blockers],
    };
  }

  // Build envelope
  const taskId = options?.sprintIdOverride ?? issue.issueId;
  const envelope = buildEnvelope(issue, profile, taskId);

  // Cross-validate with existing envelope validator
  const validationErrors = validateEnvelope(envelope);
  if (validationErrors.length > 0) {
    return {
      success: false,
      envelope: null,
      issueId: issue.issueId,
      eligibility,
      errors: ['Generated envelope failed validation', ...validationErrors],
    };
  }

  // Optionally write to disk
  let writtenTo: string | undefined;
  if (options?.write) {
    const dir = options.outputDir ?? ENVELOPES_DIR;
    const relPath = `${dir}/${taskId}.json`;
    const absPath = resolveRepoPath(relPath);
    const writeResult = safeWriteJson(absPath, envelope);
    if (!writeResult.success) {
      return {
        success: false,
        envelope,
        issueId: issue.issueId,
        eligibility,
        errors: [`Failed to write envelope: ${writeResult.error}`],
      };
    }
    writtenTo = relPath;
  }

  return {
    success: true,
    envelope,
    issueId: issue.issueId,
    eligibility,
    errors: [],
    writtenTo,
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function buildEnvelope(issue: IssueFile, profile: ProjectProfile, taskId: string): TaskEnvelope {
  const tier = resolveVerificationTier(issue, profile);
  const runtimeProofRequired = tier === 'T3' || tier === 'T4';

  // Derive truth sources from profile if not specified in issue
  const truthSources = deriveTruthSources(issue, profile);

  // Derive kill conditions from profile if not specified in issue
  const killConditions = deriveKillConditions(issue, profile);

  // Combine notes with acceptance criteria (prefixed [AC])
  const notes = [...(issue.notes ?? []), ...issue.acceptanceCriteria.map(ac => `[AC] ${ac}`)];

  return {
    envelopeVersion: ENVELOPE_VERSION,
    taskId,
    taskType: issue.taskType,
    projectId: issue.projectId,
    objective: issue.objective,
    summary: issue.summary,
    touchedAreas: issue.touchedAreas,
    truthSourcesRequired: truthSources,
    verificationTierOverride: tier,
    runtimeProofRequired,
    artifactDate: 'today',
    killConditions,
    notes,
    deferredRequirements: [],
  };
}

function resolveVerificationTier(issue: IssueFile, profile: ProjectProfile): VerificationTier {
  const profileTier = profile.verificationDefaults?.sprintTypeTiers?.[issue.taskType];
  if (profileTier) return profileTier;
  return DEFAULT_SPRINT_TYPE_TIERS[issue.taskType] ?? 'T2';
}

function deriveTruthSources(issue: IssueFile, profile: ProjectProfile): string[] {
  if (issue.truthSourcesRequired && issue.truthSourcesRequired.length > 0) {
    return issue.truthSourcesRequired;
  }
  // Derive from profile truth priority order (top 3)
  return profile.truthPriorityOrder.slice(0, 3);
}

function deriveKillConditions(issue: IssueFile, profile: ProjectProfile): string[] {
  if (issue.killConditions && issue.killConditions.length > 0) {
    return issue.killConditions;
  }
  // Derive from profile critical invariants
  return profile.criticalInvariants.map(inv => `Violation: ${inv}`);
}
