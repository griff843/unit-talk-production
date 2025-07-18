import * as fs from 'fs/promises';
import * as glob from 'glob';
import * as path from 'path';

async function updateLoggerUsage() {
  const files = glob.sync('src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });

  for (const file of files) {
    if (file.endsWith('logger.ts')) continue;

    let content = await fs.readFile(file, 'utf8');
    let modified = false;

    // Calculate the relative path to utils/logger.ts
    const relativePath = path.relative(path.dirname(file), path.join(__dirname, '../src/utils')).replace(/\\/g, '/');
    const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
    
    // Fix Logger imports
    if (content.includes('SharedLogger')) {
      content = content.replace(/SharedLogger/g, 'Logger');
      modified = true;
    }

    // Update StandardLogger imports and usages
    if ((content.includes('new StandardLogger(') || content.includes('createLogger(')) && !content.includes('import { StandardLogger }')) {
      // Add StandardLogger to existing imports or create new import
      const loggerImport = `import { StandardLogger } from '${importPath}/logger';`;
      if (!content.includes(loggerImport)) {
        content = `${loggerImport}\n${content}`;
        modified = true;
      }
    }

    // Fix createLogger and createStandardLogger calls
    if (content.includes('createLogger(') || content.includes('createStandardLogger(')) {
      content = content.replace(/createLogger\(/g, 'new StandardLogger(');
      content = content.replace(/createStandardLogger\(/g, 'new StandardLogger(');
      modified = true;
    }

    if (modified) {
      await fs.writeFile(file, content, 'utf8');
      console.log(`Updated logger usage in ${file}`);
    }
  }
}

updateLoggerUsage().catch(console.error);
