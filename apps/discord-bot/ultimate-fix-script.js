const fs = require('fs');
const path = require('path');

// All files that still have errors
const allFiles = [
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
  'src/utils/discordUtils.ts',
];

function ultimateFix(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Add all necessary imports
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

  // Ultra-comprehensive fixes
  const ultimateFixes = [
    // Fix ALL .toISOString() calls on strings with very specific patterns
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*)\.toISOString\(\)/g,
      replacement: (match, varName) => {
        // Skip if it's clearly a Date constructor or already wrapped
        if (
          varName.includes('Date') ||
          varName === 'new' ||
          varName.includes('toISOString') ||
          varName.includes('toDate')
        ) {
          return match;
        }
        return `toISOString(${varName})`;
      },
    },

    // Fix ALL Date assignment issues
    {
      pattern: /(\w+):\s*new Date\(\)/g,
      replacement: '$1: toISOString(new Date())',
    },

    {
      pattern: /(\w+)\s*=\s*new Date\(\)/g,
      replacement: '$1 = toISOString(new Date())',
    },

    // Fix setDate operations
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*)\.setDate\(/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        return `${varName} = setDate(${varName}, `;
      },
    },

    // Fix getDate operations
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*)\.getDate\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        return `getDate(${varName})`;
      },
    },

    // Fix getHours operations
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*)\.getHours\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        return `getHours(${varName})`;
      },
    },

    // Fix getDay operations
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*)\.getDay\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        return `toDate(${varName}).getDay()`;
      },
    },

    // Fix toLocaleDateString operations
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*)\.toLocaleDateString\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        return `toLocaleDateString(${varName})`;
      },
    },

    // Fix toLocaleDateString with arguments
    {
      pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*)\.toLocaleDateString\([^)]+\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') return match;
        const args = match.substring(match.indexOf('(') + 1, match.lastIndexOf(')'));
        return `toLocaleDateString(${varName}, ${args})`;
      },
    },

    // Fix Date comparison operations
    {
      pattern: /(\w+)\s*>\s*new Date\(\)/g,
      replacement: 'toDate($1) > new Date()',
    },

    {
      pattern: /(\w+)\s*<\s*new Date\(\)/g,
      replacement: 'toDate($1) < new Date()',
    },

    // Fix specific known issues
    {
      pattern: /guild_id/g,
      replacement: 'user.id', // For discord utils
    },
  ];

  // Apply all fixes
  ultimateFixes.forEach(fix => {
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
    console.log(`✅ Ultimate fix applied: ${filePath}`);
  } else {
    console.log(`📝 No ultimate fixes needed: ${filePath}`);
  }
}

// Apply ultimate fixes to all files
console.log('🔧 Starting ULTIMATE fix script...\n');
allFiles.forEach(ultimateFix);
console.log('\n✨ Ultimate fixes completed!');
