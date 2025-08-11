const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fixDoubleToISOCalls() {
  // Get all TypeScript files
  const tsFiles = execSync('find src -name "*.ts" -type f', { cwd: __dirname, encoding: 'utf8' })
    .split('\n')
    .filter(f => f.trim());

  tsFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Fix double .toISOString() calls
    const doubleToISORegex = /toISOString\([^)]*\)\.toISOString\(\)/g;
    if (doubleToISORegex.test(content)) {
      content = content.replace(doubleToISORegex, match => {
        // Extract the inner part
        const innerMatch = match.match(/toISOString\(([^)]*)\)/);
        if (innerMatch) {
          return `toISOString(${innerMatch[1]})`;
        }
        return match;
      });
      modified = true;
    }

    // Fix simple double calls like variable.toISOString().toISOString()
    const simpleDoubleRegex = /(\w+)\.toISOString\(\)\.toISOString\(\)/g;
    if (simpleDoubleRegex.test(content)) {
      content = content.replace(simpleDoubleRegex, 'toISOString($1)');
      modified = true;
    }

    // Fix new Date().toISOString().toISOString()
    const newDateDoubleRegex = /new Date\(\)\.toISOString\(\)\.toISOString\(\)/g;
    if (newDateDoubleRegex.test(content)) {
      content = content.replace(newDateDoubleRegex, 'toISOString(new Date())');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Fixed double toISOString calls: ${filePath}`);
    }
  });
}

console.log('🔧 Fixing double toISOString calls...\n');
fixDoubleToISOCalls();
console.log('\n✨ Double toISOString fixes completed!');
