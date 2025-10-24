#!/bin/bash
# Traffic Routing Script for Blue-Green Deployments
# Usage: ./route-traffic.sh <color> <percentage>
# Example: ./route-traffic.sh green 25

set -euo pipefail

COLOR=$1
PERCENTAGE=$2

echo "🔄 Routing ${PERCENTAGE}% traffic to ${COLOR}..."

if [ "$COLOR" == "green" ]; then
  # Route traffic to GREEN (canary)
  kubectl patch ingress unit-talk-api-ingress-canary -n unit-talk --type=json \
    -p="[{\"op\": \"replace\", \"path\": \"/metadata/annotations/nginx.ingress.kubernetes.io~1canary-weight\", \"value\": \"${PERCENTAGE}\"}]"
  
  echo "✅ Routing ${PERCENTAGE}% to GREEN, $((100 - PERCENTAGE))% to BLUE"
  
elif [ "$COLOR" == "blue" ]; then
  # Route traffic back to BLUE (rollback)
  CANARY_WEIGHT=$((100 - PERCENTAGE))
  kubectl patch ingress unit-talk-api-ingress-canary -n unit-talk --type=json \
    -p="[{\"op\": \"replace\", \"path\": \"/metadata/annotations/nginx.ingress.kubernetes.io~1canary-weight\", \"value\": \"${CANARY_WEIGHT}\"}]"
  
  echo "✅ Routing ${PERCENTAGE}% to BLUE, ${CANARY_WEIGHT}% to GREEN"
fi

# Verify routing
echo "📊 Current routing configuration:"
kubectl get ingress unit-talk-api-ingress-canary -n unit-talk -o jsonpath='{.metadata.annotations.nginx\.ingress\.kubernetes\.io/canary-weight}'
echo ""

