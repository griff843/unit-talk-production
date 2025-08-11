const fs = require('fs');
const path = require('path');

// All remaining files with errors
const filesToFix = [
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

function fixRemainingErrors(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Add dateUtils import if needed
  if (!content.includes("from '../utils/dateUtils'") && !content.includes("from './dateUtils'")) {
    const needsDateUtils =
      content.includes('.toISOString()') ||
      content.includes('.setDate(') ||
      content.includes('.getDate()') ||
      content.includes('.getHours()') ||
      content.includes('.getDay()') ||
      content.includes('.toLocaleDateString()') ||
      content.includes("Type 'string' is not assignable to type 'Date'") ||
      content.includes("Property 'toISOString' does not exist on type 'string'");

    if (needsDateUtils) {
      const lines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ') && !lines[i].includes('dateUtils')) {
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
  }

  const comprehensiveFixes = [
    // Fix all remaining .toISOString() calls on strings
    {
      pattern: /(\w+)\.toISOString\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new' || varName.includes('toISOString')) {
          return match;
        }
        return `toISOString(${varName})`;
      },
    },

    // Fix setDate operations on strings
    {
      pattern: /(\w+)\.setDate\(([^)]+)\)/g,
      replacement: (match, varName, arg) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `${varName} = setDate(${varName}, ${arg})`;
      },
    },

    // Fix getDate operations on strings
    {
      pattern: /(\w+)\.getDate\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getDate(${varName})`;
      },
    },

    // Fix getHours operations on strings
    {
      pattern: /(\w+)\.getHours\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getHours(${varName})`;
      },
    },

    // Fix getDay operations on strings
    {
      pattern: /(\w+)\.getDay\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `toDate(${varName}).getDay()`;
      },
    },

    // Fix toLocaleDateString operations on strings
    {
      pattern: /(\w+)\.toLocaleDateString\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `toLocaleDateString(${varName})`;
      },
    },

    // Fix Date assignment issues - replace Date assignment with string
    {
      pattern: /(\w+):\s*new Date\(\)/g,
      replacement: '$1: toISOString(new Date())',
    },

    // Fix specific Date constructor assignments
    {
      pattern: /(\w+)\s*=\s*new Date\(\)/g,
      replacement: (match, varName) => {
        // Only fix if it's clearly a string assignment context
        return `${varName} = toISOString(new Date())`;
      },
    },

    // Fix Date comparison operations (Date vs string)
    {
      pattern: /(\w+)\s*([<>]=?)\s*(['"`][^'"`]*['"`])/g,
      replacement: (match, date, op, str) => {
        return `toDate(${date}) ${op} toDate(${str})`;
      },
    },

    // Fix 'string' type being used as value
    {
      pattern: /const\s+(\w+):\s*string\s*=\s*string;/g,
      replacement: 'const $1: string = "";',
    },

    // Fix toLocaleDateString with arguments issue
    {
      pattern: /(\w+)\.toLocaleDateString\(([^)]+)\)/g,
      replacement: (match, varName, args) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `toLocaleDateString(${varName}, ${args})`;
      },
    },

    // Fix specific monitoring.ts error
    {
      pattern: /const timestamp: string = string;/g,
      replacement: 'const timestamp: string = toISOString(new Date());',
    },
  ];

  // Apply all fixes
  comprehensiveFixes.forEach(fix => {
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
    console.log(`✅ Fixed remaining errors: ${filePath}`);
  } else {
    console.log(`📝 No changes needed: ${filePath}`);
  }
}

// Phase 3: Fix all remaining errors
console.log('🔧 Starting Phase 3: Comprehensive error fixes...\n');
filesToFix.forEach(fixRemainingErrors);
console.log('\n✨ Phase 3 completed!');
