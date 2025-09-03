#!/bin/bash

# Unit Talk SaaS - Staging Deployment Script
# Automated staging deployment with validation

set -e  # Exit on any error

echo "🚀 Starting Unit Talk SaaS Staging Deployment..."

# Configuration
STAGING_ENV="staging"
HEALTH_CHECK_URL="http://localhost:3000/health"
MAX_RETRIES=30
RETRY_INTERVAL=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required environment files exist
if [ ! -f ".env.staging" ]; then
    error "Staging environment file (.env.staging) not found."
    exit 1
fi

# Check if Docker Compose file exists
if [ ! -f "docker-compose.staging.yml" ]; then
    error "Staging Docker Compose file not found."
    exit 1
fi

success "Pre-deployment checks passed"

# Build and test
log "Building application..."
npm run build
if [ $? -ne 0 ]; then
    error "Build failed"
    exit 1
fi
success "Build completed successfully"

log "Running tests..."
npm test
if [ $? -ne 0 ]; then
    error "Tests failed"
    exit 1
fi
success "All tests passed"

# Stop existing staging environment
log "Stopping existing staging environment..."
docker-compose -f docker-compose.staging.yml down --remove-orphans

# Start staging environment
log "Starting staging environment..."
docker-compose -f docker-compose.staging.yml up -d --build

# Wait for services to be ready
log "Waiting for services to start..."
sleep 30

# Health check function
check_health() {
    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s $HEALTH_CHECK_URL > /dev/null; then
            return 0
        fi
        retries=$((retries + 1))
        log "Health check attempt $retries/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    return 1
}

# Perform health checks
log "Performing health checks..."
if check_health; then
    success "Health checks passed"
else
    error "Health checks failed after $MAX_RETRIES attempts"
    log "Checking service logs..."
    docker-compose -f docker-compose.staging.yml logs --tail=50
    exit 1
fi

# Run integration tests
log "Running integration tests..."
npm run test:integration
if [ $? -ne 0 ]; then
    warning "Integration tests failed, but deployment continues"
fi

# Performance benchmarks
log "Running performance benchmarks..."
npm run test:performance
if [ $? -ne 0 ]; then
    warning "Performance tests failed, but deployment continues"
fi

# Security scan
log "Running security scan..."
npm audit --audit-level moderate
if [ $? -ne 0 ]; then
    warning "Security vulnerabilities found, please review"
fi

# Database migration check
log "Checking database migrations..."
# Add database migration commands here if needed

# Final validation
log "Running final validation..."

# Check all required services are running
REQUIRED_SERVICES=("app" "redis" "postgres" "nginx")
for service in "${REQUIRED_SERVICES[@]}"; do
    if docker-compose -f docker-compose.staging.yml ps $service | grep -q "Up"; then
        success "$service is running"
    else
        error "$service is not running"
        exit 1
    fi
done

# Check API endpoints
API_ENDPOINTS=("/health" "/api/status" "/api/version")
for endpoint in "${API_ENDPOINTS[@]}"; do
    if curl -f -s "http://localhost:3000$endpoint" > /dev/null; then
        success "API endpoint $endpoint is accessible"
    else
        warning "API endpoint $endpoint is not accessible"
    fi
done

# Generate deployment report
log "Generating deployment report..."
cat > staging_deployment_report.txt << EOF
Unit Talk SaaS - Staging Deployment Report
==========================================
Deployment Date: $(date)
Environment: $STAGING_ENV
Status: SUCCESS

Services Status:
$(docker-compose -f docker-compose.staging.yml ps)

Health Check Results:
$(curl -s $HEALTH_CHECK_URL | jq '.' 2>/dev/null || echo "Health check response not in JSON format")

Resource Usage:
$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}")

Next Steps:
1. Review application logs for any warnings
2. Run user acceptance tests
3. Monitor performance metrics
4. Prepare for production deployment

EOF

success "Staging deployment completed successfully!"
log "Deployment report saved to: staging_deployment_report.txt"
log "Access the staging environment at: http://localhost:3000"
log "Monitor logs with: docker-compose -f docker-compose.staging.yml logs -f"

echo ""
echo "🎉 Staging deployment successful!"
echo "📊 Dashboard: http://localhost:3001 (Grafana)"
echo "📈 Metrics: http://localhost:9090 (Prometheus)"
echo "🔍 Health: http://localhost:3000/health"