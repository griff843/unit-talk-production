const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getFilesWithErrors() {
  try {
    // Get list of files with TypeScript errors
    const tscOutput = execSync('npx tsc --noEmit', { cwd: __dirname, encoding: 'utf8' });
    return [];
  } catch (error) {
    const errorOutput = error.stdout || error.stderr || '';
    const files = new Set();

    // Extract file names from error output
    const lines = errorOutput.split('\n');
    lines.forEach(line => {
      const match = line.match(/^([^(]+\.ts)\(/);
      if (match) {
        files.add(match[1]);
      }
    });

    return Array.from(files);
  }
}

function aggressivelyFixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Ensure dateUtils import is comprehensive
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

  // Aggressive fixes for all remaining patterns
  const aggressiveFixes = [
    // 1. Fix ALL double/triple toISOString calls
    {
      pattern: /toISOString\([^)]*\)(?:\.toISOString\(\))+/g,
      replacement: match => {
        // Extract the innermost argument
        const innerMatch = match.match(/toISOString\(([^)]*)\)/);
        if (innerMatch) {
          return `toISOString(${innerMatch[1]})`;
        }
        return 'toISOString(new Date())';
      },
    },

    // 2. Fix simple variable.toISOString() patterns very aggressively
    {
      pattern: /\b([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.toISOString\(\)/g,
      replacement: (match, varName) => {
        // Be very specific about what NOT to replace
        if (
          varName === 'Date' ||
          varName.includes('new') ||
          varName.includes('toDate') ||
          varName.includes('toISOString') ||
          varName.match(/^Date\b/) ||
          varName.startsWith('new ')
        ) {
          return match;
        }
        return `toISOString(${varName})`;
      },
    },

    // 3. Fix all Date assignment patterns
    {
      pattern: /(\w+):\s*new Date\(\)/g,
      replacement: '$1: toISOString(new Date())',
    },

    {
      pattern: /(\w+)\s*=\s*new Date\(\)/g,
      replacement: '$1 = toISOString(new Date())',
    },

    // 4. Fix all string method calls
    {
      pattern: /\b([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.getHours\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName.startsWith('new')) return match;
        return `getHours(${varName})`;
      },
    },

    {
      pattern: /\b([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.toLocaleDateString\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName.startsWith('new')) return match;
        return `toLocaleDateString(${varName})`;
      },
    },

    {
      pattern: /\b([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\.getDay\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName.startsWith('new')) return match;
        return `toDate(${varName}).getDay()`;
      },
    },

    // 5. Fix toLocaleDateString with 2 args error
    {
      pattern: /\.toLocaleDateString\([^,)]+,\s*[^,)]+,\s*[^)]+\)/g,
      replacement: match => {
        // Extract first and third arguments only
        const args = match.match(/\.toLocaleDateString\(([^,)]+),\s*[^,)]+,\s*([^)]+)\)/);
        if (args) {
          return `.toLocaleDateString(${args[1]}, ${args[2]})`;
        }
        return match;
      },
    },

    // 6. Fix specific Date comparison issues
    {
      pattern: /new Date\([^)]*\)\s*>\s*(\w+)/g,
      replacement: (match, rightVar) => {
        const dateMatch = match.match(/new Date\(([^)]*)\)/);
        const dateArg = dateMatch ? dateMatch[1] : '';
        return `new Date(${dateArg}) > toDate(${rightVar})`;
      },
    },
  ];

  // Apply all aggressive fixes
  aggressiveFixes.forEach(fix => {
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

  // Apply line-by-line fixes for very specific patterns
  const lines = content.split('\n');
  let lineModified = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Fix specific startDate/endDate/createdAt assignments
    if (line.includes('startDate:') && line.includes('new Date()')) {
      lines[i] = line.replace(/startDate:\s*new Date\(\)/, 'startDate: toISOString(new Date())');
      lineModified = true;
    }

    if (line.includes('endDate:') && line.includes('new Date()')) {
      lines[i] = line.replace(/endDate:\s*new Date\(\)/, 'endDate: toISOString(new Date())');
      lineModified = true;
    }

    if (line.includes('createdAt:') && line.includes('new Date()')) {
      lines[i] = line.replace(/createdAt:\s*new Date\(\)/, 'createdAt: toISOString(new Date())');
      lineModified = true;
    }

    if (line.includes('lastUpdated:') && line.includes('new Date()')) {
      lines[i] = line.replace(
        /lastUpdated:\s*new Date\(\)/,
        'lastUpdated: toISOString(new Date())'
      );
      lineModified = true;
    }

    if (line.includes('gradedAt:') && line.includes('new Date()')) {
      lines[i] = line.replace(/gradedAt:\s*new Date\(\)/, 'gradedAt: toISOString(new Date())');
      lineModified = true;
    }

    if (line.includes('lastProcessed:') && line.includes('new Date()')) {
      lines[i] = line.replace(
        /lastProcessed:\s*new Date\(\)/,
        'lastProcessed: toISOString(new Date())'
      );
      lineModified = true;
    }

    if (line.includes('timestamp:') && line.includes('new Date()')) {
      lines[i] = line.replace(/timestamp:\s*new Date\(\)/, 'timestamp: toISOString(new Date())');
      lineModified = true;
    }
  }

  if (lineModified) {
    content = lines.join('\n');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Aggressively fixed: ${filePath}`);
  }
}

// Get files with errors and fix them
console.log('🎯 Starting AGGRESSIVE final fix...\n');

const filesWithErrors = getFilesWithErrors();
console.log(`Found ${filesWithErrors.length} files with errors`);

if (filesWithErrors.length === 0) {
  // If we can't detect files, fix all known problematic files
  const knownFiles = [
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
    'src/services/dmService.ts',
    'src/services/gradingService.ts',
  ];

  knownFiles.forEach(aggressivelyFixFile);
} else {
  filesWithErrors.forEach(aggressivelyFixFile);
}

console.log('\n✨ Aggressive fixes completed!');
