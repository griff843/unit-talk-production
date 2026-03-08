/**
 * Claude OS — Governance Loader
 *
 * Loads and validates the governed artifacts under governance/claude-os/.
 * Returns a structured GovernanceLoadResult with explicit error reporting.
 * Fail-closed: missing required artifacts produce fatal errors.
 */

import { resolveRepoPath, safeReadJson, safeReadText, normalizePath } from './fs-utils.js';

import type {
  GovernanceLoadResult,
  GovernanceLoadError,
  ContextManifest,
  VerificationRecipeSet,
  ProofRecipeSet,
  PackageOwnershipMap,
  LawReference,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOVERNANCE_ROOT = 'governance/claude-os';

/** Required governance files — missing any of these is fatal */
const REQUIRED_FILES = {
  contextManifest: `${GOVERNANCE_ROOT}/context/context-manifest.json`,
  verificationRecipes: `${GOVERNANCE_ROOT}/recipes/verification-recipes.json`,
  proofRecipes: `${GOVERNANCE_ROOT}/recipes/proof-recipes.json`,
  packageOwnership: `${GOVERNANCE_ROOT}/context/package-ownership.json`,
  systemLaws: `${GOVERNANCE_ROOT}/SYSTEM_LAWS.md`,
} as const;

/** Optional governance files — loaded if available, not fatal if missing */
const OPTIONAL_FILES = {
  blueprint: `${GOVERNANCE_ROOT}/blueprint/CLAUDE_OS_BLUEPRINT_V1.md`,
  repoMap: `${GOVERNANCE_ROOT}/context/repo-map.md`,
  architectureSummary: `${GOVERNANCE_ROOT}/context/architecture-summary.md`,
  dataflowMap: `${GOVERNANCE_ROOT}/context/dataflow-map.md`,
  sprintContractTemplate: `${GOVERNANCE_ROOT}/contracts/sprint-contract-template.md`,
  verificationContract: `${GOVERNANCE_ROOT}/contracts/verification-contract.md`,
  artifactContract: `${GOVERNANCE_ROOT}/contracts/artifact-contract.md`,
  failClosedRules: `${GOVERNANCE_ROOT}/contracts/fail-closed-rules.md`,
} as const;

// ---------------------------------------------------------------------------
// Law Parsing
// ---------------------------------------------------------------------------

/**
 * Extract law references from SYSTEM_LAWS.md.
 * Parses ## Law N: Name headers and the **Statement**: line.
 * This is a conservative parser — it extracts what it can reliably detect.
 */
function parseLawReferences(markdown: string): LawReference[] {
  const laws: LawReference[] = [];
  const lawPattern = /^## Law (\d+): (.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = lawPattern.exec(markdown)) !== null) {
    const id = `law_${match[1]}`;
    const name = match[2].trim();

    // Find the **Statement**: line after this heading
    const afterHeading = markdown.slice(match.index + match[0].length);
    const statementMatch = afterHeading.match(/\*\*Statement\*\*:\s*(.+?)(?:\n\n|\n\*\*)/s);
    const statement = statementMatch
      ? statementMatch[1].trim()
      : '(statement not parsed — verify in SYSTEM_LAWS.md)';

    laws.push({ id, name, statement });
  }

  return laws;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load all governance artifacts.
 * Returns a structured result with explicit success/failure per artifact.
 */
export function loadGovernance(): GovernanceLoadResult {
  const errors: GovernanceLoadError[] = [];
  const loadedFiles: string[] = [];
  let hasFatalError = false;

  // --- Load required JSON files ---

  const manifestResult = safeReadJson<ContextManifest>(
    resolveRepoPath(REQUIRED_FILES.contextManifest)
  );
  let contextManifest: ContextManifest | null = null;
  if (manifestResult.success && manifestResult.content) {
    contextManifest = manifestResult.content;
    loadedFiles.push(normalizePath(REQUIRED_FILES.contextManifest));
  } else {
    errors.push({
      file: REQUIRED_FILES.contextManifest,
      error: manifestResult.error ?? 'Unknown error loading context manifest',
      isFatal: true,
    });
    hasFatalError = true;
  }

  const verRecipesResult = safeReadJson<VerificationRecipeSet>(
    resolveRepoPath(REQUIRED_FILES.verificationRecipes)
  );
  let verificationRecipes: VerificationRecipeSet | null = null;
  if (verRecipesResult.success && verRecipesResult.content) {
    verificationRecipes = verRecipesResult.content;
    loadedFiles.push(normalizePath(REQUIRED_FILES.verificationRecipes));
  } else {
    errors.push({
      file: REQUIRED_FILES.verificationRecipes,
      error: verRecipesResult.error ?? 'Unknown error loading verification recipes',
      isFatal: true,
    });
    hasFatalError = true;
  }

  const proofRecipesResult = safeReadJson<ProofRecipeSet>(
    resolveRepoPath(REQUIRED_FILES.proofRecipes)
  );
  let proofRecipes: ProofRecipeSet | null = null;
  if (proofRecipesResult.success && proofRecipesResult.content) {
    proofRecipes = proofRecipesResult.content;
    loadedFiles.push(normalizePath(REQUIRED_FILES.proofRecipes));
  } else {
    errors.push({
      file: REQUIRED_FILES.proofRecipes,
      error: proofRecipesResult.error ?? 'Unknown error loading proof recipes',
      isFatal: true,
    });
    hasFatalError = true;
  }

  const ownershipResult = safeReadJson<PackageOwnershipMap>(
    resolveRepoPath(REQUIRED_FILES.packageOwnership)
  );
  let packageOwnership: PackageOwnershipMap | null = null;
  if (ownershipResult.success && ownershipResult.content) {
    packageOwnership = ownershipResult.content;
    loadedFiles.push(normalizePath(REQUIRED_FILES.packageOwnership));
  } else {
    errors.push({
      file: REQUIRED_FILES.packageOwnership,
      error: ownershipResult.error ?? 'Unknown error loading package ownership',
      isFatal: true,
    });
    hasFatalError = true;
  }

  // --- Load and parse system laws ---

  const lawsResult = safeReadText(resolveRepoPath(REQUIRED_FILES.systemLaws));
  let systemLaws: LawReference[] = [];
  if (lawsResult.success && lawsResult.content) {
    systemLaws = parseLawReferences(lawsResult.content);
    loadedFiles.push(normalizePath(REQUIRED_FILES.systemLaws));
  } else {
    errors.push({
      file: REQUIRED_FILES.systemLaws,
      error: lawsResult.error ?? 'Unknown error loading system laws',
      isFatal: true,
    });
    hasFatalError = true;
  }

  // --- Load optional files (non-fatal) ---

  for (const [key, relativePath] of Object.entries(OPTIONAL_FILES)) {
    const result = safeReadText(resolveRepoPath(relativePath));
    if (result.success) {
      loadedFiles.push(normalizePath(relativePath));
    } else {
      errors.push({
        file: relativePath,
        error: result.error ?? `Optional file not found: ${key}`,
        isFatal: false,
      });
    }
  }

  return {
    success: !hasFatalError,
    contextManifest,
    verificationRecipes,
    proofRecipes,
    packageOwnership,
    systemLaws,
    loadedFiles,
    errors,
  };
}

/**
 * Load governance and fail-close if any required artifact is missing.
 * Use this in CLI entrypoints where you want hard failure.
 */
export function loadGovernanceOrFail(): GovernanceLoadResult {
  const result = loadGovernance();
  if (!result.success) {
    const fatalErrors = result.errors
      .filter(e => e.isFatal)
      .map(e => `  - ${e.file}: ${e.error}`)
      .join('\n');
    throw new Error(`FAIL-CLOSED: Required governance artifacts missing:\n${fatalErrors}`);
  }
  return result;
}
