const fs = require('fs');
const path = require('path');

// Fix common build error patterns
const fixes = [
  // Fix shebang placement (already done, but good to have)
  {
    pattern: /^import[^;]+;\n#!/gm,
    replacement: (match) => {
      const parts = match.split('\n');
      return parts[1] + '\n\n' + parts[0];
    }
  },
  
  // Fix duplicate error declarations 
  {
    pattern: /catch \(error[^}]+error:/gm,
    replacement: (match) => match.replace(/error:/g, 'err:')
  },
  
  // Fix malformed function parameters with string literals
  {
    pattern: /\(\s*[^,)]+,\s*"[^"]+"\s*\)/g,
    replacement: (match) => {
      return match.replace(/"([^"]+)"/g, '$1?: string');
    }
  }
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    fixes.forEach(fix => {
      const newContent = content.replace(fix.pattern, fix.replacement);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function walkDirectory(dir, extensions = ['.ts', '.tsx']) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      walkDirectory(filePath, extensions);
    } else if (extensions.some(ext => file.endsWith(ext))) {
      fixFile(filePath);
    }
  });
}

// Run the fixes
const srcDir = path.join(__dirname, '..', 'src');
console.log('Starting build error fixes...');
walkDirectory(srcDir);
console.log('Build error fixes completed.');