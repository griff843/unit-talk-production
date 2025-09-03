#!/usr/bin/env tsx

/**
 * Performance Benchmark Runner
 * Executes comprehensive performance tests and generates detailed reports
 */

import 'dotenv/config';
import { PerformanceBenchmark, BenchmarkSuite } from './src/test/performance/PerformanceBenchmark';
import { createLogger } from './src/utils/logger';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('BenchmarkRunner');

async function main() {
  logger.info('🚀 Starting Unit Talk Performance Benchmark Suite');
  logger.info('📊 This will measure BEFORE vs AFTER performance with real production data');
  
  const benchmark = new PerformanceBenchmark();
  
  try {
    // Run the complete benchmark suite
    const results = await benchmark.runFullBenchmark();
    
    // Generate detailed report
    await generateBenchmarkReport(results);
    
    // Log summary to console
    logBenchmarkSummary(results);
    
    // Exit with appropriate code
    process.exit(results.failedTests > 0 ? 1 : 0);
    
  } catch (error) {
    logger.error('❌ Benchmark suite failed', { error });
    process.exit(1);
  }
}

async function generateBenchmarkReport(suite: BenchmarkSuite): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, `performance-report-${timestamp}.json`);
  const htmlReportPath = path.join(__dirname, `performance-report-${timestamp}.html`);
  
  // Save JSON report
  await fs.writeFile(reportPath, JSON.stringify(suite, null, 2));
  
  // Generate HTML report
  const htmlReport = generateHtmlReport(suite);
  await fs.writeFile(htmlReportPath, htmlReport);
  
  logger.info('📄 Reports generated', {
    jsonReport: reportPath,
    htmlReport: htmlReportPath
  });
}

