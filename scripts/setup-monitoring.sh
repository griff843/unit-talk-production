#!/bin/bash

# Unit Talk Production Monitoring Setup Script
# Configures comprehensive health checks and monitoring

set -e

echo "🚀 Starting Unit Talk Production Monitoring Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_status "Docker is running"
}

# Validate monitoring configuration files
validate_config() {
    echo "🔍 Validating monitoring configuration..."
    
    # Check Prometheus config
    if [ ! -f "monitoring/prometheus.yml" ]; then
        print_error "Prometheus configuration not found"
        exit 1
    fi
    
    # Validate Prometheus config syntax
    docker run --rm -v "$(pwd)/monitoring:/etc/prometheus" prom/prometheus:latest promtool check config /etc/prometheus/prometheus.yml
    print_status "Prometheus configuration valid"
    
    # Check Alertmanager config
    if [ ! -f "monitoring/alertmanager.yml" ]; then
        print_error "Alertmanager configuration not found"
        exit 1
    fi
    
    # Validate Alertmanager config
    docker run --rm -v "$(pwd)/monitoring:/etc/alertmanager" prom/alertmanager:latest amtool check-config /etc/alertmanager/alertmanager.yml
    print_status "Alertmanager configuration valid"
    
    # Check alert rules
    if [ ! -f "monitoring/alert_rules.yml" ]; then
        print_error "Alert rules not found"
        exit 1
    fi
    
    # Validate alert rules
    docker run --rm -v "$(pwd)/monitoring:/etc/prometheus" prom/prometheus:latest promtool check rules /etc/prometheus/alert_rules.yml
    print_status "Alert rules valid"
}

# Setup health check endpoints
setup_health_checks() {
    echo "🏥 Setting up health check endpoints..."
    
    # Check if health endpoints exist
    local health_endpoints=(
        "apps/api/src/routes/health.ts"
        "apps/dashboard/app/api/system/health/route.ts"
        "apps/smart-form/app/api/health/route.ts"
        "apps/command-center/pages/api/health.ts"
        "apps/discord-bot/src/routes/health.ts"
    )
    
    for endpoint in "${health_endpoints[@]}"; do
        if [ -f "$endpoint" ]; then
            print_status "Health endpoint exists: $endpoint"
        else
            print_warning "Health endpoint missing: $endpoint"
        fi
    done
}

# Start monitoring stack
start_monitoring() {
    echo "🚀 Starting monitoring stack..."
    
    # Create monitoring network if it doesn't exist
    docker network create unit-talk-monitoring || true
    
    # Start Prometheus
    echo "Starting Prometheus..."
    docker run -d \
        --name unit-talk-prometheus \
        --network unit-talk-monitoring \
        -p 9090:9090 \
        -v "$(pwd)/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml" \
        -v "$(pwd)/monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml" \
        --restart unless-stopped \
        prom/prometheus:latest \
        --config.file=/etc/prometheus/prometheus.yml \
        --storage.tsdb.path=/prometheus \
        --web.console.libraries=/etc/prometheus/console_libraries \
        --web.console.templates=/etc/prometheus/consoles \
        --web.enable-lifecycle \
        --web.enable-admin-api \
        --storage.tsdb.retention.time=30d
    
    print_status "Prometheus started on http://localhost:9090"
    
    # Start Alertmanager
    echo "Starting Alertmanager..."
    docker run -d \
        --name unit-talk-alertmanager \
        --network unit-talk-monitoring \
        -p 9093:9093 \
        -v "$(pwd)/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml" \
        --restart unless-stopped \
        prom/alertmanager:latest \
        --config.file=/etc/alertmanager/alertmanager.yml \
        --storage.path=/alertmanager \
        --web.external-url=http://localhost:9093
    
    print_status "Alertmanager started on http://localhost:9093"
    
    # Start Grafana
    echo "Starting Grafana..."
    docker run -d \
        --name unit-talk-grafana \
        --network unit-talk-monitoring \
        -p 3005:3000 \
        -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
        -e "GF_USERS_ALLOW_SIGN_UP=false" \
        -v grafana-storage:/var/lib/grafana \
        --restart unless-stopped \
        grafana/grafana:latest
    
    print_status "Grafana started on http://localhost:3005 (admin/admin)"
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 10
}

