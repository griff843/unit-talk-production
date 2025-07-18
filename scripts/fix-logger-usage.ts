import * as fs from 'fs';
import { glob } from 'glob';

async function fixLoggerUsage() {
  // Find all TypeScript files
  const files = await glob('src/**/*.ts');
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    
    // Replace StandardLogger instantiations without arguments
    let newContent = content.replace(
      /new StandardLogger\(\)/g,
      'new StandardLogger({ level: "info" })'
    );
    
    // Replace createStandardLogger calls without arguments
    newContent = newContent.replace(
      /createStandardLogger\(\)/g,
      'createStandardLogger({ level: "info" })'
    );
    
    // Replace incorrect logger imports
    newContent = newContent.replace(
      /import \{ Logger \} from '\.\.\/\.\.\/(\.\.\/)?utils\/logger';/g,
      'import { Logger } from "../utils/logger";'
    );
    
    if (newContent !== content) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Fixed ${file}`);
    }
  }
}

fixLoggerUsage().catch(console.error);
