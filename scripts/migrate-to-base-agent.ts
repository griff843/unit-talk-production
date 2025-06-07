import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const AGENTS_DIR = 'src/agents';
const TEST_DIR = 'src/test';

// Patterns to replace
const replacements = [
  {
    from: /import \{ BaseAgent \} from ['"]\.\.\/BaseAgent['"]/g,
    to: "import { BaseAgent } from '../BaseAgent/index'"
  },
  {
    from: /import \{ AgentConfig, AgentStatus, AgentCommand \} from ['"]\.\.\/types\/agent['"]/g,
    to: "import { BaseAgentConfig, AgentStatus, AgentCommand } from '../BaseAgent/types'"
  },
  {
    from: /protected config: AgentConfig;/g,
    to: "protected config: BaseAgentConfig;"
  },
  {
    from: /metricsEnabled/g,
    to: "metrics.enabled"
  },
  {
    from: /retryConfig\.maxRetries/g,
    to: "retry.maxRetries"
  },
  {
    from: /retryConfig\.backoffMs/g,
    to: "retry.backoffMs"
  },
  {
    from: /retryConfig\.maxBackoffMs/g,
    to: "retry.maxBackoffMs"
  }
];

// Files to process
const files = glob.sync([
  `${AGENTS_DIR}/**/!(BaseAgent)/*.ts`,
  `${TEST_DIR}/**/*.ts`
]);

// Process each file
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  replacements.forEach(({ from, to }) => {
    if (from.test(content)) {
      content = content.replace(from, to);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});

console.log('Migration complete!'); 