function generateHtmlReport(suite: BenchmarkSuite): string {
  const successfulTests = suite.results.filter(r => r.success);
  const failedTests = suite.results.filter(r => !r.success);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unit Talk Performance Benchmark Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #28a745; }
        .metric-label { color: #6c757d; margin-top: 5px; }
        .test-results { margin-bottom: 30px; }
        .test-card { background: white; border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
        .test-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #dee2e6; }
        .test-content { padding: 20px; }
        .improvement { font-size: 1.5em; font-weight: bold; }
        .improvement.positive { color: #28a745; }
        .improvement.negative { color: #dc3545; }
        .performance-bars { display: flex; gap: 10px; margin: 15px 0; }
        .bar { height: 30px; border-radius: 4px; display: flex; align-items: center; padding: 0 10px; color: white; font-weight: bold; }
        .bar.before { background: #dc3545; }
        .bar.after { background: #28a745; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 15px; }
        .failed { border-left: 4px solid #dc3545; }
        .success { border-left: 4px solid #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Unit Talk Performance Benchmark Report</h1>
        <p>Comprehensive performance validation with real production data</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${suite.overallImprovement.toFixed(1)}%</div>
            <div class="metric-label">Overall Improvement</div>
        </div>
        <div class="metric">
            <div class="metric-value">${suite.successfulTests}/${suite.totalTestsRun}</div>
            <div class="metric-label">Tests Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value">${(suite.executionTime / 1000).toFixed(1)}s</div>
            <div class="metric-label">Execution Time</div>
        </div>
        <div class="metric">
            <div class="metric-value">${successfulTests.reduce((sum, r) => sum + r.improvementPercent, 0) > 0 ? '✅' : '❌'}</div>
            <div class="metric-label">Performance Grade</div>
        </div>
    </div>

    <div class="test-results">
        <h2>📊 Detailed Test Results</h2>
        ${suite.results.map(result => `
            <div class="test-card ${result.success ? 'success' : 'failed'}">
                <div class="test-header">
                    <h3>${result.success ? '✅' : '❌'} ${result.testName}</h3>
                    ${result.success ? 
                        `<div class="improvement ${result.improvementPercent > 0 ? 'positive' : 'negative'}">
                            ${result.improvementPercent > 0 ? '+' : ''}${result.improvementPercent.toFixed(1)}% improvement
                        </div>` : 
                        `<div class="improvement negative">Failed: ${result.error}</div>`
                    }
                </div>
                <div class="test-content">
                    ${result.success ? `
                        <div class="performance-bars">
                            <div class="bar before" style="width: ${Math.max(result.beforeMs / Math.max(result.beforeMs, result.afterMs) * 300, 50)}px">
                                Before: ${result.beforeMs.toFixed(1)}ms
                            </div>
                            <div class="bar after" style="width: ${Math.max(result.afterMs / Math.max(result.beforeMs, result.afterMs) * 300, 50)}px">
                                After: ${result.afterMs.toFixed(1)}ms
                            </div>
                        </div>
                        <p><strong>Throughput:</strong> ${result.throughputBefore.toFixed(1)} → ${result.throughputAfter.toFixed(1)} ops/sec</p>
                        ${result.memoryBefore > 0 ? `<p><strong>Memory:</strong> ${(result.memoryBefore / 1024 / 1024).toFixed(1)}MB → ${(result.memoryAfter / 1024 / 1024).toFixed(1)}MB</p>` : ''}
                    ` : ''}
                    <div class="details">
                        <strong>Details:</strong>
                        <pre>${JSON.stringify(result.details, null, 2)}</pre>
                    </div>
                </div>
            </div>
        `).join('')}
    </div>

    <div class="summary">
        <h2>🎯 Key Findings</h2>
        <ul>
            ${successfulTests.map(r => `<li><strong>${r.testName}:</strong> ${r.improvementPercent.toFixed(1)}% improvement (${r.beforeMs.toFixed(1)}ms → ${r.afterMs.toFixed(1)}ms)</li>`).join('')}
            ${failedTests.length > 0 ? `<li style="color: #dc3545;"><strong>Failed Tests:</strong> ${failedTests.map(r => r.testName).join(', ')}</li>` : ''}
        </ul>
    </div>
</body>
</html>`;
}

function logBenchmarkSummary(suite: BenchmarkSuite): void {
  logger.info('📊 BENCHMARK RESULTS SUMMARY');
  logger.info('=' .repeat(50));
  logger.info(`Overall Performance Improvement: ${suite.overallImprovement.toFixed(1)}%`);
  logger.info(`Tests Passed: ${suite.successfulTests}/${suite.totalTestsRun}`);
  logger.info(`Execution Time: ${(suite.executionTime / 1000).toFixed(1)} seconds`);
  logger.info('');
  
  logger.info('🎯 Individual Test Results:');
  suite.results.forEach(result => {
    if (result.success) {
      logger.info(`✅ ${result.testName}: ${result.improvementPercent.toFixed(1)}% improvement`);
      logger.info(`   Before: ${result.beforeMs.toFixed(1)}ms | After: ${result.afterMs.toFixed(1)}ms`);
      logger.info(`   Throughput: ${result.throughputBefore.toFixed(1)} → ${result.throughputAfter.toFixed(1)} ops/sec`);
    } else {
      logger.error(`❌ ${result.testName}: FAILED - ${result.error}`);
    }
    logger.info('');
  });
  
  // Performance grade assessment
  const avgImprovement = suite.overallImprovement;
  let grade = 'F';
  if (avgImprovement >= 80) grade = 'A+';
  else if (avgImprovement >= 70) grade = 'A';
  else if (avgImprovement >= 60) grade = 'B+';
  else if (avgImprovement >= 50) grade = 'B';
  else if (avgImprovement >= 40) grade = 'C+';
  else if (avgImprovement >= 30) grade = 'C';
  else if (avgImprovement >= 20) grade = 'D';
  
  logger.info(`🏆 PERFORMANCE GRADE: ${grade}`);
  logger.info(`🎯 TARGET ACHIEVED: ${avgImprovement >= 50 ? 'YES ✅' : 'NO ❌'} (Target: 50%+ improvement)`);
}

// Run the benchmark
main().catch(error => {
  logger.error('Fatal error in benchmark runner', { error });
  process.exit(1);
});
