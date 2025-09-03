const fs = require('fs');
const path = require('path');

// Manual fixes for specific files and specific error patterns
const manualFixes = [
  {
    file: 'src/services/abTesting.ts',
    patterns: [
      {
        search: /startDate:\s*new Date\(\)/g,
        replace: 'startDate: toISOString(new Date())',
      },
      {
        search: /endDate:\s*new Date\(\)/g,
        replace: 'endDate: toISOString(new Date())',
      },
      {
        search: /createdAt:\s*new Date\(\)/g,
        replace: 'createdAt: toISOString(new Date())',
      },
    ],
  },
  {
    file: 'src/services/aiPoweredService.ts',
    patterns: [
      {
        search: /lastUpdated:\s*new Date\(\)/g,
        replace: 'lastUpdated: toISOString(new Date())',
      },
    ],
  },
  {
    file: 'src/services/automatedThreadService.ts',
    patterns: [
      {
        search: /lastProcessed:\s*new Date\(\)/g,
        replace: 'lastProcessed: toISOString(new Date())',
      },
      {
        search: /timestamp:\s*new Date\(\)/g,
        replace: 'timestamp: toISOString(new Date())',
      },
    ],
  },
  {
    file: 'src/services/gradingService.ts',
    patterns: [
      {
        search: /gradedAt:\s*new Date\(\)/g,
        replace: 'gradedAt: toISOString(new Date())',
      },
    ],
  },
];

function applyManualFixes() {
  manualFixes.forEach(({ file, patterns }) => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Ensure import exists
    if (!content.includes("from '../utils/dateUtils'")) {
      const lines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex !== -1) {
        lines.splice(
          lastImportIndex + 1,
          0,
          `import { toISOString, toDate } from '../utils/dateUtils';`
        );
        content = lines.join('\n');
        modified = true;
      }
    }

    // Apply patterns
    patterns.forEach(({ search, replace }) => {
      if (search.test(content)) {
        content = content.replace(search, replace);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Manual fixes applied: ${file}`);
    } else {
      console.log(`📝 No manual fixes needed: ${file}`);
    }
  });
}

// Also create a comprehensive string method fix script
function fixAllStringMethodCalls() {
  const filesToCheck = [
    'src/handlers/eventHandler.ts',
    'src/handlers/onboardingModalHandler.ts',
    'src/middleware/enterpriseMiddleware.ts',
    'src/routes/health.ts',
    'src/routes/monitoring.ts',
    'src/services/adminOverrideService.ts',
    'src/services/advancedAnalyticsService.ts',
    'src/services/automatedThreadService.ts',
    'src/services/capperService.ts',
    'src/services/dmService.ts',
    'src/services/gradingService.ts',
  ];

  filesToCheck.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Ensure import exists
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
          `import { toISOString, toDate, getHours, toLocaleDateString } from '${importPath}';`
        );
        content = lines.join('\n');
        modified = true;
      }
    }

    // Fix remaining string method calls with very specific patterns
    const methodFixes = [
      // Fix simple variable.toISOString() where variable is likely a string
      {
        pattern: /\b([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.toISOString\(\)/g,
        replacement: (match, varName) => {
          // Skip if it's clearly a Date constructor or method chain that should be preserved
          if (
            varName.includes('Date') ||
            varName.startsWith('new') ||
            varName.includes('toDate') ||
            varName.includes('toISOString') ||
            varName.match(/\.(getTime|valueOf|toString|toJSON)\b/)
          ) {
            return match;
          }
          return `toISOString(${varName})`;
        },
      },

      // Fix getHours calls on strings
      {
        pattern: /\b([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.getHours\(\)/g,
        replacement: (match, varName) => {
          if (varName.includes('Date') || varName.startsWith('new')) return match;
          return `getHours(${varName})`;
        },
      },

      // Fix toLocaleDateString calls on strings
      {
        pattern: /\b([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.toLocaleDateString\(\)/g,
        replacement: (match, varName) => {
          if (varName.includes('Date') || varName.startsWith('new')) return match;
          return `toLocaleDateString(${varName})`;
        },
      },

      // Fix getDay calls on strings
      {
        pattern: /\b([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.getDay\(\)/g,
        replacement: (match, varName) => {
          if (varName.includes('Date') || varName.startsWith('new')) return match;
          return `toDate(${varName}).getDay()`;
        },
      },
    ];

    methodFixes.forEach(fix => {
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
      console.log(`✅ String method fixes applied: ${filePath}`);
    }
  });
}

console.log('🔧 Applying manual fixes...\n');
applyManualFixes();

console.log('\n🔧 Fixing string method calls...\n');
fixAllStringMethodCalls();

console.log('\n✨ Manual fixes completed!');
