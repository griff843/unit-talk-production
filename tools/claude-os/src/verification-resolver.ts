/**
 * Claude OS — Verification Resolver
 *
 * Resolves verification and proof requirements for a given sprint type.
 * Conservative: when uncertain, escalates requirement rather than weakening it.
 */

import { isCommandResolved, getProofRecipe, getVerificationRecipe } from './contract-parser.js';

import type {
  SprintType,
  VerificationTier,
  VerificationRecipeSet,
  ProofRecipeSet,
  VerificationRequirement,
  ProofRequirement,
  DeferredRequirement,
  ProfileVerificationDefaults,
} from './types.js';

// ---------------------------------------------------------------------------
// Tier Resolution
// ---------------------------------------------------------------------------

/** Map sprint types to their minimum verification tier (defaults) */
const DEFAULT_SPRINT_TYPE_TIERS: Record<SprintType, VerificationTier> = {
  docs: 'T1',
  build_fix: 'T2',
  ui: 'T2',
  runtime: 'T3',
  schema: 'T3',
  e2e_lifecycle: 'T4',
};

/** Which recipe IDs are required at each verification tier (defaults) */
const DEFAULT_TIER_REQUIRED_RECIPES: Record<VerificationTier, string[]> = {
  T1: ['typecheck'],
  T2: ['typecheck', 'lint', 'unit_tests', 'build'],
  T3: [
    'typecheck',
    'lint',
    'unit_tests',
    'integration_tests',
    'build',
    'lifecycle_gate',
    'runtime_smoke',
  ],
  T4: [
    'typecheck',
    'lint',
    'unit_tests',
    'integration_tests',
    'build',
    'lifecycle_gate',
    'runtime_smoke',
    'discord_canary',
    'drift_audit',
  ],
};

/** Which recipe IDs are recommended (not required) at each tier (defaults) */
const DEFAULT_TIER_RECOMMENDED_RECIPES: Record<VerificationTier, string[]> = {
  T1: ['lint'],
  T2: ['drift_audit'],
  T3: ['schema_guard', 'discord_canary'],
  T4: ['schema_guard', 'ui_visual_check'],
};

// ---------------------------------------------------------------------------
// Verification Resolution
// ---------------------------------------------------------------------------

export interface VerificationResolution {
  sprintType: SprintType;
  verificationTier: VerificationTier;
  required: VerificationRequirement[];
  recommended: VerificationRequirement[];
  proofRequired: ProofRequirement[];
  proofOptional: ProofRequirement[];
  ratificationThreshold: string;
  unresolvedItems: DeferredRequirement[];
  runtimeProofRequired: boolean;
}

/**
 * Resolve full verification requirements for a sprint.
 *
 * @param sprintType - The sprint type
 * @param verificationRecipes - Loaded verification recipe set
 * @param proofRecipes - Loaded proof recipe set
 * @param overrideTier - Optional tier override (must be >= minimum for type)
 * @param profileDefaults - Optional profile verification defaults (merged over engine defaults)
 */
