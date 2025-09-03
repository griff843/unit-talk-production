const fs = require('fs');
const path = require('path');

// Fix the final 13 specific TypeScript errors
const finalFixes = [
  {
    file: 'src/services/adminOverrideService.ts',
    fixes: [
      {
        // Fix: Type 'string' is not assignable to type 'Date'
        search: /(\w+):\s*toISOString\(new Date\(\)\)/g,
        replace: '$1: new Date()',
      },
    ],
  },
  {
    file: 'src/services/advancedAnalyticsService.ts',
    fixes: [
      {
        // Fix: Property 'setDate' does not exist on type 'string'
        search: /(\w+)\.setDate\((\w+)\.getDate\(\)\s*-\s*(\d+)\)/g,
        replace: 'setDate($1, getDate($2) - $3)',
      },
    ],
  },
  {
    file: 'src/services/aiPoweredService.ts',
    fixes: [
      {
        // Fix: Type 'string' is not assignable to type 'Date'
        search: /lastActivity:\s*toISOString\(new Date\(\)\)/g,
        replace: 'lastActivity: new Date()',
      },
    ],
  },
  {
    file: 'src/services/automatedThreadService.ts',
    fixes: [
      {
        // Fix: Type 'string' is not assignable to type 'Date'
        search: /lastActivity:\s*toISOString\(new Date\(\)\)/g,
        replace: 'lastActivity: new Date()',
      },
      {
        // Fix: Property 'toLocaleDateString' does not exist on type 'string'
        search: /new Date\(\)\.toISOString\(\)\.toLocaleDateString\(\)/g,
        replace: 'toLocaleDateString(new Date())',
      },
      {
        // Fix missing return statement
        search:
          /private shouldApplyRule\(rule: ThreadLinkingRule, _channelIds: string\[\]\): Promise<void> \{[\s\S]*?\}/g,
        replace: `private shouldApplyRule(rule: ThreadLinkingRule, gameData: any): boolean {
    // Check if rule conditions match game data
    if (rule.conditions) {
      for (const [key, value] of Object.entries(rule.conditions)) {
        if (gameData[key] !== value) {
          return false;
        }
      }
    }
    return true;
  }`,
      },
    ],
  },
  {
    file: 'src/services/dmService.ts',
    fixes: [
      {
        // Fix: Expected 0 arguments, but got 2
        search: /toLocaleDateString\([^,)]+,\s*[^)]+\)/g,
        replace: 'toLocaleDateString()',
      },
      {
        // Fix: Property 'getHours' does not exist on type 'string'
        search: /(\w+)\.getHours\(\)/g,
        replace: (match, varName) => {
          if (varName.includes('Date') || varName === 'date' || varName.startsWith('new'))
            return match;
          return `getHours(${varName})`;
        },
      },
    ],
  },
  {
    file: 'src/services/gradingService.ts',
    fixes: [
      {
        // Fix: Type 'string' is not assignable to type 'Date'
        search: /created_at:\s*toISOString\(new Date\(\)\)/g,
        replace: 'created_at: new Date()',
      },
    ],
  },
];

function applyFinalFixes() {
  finalFixes.forEach(({ file, fixes }) => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ File not found: ${file}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    fixes.forEach(fix => {
      if (typeof fix.replace === 'function') {
        const newContent = content.replace(fix.search, fix.replace);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      } else {
        if (fix.search.test && fix.search.test(content)) {
          content = content.replace(fix.search, fix.replace);
          modified = true;
        } else if (typeof fix.search === 'string' && content.includes(fix.search)) {
          content = content.replace(
            new RegExp(fix.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            fix.replace
          );
          modified = true;
        }
      }
    });

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Fixed final errors: ${file}`);
    } else {
      console.log(`📝 No changes needed: ${file}`);
    }
  });
}

console.log('🎯 Fixing final 13 TypeScript errors...\n');
applyFinalFixes();
console.log('\n✨ Final fixes completed!');
