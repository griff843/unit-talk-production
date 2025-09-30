#!/usr/bin/env python3
"""
Fix malformed supabase syntax patterns in TypeScript files.
"""
import os
import re
import glob

def fix_file(filepath):
    """Fix supabase syntax issues in a single file."""
    print(f"Fixing {filepath}")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Pattern 1: Fix "const { data, error } = const supabase = requireSupabase();\n  await supabase"
    pattern1 = r'const \{ ([^}]+) \} = const supabase = requireSupabase\(\);\s*await supabase'
    replacement1 = r'const supabase = requireSupabase();\n    const { \1 } = await supabase'
    content = re.sub(pattern1, replacement1, content)

    # Pattern 2: Fix other malformed const assignments
    pattern2 = r'const ([^=]+) = const supabase = requireSupabase\(\);\s*await supabase'
    replacement2 = r'const supabase = requireSupabase();\n    const \1 = await supabase'
    content = re.sub(pattern2, replacement2, content)

    # Pattern 3: Fix standalone "const supabase = requireSupabase();\n  await supabase"
    pattern3 = r'const supabase = requireSupabase\(\);\s*await supabase'
    replacement3 = r'const supabase = requireSupabase();\n    await supabase'
    content = re.sub(pattern3, replacement3, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Fixed Fixed {filepath}")
        return True
    else:
        print(f"  - No changes needed in {filepath}")
        return False

def main():
    """Fix all TypeScript files in the src directory."""
    os.chdir('./src')

    # Find all TypeScript files
    ts_files = []
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.ts'):
                ts_files.append(os.path.join(root, file))

    print(f"Found {len(ts_files)} TypeScript files")

    fixed_count = 0
    for filepath in ts_files:
        if fix_file(filepath):
            fixed_count += 1

    print(f"\nFixed {fixed_count} files")

if __name__ == '__main__':
    main()