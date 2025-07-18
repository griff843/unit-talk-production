import * as fs from 'fs';

// Function to fix specific syntax errors in gradingEngine.ts
function fixGradingEngineSyntaxErrors() {
  const filePath = 'src/agents/GradingAgent/scoring/gradingEngine.ts';
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the specific syntax error on line 218
  content = content.replace(
    /const\s*{\s*tier,\s*confidence\s+return;/g,
    'const { tier, confidence'
  );
  
  // Fix any other similar patterns where return; is incorrectly placed
  content = content.replace(
    /(\w+)\s+return;\s*\n\s*}/g,
    '$1\n}'
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed syntax errors in: ${filePath}`);
}

// Function to fix syntax errors in featureEngineer.ts
function fixFeatureEngineerSyntaxErrors() {
  const filePath = 'src/agents/GradingAgent/scoring/featureEngineer.ts';
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Look for and fix common syntax patterns
  // Fix incomplete object destructuring
  content = content.replace(
    /const\s*{\s*([^}]+)\s+:/g,
    'const { $1:'
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed syntax errors in: ${filePath}`);
}

// Main execution
console.log('Fixing specific syntax errors...');
fixGradingEngineSyntaxErrors();
fixFeatureEngineerSyntaxErrors();
console.log('Syntax fixes completed!');