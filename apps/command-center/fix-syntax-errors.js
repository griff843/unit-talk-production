#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Common colon syntax fixes needed
const fixes = [
  // interface syntax fixes
  { from: /:\w+:/g, to: (match) => match.slice(1, -1) },
  // property/type fixes 
  { from: /(\w+:)\s*(\w+:)/g, to: (match, p1, p2) => p1.slice(0, -1) + ': ' + p2.slice(0, -1) }
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    fixes.forEach(({ from, to }) => {
      const newContent = content.replace(from, to);
      if (newContent !== content) {
        changed = true;
        content = newContent;
      }
    });

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log('Fixed: ' + filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error fixing ' + filePath + ':', error.message);
    return false;
  }
}

// Target files with known issues
const targetFiles = [
  'src/components/monitoring/SystemControls.tsx',
  'src/app/api/approval/route.ts',
  'src/lib/cache.ts',
  'src/components/ui/toast.tsx',
  'src/components/ui/table.tsx'
];

let fixedCount = 0;
targetFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (fixFile(fullPath)) {
      fixedCount++;
    }
  } else {
    console.log('File not found: ' + fullPath);
  }
});

console.log('Fixed ' + fixedCount + ' files');
