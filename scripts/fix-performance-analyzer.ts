import * as fs from 'fs';

// Function to fix specific syntax errors in performanceAnalyzer.ts
function fixPerformanceAnalyzerSyntax() {
  const file = 'src/agents/GradingAgent/scoring/performanceAnalyzer.ts';
  
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix the specific syntax error on line 176
  content = content.replace(
    /trend:\s*\[\]/g,
    'trend: []'
  );
  
  // Fix any array syntax issues with extra spaces
  content = content.replace(
    /\[\s+\]/g,
    '[]'
  );
  
  // Fix array type declarations with issues
  content = content.replace(
    /BetResult\s*\[\s*\]/g,
    'BetResult[]'
  );
  
  // Fix generic array syntax
  content = content.replace(
    /Array<([^>]+)>\s*{/g,
    'Array<$1> {'
  );
  
  fs.writeFileSync(file, content);
  console.log(`Fixed syntax errors in: ${file}`);
}

// Main execution
console.log('Fixing performanceAnalyzer syntax errors...');
fixPerformanceAnalyzerSyntax();
console.log('Syntax fixes completed!');