#!/usr/bin/env node

/**
 * Fix remaining Discord bot TypeScript errors
 * Focused on patterns that the first script missed
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const DISCORD_BOT_ROOT = join(__dirname, '..', 'apps', 'discord-bot');

interface FileProcessor {
  filePath: string;
  process: (content: string) => string;
}

const FILE_PROCESSORS: FileProcessor[] = [
  // Fix pick.ts toISOString issues
  {
    filePath: 'src/commands/pick.ts',
    process: (content: string) => {
      return content
        .replace(
          /created_at\.toISOString\(\)/g,
          '(typeof created_at === "string" ? created_at : new Date(created_at).toISOString())'
        )
        .replace(
          /updated_at\.toISOString\(\)/g,
          '(typeof updated_at === "string" ? updated_at : new Date(updated_at).toISOString())'
        )
        .replace(/new Date\(\)\.toISOString\(\)/g, 'new Date().toISOString()');
    },
  },

  // Fix monitoring.ts timestamp issues
  {
    filePath: 'src/services/monitoring.ts',
    process: (content: string) => {
      return content
        .replace(/timestamp: Date/g, 'timestamp: string')
        .replace(/timestamp: new Date\(\)/g, 'timestamp: new Date().toISOString()');
    },
  },

  // Fix validation.ts date comparison
  {
    filePath: 'src/services/validation.ts',
    process: (content: string) => {
      return content.replace(
        /if \(now < seasonStart \|\| now > seasonEnd\)/g,
        'if (new Date(now) < seasonStart || new Date(now) > seasonEnd)'
      );
    },
  },

  // Fix permissions.ts date argument
  {
    filePath: 'src/utils/permissions.ts',
    process: (content: string) => {
      return content
        .replace(/new Date\(\),/g, 'new Date().toISOString(),')
        .replace(/new Date\(\)$/g, 'new Date().toISOString()');
    },
  },

  // Fix all toISOString calls on string types
  {
    filePath: 'src/services/onboardingService.ts',
    process: (content: string) => {
      return content.replace(
        /(\w+)\.toISOString\(\)/g,
        '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
      );
    },
  },

  {
    filePath: 'src/services/permissions.ts',
    process: (content: string) => {
      return content.replace(
        /(\w+)\.toISOString\(\)/g,
        '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
      );
    },
  },

  {
    filePath: 'src/services/quickEditConfigService.ts',
    process: (content: string) => {
      return content.replace(
        /(\w+)\.toISOString\(\)/g,
        '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
      );
    },
  },

  {
    filePath: 'src/services/sportsData.ts',
    process: (content: string) => {
      return content.replace(
        /(\w+)\.toISOString\(\)/g,
        '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
      );
    },
  },

  {
    filePath: 'src/services/supabase.ts',
    process: (content: string) => {
      return content.replace(
        /(\w+)\.toISOString\(\)/g,
        '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
      );
    },
  },

  {
    filePath: 'src/services/threadService.ts',
    process: (content: string) => {
      return content
        .replace(
          /(\w+)\.toISOString\(\)/g,
          '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
        )
        .replace(/(\w+)\.toLocaleTimeString\(\)/g, 'new Date($1).toLocaleTimeString()');
    },
  },

  {
    filePath: 'src/services/vipNotificationService.ts',
    process: (content: string) => {
      return content.replace(
        /(\w+)\.toISOString\(\)/g,
        '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
      );
    },
  },

  {
    filePath: 'src/utils/enterpriseErrorHandling.ts',
    process: (content: string) => {
      return content.replace(
        /(\w+)\.toISOString\(\)/g,
        '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
      );
    },
  },

  {
    filePath: 'src/utils/logger.ts',
    process: (content: string) => {
      return content.replace(
        /(\w+)\.toISOString\(\)/g,
        '(typeof $1 === "string" ? $1 : new Date($1).toISOString())'
      );
    },
  },
];

class DiscordErrorFixer {
  private fixedFiles: string[] = [];

  async run(): Promise<void> {
    console.log('🔧 Fixing remaining Discord bot TypeScript errors');
    console.log('================================================');

    for (const processor of FILE_PROCESSORS) {
      const fullPath = join(DISCORD_BOT_ROOT, processor.filePath);

      if (!existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${processor.filePath}`);
        continue;
      }

      try {
        const originalContent = readFileSync(fullPath, 'utf8');
        const processedContent = processor.process(originalContent);

        if (originalContent !== processedContent) {
          writeFileSync(fullPath, processedContent, 'utf8');
          this.fixedFiles.push(processor.filePath);
          console.log(`✅ Fixed: ${processor.filePath}`);
        } else {
          console.log(`⏭️  No changes: ${processor.filePath}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${processor.filePath}:`, error);
      }
    }

    console.log('');
    console.log(`✅ Fixed ${this.fixedFiles.length} additional files`);

    // Run type check
    console.log('🔍 Running final type check...');
    try {
      const output = execSync('npm run type-check', {
        cwd: DISCORD_BOT_ROOT,
        encoding: 'utf8',
      });
      console.log('✅ Type check passed!');
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      const errorCount = (errorOutput.match(/error TS\d+:/g) || []).length;
      console.log(`⚠️  ${errorCount} TypeScript errors remaining`);

      // Show summary only
      const lines = errorOutput.split('\n');
      const errorLines = lines.filter(line => line.includes('error TS'));
      console.log('Remaining errors:');
      errorLines.slice(0, 10).forEach(line => console.log(`  ${line.trim()}`));
      if (errorLines.length > 10) {
        console.log(`  ... and ${errorLines.length - 10} more errors`);
      }
    }
  }
}

// Run the fixer
if (require.main === module) {
  const fixer = new DiscordErrorFixer();
  fixer.run().catch(console.error);
}

export default DiscordErrorFixer;
