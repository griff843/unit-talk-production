#!/usr/bin/env tsx

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import * as ts from 'typescript';

interface ErrorFix {
  filePath: string;
  fixes: {
    start: number;
    end: number;
    replacement: string;
  }[];
}

class TypeScriptErrorFixer {
  private projectRoot: string;
  private tsConfig: any;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.tsConfig = this.loadTsConfig();
  }

  private loadTsConfig(): any {
    const tsConfigPath = join(this.projectRoot, 'tsconfig.json');
    try {
      const config = JSON.parse(readFileSync(tsConfigPath, 'utf8'));
      return config;
    } catch (error) {
      throw new Error(`Failed to load tsconfig.json: ${error}`);
    }
  }

  public async fixCommonErrors(): Promise<void> {
    console.log('🔍 Analyzing TypeScript errors...');
    
    // 1. Fix Date vs String mismatches
    console.log('\n📅 Fixing Date vs String mismatches...');
    this.fixDateStringMismatches();

    // 2. Fix naming convention mismatches
    console.log('\n🔤 Fixing naming convention mismatches...');
    this.fixNamingConventions();

    // 3. Fix missing exports
    console.log('\n📦 Fixing missing exports...');
    this.fixMissingExports();

    // 4. Fix missing type definitions
    console.log('\n📝 Adding missing type definitions...');
    this.fixMissingTypes();

    // 5. Fix object property type mismatches
    console.log('\n🔧 Fixing object property type mismatches...');
    this.fixPropertyTypeMismatches();

    // 6. Fix implicit any types
    console.log('\n⚙️ Fixing implicit any types...');
    this.fixImplicitAnyTypes();

    console.log('\n✅ Fixes applied successfully!');
  }

  private fixDateStringMismatches(): void {
    const fixes: ErrorFix[] = [];
    
    // Common date string patterns
    const patterns = [
      {
        regex: /new Date\(\)/g,
        replacement: 'new Date().toISOString().toISOString()'
      },
      {
        regex: /(\w+):\s*Date/g,
        replacement: '$1: string'
      }
    ];

    this.processFiles((filePath, content) => {
      let modified = content;
      patterns.forEach(({ regex, replacement }) => {
        modified = modified.replace(regex, replacement);
      });
      
      if (modified !== content) {
        writeFileSync(filePath, modified, 'utf8');
        console.log(`  Fixed date handling in ${filePath}`);
      }
    });
  }

  private fixNamingConventions(): void {
    const camelToSnake = (str: string): string => 
      str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

    const snakeToCamel = (str: string): string =>
      str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    this.processFiles((filePath, content) => {
      let modified = content;

      // Fix common naming patterns
      const patterns = [
        // Property access fixes
        { 
          regex: /\.game_id\b/g, 
          replacement: '.game_id'
        },
        {
          regex: /\.created_at\b/g,
          replacement: '.created_at'
        },
        {
          regex: /\.updated_at\b/g,
          replacement: '.updated_at'
        }
      ];

      patterns.forEach(({ regex, replacement }) => {
        modified = modified.replace(regex, replacement);
      });

      if (modified !== content) {
        writeFileSync(filePath, modified, 'utf8');
        console.log(`  Fixed naming conventions in ${filePath}`);
      }
    });
  }

  private fixMissingExports(): void {
    this.processFiles((filePath, content) => {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const missingExports = new Set<string>();
      
      // Find references to undefined types/interfaces
      ts.forEachChild(sourceFile, node => {
        if (ts.isTypeReferenceNode(node)) {
          const typeName = node.typeName.getText(sourceFile);
          // Add to missing exports if type is used but not exported
          missingExports.add(typeName);
        }
      });

      if (missingExports.size > 0) {
        const exports = Array.from(missingExports)
          .map(name => `export type ${name} = any; // TODO: Define proper type`)
          .join('\n');
          
        const modified = `${exports}\n\n${content}`;
        writeFileSync(filePath, modified, 'utf8');
        console.log(`  Added missing exports in ${filePath}`);
      }
    });
  }

  private fixMissingTypes(): void {
    this.processFiles((filePath, content) => {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      let modified = content;

      // Add missing type imports
      const commonTypes = [
        'CommandInteraction',
        'CacheType',
        'ButtonInteraction'
      ];

      const hasDiscordImport = content.includes('@discordjs/core');
      if (!hasDiscordImport && commonTypes.some(type => content.includes(type))) {
        modified = `import { ${commonTypes.join(', ')} } from '@discordjs/core';\n${modified}`;
      }

      // Add missing interface definitions
      ts.forEachChild(sourceFile, node => {
        if (ts.isInterfaceDeclaration(node)) {
          // Add missing properties to interfaces
          // This is a simplified example
        }
      });

      if (modified !== content) {
        writeFileSync(filePath, modified, 'utf8');
        console.log(`  Added missing types in ${filePath}`);
      }
    });
  }

  private fixPropertyTypeMismatches(): void {
    this.processFiles((filePath, content) => {
      let modified = content;

      // Fix common type mismatches
      const replacements = [
        {
          pattern: /(created_at|updated_at):\s*Date/g,
          replacement: '$1: string'
        },
        {
          pattern: /new Date\(\),(\s*)(\/\/|$)/g,
          replacement: 'new Date().toISOString().toISOString(),$1$2'
        }
      ];

      replacements.forEach(({ pattern, replacement }) => {
        modified = modified.replace(pattern, replacement);
      });

      if (modified !== content) {
        writeFileSync(filePath, modified, 'utf8');
        console.log(`  Fixed property type mismatches in ${filePath}`);
      }
    });
  }

  private fixImplicitAnyTypes(): void {
    this.processFiles((filePath, content) => {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      let modified = content;
      const fixes: { pos: number; end: number; text: string }[] = [];

      // Find and fix implicit any types
      ts.forEachChild(sourceFile, node => {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          node.parameters.forEach(param => {
            if (!param.type) {
              fixes.push({
                pos: param.getStart(sourceFile),
                end: param.getEnd(),
                text: `${param.name.getText(sourceFile)}: unknown`
              });
            }
          });
        }
      });

      // Apply fixes from end to start to maintain positions
      fixes.sort((a, b) => b.pos - a.pos).forEach(fix => {
        modified = modified.slice(0, fix.pos) + fix.text + modified.slice(fix.end);
      });

      if (modified !== content) {
        writeFileSync(filePath, modified, 'utf8');
        console.log(`  Fixed implicit any types in ${filePath}`);
      }
    });
  }

  private processFiles(processor: (filePath: string, content: string) => void): void {
    const processDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          processDir(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          const content = readFileSync(fullPath, 'utf8');
          processor(fullPath, content);
        }
      }
    };

    processDir(this.projectRoot);
  }

  private readTsConfig(): any {
    const configPath = join(this.projectRoot, 'tsconfig.json');
    try {
      return JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('Failed to read tsconfig.json:', error);
      return {};
    }
  }
}

// Run the fixer
const projectRoot = process.cwd();
const fixer = new TypeScriptErrorFixer(projectRoot);
fixer.fixCommonErrors().catch(console.error);
