/**
 * QA Report Generator
 * Generates comprehensive reports from QA test results
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { LaunchAssessment } from '../run-launch-qa';

export interface ReportOptions {
  outputDir: string;
  formats: string[];
  includeScreenshots: boolean;
  includeMetrics: boolean;
  timestamp: string;
}

export class QAReportGenerator {
  async generateReport(assessment: LaunchAssessment, options: ReportOptions): Promise<void> {
    // Ensure output directory exists
    if (!existsSync(options.outputDir)) {
      mkdirSync(options.outputDir, { recursive: true });
    }

    // Generate reports in requested formats
    for (const format of options.formats) {
      switch (format.toLowerCase()) {
        case 'html':
          await this.generateHTMLReport(assessment, options);
          break;
        case 'json':
          await this.generateJSONReport(assessment, options);
          break;
        case 'pdf':
          console.log('PDF generation not implemented yet');
          break;
        default:
          console.warn(`Unknown report format: ${format}`);
      }
    }
  }

  private async generateHTMLReport(assessment: LaunchAssessment, options: ReportOptions): Promise<void> {
    const html = this.buildHTMLReport(assessment);
    const filename = join(options.outputDir, `qa-report-${options.timestamp}.html`);
    writeFileSync(filename, html);
    console.log(`HTML report generated: ${filename}`);
  }

  private async generateJSONReport(assessment: LaunchAssessment, options: ReportOptions): Promise<void> {
    const filename = join(options.outputDir, `qa-report-${options.timestamp}.json`);
    writeFileSync(filename, JSON.stringify(assessment, null, 2));
    console.log(`JSON report generated: ${filename}`);
  }

  private buildHTMLReport(assessment: LaunchAssessment): string {
    const statusColor = assessment.overallStatus === 'READY' ? '#28a745' : 
                       assessment.overallStatus === 'CONDITIONAL' ? '#ffc107' : '#dc3545';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QA Launch Assessment Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .status { font-size: 24px; font-weight: bold; color: ${statusColor}; }
        .score { font-size: 48px; font-weight: bold; color: ${statusColor}; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .suite-pass { border-left: 5px solid #28a745; }
        .suite-warning { border-left: 5px solid #ffc107; }
        .suite-fail { border-left: 5px solid #dc3545; }
        .test-result { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 3px; }
        .critical { color: #dc3545; font-weight: bold; }
        .warning { color: #ffc107; font-weight: bold; }
        .recommendation { color: #17a2b8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>QA Launch Assessment Report</h1>
        <div class="status">Status: ${assessment.overallStatus}</div>
        <div class="score">${assessment.readinessScore}%</div>
        <p><strong>Environment:</strong> ${assessment.environment}</p>
        <p><strong>Duration:</strong> ${Math.round(assessment.duration / 1000)}s</p>
        <p><strong>Generated:</strong> ${assessment.timestamp}</p>
    </div>

    <h2>Test Suites</h2>
    ${assessment.testSuites.map(suite => `
        <div class="suite suite-${suite.status.toLowerCase()}">
            <h3>${suite.name} - ${suite.status}</h3>
            <p><strong>Duration:</strong> ${suite.duration}ms</p>
            <p><strong>Tests:</strong> ${suite.results.length}</p>
            ${suite.results.map(result => `
                <div class="test-result">
                    <strong>${result.testName}:</strong> ${result.status}<br>
                    ${result.message}
                </div>
            `).join('')}
        </div>
    `).join('')}

    ${assessment.criticalIssues.length > 0 ? `
        <h2>Critical Issues</h2>
        <ul>
            ${assessment.criticalIssues.map(issue => `<li class="critical">${issue}</li>`).join('')}
        </ul>
    ` : ''}

    ${assessment.warnings.length > 0 ? `
        <h2>Warnings</h2>
        <ul>
            ${assessment.warnings.map(warning => `<li class="warning">${warning}</li>`).join('')}
        </ul>
    ` : ''}

    <h2>Recommendations</h2>
    <ul>
        ${assessment.recommendations.map(rec => `<li class="recommendation">${rec}</li>`).join('')}
    </ul>
</body>
</html>`;
  }
}