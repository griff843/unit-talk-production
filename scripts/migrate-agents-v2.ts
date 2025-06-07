import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// List of all files modified and TODOs added
const migrationLog: { file: string; todos: string[] }[] = [];

// Helper to add TODO markers
function addTodo(file: string, method: string): string {
  const todo = `// TODO: Restore business logic here after base migration (${method})`;
  if (!migrationLog.find(log => log.file === file)) {
    migrationLog.push({ file, todos: [] });
  }
  const log = migrationLog.find(log => log.file === file)!;
  if (!log.todos.includes(todo)) {
    log.todos.push(todo);
  }
  return todo;
}

// Migrate agent classes
function migrateAgentClass(filePath: string) {
  // Skip activity files and test files
  if (filePath.includes('activities/') || filePath.includes('__tests__/') || filePath.includes('types/')) {
    // Clean up any incorrectly added BaseAgent methods from these files
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove any BaseAgent abstract methods that were incorrectly added
    const methodsToRemove = [
      'protected async initialize(): Promise<void>',
      'protected async process(): Promise<void>',
      'protected async cleanup(): Promise<void>',
      'protected async checkHealth(): Promise<HealthStatus>',
      'protected async collectMetrics(): Promise<BaseMetrics>'
    ];

    methodsToRemove.forEach(method => {
      const methodRegex = new RegExp(`\\s*${method}\\s*{[^}]*}`, 'gs');
      content = content.replace(methodRegex, '');
    });

    // Clean up any empty class declarations
    content = content.replace(/export class \w+ extends BaseAgent\s*{\s*}/g, '');
    
    fs.writeFileSync(filePath, content);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const agentName = path.basename(path.dirname(filePath));
  
  // Skip BaseAgent
  if (agentName === 'BaseAgent') return;
  
  console.log(`Migrating ${agentName}...`);
  
  // Update imports
  content = content.replace(
    /import \{ BaseAgent \} from ['"]\.\.\/BaseAgent['"]/g,
    "import { BaseAgent } from '../BaseAgent/index'"
  );
  
  content = content.replace(
    /import \{[^}]*BaseAgentDependencies[^}]*\} from ['"][^'"]+['"]/g,
    (match) => {
      if (match.includes('../BaseAgent/types')) return match;
      return match.replace(/from ['"][^'"]+['"]/, "from '../BaseAgent/types'");
    }
  );
  
  // Add BaseAgent types import if not present
  if (!content.includes("from '../BaseAgent/types'") && !content.includes("from '../BaseAgent'")) {
    const firstImport = content.match(/import .* from/);
    if (firstImport) {
      content = content.replace(
        firstImport[0],
        `import { BaseAgentConfig, BaseAgentDependencies, AgentStatus, HealthStatus, BaseMetrics } from '../BaseAgent/types';\n${firstImport[0]}`
      );
    }
  }
  
  // Update constructor
  content = content.replace(
    /constructor\s*\([^)]*\)\s*{[^}]*super\([^)]*\);?[^}]*}/gs,
    (match) => {
      return `constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    // Initialize agent-specific properties here
  }`;
    }
  );
  
  // Update config references
  content = content.replace(/this\.config\.metricsEnabled/g, 'this.config.metrics.enabled');
  content = content.replace(/config\.metricsEnabled/g, 'config.metrics.enabled');
  content = content.replace(/this\.config\.retryConfig\.maxRetries/g, 'this.config.retry.maxRetries');
  content = content.replace(/this\.config\.retryConfig\.backoffMs/g, 'this.config.retry.backoffMs');
  content = content.replace(/this\.config\.retryConfig\.maxBackoffMs/g, 'this.config.retry.maxBackoffMs');
  
  // Remove any duplicate BaseAgent methods
  const methodsToRemove = [
    'protected async initialize(): Promise<void>',
    'protected async process(): Promise<void>',
    'protected async cleanup(): Promise<void>',
    'protected async checkHealth(): Promise<HealthStatus>',
    'protected async collectMetrics(): Promise<BaseMetrics>'
  ];

  methodsToRemove.forEach(method => {
    const methodRegex = new RegExp(`\\s*${method}\\s*{[^}]*}`, 'gs');
    content = content.replace(methodRegex, '');
  });
  
  // Add required methods if missing
  const requiredMethods = [
    { name: 'initialize', signature: 'protected async initialize(): Promise<void>' },
    { name: 'process', signature: 'protected async process(): Promise<void>' },
    { name: 'cleanup', signature: 'protected async cleanup(): Promise<void>' },
    { name: 'checkHealth', signature: 'protected async checkHealth(): Promise<HealthStatus>' },
    { name: 'collectMetrics', signature: 'protected async collectMetrics(): Promise<BaseMetrics>' }
  ];
  
  requiredMethods.forEach(({ name, signature }) => {
    // Check if method already exists with proper signature
    const methodRegex = new RegExp(`${signature}\\s*{[^}]*}`, 'gs');
    if (!content.match(methodRegex)) {
      let methodBody = '';
      
      if (name === 'checkHealth') {
        methodBody = `${signature} {
    ${addTodo(filePath, name)}
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }`;
      } else if (name === 'collectMetrics') {
        methodBody = `${signature} {
    ${addTodo(filePath, name)}
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }`;
      } else {
        methodBody = `${signature} {
    ${addTodo(filePath, name)}
  }`;
      }
      
      // Add method before the closing brace of the class
      content = content.replace(/}\s*$/, `\n  ${methodBody}\n}`);
    }
  });
  
  fs.writeFileSync(filePath, content);
  if (!migrationLog.find(log => log.file === filePath)) {
    migrationLog.push({ file: filePath, todos: [] });
  }
}

