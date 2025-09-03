const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getAllTSFiles() {
  try {
    const output = execSync('find src -name "*.ts" -type f', { cwd: __dirname, encoding: 'utf8' });
    return output.split('\n').filter(f => f.trim());
  } catch (error) {
    return [];
  }
}

function cleanupDoubleToISOCalls(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  let iterations = 0;
  const maxIterations = 5;

  // Keep applying fixes until no more changes or max iterations
  while (iterations < maxIterations) {
    const originalContent = content;

    // Fix any remaining multiple .toISOString() chains
    const patterns = [
      // Triple calls
      /toISOString\([^)]*\)\.toISOString\(\)\.toISOString\(\)/g,
      // Double calls
      /toISOString\([^)]*\)\.toISOString\(\)/g,
      // Simple variable.toISOString().toISOString()
      /(\w+)\.toISOString\(\)\.toISOString\(\)/g,
      // new Date().toISOString().toISOString()
      /new Date\(\)\.toISOString\(\)\.toISOString\(\)/g,
    ];

    patterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        if (index < 2) {
          // For toISOString chains, extract the inner argument
          content = content.replace(pattern, match => {
            const innerMatch = match.match(/toISOString\(([^)]*)\)/);
            if (innerMatch) {
              return `toISOString(${innerMatch[1]})`;
            }
            return 'toISOString(new Date())';
          });
        } else if (index === 2) {
          // For variable.toISOString().toISOString()
          content = content.replace(pattern, 'toISOString($1)');
        } else {
          // For new Date().toISOString().toISOString()
          content = content.replace(pattern, 'toISOString(new Date())');
        }
        modified = true;
      }
    });

    // If no changes were made, break
    if (content === originalContent) {
      break;
    }

    iterations++;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Cleaned up double calls: ${filePath} (${iterations} iterations)`);
  }
}

console.log('🧹 Cleaning up double toISOString calls...\n');

// Get all TypeScript files and clean them up
const tsFiles = getAllTSFiles();
if (tsFiles.length === 0) {
  console.log('No TypeScript files found, using fallback list...');
  // Fallback to known files
  const knownFiles = [
    'src/handlers/eventHandler.ts',
    'src/handlers/onboardingModalHandler.ts',
    'src/middleware/enterpriseMiddleware.ts',
    'src/routes/health.ts',
    'src/routes/monitoring.ts',
    'src/services/abTesting.ts',
    'src/services/adminOverrideService.ts',
    'src/services/advancedAnalyticsService.ts',
    'src/services/aiPoweredService.ts',
    'src/services/automatedThreadService.ts',
    'src/services/capperService.ts',
    'src/services/dmService.ts',
    'src/services/gradingService.ts',
  ];
  knownFiles.forEach(cleanupDoubleToISOCalls);
} else {
  tsFiles.forEach(cleanupDoubleToISOCalls);
}

console.log('\n✨ Double call cleanup completed!');
