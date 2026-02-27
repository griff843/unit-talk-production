/**
 * ROLLOUT_MODE_CANON_v1.0 Implementation
 * PHASE_9A_ENFORCEMENT_ACTIVATION
 *
 * Rollout mode canonical enum and allowed matrix.
 * ABSOLUTE PROHIBITION: SHADOW mode is PROHIBITED in production.
 */

// Closed enums per contract
export const ROLLOUT_MODES = ['DORMANT', 'SHADOW', 'CANARY', 'ENFORCED', 'LOCKED'] as const;
export type RolloutMode = (typeof ROLLOUT_MODES)[number];

export const ENVIRONMENTS = ['dev', 'staging', 'prod'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const UNKNOWN_MODE = 'UNKNOWN' as const;
export type UnknownMode = typeof UNKNOWN_MODE;

// Allowed Mode Matrix per ROLLOUT_MODE_CANON_v1.0 Section 5.1
type MatrixStatus = 'ALLOWED' | 'NOT_ALLOWED' | 'PROHIBITED';
const ALLOWED_MODE_MATRIX: Record<Environment, Record<RolloutMode, MatrixStatus>> = {
  dev: {
    DORMANT: 'ALLOWED',
    SHADOW: 'ALLOWED',
    CANARY: 'NOT_ALLOWED',
    ENFORCED: 'NOT_ALLOWED',
    LOCKED: 'NOT_ALLOWED',
  },
  staging: {
    DORMANT: 'ALLOWED',
    SHADOW: 'ALLOWED',
    CANARY: 'ALLOWED',
    ENFORCED: 'NOT_ALLOWED',
    LOCKED: 'NOT_ALLOWED',
  },
  prod: {
    DORMANT: 'ALLOWED',
    SHADOW: 'PROHIBITED',
    CANARY: 'ALLOWED',
    ENFORCED: 'ALLOWED',
    LOCKED: 'ALLOWED',
  },
};

export function isValidRolloutMode(value: string): value is RolloutMode {
  return ROLLOUT_MODES.includes(value as RolloutMode);
}

export function isValidEnvironment(value: string): value is Environment {
  return ENVIRONMENTS.includes(value as Environment);
}

export function parseRolloutMode(value: string | undefined): RolloutMode | UnknownMode {
  if (!value) return UNKNOWN_MODE;
  const upper = value.toUpperCase();
  return isValidRolloutMode(upper) ? upper : UNKNOWN_MODE;
}

export function parseEnvironment(value: string | undefined): Environment | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return isValidEnvironment(lower) ? lower : null;
}

export interface ModeValidationResult {
  valid: boolean;
  mode: RolloutMode | UnknownMode;
  environment: Environment | null;
  matrixStatus: MatrixStatus | 'UNKNOWN_MODE' | 'UNKNOWN_ENV';
  error?: string;
  isShadowInProd: boolean;
}

/** Validate rollout mode against environment using the allowed matrix. */
export function validateRolloutMode(
  rawMode: string | undefined,
  rawEnv: string | undefined
): ModeValidationResult {
  const mode = parseRolloutMode(rawMode);
  const env = parseEnvironment(rawEnv);

  if (mode === UNKNOWN_MODE) {
    return {
      valid: false,
      mode,
      environment: env,
      matrixStatus: 'UNKNOWN_MODE',
      isShadowInProd: false,
      error: `UNKNOWN mode: "${rawMode}". Valid: ${ROLLOUT_MODES.join(', ')}`,
    };
  }
  if (env === null) {
    return {
      valid: false,
      mode,
      environment: env,
      matrixStatus: 'UNKNOWN_ENV',
      isShadowInProd: false,
      error: `UNKNOWN environment: "${rawEnv}". Valid: ${ENVIRONMENTS.join(', ')}`,
    };
  }

  // eslint-disable-next-line security/detect-object-injection
  const matrixStatus = ALLOWED_MODE_MATRIX[env][mode];
  const isShadowInProd = env === 'prod' && mode === 'SHADOW';

  if (isShadowInProd) {
    return {
      valid: false,
      mode,
      environment: env,
      matrixStatus: 'PROHIBITED',
      isShadowInProd: true,
      error: 'FATAL: SHADOW mode PROHIBITED in production per ROLLOUT_MODE_CANON_v1.0 Section 5.2',
    };
  }
  if (matrixStatus === 'NOT_ALLOWED') {
    return {
      valid: false,
      mode,
      environment: env,
      matrixStatus,
      isShadowInProd: false,
      error: `Mode ${mode} is NOT_ALLOWED in ${env} environment per allowed matrix.`,
    };
  }
  return { valid: true, mode, environment: env, matrixStatus, isShadowInProd: false };
}

/** Hard guard against SHADOW mode in production. Throws on violation. */
export function assertNoShadowInProd(
  mode: RolloutMode | UnknownMode,
  env: Environment | null
): void {
  if (env === 'prod' && mode === 'SHADOW') {
    throw new Error(
      '[PHASE_9A] FATAL: SHADOW mode detected in production. Per ROLLOUT_MODE_CANON_v1.0: PROHIBITED.'
    );
  }
}

/** Generate a deterministic proof receipt for mode validation (no secrets). */
export function generateModeValidationReceipt(result: ModeValidationResult): string {
  const lines = [
    '=== ROLLOUT MODE VALIDATION RECEIPT ===',
    `Timestamp: ${new Date().toISOString()} | Contract: ROLLOUT_MODE_CANON_v1.0`,
    `Environment: ${result.environment ?? 'UNKNOWN'} | Mode: ${result.mode}`,
    `Matrix Status: ${result.matrixStatus} | SHADOW in PROD: ${result.isShadowInProd ? 'VIOLATION' : 'PASS'}`,
    `Valid: ${result.valid ? 'PASS' : 'FAIL'}${result.error ? ` | Error: ${result.error}` : ''}`,
    '=== END RECEIPT ===',
  ];
  return lines.join('\n');
}