// Migrate test files
function migrateTestFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`Migrating test: ${filePath}...`);
  
  // Update imports
  content = content.replace(
    /import \{[^}]*(?:AgentConfig|BaseAgentConfig)[^}]*\} from ['"][^'"]+['"]/g,
    "import { BaseAgentConfig, BaseAgentDependencies } from '@shared/types/baseAgent'"
  );
  
  // Update mock configs
  content = content.replace(
    /const \w+Config[^=]*=\s*{[^}]+}/gs,
    (match) => {
      if (match.includes('metrics:') && match.includes('enabled:')) {
        return match; // Already migrated
      }
      
      let newConfig = match;
      
      // Replace flat config with nested
      newConfig = newConfig.replace(/metricsEnabled:\s*(true|false)/g, 'metrics: { enabled: $1, interval: 60 }');
      newConfig = newConfig.replace(/retryConfig:\s*{([^}]+)}/g, 'retry: {$1}');
      
      // Add missing required fields
      if (!newConfig.includes('name:')) {
        newConfig = newConfig.replace('{', '{\n  name: \'TestAgent\',');
      }
      if (!newConfig.includes('version:')) {
        newConfig = newConfig.replace('{', '{\n  version: \'0.0.1\',');
      }
      if (!newConfig.includes('enabled:')) {
        newConfig = newConfig.replace('{', '{\n  enabled: true,');
      }
      if (!newConfig.includes('logLevel:')) {
        newConfig = newConfig.replace('{', '{\n  logLevel: \'info\',');
      }
      if (!newConfig.includes('metrics:')) {
        newConfig = newConfig.replace('}', ',\n  metrics: { enabled: false, interval: 60 }\n}');
      }
      if (!newConfig.includes('health:')) {
        newConfig = newConfig.replace('}', ',\n  health: { enabled: false, interval: 30 }\n}');
      }
      if (!newConfig.includes('retry:')) {
        newConfig = newConfig.replace('}', ',\n  retry: { maxRetries: 0, backoffMs: 200, maxBackoffMs: 500 }\n}');
      }
      
      return newConfig;
    }
  );
  
  // Add mock dependencies if needed
  if (!content.includes('BaseAgentDependencies') && content.includes('new ') && content.includes('Agent')) {
    content = content.replace(
      /const (\w+) = new \w+Agent\([^)]*\)/g,
      (match, varName) => {
        return `const mockDeps: BaseAgentDependencies = {
  supabase: {} as any,
  logger: { info: jest.fn(), error: jest.fn() } as any,
  errorHandler: { withRetry: (fn: any) => fn() } as any
};

${match.replace(/\)/, ', mockDeps)')}`;
      }
    );
  }
  
  fs.writeFileSync(filePath, content);
  migrationLog.push({ file: filePath, todos: [] });
}