# Configure Grafana dashboards and data sources
configure_grafana() {
    echo "📊 Configuring Grafana..."
    
    # Wait for Grafana to be ready
    local grafana_url="http://localhost:3005"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$grafana_url/api/health" > /dev/null 2>&1; then
            print_status "Grafana is ready"
            break
        fi
        echo "Waiting for Grafana... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Grafana failed to start properly"
        return 1
    fi
    
    # Add Prometheus data source
    echo "Adding Prometheus data source..."
    curl -X POST \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Prometheus",
            "type": "prometheus",
            "url": "http://unit-talk-prometheus:9090",
            "access": "proxy",
            "isDefault": true
        }' \
        http://admin:admin@localhost:3005/api/datasources || print_warning "Data source might already exist"
    
    # Import health dashboard
    if [ -f "monitoring/dashboards/unit-talk-health-dashboard.json" ]; then
        echo "Importing health dashboard..."
        curl -X POST \
            -H "Content-Type: application/json" \
            -d @monitoring/dashboards/unit-talk-health-dashboard.json \
            http://admin:admin@localhost:3005/api/dashboards/db || print_warning "Dashboard import failed or already exists"
        print_status "Health dashboard imported"
    fi
}

# Test health endpoints
test_health_endpoints() {
    echo "🔍 Testing health endpoints..."
    
    local endpoints=(
        "http://localhost:3001/health"
        "http://localhost:3000/api/system/health"
        "http://localhost:3002/api/health"
        "http://localhost:3003/api/health"
        "http://localhost:3004/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -s "$endpoint" > /dev/null 2>&1; then
            print_status "Health endpoint accessible: $endpoint"
        else
            print_warning "Health endpoint not accessible: $endpoint (service may not be running)"
        fi
    done
}

# Setup security monitoring
setup_security_monitoring() {
    echo "🔒 Setting up security monitoring..."
    
    # Check if npm audit is available
    if command -v npm > /dev/null 2>&1; then
        echo "Running security audit..."
        npm audit --audit-level=high || print_warning "Security vulnerabilities found - check SECURITY_AUDIT_REPORT.md"
        print_status "Security audit completed"
    fi
    
    # Setup security alert rules (already in alert_rules.yml)
    print_status "Security alert rules configured"
}

# Display monitoring URLs and next steps
display_summary() {
    echo ""
    echo "🎉 Unit Talk Production Monitoring Setup Complete!"
    echo ""
    echo "📍 Access Points:"
    echo "  • Prometheus:   http://localhost:9090"
    echo "  • Alertmanager: http://localhost:9093"
    echo "  • Grafana:      http://localhost:3005 (admin/admin)"
    echo ""
    echo "🏥 Health Check Endpoints:"
    echo "  • API:            http://localhost:3001/health"
    echo "  • Dashboard:      http://localhost:3000/api/system/health"
    echo "  • Smart Form:     http://localhost:3002/api/health"
    echo "  • Command Center: http://localhost:3003/api/health"
    echo "  • Discord Bot:    http://localhost:3004/health"
    echo ""
    echo "📋 Next Steps:"
    echo "  1. Start all Unit Talk services with './dev.sh start'"
    echo "  2. Configure notification channels in Alertmanager"
    echo "  3. Set up SSL/TLS certificates for production"
    echo "  4. Review and customize alert thresholds"
    echo "  5. Address security vulnerabilities in SECURITY_AUDIT_REPORT.md"
    echo ""
    echo "🔧 Useful Commands:"
    echo "  • View logs:        docker logs unit-talk-prometheus"
    echo "  • Restart services: docker restart unit-talk-prometheus"
    echo "  • Stop monitoring:  docker stop unit-talk-prometheus unit-talk-alertmanager unit-talk-grafana"
    echo ""
}

# Cleanup function
cleanup() {
    if [ "$1" = "clean" ]; then
        echo "🧹 Cleaning up monitoring containers..."
        docker stop unit-talk-prometheus unit-talk-alertmanager unit-talk-grafana 2>/dev/null || true
        docker rm unit-talk-prometheus unit-talk-alertmanager unit-talk-grafana 2>/dev/null || true
        docker network rm unit-talk-monitoring 2>/dev/null || true
        print_status "Cleanup completed"
        exit 0
    fi
}

# Main execution
main() {
    # Handle cleanup argument
    if [ "$1" = "clean" ]; then
        cleanup clean
    fi
    
    # Run setup steps
    check_docker
    validate_config
    setup_health_checks
    start_monitoring
    configure_grafana
    test_health_endpoints
    setup_security_monitoring
    display_summary
}

# Handle script interruption
trap 'echo -e "\n${RED}Setup interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"