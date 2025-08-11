const fs = require('fs');
const path = require('path');

// Files with remaining specific issues
const specificFixes = [
  {
    file: 'src/services/abTesting.ts',
    fixes: [
      {
        pattern: /startDate: new Date\(\),/g,
        replacement: 'startDate: toISOString(new Date()),',
      },
      {
        pattern: /endDate: new Date\(\),/g,
        replacement: 'endDate: toISOString(new Date()),',
      },
      {
        pattern: /createdAt: new Date\(\)/g,
        replacement: 'createdAt: toISOString(new Date())',
      },
    ],
  },
  {
    file: 'src/services/adminOverrideService.ts',
    fixes: [
      {
        pattern: /expiresAt: new Date\(/g,
        replacement: 'expiresAt: toISOString(new Date(',
      },
    ],
  },
  {
    file: 'src/services/aiPoweredService.ts',
    fixes: [
      {
        pattern: /lastUpdated: new Date\(\)/g,
        replacement: 'lastUpdated: toISOString(new Date())',
      },
    ],
  },
  {
    file: 'src/services/automatedThreadService.ts',
    fixes: [
      {
        pattern: /lastProcessed: new Date\(\)/g,
        replacement: 'lastProcessed: toISOString(new Date())',
      },
      {
        pattern: /timestamp: new Date\(\)/g,
        replacement: 'timestamp: toISOString(new Date())',
      },
    ],
  },
  {
    file: 'src/services/gradingService.ts',
    fixes: [
      {
        pattern: /gradedAt: new Date\(\)/g,
        replacement: 'gradedAt: toISOString(new Date())',
      },
    ],
  },
  {
    file: 'src/services/database.ts',
    fixes: [
      {
        pattern: /expires_at\s*>\s*new Date\(\)/g,
        replacement: 'toDate(expires_at) > new Date()',
      },
    ],
  },
  {
    file: 'src/services/dmService.ts',
    fixes: [
      {
        pattern: /toLocaleDateString\([^)]*,\s*[^)]*\)/g,
        replacement: 'toLocaleDateString(date)',
      },
    ],
  },
];

function applySpecificFixes() {
  specificFixes.forEach(({ file, fixes }) => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Ensure dateUtils import exists
    if (!content.includes("from '../utils/dateUtils'") && !content.includes("from './dateUtils'")) {
      const lines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex !== -1) {
        const importPath = file.includes('src/utils/') ? './dateUtils' : '../utils/dateUtils';
        lines.splice(
          lastImportIndex + 1,
          0,
          `import { toISOString, toDate } from '${importPath}';`
        );
        content = lines.join('\n');
        modified = true;
      }
    }

    // Apply specific fixes
    fixes.forEach(fix => {
      if (fix.pattern.test(content)) {
        content = content.replace(fix.pattern, fix.replacement);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Applied specific fixes: ${file}`);
    } else {
      console.log(`📝 No specific fixes needed: ${file}`);
    }
  });
}

console.log('🔧 Applying final specific fixes...\n');
applySpecificFixes();
console.log('\n✨ Final cleanup completed!');
