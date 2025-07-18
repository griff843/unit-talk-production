import * as fs from 'fs/promises';
import * as glob from 'glob';
import * as path from 'path';

async function fixPaths() {
  const files = glob.sync('src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });

  for (const file of files) {
    let content = await fs.readFile(file, 'utf8');
    let modified = false;

    // Fix logger imports
    content = content.replace(/from ["']\.\.\/utils\/logger["']/g, "from '../../utils/logger'");
    content = content.replace(/from ["']\.\.\/\.\.\/utils\/logger["']/g, "from '../../../utils/logger'");
    
    // Fix activities imports
    content = content.replace(/from ["']\.\.\/types\/activities["']/g, "from '../types/shared/activity-results'");
    content = content.replace(/from ["']\.\.\/\.\.\/types\/activities["']/g, "from '../../types/shared/activity-results'");
    content = content.replace(/from ["']\.\.\/\.\.\/\.\.\/types\/activities["']/g, "from '../../../types/shared/activity-results'");

    // Fix Base types imports
    content = content.replace(/from ["']\.\.\/BaseAgent\/types["']/g, "from '../../types/shared/base-types'");
    content = content.replace(/from ["']\.\.\/\.\.\/BaseAgent\/types["']/g, "from '../../../types/shared/base-types'");

    // Fix error handler imports 
    content = content.replace(/from ["']\.\.\/utils\/errorHandler["']/g, "from '../../utils/errorHandler'");
    content = content.replace(/from ["']\.\.\/\.\.\/utils\/errorHandler["']/g, "from '../../../utils/errorHandler'");
    content = content.replace(/from ["']\.\.\/\.\.\/\.\.\/utils\/errorHandler["']/g, "from '../../../../utils/errorHandler'");

    await fs.writeFile(file, content, 'utf8');
    console.log(`Fixed imports in ${file}`);
  }
}

fixPaths().catch(console.error);
