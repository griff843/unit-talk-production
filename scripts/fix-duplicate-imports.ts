import * as fs from 'fs/promises';
import * as glob from 'glob';

async function fixDuplicateImports() {
  const files = glob.sync('src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });

  for (const file of files) {
    if (file.endsWith('logger.ts')) continue;

    let content = await fs.readFile(file, 'utf8');
    let modified = false;

    // Fix duplicate StandardLogger imports
    const standardLoggerImports = content.match(/import.*?StandardLogger.*?from.*?['"].*?['"]/g) || [];
    if (standardLoggerImports.length > 1) {
      content = content.replace(/import.*?StandardLogger.*?from.*?['"].*?['"]\n?/g, '');
      content = `import { StandardLogger } from '../utils/logger';\n${content}`;
      modified = true;
    }

    // Fix duplicate Logger imports
    const loggerImports = content.match(/import.*?Logger.*?from.*?['"].*?['"]/g) || [];
    if (loggerImports.length > 1) {
      content = content.replace(/import.*?Logger.*?from.*?['"].*?['"]\n?/g, '');
      content = `import { Logger } from '../utils/logger';\n${content}`;
      modified = true;
    }

    // Fix incorrect import paths
    content = content.replace(/from ["']\.\.\/utils\/logger["']/g, "from '../../../utils/logger'");
    content = content.replace(/from ["']\.\.\/\.\.\/utils\/logger["']/g, "from '../../utils/logger'");

    if (modified) {
      await fs.writeFile(file, content, 'utf8');
      console.log(`Fixed imports in ${file}`);
    }
  }
}

fixDuplicateImports().catch(console.error);
