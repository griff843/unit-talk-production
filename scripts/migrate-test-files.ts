import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = 'src/test';
const MOCK_DIR = path.join(TEST_DIR, 'mocks');

// New base config template
const baseConfigTemplate = {
  name: 'TestAgent',
  version: '1.0.0',
  enabled: true,
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60,
    collectors: []
  },
  health: {
    enabled: true,
    interval: 30,
    checks: []
  },
  retry: {
    maxRetries: 3,
    backoffMs: 200,
    maxBackoffMs: 5000
  },
  security: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000
    },
    auditLogging: true
  },
  plugins: {
    enabled: false,
    directory: 'plugins'
  },
  distributed: {
    enabled: false,
    lockTimeout: 30000,
    lockRetryInterval: 5000
  }
};

// Update mock config files
const mockConfigFiles = glob.sync(`${MOCK_DIR}/configs/**/*.ts`);
mockConfigFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace old config structure with new base config
  content = content.replace(
    /export const \w+Config: AgentConfig = \{[^}]+\}/g,
    (match) => {
      const agentName = match.match(/export const (\w+)Config/)?.[1] || 'Test';
      const newConfig = {
        ...baseConfigTemplate,
        name: agentName
      };
      return `export const ${agentName}Config: BaseAgentConfig = ${JSON.stringify(newConfig, null, 2)}`;
    }
  );

  fs.writeFileSync(file, content);
  console.log(`Updated mock config: ${file}`);
});

// Update test files
const testFiles = glob.sync(`${TEST_DIR}/**/*.test.ts`);
testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Update imports
  content = content.replace(
    /import \{ AgentConfig, AgentStatus \} from ['"]\.\.\/types\/agent['"]/g,
    "import { BaseAgentConfig, AgentStatus } from '../agents/BaseAgent/types'"
  );

  // Update type references
  content = content.replace(/AgentConfig/g, 'BaseAgentConfig');

  // Update metrics config
  content = content.replace(
    /metricsEnabled: (true|false)/g,
    (_, enabled) => `metrics: { enabled: ${enabled}, interval: 60, collectors: [] }`
  );

  // Update retry config
  content = content.replace(
    /retryConfig: \{([^}]+)\}/g,
    (_, inner) => `retry: {${inner}}`
  );

  fs.writeFileSync(file, content);
  console.log(`Updated test file: ${file}`);
});

console.log('Test migration complete!'); 