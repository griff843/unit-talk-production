#!/bin/bash

# ==============================================
# Unit Talk Health Check Script
# Comprehensive health validation for all services
# ==============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
HEALTH_ENDPOINTS=(
    "PostgreSQL:localhost:5432"
    "Redis:localhost:6379"
    "Temporal:localhost:8088"
    "API:localhost:3001/health"
    "Command Center:localhost:3004"
    "Smart Form:localhost:3002"
    "Dashboard:localhost:3003"
    "Prometheus:localhost:9090/-/healthy"
    "Grafana:localhost:3000/api/health"
)

print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $1"
}

# Check if a service is responding
check_service() {
    local service_name=$1
    local endpoint=$2
    local timeout=${3:-10}
    
    if [[ $endpoint == *":"* ]]; then
        # Check if it's a port or HTTP endpoint
        if [[ $endpoint == *"/"* ]]; then
            # HTTP endpoint
            if curl -f -s --max-time $timeout "http://$endpoint" > /dev/null 2>&1; then
                print_success "$service_name is healthy"
                return 0
            else
                print_error "$service_name is not responding"
                return 1
            fi
        else
            # Port check
            local host=$(echo $endpoint | cut -d':' -f1)
            local port=$(echo $endpoint | cut -d':' -f2)
            
            if nc -z -w$timeout $host $port 2>/dev/null; then
                print_success "$service_name is healthy"
                return 0
            else
                print_error "$service_name is not responding"
                return 1
            fi
        fi
    else
        print_error "Invalid endpoint format: $endpoint"
        return 1
    fi
}

# Check Docker containers
check_containers() {
    print_status "Checking Docker containers..."
    
    local containers=$(docker-compose ps --format json 2>/dev/null || echo "[]")
    
    if [ "$containers" = "[]" ] || [ -z "$containers" ]; then
        print_warning "No Docker containers found. Run 'make dev' to start the environment."
        return 1
    fi
    
    local healthy=0
    local total=0
    
    echo "$containers" | jq -r '.[] | "\(.Name):\(.State):\(.Health // "unknown")"' | while IFS=':' read -r name state health; do
        total=$((total + 1))
        
        if [ "$state" = "running" ]; then
            if [ "$health" = "healthy" ] || [ "$health" = "unknown" ]; then
                print_success "Container $name is running"
                healthy=$((healthy + 1))
            else
                print_warning "Container $name is running but unhealthy ($health)"
            fi
        else
            print_error "Container $name is not running ($state)"
        fi
    done
    
    echo -e "${BLUE}Container Summary:${NC} $healthy/$total containers healthy"
}

# Check disk space
check_disk_space() {
    print_status "Checking disk space..."
    
    local usage
    if command -v df >/dev/null 2>&1; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
        else
            # Linux
            usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
        fi
        
        if [ "$usage" -gt 90 ]; then
            print_error "Disk usage is critical: ${usage}%"
            return 1
        elif [ "$usage" -gt 80 ]; then
            print_warning "Disk usage is high: ${usage}%"
        else
            print_success "Disk usage is healthy: ${usage}%"
        fi
    else
        print_warning "Cannot check disk usage (df command not available)"
    fi
}

# Check memory usage
check_memory() {
    print_status "Checking memory usage..."
    
    if command -v free >/dev/null 2>&1; then
        # Linux
        local mem_usage=$(free | awk 'FNR==2{printf "%.2f", ($3/($3+$4))*100}')
        local mem_int=${mem_usage%.*}
        
        if [ "$mem_int" -gt 90 ]; then
            print_error "Memory usage is critical: ${mem_usage}%"
            return 1
        elif [ "$mem_int" -gt 80 ]; then
            print_warning "Memory usage is high: ${mem_usage}%"
        else
            print_success "Memory usage is healthy: ${mem_usage}%"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        local mem_pressure=$(memory_pressure | grep "System-wide memory free percentage" | awk '{print $5}' | sed 's/%//')
        if [ -n "$mem_pressure" ]; then
            local mem_used=$((100 - mem_pressure))
            if [ "$mem_used" -gt 90 ]; then
                print_error "Memory usage is critical: ${mem_used}%"
                return 1
            elif [ "$mem_used" -gt 80 ]; then
                print_warning "Memory usage is high: ${mem_used}%"
            else
                print_success "Memory usage is healthy: ${mem_used}%"
            fi
        else
            print_warning "Cannot determine memory usage on macOS"
        fi
    else
        print_warning "Cannot check memory usage (unsupported OS)"
    fi
}

