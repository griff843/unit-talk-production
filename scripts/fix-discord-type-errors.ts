#!/usr/bin/env node

/**
 * Comprehensive TypeScript Error Fix for Discord Bot
 * Fixes Date/string type mismatches and unused variable warnings
 * Fortune 100-grade quality standards
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DISCORD_BOT_ROOT = join(__dirname, '..', 'apps', 'discord-bot');

interface FixPattern {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// Date/string conversion patterns
const DATE_FIX_PATTERNS: FixPattern[] = [
  // toISOString() on string -> use directly or convert to Date
  {
    pattern: /(\w+)\.toISOString\(\)/g,
    replacement: '(typeof $1 === "string" ? $1 : new Date($1).toISOString())',
    description: 'Fix toISOString() calls on string|Date types',
  },

  // Date methods on strings
  {
    pattern: /(\w+)\.setDate\((\w+)\.getDate\(\)\)/g,
    replacement: 'new Date($1).setDate(new Date($2).getDate())',
    description: 'Fix setDate/getDate on string types',
  },

  {
    pattern: /(\w+)\.getHours\(\)/g,
    replacement: 'new Date($1).getHours()',
    description: 'Fix getHours() on string types',
  },

  {
    pattern: /(\w+)\.getTime\(\)/g,
    replacement: 'new Date($1).getTime()',
    description: 'Fix getTime() on string types',
  },

  {
    pattern: /(\w+)\.toLocaleTimeString\(\)/g,
    replacement: 'new Date($1).toLocaleTimeString()',
    description: 'Fix toLocaleTimeString() on string types',
  },

  // Date comparisons with strings
  {
    pattern: /(\w+)\s*<\s*new Date\(/g,
    replacement: 'new Date($1) < new Date(',
    description: 'Fix date comparison with string',
  },

  {
    pattern: /(\w+)\s*>\s*new Date\(/g,
    replacement: 'new Date($1) > new Date(',
    description: 'Fix date comparison with string',
  },

  // Type mismatches in function arguments
  {
    pattern: /timestamp:\s*new Date\(\)/g,
    replacement: 'timestamp: new Date().toISOString()',
    description: 'Fix timestamp type mismatch',
  },
];

// Unused variable fix patterns
const UNUSED_VAR_PATTERNS: FixPattern[] = [
  // Remove or prefix with underscore
  {
    pattern: /(\s+)(\w+)(\s*=\s*[^;]+;\s*\/\/.*never read)/g,
    replacement: '$1// $2$3 // Removed unused variable',
    description: 'Comment out unused variables',
  },

  {
    pattern: /(\s+const\s+)(\w+)(\s*=\s*[^;]+;)/g,
    replacement: '$1_$2$3',
    description: 'Prefix unused variables with underscore',
  },
];

class TypeScriptErrorFixer {
  private fixedFiles: string[] = [];

  constructor() {
    console.log('🔧 Discord Bot TypeScript Error Fixer');
    console.log('=====================================');
  }

  /**
   * Get all TypeScript files in the Discord bot
   */
  private getTypeScriptFiles(): string[] {
    try {
      const output = execSync(`find "${DISCORD_BOT_ROOT}/src" -name "*.ts" -type f`, {
        encoding: 'utf8',
      });
      return output.trim().split('\n').filter(Boolean);
    } catch (error) {
      console.error('❌ Error finding TypeScript files:', error);
      return [];
    }
  }

  /**
   * Apply fix patterns to a file
   */
  private applyFixesToFile(filePath: string): boolean {
    if (!existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return false;
    }

    try {
      let content = readFileSync(filePath, 'utf8');
      let modified = false;

      // Apply date fixes
      for (const { pattern, replacement, description } of DATE_FIX_PATTERNS) {
        const originalContent = content;
        content = content.replace(pattern, replacement);
        if (content !== originalContent) {
          modified = true;
          console.log(`  ✅ Applied: ${description}`);
        }
      }

      // Special case fixes for specific patterns
      content = this.applySpecialCaseFixes(content, filePath);

      if (modified) {
        writeFileSync(filePath, content, 'utf8');
        this.fixedFiles.push(filePath);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Apply special case fixes that need more context
   */
  private applySpecialCaseFixes(content: string, filePath: string): string {
    // Fix specific validation.ts issues
    if (filePath.includes('validation.ts')) {
      content = content.replace(
        /if \(now < seasonStart \|\| now > seasonEnd\)/,
        'if (new Date(now) < seasonStart || new Date(now) > seasonEnd)'
      );
    }

    // Fix monitoring.ts health check results
    if (filePath.includes('monitoring.ts')) {
      content = content.replace(/timestamp: Date/g, 'timestamp: string');
      content = content.replace(/timestamp: new Date\(\)/g, 'timestamp: new Date().toISOString()');
    }

    // Fix permissions.ts date argument issues
    if (filePath.includes('permissions.ts')) {
      content = content.replace(/\bnew Date\(\)/g, 'new Date().toISOString()');
    }

    // Remove or comment out unused variables
    content = this.fixUnusedVariables(content);

    return content;
  }

  /**
   * Fix unused variable warnings
   */
  private fixUnusedVariables(content: string): string {
    // Specific patterns for common unused variables
    const unusedPatterns = [
      {
        pattern: /const\s+calculateMarketTimingAdvantage\s*=.*?};/s,
        fix: '// calculateMarketTimingAdvantage removed (unused)',
      },
      { pattern: /const\s+_stats\s*=.*?;/g, fix: '// _stats removed (unused)' },
      { pattern: /const\s+_totalScore\s*=.*?;/g, fix: '// _totalScore removed (unused)' },
      { pattern: /const\s+_scoreCount\s*=.*?;/g, fix: '// _scoreCount removed (unused)' },
      {
        pattern: /const\s+FeatureEngineeringConfig\s*=.*?};/s,
        fix: '// FeatureEngineeringConfig removed (unused)',
      },
    ];

    for (const { pattern, fix } of unusedPatterns) {
      content = content.replace(pattern, fix);
    }

    // Generic unused variable prefix
    content = content.replace(
      /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;]+);(\s*\/\/.*never read)/g,
      'const _$1 = $2;$3 // Prefixed to indicate unused'
    );

    return content;
  }

  /**
   * Run the complete fix process
   */
  async run(): Promise<void> {
    console.log('🔍 Finding TypeScript files...');
    const tsFiles = this.getTypeScriptFiles();

    if (tsFiles.length === 0) {
      console.log('❌ No TypeScript files found');
      return;
    }

    console.log(`📁 Found ${tsFiles.length} TypeScript files`);
    console.log('');

    let totalFixed = 0;

    for (const filePath of tsFiles) {
      const fileName = filePath.replace(DISCORD_BOT_ROOT, '');
      console.log(`🔧 Processing: ${fileName}`);

      if (this.applyFixesToFile(filePath)) {
        totalFixed++;
        console.log(`  ✅ Fixed`);
      } else {
        console.log(`  ⏭️  No changes needed`);
      }
      console.log('');
    }

    console.log('=====================================');
    console.log(`✅ Fixed ${totalFixed} files`);
    console.log(`📋 Files modified:`);
    this.fixedFiles.forEach(file => {
      console.log(`   - ${file.replace(DISCORD_BOT_ROOT, '')}`);
    });

    // Run type check to verify fixes
    console.log('');
    console.log('🔍 Running type check to verify fixes...');
    try {
      execSync('npm run type-check', {
        cwd: DISCORD_BOT_ROOT,
        stdio: 'pipe',
      });
      console.log('✅ Type check passed!');
    } catch (error: any) {
      console.log('⚠️  Some type errors may remain:');
      console.log(error.stdout?.toString() || error.message);
    }
  }
}

// Run the fixer
if (require.main === module) {
  const fixer = new TypeScriptErrorFixer();
  fixer.run().catch(console.error);
}

export default TypeScriptErrorFixer;
