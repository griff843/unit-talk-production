#!/bin/bash
# Deploy Redis Cache Warming CronJobs for Smart Form
# Date: 2025-10-25
# Ensures first-hit performance by pre-warming cache

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Smart Form Cache Warmer Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found. Please install kubectl.${NC}"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace unit-talk &> /dev/null; then
    echo -e "${YELLOW}⚠️  Namespace 'unit-talk' not found. Creating...${NC}"
    kubectl create namespace unit-talk
    echo -e "${GREEN}✅ Namespace created${NC}"
fi

# Apply cache warmer CronJobs
echo -e "${BLUE}📦 Deploying cache warming CronJobs...${NC}"
kubectl apply -f infrastructure/kubernetes/apps/smart-form/cache-warmers.yaml

# Wait for CronJobs to be created
echo -e "${BLUE}⏳ Waiting for CronJobs to be ready...${NC}"
sleep 3

# Verify CronJobs
echo ""
echo -e "${BLUE}🔍 Verifying CronJobs...${NC}"
kubectl get cronjobs -n unit-talk | grep warm

# Trigger initial cache warming
echo ""
echo -e "${BLUE}🔥 Triggering initial cache warming...${NC}"

# Create manual jobs from CronJobs
kubectl create job -n unit-talk warm-players-manual-$(date +%s) --from=cronjob/warm-players-today
kubectl create job -n unit-talk warm-games-manual-$(date +%s) --from=cronjob/warm-games-today
kubectl create job -n unit-talk warm-popular-players-manual-$(date +%s) --from=cronjob/warm-popular-players

echo -e "${GREEN}✅ Manual cache warming jobs created${NC}"

# Monitor initial warming
echo ""
echo -e "${BLUE}📊 Monitoring initial cache warming (30 seconds)...${NC}"
sleep 5

# Get job names
PLAYER_JOB=$(kubectl get jobs -n unit-talk | grep warm-players-manual | tail -1 | awk '{print $1}')
GAMES_JOB=$(kubectl get jobs -n unit-talk | grep warm-games-manual | tail -1 | awk '{print $1}')
POPULAR_JOB=$(kubectl get jobs -n unit-talk | grep warm-popular-players-manual | tail -1 | awk '{print $1}')

# Check job status
echo ""
echo -e "${BLUE}Job Status:${NC}"
kubectl get jobs -n unit-talk | grep warm-

# Show logs from first job
echo ""
echo -e "${BLUE}📋 Sample logs from player warming job:${NC}"
kubectl logs -n unit-talk job/$PLAYER_JOB --tail=20 || echo -e "${YELLOW}⚠️  Job still starting...${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Cache Warmer Deployment Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Deployed CronJobs:${NC}"
echo "  • warm-players-today (hourly at :00)"
echo "  • warm-games-today (hourly at :05)"
echo "  • warm-popular-players (every 30 minutes)"
echo ""
echo -e "${BLUE}Manual Jobs Created:${NC}"
echo "  • $PLAYER_JOB"
echo "  • $GAMES_JOB"
echo "  • $POPULAR_JOB"
echo ""
echo -e "${BLUE}Monitor cache warming:${NC}"
echo "  kubectl logs -n unit-talk job/$PLAYER_JOB -f"
echo "  kubectl logs -n unit-talk job/$GAMES_JOB -f"
echo "  kubectl logs -n unit-talk job/$POPULAR_JOB -f"
echo ""
echo -e "${BLUE}View CronJob schedules:${NC}"
echo "  kubectl get cronjobs -n unit-talk"
echo ""
echo -e "${BLUE}View cache metrics:${NC}"
echo "  kubectl port-forward -n unit-talk svc/smart-form 9090:9090"
echo "  curl http://localhost:9090/metrics | grep redis_cache"
echo ""

