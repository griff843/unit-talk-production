import * as fs from 'fs/promises';
import * as glob from 'glob';

async function fixStandardLoggerImports() {
  try {
    const files = glob.sync('src/**/*.ts', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of files) {
      let content = await fs.readFile(file, 'utf8');
      let modified = false;

      // Add StandardLogger to imports if needed
      if (content.includes('new StandardLogger(') && !content.includes('import { StandardLogger }')) {
        const importRegex = /import\s*{([^}]*)}\s*from\s*['"]([^'"]+logger[^'"]*)['"]/;
        const importMatch = content.match(importRegex);
        
        if (importMatch) {
          const imports = importMatch[1];
          const path = importMatch[2];
          const newImports = imports.includes('StandardLogger') 
            ? imports 
            : imports.trim() + ', StandardLogger';
          content = content.replace(importRegex, `import { ${newImports} } from "${path}"`);
          modified = true;
        } else {
          // Add new import
          content = `import { StandardLogger } from '../../utils/logger';\n${content}`;
          modified = true;
        }
      }

      // Fix createLogger to StandardLogger
      if (content.includes('createLogger')) {
        content = content.replace(/createLogger/g, 'StandardLogger');
        content = content.replace(/createStandardLogger/g, 'new StandardLogger');
        modified = true;
      }

      // Fix SharedLogger to Logger
      if (content.includes('SharedLogger')) {
        content = content.replace(/SharedLogger/g, 'Logger');
        modified = true;
      }

      // Fix multiple declarations of StandardLogger
      const standardLoggerDeclarations = content.match(/import\s*{\s*StandardLogger\s*}/g) || [];
      if (standardLoggerDeclarations.length > 1) {
        content = content.replace(/import\s*{\s*StandardLogger\s*}/g, '');
        content = `import { StandardLogger } from '../../utils/logger';\n${content}`;
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
    process.exit(1);
  }
}

fixStandardLoggerImports();
