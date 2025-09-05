# Scripts Overview

This folder contains operational and verification scripts used across the monorepo.

## Structure
- ops/: Operational checks and guards (e.g., verify Docker setup, validate env)
- e2e/: End-to-end helpers
- health-check.sh: Human-friendly environment health validator
- check-metrics.sh: Quick Prometheus metrics check (used by CI)

## Usage
- npm run health:check
- npm run alerts:test
- node scripts/ops/verify-docker.js

## Deprecations
The project has accumulated many ad-hoc scripts during rapid development. Files marked with the following banner are legacy and slated for consolidation or removal:

```
# DEPRECATION NOTICE
# This script is legacy and will be removed or consolidated.
# Prefer using scripts in scripts/ops or documented npm scripts in package.json.
```

Please migrate to the consolidated scripts where possible.

