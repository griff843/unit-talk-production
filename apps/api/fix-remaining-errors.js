#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix remaining TypeScript issues
const srcDir = path.join(__dirname, 'src');

function getAllTsFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function fixRemainingErrors() {
  const files = getAllTsFiles(srcDir);
  let fixedFiles = 0;

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let newContent = content;
      let hasChanges = false;

      // Fix 1: Replace duplicate variable declarations
      // Replace "const supabase = requireSupabase()" with "const supabaseClient = requireSupabase()"
      if (newContent.includes('const supabase = requireSupabase()')) {
        newContent = newContent.replace(/const supabase = requireSupabase\(\)/g, 'const supabaseClient = requireSupabase()');
        // Also replace usage of that variable
        newContent = newContent.replace(/await supabase\./g, 'await supabaseClient.');
        hasChanges = true;
      }

      // Fix 2: Fix ShadowModeValidator specific issues
      if (filePath.includes('ShadowModeValidator.ts')) {
        // Remove redeclarations and fix variable usage
        newContent = newContent.replace(/const supabaseClient = requireSupabase\(\);/g, '');
        // Use the requireSupabase directly in usage
        newContent = newContent.replace(/supabaseClient\./g, 'requireSupabase().');
        hasChanges = true;
      }

      // Fix 3: Fix fetchEdgeConfig duplicate declarations
      if (filePath.includes('fetchEdgeConfig.ts')) {
        // Remove duplicate supabase declarations
        const lines = newContent.split('\n');
        const filteredLines = [];
        let insideFunction = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Skip duplicate supabase declarations inside functions
          if (line.includes('const supabase = requireSupabase()') && insideFunction) {
            continue;
          }

          if (line.includes('export async function') || line.includes('async function')) {
            insideFunction = true;
          }

          if (line.trim() === '}' && insideFunction) {
            insideFunction = false;
          }

          filteredLines.push(line);
        }

        newContent = filteredLines.join('\n');
        hasChanges = true;
      }

      // Fix 4: Shadow mode specific fixes - replace supabaseClient references
      if (filePath.includes('shadow/ShadowMode.ts')) {
        // Add import if not present
        if (!newContent.includes('import { requireSupabase }')) {
          const lines = newContent.split('\n');
          let lastImportIndex = -1;

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ') && !lines[i].includes('//')) {
              lastImportIndex = i;
            }
          }

          if (lastImportIndex >= 0) {
            lines.splice(lastImportIndex + 1, 0, "import { requireSupabase } from '../utils/supabaseUtils';");
            newContent = lines.join('\n');
          }
        }

        // Replace supabaseClient with requireSupabase()
        newContent = newContent.replace(/supabaseClient\./g, 'requireSupabase().');
        hasChanges = true;
      }

      // Fix 5: Remove duplicate imports in test files
      if (filePath.includes('test-') && filePath.endsWith('.ts')) {
        // Fix redeclaration issues
        newContent = newContent.replace(/const supabaseClient = requireSupabase\(\);[\s]*const supabaseClient = requireSupabase\(\);/g, 'const supabaseClient = requireSupabase();');
        hasChanges = true;
      }

      if (hasChanges) {
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ Fixed ${path.relative(srcDir, filePath)}`);
        fixedFiles++;
      }

    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }

  console.log(`\n🎉 Fixed ${fixedFiles} files`);
}

fixRemainingErrors();