const fs = require('fs');
const path = require('path');

// List of files that still have double .toISOString() calls
const filesToFix = [
  'src/handlers/onboardingModalHandler.ts',
  'src/middleware/enterpriseMiddleware.ts',
  'src/services/adminOverrideService.ts',
  'src/services/advancedAnalyticsService.ts',
  'src/services/capperService.ts',
  'src/services/dmService.ts',
  'src/services/gradingService.ts',
  'src/services/automatedThreadService.ts',
];

function fixDoubleToISOString(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Fix the specific patterns causing errors
  const fixes = [
    // Fix: toISOString(new Date()).toISOString()
    {
      pattern: /toISOString\(new Date\(\)\)\.toISOString\(\)/g,
      replacement: 'toISOString(new Date())',
    },
    // Fix: variable.toISOString() where variable is likely a string
    {
      pattern: /(\w+)\.toISOString\(\)/g,
      replacement: (match, varName) => {
        // Don't replace Date objects or method chains
        if (
          varName === 'Date' ||
          varName.includes('new') ||
          varName.includes('toDate') ||
          varName.includes('Date')
        ) {
          return match;
        }
        return `toISOString(${varName})`;
      },
    },
  ];

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
    console.log(`✅ Fixed double calls: ${filePath}`);
  } else {
    console.log(`📝 No changes needed: ${filePath}`);
  }
}

console.log('🔧 Fixing remaining double .toISOString() calls...\n');

filesToFix.forEach(fixDoubleToISOString);

console.log('\n✨ Double call fixes completed!');
