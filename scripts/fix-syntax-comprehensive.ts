import * as fs from 'fs';
import * as glob from 'glob';

// Function to fix syntax errors with misplaced return statements
function fixMisplacedReturns() {
  const patterns = [
    'src/agents/GradingAgent/scoring/*.ts',
    'src/api/*.ts'
  ];
  
  patterns.forEach(pattern => {
    const files = glob.sync(pattern);
    
    files.forEach(file => {
      let content = fs.readFileSync(file, 'utf8');
      
      // Fix pattern: { ...something   return;
      content = content.replace(
        /({[^}]*)\s+return;/g,
        '$1'
      );
      
      // Fix pattern: const { something   return;
      content = content.replace(
        /(const\s*{[^}]*)\s+return;/g,
        '$1'
      );
      
      // Fix pattern: something   return; on same line followed by }
      content = content.replace(
        /([^;])\s+return;\s*\n\s*}/g,
        '$1\n}'
      );
      
      // Fix pattern: something   return; followed by ];
      content = content.replace(
        /([^;])\s+return;\s*\n\s*];/g,
        '$1\n];'
      );
      
      // Fix pattern in object literals
      content = content.replace(
        /:\s*([^,}]+)\s+return;/g,
        ': $1'
      );
      
      if (content !== fs.readFileSync(file, 'utf8')) {
        fs.writeFileSync(file, content);
        console.log(`Fixed syntax errors in: ${file}`);
      }
    });
  });
}

// Function to fix specific patterns in performanceAnalyzer.ts
function fixPerformanceAnalyzerErrors() {
  const file = 'src/agents/GradingAgent/scoring/performanceAnalyzer.ts';
  
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix array access syntax errors
  content = content.replace(
    /\[\s*\]/g,
    '[]'
  );
  
  // Fix object property syntax
  content = content.replace(
    /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([^,}]+)\s*\[\s*\]/g,
    '$1: $2[]'
  );
  
  fs.writeFileSync(file, content);
  console.log(`Fixed syntax errors in: ${file}`);
}

// Main execution
console.log('Fixing syntax errors...');
fixMisplacedReturns();
fixPerformanceAnalyzerErrors();
console.log('Syntax fixes completed!');