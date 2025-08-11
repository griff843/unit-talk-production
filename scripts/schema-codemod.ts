#!/usr/bin/env tsx

/**
 * Unit Talk v3.0.0 Schema Codemod
 * Automated migration from legacy schema to v3.0.0 canonical schema
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface CodemodResult {
  file: string;
  changes: number;
  errors: string[];
  transformations: Array<{
    line: number;
    old: string;
    new: string;
    type: 'table' | 'column' | 'query' | 'type';
  }>;
}

class SchemaCodemod {
  private results: CodemodResult[] = [];
  private dryRun: boolean = false;

  // Table name mappings
  private tableReplacements = new Map([
    ['final_picks', 'unified_picks'],
    ['picks_final', 'unified_picks'],
    ['_final_picks', 'unified_picks'],
    ['raw_props_old', 'raw_props'],
    ['ingested_props', 'raw_props']
  ]);

  // Column mappings - more complex transformations
  private columnReplacements = new Map([
    // Simple replacements
    ['auto_approved', 'published'],
    ['is_graded', 'grading_status'],
    ['graded', 'grading_status'],
    ['queue_status', 'stage'],
    ['promotion_status', 'stage'],
    ['instant', 'is_instant'],
    ['post_now', 'is_instant'],
    ['position_size', 'kelly_fraction'],
    ['stake_fraction', 'kelly_fraction'],
    ['clv_basis_points', 'clv_pct'],
    
    // Deprecated columns (to be removed)
    ['edge_score', '-- REMOVED: edge_score (calculate from confidence)'],
    ['ev', 'devigged_edge'],
    ['score', 'professional_score'],
    ['composite_score', 'professional_score']
  ]);

  // Query pattern replacements
  private queryPatterns = [
    {
      pattern: /WHERE\s+processed\s*=\s*true/gi,
      replacement: 'WHERE processed_at IS NOT NULL',
      type: 'query' as const
    },
    {
      pattern: /WHERE\s+processed\s*=\s*false/gi,
      replacement: 'WHERE processed_at IS NULL',
      type: 'query' as const
    },
    {
      pattern: /WHERE\s+auto_approved\s*=\s*true/gi,
      replacement: 'WHERE published = true',
      type: 'query' as const
    },
    {
      pattern: /WHERE\s+is_graded\s*=\s*true/gi,
      replacement: "WHERE grading_status = 'graded'",
      type: 'query' as const
    },
    {
      pattern: /WHERE\s+tier\s+IS\s+NULL/gi,
      replacement: 'WHERE processed_at IS NULL',
      type: 'query' as const
    }
  ];

  // TypeScript interface patterns
  private typePatterns = [
    {
      pattern: /FinalPick([^s])/g,
      replacement: 'UnifiedPick$1',
      type: 'type' as const
    },
    {
      pattern: /FinalPicks/g,
      replacement: 'UnifiedPicks',
      type: 'type' as const
    },
    {
      pattern: /final_picks/g,
      replacement: 'unified_picks',
      type: 'table' as const
    }
  ];

  constructor(dryRun: boolean = false) {
    this.dryRun = dryRun;
  }

  async processRepository(): Promise<CodemodResult[]> {
    console.log(`🚀 Starting schema codemod (${this.dryRun ? 'DRY RUN' : 'LIVE'})`);
    
    // Find all TypeScript, SQL, and JavaScript files
    const patterns = [
      'apps/**/*.ts',
      'apps/**/*.tsx',
      'apps/**/*.js',
      'apps/**/*.jsx',
      'apps/**/*.sql',
      'packages/**/*.ts',
      'packages/**/*.tsx',
      'migrations/**/*.sql',
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/*.min.*'
    ];

    const files = await glob(patterns, { 
      cwd: process.cwd(),
      absolute: true 
    });

    console.log(`📁 Found ${files.length} files to process`);

    for (const file of files) {
      try {
        await this.processFile(file);
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error);
      }
    }

    return this.results;
  }

  private async processFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let modifiedContent = content;
    let changeCount = 0;
    const transformations: CodemodResult['transformations'] = [];

    // Apply table name replacements
    for (const [oldTable, newTable] of this.tableReplacements) {
      const regex = new RegExp(`\\b${oldTable}\\b`, 'g');
      if (regex.test(modifiedContent)) {
        const newContent = modifiedContent.replace(regex, newTable);
        if (newContent !== modifiedContent) {
          changeCount++;
          transformations.push({
            line: this.findLineNumber(lines, oldTable),
            old: oldTable,
            new: newTable,
            type: 'table'
          });
          modifiedContent = newContent;
        }
      }
    }

    // Apply column name replacements (more careful with context)
    for (const [oldColumn, newColumn] of this.columnReplacements) {
      if (!newColumn.startsWith('-- REMOVED')) {
        // Safe column replacement in SQL contexts
        const sqlPattern = new RegExp(`\\b${oldColumn}\\b(?=\\s*[,\\)\\s=])`, 'g');
        if (sqlPattern.test(modifiedContent)) {
          const newContent = modifiedContent.replace(sqlPattern, newColumn);
          if (newContent !== modifiedContent) {
            changeCount++;
            transformations.push({
              line: this.findLineNumber(lines, oldColumn),
              old: oldColumn,
              new: newColumn,
              type: 'column'
            });
            modifiedContent = newContent;
          }
        }
      }
    }

    // Apply query patterns
    for (const { pattern, replacement, type } of this.queryPatterns) {
      if (pattern.test(modifiedContent)) {
        const newContent = modifiedContent.replace(pattern, replacement);
        if (newContent !== modifiedContent) {
          changeCount++;
          transformations.push({
            line: this.findLineNumber(lines, pattern.source),
            old: pattern.source,
            new: replacement,
            type
          });
          modifiedContent = newContent;
        }
      }
    }

    // Apply TypeScript patterns
    for (const { pattern, replacement, type } of this.typePatterns) {
      if (pattern.test(modifiedContent)) {
        const newContent = modifiedContent.replace(pattern, replacement);
        if (newContent !== modifiedContent) {
          changeCount++;
          transformations.push({
            line: this.findLineNumber(lines, pattern.source),
            old: pattern.source,
            new: replacement,
            type
          });
          modifiedContent = newContent;
        }
      }
    }

    // Record results
    if (changeCount > 0) {
      this.results.push({
        file: path.relative(process.cwd(), filePath),
        changes: changeCount,
        errors: [],
        transformations
      });

      // Write file if not dry run
      if (!this.dryRun) {
        await fs.writeFile(filePath, modifiedContent, 'utf-8');
      }

      console.log(`✅ ${changeCount} changes in ${path.basename(filePath)}`);
    }
  }

  private findLineNumber(lines: string[], searchText: string): number {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 1;
  }

  generateReport(): void {
    const totalFiles = this.results.length;
    const totalChanges = this.results.reduce((sum, r) => sum + r.changes, 0);

    console.log('\n📊 CODEMOD REPORT');
    console.log('='.repeat(50));
    console.log(`Files processed: ${totalFiles}`);
    console.log(`Total changes: ${totalChanges}`);
    console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE'}`);

    if (this.results.length > 0) {
      console.log('\n📁 FILES CHANGED:');
      for (const result of this.results.slice(0, 10)) {
        console.log(`  ${result.file}: ${result.changes} changes`);
      }

      if (this.results.length > 10) {
        console.log(`  ... and ${this.results.length - 10} more files`);
      }

      console.log('\n🔄 TRANSFORMATION TYPES:');
      const typeCount = new Map();
      for (const result of this.results) {
        for (const transform of result.transformations) {
          typeCount.set(transform.type, (typeCount.get(transform.type) || 0) + 1);
        }
      }
      for (const [type, count] of typeCount) {
        console.log(`  ${type}: ${count} changes`);
      }
    }

    if (!this.dryRun) {
      console.log('\n✅ All changes applied successfully!');
      console.log('\n🎯 Next steps:');
      console.log('  1. Run TypeScript compilation check');
      console.log('  2. Run tests');
      console.log('  3. Apply database migrations');
      console.log('  4. Verify functionality');
    } else {
      console.log('\n🔍 Dry run complete - no files were changed');
      console.log('Run with --apply flag to apply changes');
    }
  }
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const codemod = new SchemaCodemod(dryRun);
  
  try {
    await codemod.processRepository();
    codemod.generateReport();
  } catch (error) {
    console.error('❌ Codemod failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SchemaCodemod };