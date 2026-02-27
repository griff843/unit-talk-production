/**
 * FAIL_CLOSED_BOOT_SPEC_v1.0 Implementation
 * PHASE_9A_ENFORCEMENT_ACTIVATION
 *
 * Fail-closed boot behavior for the API service.
 * Every precondition failure results in HALT.
 *
 * Exit Codes: 0=success, 2=env, 3=secret, 4=config, 5=db, 6=deps
 */

/* eslint-disable no-console */

import {
  validateRolloutMode,
  parseRolloutMode,
  parseEnvironment,
  generateModeValidationReceipt,
  type Environment,
  type RolloutMode,
  type ModeValidationResult,
} from './rollout-mode';

// Exit codes per FAIL_CLOSED_BOOT_SPEC_v1.0 Section 11.3
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_FAILURE: 1,
  ENV_FAILURE: 2,
  SECRET_FAILURE: 3,
  CONFIG_FAILURE: 4,
  DB_FAILURE: 5,
  DEPS_FAILURE: 6,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export const BOOT_PRECONDITIONS = {
  BP_ENV: 'BP_ENV',
  BP_SECRET: 'BP_SECRET',
  BP_CONFIG: 'BP_CONFIG',
  BP_DB: 'BP_DB',
  BP_DEPS: 'BP_DEPS',
} as const;

export type BootPrecondition = (typeof BOOT_PRECONDITIONS)[keyof typeof BOOT_PRECONDITIONS];

// Required env vars validators
const ENV_VALIDATORS: Record<
  string,
  { required: boolean; validator: (v?: string) => boolean; errorMsg: string }
> = {
  ENV_IDENTITY: {
    required: true,
    validator: v => ['dev', 'staging', 'prod'].includes(v?.toLowerCase() ?? ''),
    errorMsg: 'ENV_IDENTITY MUST be set to dev, staging, or prod',
  },
  NODE_ENV: {
    required: true,
    validator: v => ['development', 'test', 'production', 'staging'].includes(v ?? ''),
    errorMsg: 'NODE_ENV MUST be development, test, staging, or production',
  },
  PORT: {
    required: false,
    validator: v => !v || (!isNaN(Number(v)) && Number(v) > 0 && Number(v) < 65536),
    errorMsg: 'PORT MUST be a valid port number (1-65535)',
  },
  ROLLOUT_MODE: {
    required: false,
    validator: v =>
      !v || ['DORMANT', 'SHADOW', 'CANARY', 'ENFORCED', 'LOCKED'].includes(v.toUpperCase()),
    errorMsg: 'ROLLOUT_MODE MUST be DORMANT, SHADOW, CANARY, ENFORCED, or LOCKED',
  },
};

const SECRETS_BY_ENV: Record<string, string[]> = {
  all: [],
  dev: [],
  staging: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  prod: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'],
};

export interface BootCheckResult {
  category: BootPrecondition;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; error?: string }>;
  exitCode: ExitCode;
}

export interface BootSequenceResult {
  success: boolean;
  exitCode: ExitCode;
  environment: Environment | null;
  rolloutMode: RolloutMode | 'UNKNOWN';
  modeValidation: ModeValidationResult;
  checks: BootCheckResult[];
  timestamp: string;
  durationMs: number;
}

function checkEnvPreconditions(): BootCheckResult {
  const checks: BootCheckResult['checks'] = [];
  for (const [name, cfg] of Object.entries(ENV_VALIDATORS)) {
    // eslint-disable-next-line security/detect-object-injection
    const value = process.env[name];
    if (cfg.required && !value) {
      checks.push({ name, passed: false, error: `${name} is required but not set` });
    } else if (!cfg.validator(value)) {
      checks.push({ name, passed: false, error: cfg.errorMsg });
    } else {
      checks.push({ name, passed: true });
    }
  }
  const allPassed = checks.every(c => c.passed);
  return {
    category: BOOT_PRECONDITIONS.BP_ENV,
    passed: allPassed,
    checks,
    exitCode: allPassed ? 0 : 2,
  };
}

function checkSecretsPreconditions(env: Environment | null): BootCheckResult {
  const checks: BootCheckResult['checks'] = [];
  // eslint-disable-next-line security/detect-object-injection
  const required = [...SECRETS_BY_ENV.all, ...(env ? SECRETS_BY_ENV[env] : [])];
  for (const name of required) {
    // eslint-disable-next-line security/detect-object-injection
    const val = process.env[name];
    if (!val || val.trim() === '') {
      checks.push({
        name,
        passed: false,
        error: `Secret ${name} required in ${env ?? 'unknown'} but not set`,
      });
    } else {
      checks.push({ name, passed: true });
    }
  }
  const allPassed = checks.every(c => c.passed);
  return {
    category: BOOT_PRECONDITIONS.BP_SECRET,
    passed: allPassed,
    checks,
    exitCode: allPassed ? 0 : 3,
  };
}

