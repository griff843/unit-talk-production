const fs = require('fs');
const path = require('path');

// Files that need Discord.js type fixes
const discordTypeFiles = [
  'src/commands/interactive-tutorial.ts',
  'src/commands/pick-result.ts',
  'src/commands/portfolio.ts',
  'src/commands/trends.ts',
  'src/handlers/buttonHandler.ts',
  'src/handlers/commandHandler.ts',
];

// Files that need remaining Date/string fixes
const remainingDateFiles = [
  'src/examples/database-usage.ts',
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

function fixDiscordTypes(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Add discordUtils import if not present and Discord types are used
  if (
    !content.includes("from '../utils/discordUtils'") &&
    (content.includes('GuildMember') || content.includes('APIInteractionGuildMember'))
  ) {
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') && !lines[i].includes('discordUtils')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex !== -1) {
      const importPath = filePath.includes('src/utils/')
        ? './discordUtils'
        : '../utils/discordUtils';
      lines.splice(
        lastImportIndex + 1,
        0,
        `import { toGuildMember, getUserId, getDisplayName } from '${importPath}';`
      );
      content = lines.join('\n');
      modified = true;
    }
  }

  // Fix Discord.js type issues
  const discordFixes = [
    // Fix GuildMember | APIInteractionGuildMember type issues
    {
      pattern: /(\w+\.member)(?=\s*[,)])/g,
      replacement: 'await toGuildMember($1, interaction.guild)',
    },
    // Fix interaction.member usage in function calls
    {
      pattern: /(\w+)\(([^,)]*interaction\.member[^,)]*)\)/g,
      replacement: (match, funcName, args) => {
        if (args.includes('await toGuildMember')) {
          return match; // Already fixed
        }
        return `${funcName}(await toGuildMember(interaction.member, interaction.guild))`;
      },
    },
  ];

  // Apply Discord fixes
  discordFixes.forEach(fix => {
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
    console.log(`✅ Fixed Discord types: ${filePath}`);
  } else {
    console.log(`📝 No Discord type changes needed: ${filePath}`);
  }
}

function fixRemainingDateIssues(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Add dateUtils import if not present and date operations are used
  if (!content.includes("from '../utils/dateUtils'") && !content.includes("from './dateUtils'")) {
    const needsDateUtils =
      content.includes('.toISOString()') ||
      content.includes('.setDate(') ||
      content.includes('.getDate()') ||
      content.includes('.getHours()') ||
      content.includes('.getDay()') ||
      content.includes('.toLocaleDateString()');

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

  const remainingFixes = [
    // Fix remaining .toISOString() calls on strings
    {
      pattern: /([\w.]+)\.toISOString\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new' || varName.includes('toISOString')) {
          return match;
        }
        return `toISOString(${varName})`;
      },
    },

    // Fix Date assignment issues (Type 'string' is not assignable to type 'Date')
    {
      pattern: /(\w+):\s*new Date\(\)\.toISOString\(\)/g,
      replacement: '$1: toISOString(new Date())',
    },

    // Fix setDate calls on strings
    {
      pattern: /([\w.]+)\.setDate\(([^)]+)\)/g,
      replacement: (match, varName, arg) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `${varName} = setDate(${varName}, ${arg})`;
      },
    },

    // Fix getDate calls on strings
    {
      pattern: /([\w.]+)\.getDate\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getDate(${varName})`;
      },
    },

    // Fix getHours/getDay calls on strings
    {
      pattern: /([\w.]+)\.getHours\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `getHours(${varName})`;
      },
    },

    {
      pattern: /([\w.]+)\.getDay\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `toDate(${varName}).getDay()`;
      },
    },

    // Fix toLocaleDateString calls on strings
    {
      pattern: /([\w.]+)\.toLocaleDateString\(\)/g,
      replacement: (match, varName) => {
        if (varName.includes('Date') || varName === 'new') {
          return match;
        }
        return `toLocaleDateString(${varName})`;
      },
    },

    // Fix Date comparison operations
    {
      pattern: /(\w+)\s*([<>]=?)\s*(['"`][^'"`]*['"`])/g,
      replacement: (match, date, op, str) => {
        return `toDate(${date}) ${op} toDate(${str})`;
      },
    },

    // Fix string type being used as value (monitoring.ts)
    { pattern: /const\s+(\w+):\s*string\s*=\s*string;/g, replacement: 'const $1: string = "";' },

    // Fix cannot assign to const errors
    {
      pattern: /(\w+) = setDate\((\w+),/g,
      replacement: (match, varName, originalVar) => {
        if (varName === originalVar) {
          return `const new${varName.charAt(0).toUpperCase() + varName.slice(1)} = setDate(${originalVar},`;
        }
        return match;
      },
    },
  ];

  // Apply remaining fixes
  remainingFixes.forEach(fix => {
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
    console.log(`✅ Fixed remaining date issues: ${filePath}`);
  } else {
    console.log(`📝 No remaining date changes needed: ${filePath}`);
  }
}

// Phase 2: Fix Discord.js API type mismatches and remaining Date/string errors
console.log('🔧 Starting Phase 2: Discord.js type fixes and remaining Date/string errors...\n');

console.log('📋 Part A: Fixing Discord.js type mismatches...');
discordTypeFiles.forEach(fixDiscordTypes);

console.log('\n📋 Part B: Fixing remaining Date/string errors...');
remainingDateFiles.forEach(fixRemainingDateIssues);

console.log('\n✨ Phase 2 completed!');
