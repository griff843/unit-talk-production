#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
try {
  require('dotenv').config();
} catch (error) {
  console.warn('Warning: dotenv not available, using system environment variables only');
}

// Define environment requirements for each app
const ENV_REQUIREMENTS = [
  // Core Database
  {
    key: 'SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    example: 'https://your-project.supabase.co',
    apps: ['api', 'command-center', 'smart-form']
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (server-side)',
    apps: ['api']
  },
  {
    key: 'SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key (client-side)',
    apps: ['command-center', 'smart-form', 'dashboard']
  },

  // API Configuration
  {
    key: 'API_PORT',
    required: false,
    description: 'API server port',
    example: '3000',
    apps: ['api']
  },
  {
    key: 'API_URL',
    required: false,
    description: 'API base URL for client connections',
    example: 'http://localhost:3000',
    apps: ['command-center', 'smart-form', 'dashboard']
  },

  // External APIs
  {
    key: 'OPTIMAL_API_KEY',
    required: false,
    description: 'Optimal API key for sports data',
    apps: ['api']
  },
  {
    key: 'ODDS_API_KEY',
    required: false,
    description: 'Odds API key for sports data fallback',
    apps: ['api']
  },

  // Discord Bot
  {
    key: 'DISCORD_BOT_TOKEN',
    required: false,
    description: 'Discord bot token',
    apps: ['discord-bot']
  },
  {
    key: 'DISCORD_CLIENT_ID',
    required: false,
    description: 'Discord application client ID',
    apps: ['discord-bot']
  },
  {
    key: 'DISCORD_GUILD_ID',
    required: false,
    description: 'Discord server (guild) ID',
    apps: ['discord-bot']
  },

  // Temporal Workflow Engine
  {
    key: 'TEMPORAL_ADDRESS',
    required: false,
    description: 'Temporal server address',
    example: 'localhost:7233',
    apps: ['api']
  },
  {
    key: 'TEMPORAL_SERVER_URL',
    required: false,
    description: 'Alternative Temporal server URL',
    example: 'http://localhost:7233',
    apps: ['api']
  },
  {
    key: 'TEMPORAL_NAMESPACE',
    required: false,
    description: 'Temporal namespace',
    example: 'unit-talk',
    apps: ['api']
  },

  // AI Services
  {
    key: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key for AI features',
    apps: ['api']
  },
  {
    key: 'ANTHROPIC_API_KEY',
    required: false,
    description: 'Anthropic API key for AI features',
    apps: ['api']
  },

  // Environment & Logging
  {
    key: 'NODE_ENV',
    required: false,
    description: 'Node.js environment',
    example: 'development|production|test',
    apps: ['api', 'command-center', 'smart-form', 'dashboard', 'discord-bot']
  },
  {
    key: 'LOG_LEVEL',
    required: false,
    description: 'Logging level',
    example: 'info|debug|warn|error',
    apps: ['api', 'discord-bot']
  },

  // Redis (optional)
  {
    key: 'REDIS_URL',
    required: false,
    description: 'Redis connection URL for caching',
    example: 'redis://localhost:6379',
    apps: ['api']
  },

  // Telemetry (optional)
  {
    key: 'OTEL_EXPORTER_OTLP_ENDPOINT',
    required: false,
    description: 'OpenTelemetry OTLP endpoint',
    example: 'http://localhost:4318/v1/traces',
    apps: ['api']
  },
  {
    key: 'SERVICE_NAME',
    required: false,
    description: 'Service name for telemetry',
    example: 'unit-talk-api',
    apps: ['api']
  },
  {
    key: 'SERVICE_VERSION',
    required: false,
    description: 'Service version for telemetry',
    example: '1.0.0',
    apps: ['api']
  }
];

function maskSensitiveValue(key, value) {
  const sensitiveKeys = ['key', 'token', 'secret', 'password', 'pass'];
  const isSensitive = sensitiveKeys.some(sensitive => 
    key.toLowerCase().includes(sensitive)
  );
  
  if (isSensitive && value.length > 8) {
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }
  
  return value;
}

async function validateEnvironment() {
  const results = [];
  let requiredMissing = 0;

  for (const requirement of ENV_REQUIREMENTS) {
    const value = process.env[requirement.key];
    const present = value !== undefined && value !== '';
    
    if (requirement.required && !present) {
      requiredMissing++;
    }

    results.push({
      key: requirement.key,
      present,
      value: present ? value : undefined,
      masked: present ? maskSensitiveValue(requirement.key, value) : undefined,
      required: requirement.required,
      description: requirement.description,
      apps: requirement.apps
    });
  }

  const present = results.filter(r => r.present).length;
  const missing = results.filter(r => !r.present).length;

  let overall = 'PASS';
  if (requiredMissing > 0) {
    overall = 'FAIL';
  } else if (missing > 0) {
    overall = 'DEGRADED';
  }

  // Generate suggested .env keys
  const suggestedEnvKeys = ENV_REQUIREMENTS.map(req => {
    const comment = `# ${req.description} (${req.apps.join(', ')})${req.required ? ' - REQUIRED' : ''}`;
    const keyLine = req.example 
      ? `${req.key}=${req.example}`
      : `${req.key}=`;
    
    return `${comment}\n${keyLine}`;
  });

  return {
    timestamp: new Date().toISOString(),
    overall,
    totalChecked: results.length,
    present,
    missing,
    requiredMissing,
    results,
    suggestedEnvKeys
  };
}

async function main() {
  console.log('🔍 Validating environment variables...');
  
  const report = await validateEnvironment();
  
  // Ensure output directory exists
  const outDir = path.join(process.cwd(), 'out', 'ops');
  fs.mkdirSync(outDir, { recursive: true });
  
  // Write report
  const reportPath = path.join(outDir, 'env-validate.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Log results
  console.log(`\n📊 Environment Validation Results:`);
  console.log(`Overall Status: ${report.overall === 'PASS' ? '✅' : report.overall === 'DEGRADED' ? '⚠️' : '❌'} ${report.overall}`);
  console.log(`Variables: ${report.present}✅ ${report.missing}❌ (${report.requiredMissing} required missing)`);
  
  if (report.requiredMissing > 0) {
    console.log(`\n❌ Missing required environment variables:`);
    for (const result of report.results.filter(r => r.required && !r.present)) {
      console.log(`  ${result.key} - ${result.description} (${result.apps.join(', ')})`);
    }
  }
  
  if (report.missing > report.requiredMissing) {
    console.log(`\n⚠️ Missing optional environment variables:`);
    for (const result of report.results.filter(r => !r.required && !r.present)) {
      console.log(`  ${result.key} - ${result.description} (${result.apps.join(', ')})`);
    }
  }
  
  console.log(`\n📄 Full report: ${reportPath}`);
  
  process.exit(report.overall === 'FAIL' ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}