function checkConfigPreconditions(env: Environment | null): BootCheckResult {
  const checks: BootCheckResult['checks'] = [];
  const modeValidation = validateRolloutMode(process.env.ROLLOUT_MODE, process.env.ENV_IDENTITY);
  checks.push({
    name: 'ROLLOUT_MODE_MATRIX',
    passed: modeValidation.valid,
    error: modeValidation.error,
  });
  checks.push({
    name: 'NO_SHADOW_IN_PROD',
    passed: !modeValidation.isShadowInProd,
    error: modeValidation.isShadowInProd ? 'SHADOW mode PROHIBITED in production' : undefined,
  });
  if (env === 'prod') {
    const dockerOk = process.env.DOCKER_CONTAINER === 'true';
    checks.push({
      name: 'DOCKER_CONTAINER_REQUIRED',
      passed: dockerOk,
      error: dockerOk ? undefined : 'Production requires Docker. Set DOCKER_CONTAINER=true.',
    });
  }
  const allPassed = checks.every(c => c.passed);
  return {
    category: BOOT_PRECONDITIONS.BP_CONFIG,
    passed: allPassed,
    checks,
    exitCode: allPassed ? 0 : 4,
  };
}

function buildFailResult(
  exitCode: ExitCode,
  env: Environment | null,
  checks: BootCheckResult[],
  startTime: number
): BootSequenceResult {
  return {
    success: false,
    exitCode,
    environment: env,
    rolloutMode: 'UNKNOWN',
    modeValidation: validateRolloutMode(process.env.ROLLOUT_MODE, process.env.ENV_IDENTITY),
    checks,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

/** Execute the fail-closed boot sequence. Returns result (does not exit). */
export function executeBootSequence(): BootSequenceResult {
  const startTime = Date.now();
  const checks: BootCheckResult[] = [];

  const envCheck = checkEnvPreconditions();
  checks.push(envCheck);
  if (!envCheck.passed) return buildFailResult(envCheck.exitCode, null, checks, startTime);

  const env = parseEnvironment(process.env.ENV_IDENTITY);

  const secretCheck = checkSecretsPreconditions(env);
  checks.push(secretCheck);
  if (!secretCheck.passed) return buildFailResult(secretCheck.exitCode, env, checks, startTime);

  const configCheck = checkConfigPreconditions(env);
  checks.push(configCheck);
  if (!configCheck.passed) return buildFailResult(configCheck.exitCode, env, checks, startTime);

  const mode = parseRolloutMode(process.env.ROLLOUT_MODE || 'DORMANT');
  return {
    success: true,
    exitCode: 0,
    environment: env,
    rolloutMode: mode === 'UNKNOWN' ? 'DORMANT' : (mode as RolloutMode),
    modeValidation: validateRolloutMode(
      process.env.ROLLOUT_MODE || 'DORMANT',
      process.env.ENV_IDENTITY
    ),
    checks,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

function logBootFailure(result: BootSequenceResult): void {
  console.error(
    '\n================================================================================'
  );
  console.error('[PHASE_9A] FAIL-CLOSED BOOT: PRECONDITION FAILURE');
  console.error('================================================================================');
  console.error(
    `Timestamp: ${result.timestamp} | Exit Code: ${result.exitCode} | Duration: ${result.durationMs}ms\n`
  );
  for (const check of result.checks) {
    console.error(`${check.passed ? '[PASS]' : '[FAIL]'} ${check.category}`);
    for (const sub of check.checks) {
      if (!sub.passed) console.error(`  [XX] ${sub.name}: ${sub.error}`);
    }
  }
  console.error(
    '\nPer FAIL_CLOSED_BOOT_SPEC_v1.0: Service MUST NOT start with failed preconditions.'
  );
  console.error(
    '================================================================================\n'
  );
}

/** Enforce fail-closed boot. Exits process on failure. */
export function enforceFailClosedBoot(): BootSequenceResult {
  const result = executeBootSequence();
  if (!result.success) {
    logBootFailure(result);
    process.exit(result.exitCode);
  }
  console.log('\n[PHASE_9A] FAIL-CLOSED BOOT: ALL PRECONDITIONS PASSED');
  console.log(
    `  Environment: ${result.environment} | Rollout Mode: ${result.rolloutMode} | Duration: ${result.durationMs}ms\n`
  );
  return result;
}

/** Generate a deterministic proof receipt (no secret values). */
export function generateBootReceipt(result: BootSequenceResult): string {
  const lines = [
    '=== FAIL-CLOSED BOOT RECEIPT ===',
    `Contract: FAIL_CLOSED_BOOT_SPEC_v1.0 | Timestamp: ${result.timestamp} | Duration: ${result.durationMs}ms`,
    `Success: ${result.success ? 'PASS' : 'FAIL'} | Exit Code: ${result.exitCode}`,
    `Environment: ${result.environment ?? 'UNKNOWN'} | Rollout Mode: ${result.rolloutMode}`,
    '--- Precondition Checks ---',
  ];
  for (const check of result.checks) {
    lines.push(`[${check.passed ? 'PASS' : 'FAIL'}] ${check.category}`);
    for (const sub of check.checks) {
      lines.push(
        `  - ${sub.name}: ${sub.passed ? 'OK' : 'FAIL'}${sub.error ? `: ${sub.error}` : ''}`
      );
    }
  }
  lines.push(
    '--- Mode Validation ---',
    generateModeValidationReceipt(result.modeValidation),
    '=== END RECEIPT ==='
  );
  return lines.join('\n');
}

// Re-exports
export {
  validateRolloutMode,
  parseRolloutMode,
  parseEnvironment,
  generateModeValidationReceipt,
  type RolloutMode,
  type Environment,
  type ModeValidationResult,
} from './rollout-mode';
