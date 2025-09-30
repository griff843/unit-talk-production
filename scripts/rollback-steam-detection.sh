#!/bin/bash

# Steam Detection Engine Rollback Script
# Removes steam detection integration from AlertAgent

set -e

echo "🌊 Rolling back Steam Detection Engine..."

# Remove SteamDetectionIntegrator
rm -f apps/api/src/agents/AlertAgent/SteamDetectionIntegrator.ts

# Restore original AlertAgent
git checkout HEAD^ -- apps/api/src/agents/AlertAgent/index.ts

# Restart AlertAgent
docker-compose restart api

echo "✅ Steam Detection Engine rollback completed"