export function resolveVerification(
  sprintType: SprintType,
  verificationRecipes: VerificationRecipeSet,
  proofRecipes: ProofRecipeSet,
  overrideTier?: VerificationTier,
  profileDefaults?: ProfileVerificationDefaults
): VerificationResolution {
  const sprintTypeTiers: Record<SprintType, VerificationTier> = {
    ...DEFAULT_SPRINT_TYPE_TIERS,
    ...(profileDefaults?.sprintTypeTiers ?? {}),
  };
  const tierRequiredRecipes: Record<VerificationTier, string[]> = {
    ...DEFAULT_TIER_REQUIRED_RECIPES,
    ...(profileDefaults?.tierRequiredRecipes ?? {}),
  };
  const tierRecommendedRecipes: Record<VerificationTier, string[]> = {
    ...DEFAULT_TIER_RECOMMENDED_RECIPES,
    ...(profileDefaults?.tierRecommendedRecipes ?? {}),
  };

  const minimumTier = sprintTypeTiers[sprintType];
  const effectiveTier = overrideTier ? maxTier(overrideTier, minimumTier) : minimumTier;

  const requiredRecipeIds = tierRequiredRecipes[effectiveTier];
  const recommendedRecipeIds = tierRecommendedRecipes[effectiveTier];
  const unresolvedItems: DeferredRequirement[] = [];

  // --- Resolve verification requirements ---
  const required = requiredRecipeIds.map(recipeId => {
    const recipe = getVerificationRecipe(verificationRecipes, recipeId);
    if (!recipe) {
      unresolvedItems.push({
        category: 'verification',
        description: `Verification recipe '${recipeId}' not found in verification-recipes.json`,
        reason: 'Recipe definition missing',
        suggestedPhase: 'Phase C',
      });
      return createUnresolvedRequirement(recipeId);
    }

    const resolved = isCommandResolved(recipe.command_placeholder);
    if (!resolved) {
      unresolvedItems.push({
        category: 'verification',
        description: `Command for '${recipeId}' is a placeholder: ${recipe.command_placeholder}`,
        reason: 'Command not yet defined',
        suggestedPhase: 'Phase D',
      });
    }

    return {
      recipeId: recipe.id,
      purpose: recipe.purpose,
      required: true,
      commandPlaceholder: recipe.command_placeholder,
      commandResolved: resolved,
      outputFile: recipe.output_file,
      failureSeverity: recipe.failure_severity,
      notes: recipe.notes,
    } satisfies VerificationRequirement;
  });

  const recommended = recommendedRecipeIds
    .filter(id => !requiredRecipeIds.includes(id))
    .map(recipeId => {
      const recipe = getVerificationRecipe(verificationRecipes, recipeId);
      if (!recipe) {
        return createUnresolvedRequirement(recipeId, false);
      }
      return {
        recipeId: recipe.id,
        purpose: recipe.purpose,
        required: false,
        commandPlaceholder: recipe.command_placeholder,
        commandResolved: isCommandResolved(recipe.command_placeholder),
        outputFile: recipe.output_file,
        failureSeverity: recipe.failure_severity,
        notes: recipe.notes,
      } satisfies VerificationRequirement;
    });

  // --- Resolve proof requirements ---
  const proofRecipe = getProofRecipe(proofRecipes, sprintType);
  let proofRequired: ProofRequirement[] = [];
  let proofOptional: ProofRequirement[] = [];
  let ratificationThreshold = '(proof recipe not found for sprint type)';

  if (proofRecipe) {
    proofRequired = proofRecipe.required_proof.map(p => ({
      category: p.category,
      artifact: p.artifact,
      description: p.description,
      required: true,
    }));

    proofOptional = proofRecipe.optional_proof.map(p => ({
      category: p.category,
      artifact: p.artifact,
      description: p.description,
      required: false,
    }));

    ratificationThreshold = proofRecipe.ratification_threshold;
  } else {
    unresolvedItems.push({
      category: 'proof',
      description: `No proof recipe found for sprint type '${sprintType}'`,
      reason: 'Sprint type not defined in proof-recipes.json',
      suggestedPhase: 'Phase B amendment',
    });
  }

  const runtimeProofRequired = effectiveTier === 'T3' || effectiveTier === 'T4';

  return {
    sprintType,
    verificationTier: effectiveTier,
    required,
    recommended,
    proofRequired,
    proofOptional,
    ratificationThreshold,
    unresolvedItems,
    runtimeProofRequired,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compare tiers and return the higher (more strict) one */
function maxTier(a: VerificationTier, b: VerificationTier): VerificationTier {
  const order: VerificationTier[] = ['T1', 'T2', 'T3', 'T4'];
  const indexA = order.indexOf(a);
  const indexB = order.indexOf(b);
  return order[Math.max(indexA, indexB)];
}

function createUnresolvedRequirement(recipeId: string, required = true): VerificationRequirement {
  return {
    recipeId,
    purpose: `(unresolved — recipe '${recipeId}' not found)`,
    required,
    commandPlaceholder: 'UNRESOLVED',
    commandResolved: false,
    outputFile: 'UNRESOLVED',
    failureSeverity: required ? 'blocking' : 'informational',
    notes: 'Recipe definition missing from verification-recipes.json',
  };
}

/**
 * Get the minimum verification tier for a sprint type.
 */
export function getMinimumTier(
  sprintType: SprintType,
  profileDefaults?: ProfileVerificationDefaults
): VerificationTier {
  const tiers: Record<SprintType, VerificationTier> = {
    ...DEFAULT_SPRINT_TYPE_TIERS,
    ...(profileDefaults?.sprintTypeTiers ?? {}),
  };
  return tiers[sprintType];
}

/**
 * Check if a sprint type is recognized.
 */
export function isValidSprintType(type: string): type is SprintType {
  return type in DEFAULT_SPRINT_TYPE_TIERS;
}
