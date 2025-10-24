#!/bin/bash
# Blue-Green Deployment Script
# Usage: ./deploy.sh <color> <percentage>
# Example: ./deploy.sh blue 5
# Example: ./deploy.sh green 100

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Function to print colored messages
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Function to display usage
usage() {
  cat <<EOF
Usage: $0 <color> <percentage>

Arguments:
  color       Deployment color (blue|green)
  percentage  Traffic percentage to route (5|25|100)

Examples:
  $0 blue 5      # Route 5% traffic to blue
  $0 green 25    # Route 25% traffic to green
  $0 blue 100    # Route 100% traffic to blue (full cutover)

Environment Variables:
  GH_TOKEN       GitHub token for workflow dispatch (required)
  ENV            Target environment (staging|production, default: production)
EOF
  exit 1
}

# Validate arguments
if [ $# -ne 2 ]; then
  log_error "Invalid number of arguments"
  usage
fi

COLOR=$1
PERCENTAGE=$2
ENV=${ENV:-production}

# Validate color
if [[ ! "$COLOR" =~ ^(blue|green)$ ]]; then
  log_error "Invalid color: $COLOR. Must be 'blue' or 'green'"
  exit 1
fi

# Validate percentage
if [[ ! "$PERCENTAGE" =~ ^(5|25|100)$ ]]; then
  log_error "Invalid percentage: $PERCENTAGE. Must be 5, 25, or 100"
  exit 1
fi

# Validate environment
if [[ ! "$ENV" =~ ^(staging|production)$ ]]; then
  log_error "Invalid environment: $ENV. Must be 'staging' or 'production'"
  exit 1
fi

# Check for GH_TOKEN
if [ -z "${GH_TOKEN:-}" ]; then
  log_error "GH_TOKEN environment variable is required"
  exit 1
fi

log_info "Starting blue-green deployment"
log_info "  Color: $COLOR"
log_info "  Percentage: $PERCENTAGE%"
log_info "  Environment: $ENV"

# Dispatch to GitHub workflow
log_info "Triggering GitHub workflow dispatch..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/${GITHUB_REPOSITORY:-anthropics/unit-talk-production}/actions/workflows/global-deploy.yml/dispatches \
  -d "{\"ref\":\"main\",\"inputs\":{\"env\":\"${ENV}\",\"mode\":\"${COLOR}\",\"rollout\":\"${PERCENTAGE}\"}}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 204 ]; then
  log_info "Workflow dispatch successful"
  log_info "Monitor deployment: https://github.com/${GITHUB_REPOSITORY:-anthropics/unit-talk-production}/actions"
  exit 0
else
  log_error "Workflow dispatch failed with status: $HTTP_CODE"
  log_error "Response: $BODY"
  exit 1
fi
