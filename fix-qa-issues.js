#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration for fixes
const FIXES = {
  // Import fixes
  imports: {
    'createTimestamp': "import { createTimestamp } from '../utils/qa-utils';",
    'createQATestResult': "import { createQATestResult } from '../utils/qa-utils';",
    'playwright': "// Playwright imports handled conditionally"
  },
  
  // Category property removal patterns
  categoryPatterns: [
    /category:\s*['"][^'"]*['"],?\s*\n/g,
    /,\s*category:\s*['"][^'"]*['"]/g
  ],
  
  // createTimestamp fixes
  timestampFixes: [
    {
      pattern: /timestamp:\s*createTimestamp\(\)/g,
      replacement: 'timestamp: createTimestamp()'
    }
  ],
  
  // Type fixes
  typeFixes: [
    {
      pattern: /'Browser' refers to a value, but is being used as a type here/,
      fix: (content) => content.replace(/: Browser/g, ': any')
    },
    {
      pattern: /'Page' refers to a value, but is being used as a type here/,
      fix: (content) => content.replace(/: Page/g, ': any')
    }
  ]
};

// Files to process
const TEST_FILES = [
  'qa/tests/workflows.test.ts',
  'qa/tests/security.test.ts',
  'qa/tests/user-tiers.test.ts',
  'qa/tests/performance.test.ts',
  'qa/tests/integration.test.ts',
  'qa/tests/mobile.test.ts'
];

const QA_FRAMEWORK_FILES = [
  'qa-framework/final-qa-report-generator.ts',
  'qa-framework/mobile-accessibility-tester.ts'
];

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error.message);
    return false;
  }
}

function fixImports(content, filePath) {
  const lines = content.split('\n');
  const importSection = [];
  const restOfFile = [];
  let inImportSection = true;
  
  for (const line of lines) {
    if (inImportSection && (line.startsWith('import ') || line.trim() === '')) {
      importSection.push(line);
    } else {
      inImportSection = false;
      restOfFile.push(line);
    }
  }
  
  // Add missing imports
  const hasCreateTimestamp = importSection.some(line => line.includes('createTimestamp'));
  const hasCreateQATestResult = importSection.some(line => line.includes('createQATestResult'));
  
  if (!hasCreateTimestamp || !hasCreateQATestResult) {
    const utilsImport = `import { ${[
      !hasCreateTimestamp ? 'createTimestamp' : null,
      !hasCreateQATestResult ? 'createQATestResult' : null
    ].filter(Boolean).join(', ')} } from '../utils/qa-utils';`;
    
    importSection.push(utilsImport);
  }
  
  return [...importSection, ...restOfFile].join('\n');
}

function fixCategoryProperties(content) {
  let fixed = content;
  
  // Remove category properties from object literals
  FIXES.categoryPatterns.forEach(pattern => {
    fixed = fixed.replace(pattern, '');
  });
  
  return fixed;
}

function fixObjectLiteralsToCreateQATestResult(content) {
  // Pattern to match object literals that should be createQATestResult calls
  const objectLiteralPattern = /(\s+)(return\s+)?{(\s*)(id:\s*['"][^'"]*['"],?\s*)(name:\s*['"][^'"]*['"],?\s*)(status:\s*['"][^'"]*['"],?\s*)(message:\s*['"][^'"]*['"],?\s*)(timestamp:\s*[^,}]+,?\s*)(details:\s*[^}]*)?}/g;
  
  return content.replace(objectLiteralPattern, (match, indent, returnKeyword, spacing, id, name, status, message, timestamp, details) => {
    const idValue = id.match(/['"]([^'"]*)['"]/)[1];
    const nameValue = name.match(/['"]([^'"]*)['"]/)[1];
    const statusValue = status.match(/['"]([^'"]*)['"]/)[1];
    const messageValue = message.match(/['"]([^'"]*)['"]/)[1];
    
    return `${indent}${returnKeyword || ''}createQATestResult('${idValue}', '${nameValue}', '${statusValue}', '${messageValue}')`;
  });
}

function fixPlaywrightTypes(content) {
  // Replace Browser and Page type references with any
  return content
    .replace(/: Browser(?!\w)/g, ': any')
    .replace(/: Page(?!\w)/g, ': any')
    .replace(/'Browser' refers to a value, but is being used as a type here\. Did you mean 'typeof Browser'\?/g, '')
    .replace(/'Page' refers to a value, but is being used as a type here\. Did you mean 'typeof Page'\?/g, '');
}