// Migrate mock config files
function migrateMockConfig(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`Migrating mock config: ${filePath}...`);
  
  // Update imports
  content = content.replace(
    /import \{[^}]*AgentConfig[^}]*\} from ['"][^'"]+['"]/g,
    "import { BaseAgentConfig } from '@shared/types/baseAgent'"
  );
  
  // Update config object
  content = content.replace(
    /export const \w+Config:\s*\w*AgentConfig\s*=\s*{[^}]+}/gs,
    (match) => {
      const configName = match.match(/export const (\w+)Config/)?.[1] || 'Test';
      
      return `export const ${configName}Config: BaseAgentConfig = {
  name: '${configName}',
  version: '0.0.1',
  enabled: true,
  logLevel: 'info',
  metrics: { enabled: true, interval: 60 },
  health: { enabled: true, interval: 30 },
  retry: { maxRetries: 3, backoffMs: 200, maxBackoffMs: 5000 }
}`;
    }
  );
  
  fs.writeFileSync(filePath, content);
  migrationLog.push({ file: filePath, todos: [] });
}

// Main migration
async function migrate() {
  console.log('Starting BaseAgent v2 migration...\n');
  
  // Remove old BaseAgent.ts file
  const oldBaseAgent = 'src/agents/BaseAgent.ts';
  if (fs.existsSync(oldBaseAgent)) {
    fs.unlinkSync(oldBaseAgent);
    console.log('Removed old BaseAgent.ts');
  }
  
  // Migrate all agent classes
  const agentFiles = glob.sync('src/agents/**/index.ts', {
    ignore: ['**/BaseAgent/**', '**/__tests__/**', '**/test/**']
  });
  
  agentFiles.forEach(migrateAgentClass);
  
  // Migrate test files
  const testFiles = glob.sync('src/**/*.{test,spec}.ts');
  testFiles.forEach(migrateTestFile);
  
  // Migrate mock configs
  const mockConfigs = glob.sync('src/test/mocks/**/*.ts');
  mockConfigs.forEach(migrateMockConfig);
  
  // Generate migration summary
  generateMigrationSummary();
  
  console.log('\nMigration complete! See MIGRATION_SUMMARY.md for details.');
}

function generateMigrationSummary() {
  let summary = `# BaseAgent v2 Migration Summary

Generated on: ${new Date().toISOString()}

## Files Modified

Total files modified: ${migrationLog.length}

### Agent Classes
`;

  const agentFiles = migrationLog.filter(log => log.file.includes('/agents/') && !log.file.includes('test'));
  agentFiles.forEach(({ file, todos }) => {
    summary += `- ${file}\n`;
    if (todos.length > 0) {
      todos.forEach(todo => {
        summary += `  - ${todo}\n`;
      });
    }
  });

  summary += `\n### Test Files\n`;
  const testFiles = migrationLog.filter(log => log.file.includes('test') || log.file.includes('spec'));
  testFiles.forEach(({ file }) => {
    summary += `- ${file}\n`;
  });

  summary += `\n### Mock Configs\n`;
  const mockFiles = migrationLog.filter(log => log.file.includes('mock'));
  mockFiles.forEach(({ file }) => {
    summary += `- ${file}\n`;
  });

  summary += `\n## TODO Items

The following files contain TODO markers that need business logic restoration:

`;

  const todosFiles = migrationLog.filter(log => log.todos.length > 0);
  todosFiles.forEach(({ file, todos }) => {
    summary += `### ${file}\n`;
    todos.forEach(todo => {
      summary += `- ${todo}\n`;
    });
    summary += '\n';
  });

  summary += `\n## Next Steps

1. Review each TODO marker and restore the business logic
2. Run tests to ensure all agents are working correctly
3. Update any agent-specific configurations that may have been missed
4. Remove any deprecated code or utilities that are now handled by BaseAgent
`;

  fs.writeFileSync('MIGRATION_SUMMARY.md', summary);
}

// Run migration
migrate().catch(console.error); 