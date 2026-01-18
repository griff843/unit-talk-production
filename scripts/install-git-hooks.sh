#!/bin/bash
# ============================================================================
# Git Hooks Installation Script
# Purpose: Install pre-commit hooks for secret scanning and code quality
# Usage: bash scripts/install-git-hooks.sh
# ============================================================================

set -e  # Exit on error

echo "========================================="
echo "UNIT TALK - GIT HOOKS INSTALLATION"
echo "========================================="
echo ""

# ============================================================================
# CHECK PREREQUISITES
# ============================================================================

echo "📋 Checking prerequisites..."

# Check if Python is installed (required for pre-commit)
if ! command -v python3 &> /dev/null; then
    echo "❌ ERROR: Python 3 is required but not installed"
    echo "   Install Python: https://www.python.org/downloads/"
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ ERROR: pip3 is required but not installed"
    echo "   Install pip: python3 -m ensurepip --upgrade"
    exit 1
fi

echo "✅ Python 3 and pip3 are installed"

# ============================================================================
# INSTALL PRE-COMMIT FRAMEWORK
# ============================================================================

echo ""
echo "📦 Installing pre-commit framework..."

if ! command -v pre-commit &> /dev/null; then
    pip3 install pre-commit
    echo "✅ pre-commit framework installed"
else
    echo "✅ pre-commit framework already installed"
fi

# ============================================================================
# INSTALL DETECT-SECRETS
# ============================================================================

echo ""
echo "🔒 Installing detect-secrets..."

if ! pip3 show detect-secrets &> /dev/null; then
    pip3 install detect-secrets
    echo "✅ detect-secrets installed"
else
    echo "✅ detect-secrets already installed"
fi

# ============================================================================
# CREATE SECRETS BASELINE
# ============================================================================

echo ""
echo "📝 Creating secrets baseline..."

if [ ! -f ".secrets.baseline" ]; then
    detect-secrets scan > .secrets.baseline
    echo "✅ Secrets baseline created"
else
    echo "ℹ️  Secrets baseline already exists"
    read -p "   Update baseline? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        detect-secrets scan > .secrets.baseline
        echo "✅ Secrets baseline updated"
    fi
fi

# ============================================================================
# INSTALL PRE-COMMIT HOOKS
# ============================================================================

echo ""
echo "🔧 Installing pre-commit hooks..."

pre-commit install
pre-commit install --hook-type commit-msg

echo "✅ Pre-commit hooks installed"

# ============================================================================
# INSTALL DEPENDENCIES
# ============================================================================

echo ""
echo "📦 Installing hook dependencies..."

pre-commit install-hooks

echo "✅ All dependencies installed"

# ============================================================================
# RUN INITIAL VALIDATION
# ============================================================================

echo ""
echo "🧪 Running initial validation..."

echo "   This may take a few minutes on first run..."
if pre-commit run --all-files; then
    echo "✅ All validation checks passed"
else
    echo "⚠️  Some checks failed - review output above"
    echo "   Note: This is normal for first-time setup"
    echo "   Pre-commit hooks will still be active for future commits"
fi

# ============================================================================
# CONFIGURE GIT IGNORE REVS (for blame)
# ============================================================================

echo ""
echo "🔧 Configuring git blame to ignore formatting commits..."

if ! git config --get blame.ignoreRevsFile &> /dev/null; then
    git config blame.ignoreRevsFile .git-blame-ignore-revs
    echo "✅ Git blame configuration updated"
fi

# ============================================================================
# SUCCESS MESSAGE
# ============================================================================

echo ""
echo "========================================="
echo "✅ GIT HOOKS INSTALLATION COMPLETE"
echo "========================================="
echo ""
echo "📋 What was installed:"
echo "   • pre-commit framework"
echo "   • detect-secrets (secret scanning)"
echo "   • ESLint hooks (code quality)"
echo "   • SQL migration validation"
echo "   • Conventional commit format checker"
echo ""
echo "🔒 Secret protection enabled:"
echo "   • .env files blocked from commits"
echo "   • Supabase service role keys blocked"
echo "   • Database connection strings blocked"
echo "   • Private keys detection enabled"
echo ""
echo "🎯 Next steps:"
echo "   1. Make a commit to test the hooks"
echo "   2. Run 'pre-commit run --all-files' to scan all files"
echo "   3. Review '.secrets.baseline' and commit it"
echo ""
echo "📚 Documentation:"
echo "   • Pre-commit config: .pre-commit-config.yaml"
echo "   • Secrets baseline: .secrets.baseline"
echo "   • More info: https://pre-commit.com/"
echo ""
echo "========================================="
