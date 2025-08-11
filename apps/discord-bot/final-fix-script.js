const fs = require('fs');
const path = require('path');

// Additional files that need fixes based on the error output
const additionalFilesToFix = [
  'src/services/advancedAnalyticsService.ts',
  'src/services/agents.ts',
  'src/services/aiCoaching.ts',
  'src/services/aiPoweredService.ts',
  'src/services/automatedThreadService.ts',
  'src/services/capperService.ts',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Add dateUtils import if not present
  if (
    !content.includes('import { toISOString') &&
    !content.includes("from '../utils/dateUtils'") &&
    !content.includes("from './dateUtils'")
  ) {
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

  // Fix various date/string issues
  const fixes = [
    // Fix multiple chained toISOString calls
    {
      pattern: /new Date\(\)\s*(?:\.toISOString\(\)\s*){2,}/g,
      replacement: 'toISOString(new Date())',
    },

    // Fix .toISOString() calls on variables that might be strings
    {
      pattern: /(\w+)\.toISOString\(\)/g,
      replacement: (match, varName) => {
        // Don't replace if it's clearly a Date constructor
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `toISOString(${varName})`;
      },
    },

    // Fix Date method calls on strings
    {
      pattern: /(\w+)\.getHours\(\)/g,
      replacement: (match, varName) => {
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getHours(${varName})`;
      },
    },

    {
      pattern: /(\w+)\.getMinutes\(\)/g,
      replacement: (match, varName) => {
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getMinutes(${varName})`;
      },
    },

    {
      pattern: /(\w+)\.getFullYear\(\)/g,
      replacement: (match, varName) => {
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getFullYear(${varName})`;
      },
    },

    {
      pattern: /(\w+)\.getMonth\(\)/g,
      replacement: (match, varName) => {
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getMonth(${varName})`;
      },
    },

    {
      pattern: /(\w+)\.getDate\(\)/g,
      replacement: (match, varName) => {
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getDate(${varName})`;
      },
    },

    {
      pattern: /(\w+)\.setDate\(([^)]+)\)/g,
      replacement: (match, varName, arg) => {
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `${varName} = setDate(${varName}, ${arg})`;
      },
    },

    {
      pattern: /(\w+)\.toLocaleDateString\(\)/g,
      replacement: (match, varName) => {
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `toLocaleDateString(${varName})`;
      },
    },

    {
      pattern: /(\w+)\.getDay\(\)/g,
      replacement: (match, varName) => {
        if (varName === 'Date()' || varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `toDate(${varName}).getDay()`;
      },
    },
  ];

  // Apply all fixes
  fixes.forEach(fix => {
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
    console.log(`✅ Fixed: ${filePath}`);
  } else {
    console.log(`📝 No changes needed: ${filePath}`);
  }
}

// Fix all additional files
console.log('🔧 Starting Phase 1: Fixing remaining systematic Date/string errors...\n');
additionalFilesToFix.forEach(fixFile);
console.log('\n✨ Phase 1 completed!');
