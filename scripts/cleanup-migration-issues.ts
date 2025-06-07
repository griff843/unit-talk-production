import * as fs from 'fs';
import { glob } from 'glob';

// Fix syntax issues in test files and configs
function fixSyntaxIssues() {
  console.log('Fixing syntax issues from migration...\n');

  // Find all affected files
  const affectedFiles = glob.sync([
    'src/**/*.ts',
    'test/**/*.ts'
  ]);

  affectedFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Fix incorrect metrics.enabled syntax
    const badMetricsSyntax = /metrics\.enabled:\s*(true|false)/g;
    if (badMetricsSyntax.test(content)) {
      content = content.replace(badMetricsSyntax, 'metrics: { enabled: $1, interval: 60 }');
      modified = true;
    }

    // Fix any double replacements
    content = content.replace(/metrics:\s*{\s*enabled:\s*{\s*enabled:/g, 'metrics: { enabled:');
    
    // Fix broken object syntax
    content = content.replace(/,\s*metrics:\s*{\s*enabled:\s*(true|false),\s*interval:\s*\d+\s*}\s*}/g, ',\n  metrics: { enabled: $1, interval: 60 }\n}');

    // Fix retry config issues
    const badRetrySyntax = /retry\.maxRetries:\s*\d+/g;
    if (badRetrySyntax.test(content)) {
      content = content.replace(/retry\.(maxRetries|backoffMs|maxBackoffMs):/g, (match, prop) => {
        return `retry: { ${prop}:`;
      });
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(file, content);
      console.log(`Fixed syntax in ${file}`);
    }
  });

  console.log('\nCleanup complete!');
}

// Run cleanup
fixSyntaxIssues(); 