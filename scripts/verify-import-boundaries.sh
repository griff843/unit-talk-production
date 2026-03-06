#!/usr/bin/env bash
# SPRINT-REPO-TRUTH-LOCK-002: Import boundary verification
# Ensures: no app-to-app imports, no package-to-app imports
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=true

echo "=== Import Boundary Verification ==="
echo ""

# 1. Check no app imports from another app
echo "--- Check 1: No cross-app imports ---"
CROSS_APP=$(grep -rn "from ['\"].*apps/" "$REPO_ROOT/apps/" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next" || true)
if [ -n "$CROSS_APP" ]; then
  echo "FAIL: Cross-app imports found:"
  echo "$CROSS_APP"
  PASS=false
else
  echo "PASS: No cross-app imports"
fi
echo ""

# 2. Check no relative imports that escape app boundary into another app
echo "--- Check 2: No relative imports escaping to other apps ---"
ESCAPE=$(grep -rn "from ['\"]\.\.\/\.\.\/\.\.\/\.\.\/apps/" "$REPO_ROOT/apps/" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules || true)
if [ -n "$ESCAPE" ]; then
  echo "FAIL: Relative imports escaping to other apps:"
  echo "$ESCAPE"
  PASS=false
else
  echo "PASS: No relative imports escaping app boundary"
fi
echo ""

# 3. Check no package imports from apps
echo "--- Check 3: No package-to-app imports ---"
PKG_TO_APP=$(grep -rn "from ['\"].*apps/" "$REPO_ROOT/packages/" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules || true)
if [ -n "$PKG_TO_APP" ]; then
  echo "FAIL: Package imports from apps:"
  echo "$PKG_TO_APP"
  PASS=false
else
  echo "PASS: No package-to-app imports"
fi
echo ""

# 4. Verify package dependency directions (packages should not depend on apps in package.json)
echo "--- Check 4: No app dependencies in package.json ---"
for pkg_json in "$REPO_ROOT"/packages/*/package.json; do
  pkg_name=$(basename "$(dirname "$pkg_json")")
  if grep -q '"unit-talk-platform"' "$pkg_json" 2>/dev/null; then
    echo "FAIL: packages/$pkg_name/package.json depends on an app"
    PASS=false
  fi
done
echo "PASS: No app dependencies in package configs"
echo ""

# Summary
echo "==========================="
if [ "$PASS" = true ]; then
  echo "GATE PASSED: All import boundaries clean"
  exit 0
else
  echo "GATE FAILED: Import boundary violations detected"
  exit 1
fi
