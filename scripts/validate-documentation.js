#!/usr/bin/env node

/**
 * Documentation Validation Script
 * Ensures CLAUDE.md compliance and consistency across the workspace
 */

const fs = require('fs');
const path = require('path');

class DocumentationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.workspaceRoot = process.cwd();
  }

  validate() {
    console.log('🔍 Validating Unit Talk Platform Documentation...\n');

    this.validateWorkspaceStructure();
    this.validateClaudeMdFiles();
    this.validateDocumentationHierarchy();

    this.printResults();

    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  validateWorkspaceStructure() {
    console.log('📁 Checking workspace structure...');

    const requiredDirs = ['apps', 'packages', 'docs', 'infrastructure', 'scripts', 'tools'];
    const requiredApps = ['api', 'discord-bot', 'dashboard', 'smart-form', 'command-center'];

    for (const dir of requiredDirs) {
      if (!fs.existsSync(path.join(this.workspaceRoot, dir))) {
        this.errors.push(`Missing required directory: ${dir}/`);
      }
    }

    for (const app of requiredApps) {
      const appPath = path.join(this.workspaceRoot, 'apps', app);
      if (!fs.existsSync(appPath)) {
        this.errors.push(`Missing required app: apps/${app}/`);
      }
    }
  }

  validateClaudeMdFiles() {
    console.log('📄 Checking CLAUDE.md files...');

    // Check root CLAUDE.md
    const rootClaudemd = path.join(this.workspaceRoot, 'CLAUDE.md');
    if (!fs.existsSync(rootClaudemd)) {
      this.errors.push('Missing root CLAUDE.md file');
    } else {
      this.validateClaudeMdContent(rootClaudemd, 'workspace');
    }

    // Check app-specific CLAUDE.md files
    const appsDir = path.join(this.workspaceRoot, 'apps');
    if (fs.existsSync(appsDir)) {
      const apps = fs.readdirSync(appsDir);
      for (const app of apps) {
        const appClaudemd = path.join(appsDir, app, 'CLAUDE.md');
        if (!fs.existsSync(appClaudemd)) {
          this.warnings.push(`Missing CLAUDE.md in apps/${app}/`);
        } else {
          this.validateClaudeMdContent(appClaudemd, 'app');
        }
      }
    }
  }

  validateClaudeMdContent(filePath, type) {
    const content = fs.readFileSync(filePath, 'utf8');
    const requiredSections = {
      workspace: ['Workspace Architecture', 'Quick Commands', 'Development Guidelines'],
      app: ['Project Overview', 'Development Commands', 'Architecture'],
    };

    const sections = requiredSections[type] || [];
    for (const section of sections) {
      if (!content.includes(section)) {
        this.warnings.push(`${filePath}: Missing section "${section}"`);
      }
    }
  }

  validateDocumentationHierarchy() {
    console.log('🏗️ Checking documentation hierarchy...');

    const docsStructure = ['docs/architecture', 'docs/api', 'docs/deployment'];

    for (const docPath of docsStructure) {
      const fullPath = path.join(this.workspaceRoot, docPath);
      if (!fs.existsSync(fullPath)) {
        this.warnings.push(`Missing documentation directory: ${docPath}/`);
      }
    }
  }

  printResults() {
    console.log('\n📊 Validation Results:');
    console.log(`✅ Errors: ${this.errors.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}\n`);

    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(error => console.log(`  • ${error}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
      console.log('');
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 All documentation validation checks passed!');
    }
  }
}

// Run validation
const validator = new DocumentationValidator();
validator.validate();
