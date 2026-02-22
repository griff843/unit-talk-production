#!/usr/bin/env npx tsx
/**
 * SPRINT-TRUTH-RESTORATION-001: Deploy Path Validation Gate
 *
 * This gate ensures all Dockerfile paths referenced in deploy.yml actually exist.
 * Prevents deployment failures due to missing Dockerfiles.
 *
 * Usage: pnpm run deploy:validate-paths
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEPLOY_WORKFLOW = path.join(PROJECT_ROOT, '.github/workflows/deploy.yml');

interface ValidationResult {
  pass: boolean;
  apps: string[];
  missingDockerfiles: string[];
  foundDockerfiles: string[];
}

function extractAppsFromMatrix(content: string): string[] {
  // Match: app: [api, discord-bot, dashboard, smart-form, command-center]
  const matrixMatch = content.match(/app:\s*\[([\w\-,\s]+)\]/);
  if (!matrixMatch) return [];

  return matrixMatch[1]
    .split(',')
    .map((app) => app.trim())
    .filter((app) => app.length > 0);
}

function extractDockerfilePattern(content: string): string | null {
  // Match: file: apps/${{ matrix.app }}/Dockerfile or similar
  const fileMatch = content.match(/file:\s*([^\n]+\$\{\{\s*matrix\.app\s*\}\}[^\n]*)/);
  if (!fileMatch) {
    // Try without matrix variable
    const staticMatch = content.match(/file:\s*(infrastructure\/docker\/Dockerfile\.\$\{\{\s*matrix\.app\s*\}\})/);
    if (staticMatch) return staticMatch[1];
    return null;
  }
  return fileMatch[1].trim();
}

function validateDeployPaths(): ValidationResult {
  console.log('🔍 DEPLOY PATH VALIDATION GATE');
  console.log('   Scanning: .github/workflows/deploy.yml');
  console.log('   Checking: Dockerfile paths exist\n');

  if (!fs.existsSync(DEPLOY_WORKFLOW)) {
    console.log('   ❌ deploy.yml not found!');
    return {
      pass: false,
      apps: [],
      missingDockerfiles: [DEPLOY_WORKFLOW],
      foundDockerfiles: [],
    };
  }

  const workflowContent = fs.readFileSync(DEPLOY_WORKFLOW, 'utf-8');

  // Extract apps from the matrix strategy
  const apps = extractAppsFromMatrix(workflowContent);

  if (apps.length === 0) {
    console.log('   ⚠️  No apps found in build-images matrix');
    return {
      pass: true,
      apps: [],
      missingDockerfiles: [],
      foundDockerfiles: [],
    };
  }

  console.log(`   📦 Apps in matrix: ${apps.join(', ')}`);

  // Extract Dockerfile path pattern from the workflow
  const filePattern = extractDockerfilePattern(workflowContent);

  if (!filePattern) {
    console.log('   ⚠️  Could not extract Dockerfile pattern from workflow');
    console.log('   Assuming pattern: apps/${{ matrix.app }}/Dockerfile');
  }

  const pattern = filePattern || 'apps/${{ matrix.app }}/Dockerfile';
  console.log(`   📄 Dockerfile pattern: ${pattern}`);

  // Check if each Dockerfile exists
  const missingDockerfiles: string[] = [];
  const foundDockerfiles: string[] = [];

  for (const app of apps) {
    // Replace matrix variable with actual app name
    const dockerfilePath = pattern.replace(/\$\{\{\s*matrix\.app\s*\}\}/, app);
    const fullPath = path.join(PROJECT_ROOT, dockerfilePath);

    if (fs.existsSync(fullPath)) {
      foundDockerfiles.push(dockerfilePath);
      console.log(`   ✅ ${dockerfilePath}`);
    } else {
      missingDockerfiles.push(dockerfilePath);
      console.log(`   ❌ ${dockerfilePath} (MISSING)`);
    }
  }

  console.log('\n📊 Results:');
  console.log(`   Apps checked: ${apps.length}`);
  console.log(`   Dockerfiles found: ${foundDockerfiles.length}`);
  console.log(`   Dockerfiles missing: ${missingDockerfiles.length}`);

  if (missingDockerfiles.length > 0) {
    console.log('\n❌ GATE FAILED');
    console.log('   The following Dockerfiles are referenced but do not exist:');
    missingDockerfiles.forEach((df) => {
      console.log(`      - ${df}`);
    });
    console.log('\n   Fix by either:');
    console.log('   1. Creating the missing Dockerfiles');
    console.log('   2. Updating deploy.yml to use correct paths');
    console.log('   3. Removing the app from the build matrix');

    return {
      pass: false,
      apps,
      missingDockerfiles,
      foundDockerfiles,
    };
  }

  console.log('\n✅ GATE PASSED');
  console.log('   All Dockerfiles referenced in deploy.yml exist.');

  return {
    pass: true,
    apps,
    missingDockerfiles: [],
    foundDockerfiles,
  };
}

// Main execution
const result = validateDeployPaths();
process.exit(result.pass ? 0 : 1);
