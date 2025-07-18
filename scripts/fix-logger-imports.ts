import * as fs from 'fs/promises';
import * as glob from 'glob';

async function fixLoggerImports() {
  try {
    // Find all TypeScript files in src directory recursively
    const files = glob.sync('src/**/*.ts', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of files) {
      let content = await fs.readFile(file, 'utf8');
      let modified = false;

      // Fix incorrect logger imports
      if (content.includes('import { Logger } from "../utils/logger"')) {
        content = content.replace(
          'import { Logger } from "../utils/logger"',
          'import { Logger } from "../../utils/logger"'
        );
        modified = true;
      }

      // Fix missing createLogger imports
      if (content.includes('createLogger') && !content.includes('import { createLogger }')) {
        content = `import { StandardLogger } from '../../utils/logger';\n${content}`;
        // Replace createLogger usage with StandardLogger
        content = content.replace(/createLogger\(/g, 'new StandardLogger(');
        modified = true;
      }

      // Remove duplicate Logger imports
      const loggerImports = content.match(/import.*Logger.*from.*logger.*;/g) || [];
      if (loggerImports.length > 1) {
        // Keep only the first import
        const firstImport = loggerImports[0];
        content = content.replace(/import.*Logger.*from.*logger.*;/g, '');
        content = firstImport + '\n' + content;
        modified = true;
      }

      if (modified) {
        await fs.writeFile(file, content, 'utf8');
        console.log(`Fixed logger imports in ${file}`);
      }
    }

    console.log('Logger import fixes completed');
  } catch (error) {
    console.error('Error fixing logger imports:', error);
  }
}

fixLoggerImports().catch(console.error);