# Check if required tools are available
check_dependencies() {
    print_status "Checking dependencies..."
    
    local deps=("docker" "docker-compose" "curl" "jq")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -eq 0 ]; then
        print_success "All dependencies are available"
    else
        print_error "Missing dependencies: ${missing[*]}"
        return 1
    fi
}

# Main health check function
main() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "         UNIT TALK HEALTH CHECK"
    echo "         System Health Validation"
    echo "=================================================="
    echo -e "${NC}"
    
    local failed_checks=0
    
    # Check dependencies first
    if ! check_dependencies; then
        exit 1
    fi
    
    # Check system resources
    if ! check_disk_space; then
        failed_checks=$((failed_checks + 1))
    fi
    
    if ! check_memory; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Check Docker containers
    if ! check_containers; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Check service endpoints
    print_status "Checking service endpoints..."
    local failed_services=0
    
    for service_info in "${HEALTH_ENDPOINTS[@]}"; do
        IFS=':' read -r service_name endpoint <<< "$service_info"
        if ! check_service "$service_name" "$endpoint"; then
            failed_services=$((failed_services + 1))
        fi
        sleep 1
    done
    
    if [ $failed_services -gt 0 ]; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Summary
    echo ""
    echo -e "${BLUE}=================================================="
    echo "                HEALTH CHECK SUMMARY"
    echo -e "==================================================${NC}"
    
    if [ $failed_checks -eq 0 ]; then
        print_success "All health checks passed! 🎉"
        echo ""
        echo -e "${GREEN}Your Unit Talk development environment is ready!${NC}"
        echo ""
        echo -e "${CYAN}Service URLs:${NC}"
        echo "  📊 Command Center:    http://localhost:3004"
        echo "  📱 Smart Form:        http://localhost:3002"
        echo "  📈 Dashboard:         http://localhost:3003"
        echo "  🔧 API:               http://localhost:3001"
        echo "  ⏱️  Temporal UI:       http://localhost:8088"
        echo "  📊 Grafana:           http://localhost:3000"
        echo "  📈 Prometheus:        http://localhost:9090"
        exit 0
    else
        print_error "Health check failed! $failed_checks issue(s) found."
        echo ""
        echo -e "${YELLOW}Troubleshooting tips:${NC}"
        echo "  1. Run 'make dev' to start the development environment"
        echo "  2. Wait a few minutes for all services to start"
        echo "  3. Check logs with 'make logs'"
        echo "  4. Restart services with 'make restart'"
        echo "  5. Reset environment with 'make reset' if needed"
        exit 1
    fi
}

# Install required tools if missing
install_dependencies() {
    print_status "Installing missing dependencies..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if ! command -v jq >/dev/null 2>&1; then
            if command -v brew >/dev/null 2>&1; then
                brew install jq
            else
                print_error "Homebrew not found. Please install jq manually."
                exit 1
            fi
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if ! command -v jq >/dev/null 2>&1; then
            if command -v apt-get >/dev/null 2>&1; then
                sudo apt-get update && sudo apt-get install -y jq
            elif command -v yum >/dev/null 2>&1; then
                sudo yum install -y jq
            else
                print_error "Package manager not found. Please install jq manually."
                exit 1
            fi
        fi
    else
        print_warning "Unsupported OS for automatic dependency installation"
    fi
}

# Handle command line arguments
case "${1:-}" in
    "deps")
        install_dependencies
        ;;
    "services")
        print_status "Checking service endpoints only..."
        for service_info in "${HEALTH_ENDPOINTS[@]}"; do
            IFS=':' read -r service_name endpoint <<< "$service_info"
            check_service "$service_name" "$endpoint"
        done
        ;;
    "containers")
        check_containers
        ;;
    "help"|"-h"|"--help")
        echo "Unit Talk Health Check Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  (none)      Run complete health check (default)"
        echo "  services    Check service endpoints only"
        echo "  containers  Check Docker containers only"
        echo "  deps        Install missing dependencies"
        echo "  help        Show this help message"
        ;;
    *)
        main
        ;;
esac