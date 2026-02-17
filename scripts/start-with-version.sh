#!/bin/bash
# start-with-version.sh
# Starts docker-compose with git version provenance injected
# Part of: ui/surface-reset-020

set -e

# Get git info
export GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
export GIT_COMMIT_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

echo "=========================================="
echo "Unit Talk Platform Startup"
echo "=========================================="
echo "GIT_COMMIT:       ${GIT_COMMIT}"
echo "GIT_COMMIT_SHORT: ${GIT_COMMIT_SHORT}"
echo "GIT_BRANCH:       ${GIT_BRANCH}"
echo "=========================================="

# Validate git info (warning only, don't fail)
if [ "$GIT_COMMIT" = "unknown" ]; then
    echo "WARNING: GIT_COMMIT is unknown - version provenance may be unreliable"
fi

# Start docker-compose with the exported variables
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build "$@"

echo ""
echo "=========================================="
echo "Services Starting..."
echo "=========================================="
echo ""
echo "Smart Form:      http://localhost:3002/submit-ticket"
echo "Command Center:  http://localhost:3004"
echo "API:             http://localhost:3010"
echo ""
echo "Version Endpoints:"
echo "  curl http://localhost:3010/version"
echo "  curl http://localhost:3002/api/version"
echo "  curl http://localhost:3004/api/version"
echo ""
echo "=========================================="
