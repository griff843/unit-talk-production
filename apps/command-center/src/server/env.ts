import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  DATABASE_URL: z.string().optional(),
  GITHUB_WORKFLOW_TOKEN: z.string().optional(),
  ALERTMANAGER_WEBHOOK_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
] as const;

const optionalVars = [
  'DATABASE_URL',
  'GITHUB_WORKFLOW_TOKEN', 
  'ALERTMANAGER_WEBHOOK_SECRET',
  'NEXTAUTH_SECRET'
] as const;

interface ConfigValidation {
  isConfigured: boolean;
  env: Partial<Env>;
  missingRequired: string[];
  missingOptional: string[];
  errors: string[];
}

export function validateEnvironment(): ConfigValidation {
  const env: Partial<Env> = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    GITHUB_WORKFLOW_TOKEN: process.env.GITHUB_WORKFLOW_TOKEN,
    ALERTMANAGER_WEBHOOK_SECRET: process.env.ALERTMANAGER_WEBHOOK_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  };

  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  const errors: string[] = [];

  // Check required variables
  for (const varName of requiredVars) {
    if (!env[varName]) {
      missingRequired.push(varName);
    }
  }

  // Check optional variables
  for (const varName of optionalVars) {
    if (!env[varName]) {
      missingOptional.push(varName);
    }
  }

  // Validate with zod schema
  try {
    const requiredEnv = Object.fromEntries(
      requiredVars.map(key => [key, env[key]]).filter(([, value]) => value)
    );
    
    envSchema.partial().parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(err => `${err.path.join('.')}: ${err.message}`));
    } else {
      errors.push('Unknown validation error');
    }
  }

  const isConfigured = missingRequired.length === 0 && errors.length === 0;

  return {
    isConfigured,
    env,
    missingRequired,
    missingOptional,
    errors,
  };
}

export const configValidation = validateEnvironment();
export const isConfigured = configValidation.isConfigured;

// Export validated env vars (only if configured)
export const env = configValidation.isConfigured ? configValidation.env as Env : null;

// Helper function to get config error message
export function getConfigErrorMessage(): string {
  const { missingRequired, missingOptional, errors } = configValidation;
  
  const messages: string[] = [];
  
  if (missingRequired.length > 0) {
    messages.push(`Missing required environment variables: ${missingRequired.join(', ')}`);
  }
  
  if (errors.length > 0) {
    messages.push(`Configuration errors: ${errors.join(', ')}`);
  }
  
  if (missingOptional.length > 0) {
    messages.push(`Missing optional environment variables (reduced functionality): ${missingOptional.join(', ')}`);
  }

  return messages.join('\n');
}

// Helper to create a 501 Not Configured response
export function createNotConfiguredResponse() {
  return Response.json(
    {
      error: 'Service Not Configured',
      message: getConfigErrorMessage(),
      code: 'CONFIGURATION_MISSING',
      missingRequired: configValidation.missingRequired,
      missingOptional: configValidation.missingOptional,
    },
    { status: 501 }
  );
}