const fs = require('fs');
const path = require('path');

// Get all files that have TypeScript errors from the last check
const filesWithErrors = [
  'src/handlers/eventHandler.ts',
  'src/handlers/onboardingModalHandler.ts',
  'src/middleware/enterpriseMiddleware.ts',
  'src/routes/health.ts',
  'src/routes/monitoring.ts',
  'src/services/abTesting.ts',
  'src/services/adminOverrideService.ts',
  'src/services/advancedAnalyticsService.ts',
  'src/services/aiPoweredService.ts',
  'src/services/automatedThreadService.ts',
  'src/services/capperService.ts',
  'src/services/database.ts',
  'src/services/dmService.ts',
  'src/services/gradingService.ts',
];

function fixFileToZeroErrors(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Ensure dateUtils import is present and comprehensive
  if (!content.includes("from '../utils/dateUtils'") && !content.includes("from './dateUtils'")) {
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex !== -1) {
      const importPath = filePath.includes('src/utils/') ? './dateUtils' : '../utils/dateUtils';
      lines.splice(
        lastImportIndex + 1,
        0,
        `import { toISOString, toDate, getHours, getMinutes, getFullYear, getMonth, getDate, setDate, toLocaleDateString } from '${importPath}';`
      );
      content = lines.join('\n');
      modified = true;
    }
  }

  // Comprehensive fixes for all remaining error patterns
  const zeroErrorFixes = [
    // 1. Fix ALL remaining .toISOString() calls on strings
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$.]*)\.toISOString\(\)/g,
      replacement: (match, varName) => {
        // Skip if it's clearly a Date constructor or already wrapped or is a method chain
        if (
          varName.includes('toISOString') ||
          varName.includes('toDate') ||
          varName.includes('Date') ||
          varName === 'new' ||
          varName.startsWith('new ') ||
          varName.endsWith('.toISOString')
        ) {
          return match;
        }
        return `toISOString(${varName})`;
      },
    },

    // 2. Fix triple/quadruple toISOString chains that were missed
    {
      pattern: /toISOString\([^)]*\)\.toISOString\(\)\.toISOString\(\)/g,
      replacement: match => {
        const innerMatch = match.match(/toISOString\(([^)]*)\)/);
        return innerMatch ? `toISOString(${innerMatch[1]})` : match;
      },
    },

    // 3. Fix all Date assignment to string fields
    {
      pattern: /(\w+):\s*new Date\(\)/g,
      replacement: '$1: toISOString(new Date())',
    },

    {
      pattern: /(\w+)\s*=\s*new Date\(\)/g,
      replacement: '$1 = toISOString(new Date())',
    },

    // 4. Fix startDate/endDate/createdAt specifically
    {
      pattern:
        /(startDate|endDate|createdAt|lastUpdated|lastProcessed|timestamp|gradedAt):\s*new Date\(\)/g,
      replacement: '$1: toISOString(new Date())',
    },

    // 5. Fix all Date method calls on strings
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$.]*)\.getHours\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        return `getHours(${varName})`;
      },
    },

    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$.]*)\.getDay\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        return `toDate(${varName}).getDay()`;
      },
    },

    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$.]*)\.toLocaleDateString\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        return `toLocaleDateString(${varName})`;
      },
    },

    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$.]*)\.toLocaleDateString\([^)]+\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        const argsMatch = match.match(/\.toLocaleDateString\(([^)]+)\)/);
        const args = argsMatch ? argsMatch[1] : '';
        return `toLocaleDateString(${varName}${args ? ', ' + args : ''})`;
      },
    },

    // 6. Fix Date comparison operations
    {
      pattern: /(\w+)\s*>\s*new Date\(\)/g,
      replacement: 'toDate($1) > new Date()',
    },

    {
      pattern: /new Date\([^)]*\)\s*>\s*(\w+)/g,
      replacement: (match, rightSide) => {
        const dateMatch = match.match(/new Date\(([^)]*)\)/);
        const dateArg = dateMatch ? dateMatch[1] : '';
        return `new Date(${dateArg}) > toDate(${rightSide})`;
      },
    },

    // 7. Fix toLocaleDateString with 2 arguments error
    {
      pattern: /toLocaleDateString\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g,
      replacement: 'toLocaleDateString($1, $3)',
    },

    // 8. Fix specific expiresAt assignment patterns
    {
      pattern: /expiresAt:\s*toISOString\(new Date\(/g,
      replacement: 'expiresAt: toISOString(new Date(',
    },

    // 9. Fix missing closing parenthesis issues
    {
      pattern: /toISOString\(new Date\([^)]*$/gm,
      replacement: match => match + '))',
    },
  ];

  // Apply all fixes
  zeroErrorFixes.forEach(fix => {
    if (typeof fix.replacement === 'function') {
      const newContent = content.replace(fix.pattern, fix.replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    } else {
      if (fix.pattern.test(content)) {
        content = content.replace(fix.pattern, fix.replacement);
        modified = true;
      }
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Zero-error fixes applied: ${filePath}`);
  } else {
    console.log(`📝 No additional fixes needed: ${filePath}`);
  }
}

// Apply zero-error fixes to all remaining problematic files
console.log('🎯 Starting FINAL zero-error fix script...\n');
filesWithErrors.forEach(fixFileToZeroErrors);
console.log('\n✨ Zero-error fixes completed!');
