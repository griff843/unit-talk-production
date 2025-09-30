#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Find all TypeScript files that have requireSupabase but no import
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

function fixSupabaseImports() {
  const files = getAllTsFiles(srcDir);
  let fixedFiles = 0;

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Check if file uses requireSupabase but doesn't import it
      const usesRequireSupabase = content.includes('requireSupabase');
      const hasRequireSupabaseImport = content.includes('requireSupabase') &&
        (content.includes("import { requireSupabase }") ||
         content.includes("import {requireSupabase}"));

      // Check if file uses supabaseClient but doesn't import it
      const usesSupabaseClient = content.includes('supabaseClient') && !content.includes('const supabaseClient');
      const hasSupabaseClientImport = content.includes('supabaseClient') &&
        (content.includes("import { supabaseClient }") ||
         content.includes("import {supabaseClient}"));

      if (!usesRequireSupabase && !usesSupabaseClient) {
        continue; // Skip files that don't need fixes
      }

      let newContent = content;
      let needsImport = false;
      let importsToAdd = [];

      if (usesRequireSupabase && !hasRequireSupabaseImport) {
        importsToAdd.push('requireSupabase');
        needsImport = true;
      }

      if (usesSupabaseClient && !hasSupabaseClientImport) {
        importsToAdd.push('supabaseClient');
        needsImport = true;
      }

      if (needsImport) {
        // Determine relative path to utils/supabaseUtils
        const relativePath = path.relative(path.dirname(filePath), path.join(srcDir, 'utils', 'supabaseUtils')).replace(/\\/g, '/');
        const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;

        // Find the last import statement
        const lines = newContent.split('\n');
        let lastImportIndex = -1;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('import ') && !lines[i].includes('//')) {
            lastImportIndex = i;
          }
        }

        // Add the import after the last import
        const importStatement = `import { ${importsToAdd.join(', ')} } from '${importPath}';`;

        if (lastImportIndex >= 0) {
          lines.splice(lastImportIndex + 1, 0, importStatement);
        } else {
          // No imports found, add at the beginning
          lines.unshift(importStatement);
          lines.unshift(''); // Add empty line after
        }

        newContent = lines.join('\n');

        // Also fix variable naming conflicts (supabase -> supabaseClient)
        newContent = newContent.replace(/const supabase = requireSupabase\(\)/g, 'const supabaseClient = requireSupabase()');

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

fixSupabaseImports();