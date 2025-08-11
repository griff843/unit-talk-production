const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/commands/interactive-tutorial.ts',
  'src/commands/portfolio.ts',
  'src/commands/trends.ts',
  'src/handlers/buttonHandler.ts',
  'src/handlers/commandHandler.ts',
];

function addMissingImports(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Check if toGuildMember is used but not imported
  if (content.includes('toGuildMember') && !content.includes("from '../utils/discordUtils'")) {
    const lines = content.split('\n');
    let lastImportIndex = -1;

    // Find the last import statement
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex !== -1) {
      const importPath = filePath.includes('src/utils/')
        ? './discordUtils'
        : '../utils/discordUtils';
      lines.splice(lastImportIndex + 1, 0, `import { toGuildMember } from '${importPath}';`);
      content = lines.join('\n');
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Added missing imports: ${filePath}`);
  } else {
    console.log(`📝 Imports already correct: ${filePath}`);
  }
}

console.log('🔧 Adding missing imports...\n');
filesToFix.forEach(addMissingImports);
console.log('\n✨ Import fixes completed!');
