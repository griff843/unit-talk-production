#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function verifyDockerSetup() {
  const report = {
    timestamp: new Date().toISOString(),
    overall: 'PASS',
    checks: []
  };

  // Check 1: Dockerfile exists and is monorepo-aware
  try {
    const dockerfilePath = path.join('apps', 'api', 'Dockerfile');
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
    
    const checks = [
      { pattern: /COPY packages/, description: 'Copies packages directory' },
      { pattern: /WORKDIR.*apps\/api/, description: 'Sets correct working directory' },
      { pattern: /npm.*workspace/, description: 'Uses workspace commands' },
      { pattern: /FROM node/, description: 'Uses Node.js base image' }
    ];

    let dockerfileScore = 0;
    const dockerfileDetails = [];

    for (const check of checks) {
      const passed = check.pattern.test(dockerfileContent);
      dockerfileScore += passed ? 1 : 0;
      dockerfileDetails.push({
        check: check.description,
        passed,
        pattern: check.pattern.toString()
      });
    }

    report.checks.push({
      name: 'Dockerfile Monorepo Compliance',
      status: dockerfileScore >= 3 ? 'PASS' : 'FAIL',
      score: `${dockerfileScore}/${checks.length}`,
      details: dockerfileDetails,
      path: dockerfilePath
    });

    if (dockerfileScore < 3) {
      report.overall = 'FAIL';
    }

  } catch (error) {
    report.checks.push({
      name: 'Dockerfile Monorepo Compliance',
      status: 'FAIL',
      error: error.message,
      path: 'apps/api/Dockerfile'
    });
    report.overall = 'FAIL';
  }

  // Check 2: docker-compose.yml exists and is properly configured
  try {
    const dockerComposePath = 'docker-compose.yml';
    const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
    
    const checks = [
      { pattern: /api:/, description: 'Defines API service' },
      { pattern: /database:/, description: 'Defines database service' },
      { pattern: /volumes:/, description: 'Uses volumes for persistence' },
      { pattern: /environment:/, description: 'Configures environment variables' }
    ];

    let composeScore = 0;
    const composeDetails = [];

    for (const check of checks) {
      const passed = check.pattern.test(dockerComposeContent);
      composeScore += passed ? 1 : 0;
      composeDetails.push({
        check: check.description,
        passed,
        pattern: check.pattern.toString()
      });
    }

    report.checks.push({
      name: 'Docker Compose Configuration',
      status: composeScore >= 3 ? 'PASS' : 'FAIL',
      score: `${composeScore}/${checks.length}`,
      details: composeDetails,
      path: dockerComposePath
    });

    if (composeScore < 3) {
      report.overall = 'FAIL';
    }

  } catch (error) {
    report.checks.push({
      name: 'Docker Compose Configuration',
      status: 'FAIL',
      error: error.message,
      path: 'docker-compose.yml'
    });
    report.overall = 'FAIL';
  }

  // Check 3: .dockerignore exists and excludes proper files
  try {
    const dockerignorePath = '.dockerignore';
    const dockerignoreContent = fs.readFileSync(dockerignorePath, 'utf8');
    
    const checks = [
      { pattern: /node_modules/, description: 'Excludes node_modules' },
      { pattern: /\.git/, description: 'Excludes .git directory' },
      { pattern: /dist/, description: 'Excludes dist directories' },
      { pattern: /\.env/, description: 'Excludes environment files' }
    ];

    let ignoreScore = 0;
    const ignoreDetails = [];

    for (const check of checks) {
      const passed = check.pattern.test(dockerignoreContent);
      ignoreScore += passed ? 1 : 0;
      ignoreDetails.push({
        check: check.description,
        passed,
        pattern: check.pattern.toString()
      });
    }

    report.checks.push({
      name: 'Docker Ignore Configuration',
      status: ignoreScore >= 3 ? 'PASS' : 'DEGRADED',
      score: `${ignoreScore}/${checks.length}`,
      details: ignoreDetails,
      path: dockerignorePath
    });

    if (ignoreScore < 2) {
      report.overall = 'FAIL';
    } else if (ignoreScore < 3 && report.overall === 'PASS') {
      report.overall = 'DEGRADED';
    }

  } catch (error) {
    report.checks.push({
      name: 'Docker Ignore Configuration',
      status: 'DEGRADED',
      error: error.message,
      path: '.dockerignore',
      note: 'Missing .dockerignore file (recommended but not critical)'
    });
    if (report.overall === 'PASS') {
      report.overall = 'DEGRADED';
    }
  }

  // Check 4: dev.sh script exists and supports Docker operations
  try {
    const devScriptPath = 'dev.sh';
    const devScriptContent = fs.readFileSync(devScriptPath, 'utf8');
    
    const checks = [
      { pattern: /docker-compose/, description: 'Uses docker-compose commands' },
      { pattern: /start/, description: 'Supports start command' },
      { pattern: /stop/, description: 'Supports stop command' },
      { pattern: /logs/, description: 'Supports logs command' }
    ];

    let devScore = 0;
    const devDetails = [];

    for (const check of checks) {
      const passed = check.pattern.test(devScriptContent);
      devScore += passed ? 1 : 0;
      devDetails.push({
        check: check.description,
        passed,
        pattern: check.pattern.toString()
      });
    }

    report.checks.push({
      name: 'Development Script Docker Support',
      status: devScore >= 3 ? 'PASS' : 'DEGRADED',
      score: `${devScore}/${checks.length}`,
      details: devDetails,
      path: devScriptPath
    });

    if (devScore < 2) {
      report.overall = 'FAIL';
    } else if (devScore < 3 && report.overall === 'PASS') {
      report.overall = 'DEGRADED';
    }

  } catch (error) {
    report.checks.push({
      name: 'Development Script Docker Support',
      status: 'DEGRADED',
      error: error.message,
      path: 'dev.sh',
      note: 'Missing dev.sh script (recommended for Docker operations)'
    });
    if (report.overall === 'PASS') {
      report.overall = 'DEGRADED';
    }
  }

  return report;
}

async function main() {
  console.log('🐳 Verifying Docker setup...');
  
  const report = await verifyDockerSetup();
  
  // Ensure output directory exists
  const outDir = path.join(process.cwd(), 'out', 'ops');
  fs.mkdirSync(outDir, { recursive: true });
  
  // Write report
  const reportPath = path.join(outDir, 'docker-verify.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Log results
  console.log(`\n📊 Docker Verification Results:`);
  console.log(`Overall Status: ${report.overall === 'PASS' ? '✅' : report.overall === 'DEGRADED' ? '⚠️' : '❌'} ${report.overall}`);
  
  for (const check of report.checks) {
    console.log(`\n🔍 ${check.name}:`);
    console.log(`  Status: ${check.status === 'PASS' ? '✅' : check.status === 'DEGRADED' ? '⚠️' : '❌'} ${check.status}`);
    if (check.score) {
      console.log(`  Score: ${check.score}`);
    }
    if (check.error) {
      console.log(`  Error: ${check.error}`);
    }
    if (check.note) {
      console.log(`  Note: ${check.note}`);
    }
    if (check.details) {
      for (const detail of check.details) {
        console.log(`    ${detail.passed ? '✅' : '❌'} ${detail.check}`);
      }
    }
  }
  
  console.log(`\n📄 Full report: ${reportPath}`);
  
  process.exit(report.overall === 'FAIL' ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}
