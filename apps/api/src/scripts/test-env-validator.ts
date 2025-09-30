#!/usr/bin/env node

import { SupabaseClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { createLogger } from '../utils/logger';
import { requireSupabase } from '../utils/supabaseUtils';

// import { Logger } from '../utils/logger'; // Unused

const logger = createLogger('TestEnvValidator');

interface ValidationResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

async function validateEnvironment(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Validate required environment variables
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TEMPORAL_TASK_QUEUE',
    'TEMPORAL_ADDRESS',
    'TEMPORAL_NAMESPACE'
  ];

  for (const varName of requiredVars) {
    results.push(validateEnvVar(varName, true));
  }

  // Validate optional environment variables
  const optionalVars = [
    'DISCORD_APPROVED_WEBHOOK_URL',
    'OPTIMAL_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_FROM_NUMBER'
  ];

  for (const varName of optionalVars) {
    results.push(validateEnvVar(varName, false));
  }

  // Validate Supabase connection
  results.push(await validateSupabaseConnection());

  // Validate Temporal connection
  results.push(await validateTemporalConnection());

  return results;
}

function validateEnvVar(varName: string, required: unknown): ValidationResult {
  const value = env[varName as keyof typeof env];

  if (!value && required) {
    return {
      success: false,
      message: `Required environment variable ${varName} is missing`,
      details: { varName, required }
    };
  }

  if (!value && !required) {
    return {
      success: true,
      message: `Optional environment variable ${varName} is not set`,
      details: { varName, required }
    };
  }

  return {
    success: true,
    message: `Environment variable ${varName} is set`,
    details: { varName, required }
  };
}

async function validateSupabaseConnection(): Promise<ValidationResult> {
  try {
    const supabase = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const supabaseClient = requireSupabase();
      const { data, error } = await supabase.from('agent_logs').select('count').limit(1);

    if (error) {
      return {
        success: false,
        message: 'Failed to connect to Supabase',
        details: { error: error.message }
      };
    }

    return {
      success: true,
      message: 'Successfully connected to Supabase',
      details: { data }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to connect to Supabase',
      details: { err: error instanceof Error ? error.message : String(error) }
    };
  }
}

async function validateTemporalConnection(): Promise<ValidationResult> {
  try {
    // TODO: Add Temporal connection validation
    return {
      success: true,
      message: 'Temporal connection validation not implemented yet',
      details: { temporalAddress: process.env.TEMPORAL_ADDRESS || 'localhost:7233' }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to connect to Temporal',
      details: { err: error instanceof Error ? error.message : String(error) }
    };
  }
}

if (require.main === module) {
  validateEnvironment().then((results) => {
    const failures = results.filter(r => !r.success);

    for (const result of results) {
      if (result.success) {
        logger.info(result.message, result.details);
      } else {
        logger.error(result.message, result.details);
      }
    }

    if (failures.length > 0) {
      logger.error('Environment validation failed', {
        failureCount: failures.length,
        totalChecks: results.length
      });
      process.exit(1);
    }

    logger.info('Environment validation passed', {
      totalChecks: results.length
    });
  }).catch((error) => {
    logger.error('Failed to validate environment', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}

export { validateEnvironment };