import * as fs from 'fs/promises';
import * as glob from 'glob';

async function fixLoggerPaths() {
  try {
    const files = glob.sync('src/**/*.ts', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of files) {
      let content = await fs.readFile(file, 'utf8');
      let modified = false;

      // Fix imports from "../../utils/logger"
      if (content.includes('from "../../utils/logger"')) {
        content = content.replace(
          'from "../../utils/logger"',
          'from "../utils/logger"'
        );
        modified = true;
      }

      // Fix imports from "../utils/logger"
      if (content.includes('from "../utils/logger"')) {
        const relativePath = file.split('\\').slice(0, -1).length;
        const prefix = '../'.repeat(Math.max(1, relativePath - 3));
        content = content.replace(
          'from "../utils/logger"',
          `from "${prefix}utils/logger"`
        );
        modified = true;
      }

      // Fix createLogger to StandardLogger
      if (content.includes('createLogger')) {
        content = content.replace(
          'import { createLogger }',
          'import { StandardLogger }'
        );
        content = content.replace(/createLogger\(/g, 'new StandardLogger(');
        modified = true;
      }

      // Fix Logger import
      if (content.includes('import { Logger }')) {
        const relativePath = file.split('\\').slice(0, -1).length;
        const prefix = '../'.repeat(Math.max(1, relativePath - 3));
        content = content.replace(
          /import\s*{\s*Logger\s*}\s*from\s*['"].*?['"]/,
          `import { Logger } from "${prefix}utils/logger"`
        );
        modified = true;
      }

      if (modified) {
        await fs.writeFile(file, content, 'utf8');
        console.log(`Fixed logger paths in ${file}`);
      }
    }
  } catch (error) {
    console.error('Error fixing logger paths:', error);
    process.exit(1);
  }
}

fixLoggerPaths();