function fixTimestampIssues(content) {
  // Fix createTimestamp calls and toISOString issues
  return content
    .replace(/createTimestamp\(\)\.toISOString\(\)/g, 'createTimestamp()')
    .replace(/timestamp:\s*createTimestamp\(\)\.toISOString\(\)/g, 'timestamp: createTimestamp()')
    .replace(/\.toISOString\(\)/g, ''); // Remove remaining toISOString calls on strings
}

function fixTestFile(filePath) {
  console.log(`\n🔧 Processing: ${filePath}`);
  
  const content = readFile(filePath);
  if (!content) return false;
  
  let fixed = content;
  
  // Apply fixes in order
  fixed = fixImports(fixed, filePath);
  fixed = fixCategoryProperties(fixed);
  fixed = fixObjectLiteralsToCreateQATestResult(fixed);
  fixed = fixPlaywrightTypes(fixed);
  fixed = fixTimestampIssues(fixed);
  
  return writeFile(filePath, fixed);
}

function fixQAFrameworkTypes() {
  console.log('\n🔧 Fixing QA Framework Types...');
  
  // First, let's add the missing types to qa-types.ts
  const qaTypesPath = 'types/qa-types.ts';
  const qaTypesContent = readFile(qaTypesPath);
  
  if (qaTypesContent) {
    const missingTypes = `
// Additional test result types
export interface AccessibilityTestResult extends QATestResult {
  violations: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: Array<{
      target: string[];
      html: string;
    }>;
  }>;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface MobileTestResult extends QATestResult {
  device: string;
  viewport: {
    width: number;
    height: number;
  };
  userAgent: string;
  touchSupport: boolean;
}

export interface SecurityTestResult extends QATestResult {
  vulnerabilityType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cveId?: string;
  remediation?: string;
}

export interface UXTestResult extends QATestResult {
  userFlow: string;
  interactionType: string;
  usabilityScore: number;
  recommendations: string[];
}

export interface DocumentationTestResult extends QATestResult {
  documentType: string;
  completeness: number;
  accuracy: number;
  clarity: number;
}

export interface LaunchReadinessCheck extends QATestResult {
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  blocksLaunch: boolean;
  estimatedFixTime: string;
}
`;
    
    const updatedContent = qaTypesContent + missingTypes;
    writeFile(qaTypesPath, updatedContent);
  }
}

function fixPerformanceConfig() {
  console.log('\n🔧 Fixing Performance Config...');
  
  const configPath = 'config/qa-config.ts';
  const configContent = readFile(configPath);
  
  if (configContent) {
    const updatedConfig = configContent.replace(
      /export const performanceConfig = {[^}]+}/s,
      `export const performanceConfig = {
  budgets: {
    loadTime: 3000,
    firstContentfulPaint: 1500,
    largestContentfulPaint: 2500,
    cumulativeLayoutShift: 0.1,
    firstInputDelay: 100
  },
  thresholds: {
    lcp: 2500,
    fid: 100,
    cls: 0.1
  },
  devices: ['desktop', 'mobile', 'tablet'],
  networkConditions: ['fast3g', 'slow3g', 'offline'],
  maxPageLoadTime: 5000,
  maxApiResponseTime: 2000,
  maxResourceSize: 1000000,
  maxMemoryUsage: 50000000,
  maxNetworkLatency: 1000,
  maxDatabaseQueryTime: 500
}`
    );
    
    writeFile(configPath, updatedConfig);
  }
}

function main() {
  console.log('🚀 Starting QA Framework Fix Script...\n');
  
  // Fix QA Framework types first
  fixQAFrameworkTypes();
  
  // Fix performance config
  fixPerformanceConfig();
  
  // Process test files
  console.log('\n📝 Processing Test Files...');
  let successCount = 0;
  let totalFiles = TEST_FILES.length;
  
  for (const file of TEST_FILES) {
    if (fixTestFile(file)) {
      successCount++;
    }
  }
  
  // Process QA framework files
  console.log('\n🔧 Processing QA Framework Files...');
  for (const file of QA_FRAMEWORK_FILES) {
    if (fixTestFile(file)) {
      successCount++;
      totalFiles++;
    }
  }
  
  console.log(`\n✨ Completed! Fixed ${successCount}/${totalFiles} files successfully.`);
  console.log('\n📋 Summary of fixes applied:');
  console.log('  ✅ Added missing imports (createTimestamp, createQATestResult)');
  console.log('  ✅ Removed category properties from object literals');
  console.log('  ✅ Fixed Playwright type references');
  console.log('  ✅ Fixed timestamp and toISOString issues');
  console.log('  ✅ Added missing type definitions');
  console.log('  ✅ Updated performance configuration');
  
  console.log('\n🔍 Run TypeScript check to verify fixes:');
  console.log('  npx tsc --noEmit');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fixTestFile, fixQAFrameworkTypes, fixPerformanceConfig };