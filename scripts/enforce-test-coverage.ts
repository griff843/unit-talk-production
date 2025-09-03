/**
 * Test Coverage Enforcement Script
 * Ensures all applications meet the 80% test coverage requirement
 * Generates coverage reports and identifies gaps
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface CoverageReport {
  app: string;
  coverage: {
    lines: { pct: number; covered: number; total: number };
    functions: { pct: number; covered: number; total: number };
    branches: { pct: number; covered: number; total: number };
    statements: { pct: number; covered: number; total: number };
  };
  uncoveredFiles: string[];
  meetsCriteria: boolean;
}

interface CoverageSummary {
  totalApps: number;
  passingApps: number;
  failingApps: number;
  overallCoverage: number;
  reports: CoverageReport[];
}

class TestCoverageEnforcer {
  private readonly COVERAGE_THRESHOLD = 80;
  private readonly apps = [
    'apps/api',
    'apps/discord-bot',
    'apps/dashboard',
    'apps/smart-form',
    'apps/command-center'
  ];

  /**
   * Run coverage analysis for all applications
   */
  async enforceTestCoverage(): Promise<CoverageSummary> {
    console.log('🧪 Starting test coverage enforcement...\n');

    const reports: CoverageReport[] = [];

    for (const app of this.apps) {
      console.log(`📊 Analyzing coverage for ${app}...`);
      
      try {
        const report = await this.analyzeCoverage(app);
        reports.push(report);
        
        if (report.meetsCriteria) {
          console.log(`✅ ${app}: PASSED (${report.coverage.lines.pct.toFixed(1)}% line coverage)`);
        } else {
          console.log(`❌ ${app}: FAILED (${report.coverage.lines.pct.toFixed(1)}% line coverage, need ${this.COVERAGE_THRESHOLD}%)`);
        }
      } catch (error) {
        console.log(`⚠️ ${app}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Create failed report
        reports.push({
          app,
          coverage: {
            lines: { pct: 0, covered: 0, total: 0 },
            functions: { pct: 0, covered: 0, total: 0 },
            branches: { pct: 0, covered: 0, total: 0 },
            statements: { pct: 0, covered: 0, total: 0 }
          },
          uncoveredFiles: [],
          meetsCriteria: false
        });
      }
    }

    const summary = this.generateSummary(reports);
    await this.generateDetailedReport(summary);
    
    return summary;
  }

  /**
   * Analyze coverage for a specific application
   */
  private async analyzeCoverage(appPath: string): Promise<CoverageReport> {
    const appDir = join(process.cwd(), appPath);
    
    if (!existsSync(appDir)) {
      throw new Error(`Application directory not found: ${appPath}`);
    }

    // Check if Jest config exists
    const jestConfigPath = join(appDir, 'jest.config.js');
    if (!existsSync(jestConfigPath)) {
      throw new Error(`Jest configuration not found: ${jestConfigPath}`);
    }

    try {
      // Run tests with coverage
      const command = `cd ${appDir} && npm test -- --coverage --coverageReporters=json-summary --passWithNoTests`;
      execSync(command, { stdio: 'pipe' });

      // Read coverage report
      const coveragePath = join(appDir, 'coverage', 'coverage-summary.json');
      if (!existsSync(coveragePath)) {
        throw new Error('Coverage report not generated');
      }

      const coverageData = JSON.parse(readFileSync(coveragePath, 'utf8'));
      const totalCoverage = coverageData.total;

      // Find uncovered files
      const uncoveredFiles = this.findUncoveredFiles(appDir, coverageData);

      const meetsCriteria = 
        totalCoverage.lines.pct >= this.COVERAGE_THRESHOLD &&
        totalCoverage.functions.pct >= this.COVERAGE_THRESHOLD &&
        totalCoverage.branches.pct >= this.COVERAGE_THRESHOLD &&
        totalCoverage.statements.pct >= this.COVERAGE_THRESHOLD;

      return {
        app: appPath,
        coverage: totalCoverage,
        uncoveredFiles,
        meetsCriteria
      };

    } catch (error) {
      throw new Error(`Failed to run coverage analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find files with low or no coverage
   */
  private findUncoveredFiles(appDir: string, coverageData: any): string[] {
    const uncoveredFiles: string[] = [];
    
    for (const [filePath, fileData] of Object.entries(coverageData)) {
      if (filePath === 'total') continue;
      
      const data = fileData as any;
      if (data.lines && data.lines.pct < this.COVERAGE_THRESHOLD) {
        uncoveredFiles.push(filePath.replace(appDir, ''));
      }
    }

    return uncoveredFiles.sort();
  }

  /**
   * Generate coverage summary
   */
  private generateSummary(reports: CoverageReport[]): CoverageSummary {
    const passingApps = reports.filter(r => r.meetsCriteria).length;
    const failingApps = reports.length - passingApps;

    // Calculate overall coverage
    let totalLines = 0;
    let coveredLines = 0;

    for (const report of reports) {
      totalLines += report.coverage.lines.total;
      coveredLines += report.coverage.lines.covered;
    }

    const overallCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;

    return {
      totalApps: reports.length,
      passingApps,
      failingApps,
      overallCoverage,
      reports
    };
  }

  /**
   * Generate detailed coverage report
   */
  private async generateDetailedReport(summary: CoverageSummary): Promise<void> {
    const reportPath = join(process.cwd(), 'coverage-report.md');
    
    let report = `# Test Coverage Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    // Summary
    report += `## Summary\n\n`;
    report += `- **Total Applications:** ${summary.totalApps}\n`;
    report += `- **Passing (≥80%):** ${summary.passingApps}\n`;
    report += `- **Failing (<80%):** ${summary.failingApps}\n`;
    report += `- **Overall Coverage:** ${summary.overallCoverage.toFixed(1)}%\n\n`;
    
    // Status
    if (summary.failingApps === 0) {
      report += `🎉 **STATUS: ALL APPLICATIONS MEET COVERAGE REQUIREMENTS**\n\n`;
    } else {
      report += `⚠️ **STATUS: ${summary.failingApps} APPLICATION(S) NEED IMPROVEMENT**\n\n`;
    }

    // Detailed results
    report += `## Detailed Results\n\n`;
    
    for (const appReport of summary.reports) {
      const status = appReport.meetsCriteria ? '✅' : '❌';
      report += `### ${status} ${appReport.app}\n\n`;
      
      report += `| Metric | Coverage | Covered | Total |\n`;
      report += `|--------|----------|---------|-------|\n`;
      report += `| Lines | ${appReport.coverage.lines.pct.toFixed(1)}% | ${appReport.coverage.lines.covered} | ${appReport.coverage.lines.total} |\n`;
      report += `| Functions | ${appReport.coverage.functions.pct.toFixed(1)}% | ${appReport.coverage.functions.covered} | ${appReport.coverage.functions.total} |\n`;
      report += `| Branches | ${appReport.coverage.branches.pct.toFixed(1)}% | ${appReport.coverage.branches.covered} | ${appReport.coverage.branches.total} |\n`;
      report += `| Statements | ${appReport.coverage.statements.pct.toFixed(1)}% | ${appReport.coverage.statements.covered} | ${appReport.coverage.statements.total} |\n\n`;

      if (appReport.uncoveredFiles.length > 0) {
        report += `**Files needing coverage improvement:**\n`;
        for (const file of appReport.uncoveredFiles.slice(0, 10)) { // Show top 10
          report += `- ${file}\n`;
        }
        if (appReport.uncoveredFiles.length > 10) {
          report += `- ... and ${appReport.uncoveredFiles.length - 10} more files\n`;
        }
        report += `\n`;
      }
    }

    // Recommendations
    report += `## Recommendations\n\n`;
    
    const failingApps = summary.reports.filter(r => !r.meetsCriteria);
    if (failingApps.length > 0) {
      report += `### Priority Actions\n\n`;
      
      for (const app of failingApps) {
        const gap = this.COVERAGE_THRESHOLD - app.coverage.lines.pct;
        report += `**${app.app}** (${gap.toFixed(1)}% gap):\n`;
        report += `- Add unit tests for core business logic\n`;
        report += `- Focus on uncovered functions and branches\n`;
        report += `- Consider integration tests for complex workflows\n\n`;
      }
    }

    report += `### Best Practices\n\n`;
    report += `- Write tests before implementing new features (TDD)\n`;
    report += `- Focus on testing business logic and edge cases\n`;
    report += `- Use integration tests for API endpoints\n`;
    report += `- Mock external dependencies appropriately\n`;
    report += `- Regularly review and update test coverage\n\n`;

    writeFileSync(reportPath, report);
    console.log(`\n📄 Detailed report generated: ${reportPath}`);
  }

  /**
   * Create missing test files for uncovered code
   */
  async generateTestTemplates(): Promise<void> {
    console.log('\n🏗️ Generating test templates for uncovered files...');

    for (const app of this.apps) {
      try {
        const appDir = join(process.cwd(), app);
        const srcDir = join(appDir, 'src');
        const testDir = join(appDir, 'test');

        if (!existsSync(srcDir)) continue;

        // Find TypeScript files without corresponding tests
        const sourceFiles = this.findSourceFiles(srcDir);
        const missingTests = sourceFiles.filter(file => {
          const testFile = file.replace('/src/', '/test/').replace('.ts', '.test.ts');
          return !existsSync(testFile);
        });

        if (missingTests.length > 0) {
          console.log(`📝 ${app}: Creating ${missingTests.length} test templates`);
          
          for (const sourceFile of missingTests.slice(0, 5)) { // Limit to 5 per app
            await this.createTestTemplate(sourceFile, app);
          }
        }

      } catch (error) {
        console.log(`⚠️ Failed to generate templates for ${app}:`, error);
      }
    }
  }

  /**
   * Find all TypeScript source files
   */
  private findSourceFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const items = require('fs').readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = join(dir, item.name);
        
        if (item.isDirectory() && !item.name.startsWith('.')) {
          files.push(...this.findSourceFiles(fullPath));
        } else if (item.isFile() && item.name.endsWith('.ts') && !item.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  /**
   * Create test template for a source file
   */
  private async createTestTemplate(sourceFile: string, app: string): Promise<void> {
    const testFile = sourceFile.replace('/src/', '/test/').replace('.ts', '.test.ts');
    const testDir = require('path').dirname(testFile);
    
    // Ensure test directory exists
    require('fs').mkdirSync(testDir, { recursive: true });

    // Generate basic test template
    const className = require('path').basename(sourceFile, '.ts');
    const relativePath = require('path').relative(testDir, sourceFile).replace('.ts', '');

    const template = `/**
 * Test suite for ${className}
 * Generated automatically - please implement actual tests
 */

import { ${className} } from '${relativePath}';

describe('${className}', () => {
  beforeEach(() => {
    // Setup test environment
  });

  afterEach(() => {
    // Cleanup after tests
  });

  describe('constructor', () => {
    it('should create instance successfully', () => {
      // TODO: Implement constructor test
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('core functionality', () => {
    it('should handle normal operations', () => {
      // TODO: Implement functionality tests
      expect(true).toBe(true); // Placeholder
    });

    it('should handle edge cases', () => {
      // TODO: Implement edge case tests
      expect(true).toBe(true); // Placeholder
    });

    it('should handle error conditions', () => {
      // TODO: Implement error handling tests
      expect(true).toBe(true); // Placeholder
    });
  });
});
`;

    writeFileSync(testFile, template);
  }
}

// Main execution
async function main() {
  const enforcer = new TestCoverageEnforcer();
  
  try {
    const summary = await enforcer.enforceTestCoverage();
    
    console.log('\n📊 COVERAGE ENFORCEMENT SUMMARY');
    console.log('================================');
    console.log(`Total Applications: ${summary.totalApps}`);
    console.log(`Passing (≥80%): ${summary.passingApps}`);
    console.log(`Failing (<80%): ${summary.failingApps}`);
    console.log(`Overall Coverage: ${summary.overallCoverage.toFixed(1)}%`);
    
    if (summary.failingApps === 0) {
      console.log('\n🎉 ALL APPLICATIONS MEET COVERAGE REQUIREMENTS!');
      process.exit(0);
    } else {
      console.log(`\n⚠️ ${summary.failingApps} APPLICATION(S) NEED IMPROVEMENT`);
      
      // Optionally generate test templates
      if (process.argv.includes('--generate-templates')) {
        await enforcer.generateTestTemplates();
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Coverage enforcement failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { TestCoverageEnforcer };
