#!/bin/bash

# ==============================================
# Unit Talk Development Environment Startup
# Fortune 100-grade local development orchestration
# ==============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
HEALTH_CHECK_TIMEOUT=300  # 5 minutes
HEALTH_CHECK_INTERVAL=5   # 5 seconds

# Function to print colored output
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

print_info() {
    echo -e "${CYAN}[$(date +'%H:%M:%S')] ℹ️${NC} $1"
}

# Function to check if a service is healthy
wait_for_service() {
    local service_name=$1
    local health_endpoint=$2
    local timeout=$3
    local elapsed=0
    
    print_status "Waiting for $service_name to become healthy..."
    
    while [ $elapsed -lt $timeout ]; do
        if curl -f -s $health_endpoint > /dev/null 2>&1; then
            print_success "$service_name is healthy!"
            return 0
        fi
        
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        
        # Show progress every 30 seconds
        if [ $((elapsed % 30)) -eq 0 ]; then
            print_status "Still waiting for $service_name... (${elapsed}s elapsed)"
        fi
    done
    
    print_error "$service_name failed to become healthy within ${timeout}s"
    return 1
}

# Function to check service status
check_service_status() {
    local service=$1
    local status=$(docker-compose ps --format json $service 2>/dev/null | jq -r '.[0].State // "not found"')
    echo $status
}

# Function to display banner
show_banner() {
    echo -e "${PURPLE}"
    echo "=================================================="
    echo "    UNIT TALK DEVELOPMENT ENVIRONMENT"
    echo "    Fortune 100-Grade Local Development"
    echo "=================================================="
    echo -e "${NC}"
}

# Function to show service URLs
show_service_urls() {
    echo -e "${CYAN}"
    echo "🌐 Service URLs:"
    echo "=================================================="
    echo "📊 Command Center:    http://localhost:3004"
    echo "📱 Smart Form:        http://localhost:3002"
    echo "📈 Dashboard:         http://localhost:3003"
    echo "🔧 API:               http://localhost:3001"
    echo ""
    echo "🛠️  Development Tools:"
    echo "=================================================="
    echo "⏱️  Temporal UI:       http://localhost:8088"
    echo "📊 Prometheus:        http://localhost:9090"
    echo "📈 Grafana:           http://localhost:3001 (admin/admin)"
    echo "🗄️  pgAdmin:           http://localhost:5050 (admin@unittalk.com/admin)"
    echo "📮 Redis Commander:   http://localhost:8081"
    echo "📧 Mailhog:           http://localhost:8025"
    echo -e "${NC}"
}

# EMBED-FIX-031: Function to set git provenance environment variables
set_git_provenance() {
    print_status "Setting git provenance for build tracking..."

    # Get git commit info
    if command -v git > /dev/null 2>&1 && git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        export GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
        export GIT_COMMIT_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        export GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
        print_success "Git provenance set: ${GIT_COMMIT_SHORT} on ${GIT_BRANCH}"
    else
        export GIT_COMMIT="unknown"
        export GIT_COMMIT_SHORT="unknown"
        export GIT_BRANCH="unknown"
        print_warning "Not in a git repository - using 'unknown' for provenance"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose > /dev/null 2>&1; then
        print_error "docker-compose is not installed or not in PATH."
        exit 1
    fi
    
    # Check if required files exist
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_info "Please update .env with your actual values before continuing."
            exit 1
        else
            print_error "No .env.example file found. Please create .env manually."
            exit 1
        fi
    fi
    
    print_success "Prerequisites check passed!"
}

# Function to setup workspace
setup_workspace() {
    print_status "Setting up workspace..."
    
    # Create required directories
    mkdir -p logs monitoring/grafana/dashboards monitoring/grafana/provisioning
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing workspace dependencies..."
        npm install
    fi
    
    print_success "Workspace setup complete!"
}

# Function to create monitoring configuration
create_monitoring_config() {
    print_status "Creating monitoring configuration..."
    
    mkdir -p monitoring
    
    # Create Prometheus configuration
    cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'unit-talk-api'
    static_configs:
      - targets: ['api:9464']
    scrape_interval: 5s
    metrics_path: /metrics

  - job_name: 'unit-talk-workers'
    static_configs:
      - targets: ['workers:9464']
    scrape_interval: 5s
    metrics_path: /metrics

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'temporal'
    static_configs:
      - targets: ['temporal:7233']
    scrape_interval: 10s
EOF

    print_success "Monitoring configuration created!"
}

# Function to start infrastructure services
start_infrastructure() {
    print_status "Starting infrastructure services..."
    
    # Start database services first
    docker-compose up -d postgres redis temporal-postgres
    
    # Wait for databases to be ready
    print_status "Waiting for databases to initialize..."
    sleep 10
    
    # Start Temporal services
    docker-compose up -d temporal-admin-tools
    sleep 5
    
    docker-compose up -d temporal temporal-ui
    
    # Start monitoring services
    docker-compose up -d prometheus grafana
    
    print_success "Infrastructure services started!"
}

# Function to start application services
start_applications() {
    print_status "Starting application services..."
    
    # Start main API first
    docker-compose up -d api
    
    # Wait for API to be healthy before starting dependent services
    if wait_for_service "API" "http://localhost:3001/health" 60; then
        # Start worker processes
        docker-compose up -d workers
        
        # Start Discord bot
        docker-compose up -d discord-bot
        
        # Start frontend applications
        docker-compose up -d smart-form dashboard command-center
        
        print_success "Application services started!"
    else
        print_error "Failed to start application services - API not healthy"
        return 1
    fi
}

# Function to start development tools
start_dev_tools() {
    print_status "Starting development tools..."
    
    # Start optional development tools
    docker-compose --profile tools up -d pgadmin redis-commander mailhog
    
    print_success "Development tools started!"
}

# Function to perform health checks
perform_health_checks() {
    print_status "Performing comprehensive health checks..."
    
    # Critical services health checks
    local services=(
        "PostgreSQL:http://localhost:5432"
        "Redis:http://localhost:6379" 
        "Temporal:http://localhost:8088"
        "API:http://localhost:3001/health"
        "Command Center:http://localhost:3004"
        "Smart Form:http://localhost:3002"
        "Dashboard:http://localhost:3003"
        "Prometheus:http://localhost:9090/-/healthy"
        "Grafana:http://localhost:3001/api/health"
    )
    
    local failed_services=()
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service_name service_url <<< "$service_info"
        if ! wait_for_service "$service_name" "$service_url" 30; then
            failed_services+=("$service_name")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        print_success "All services are healthy!"
        return 0
    else
        print_warning "Some services failed health checks: ${failed_services[*]}"
        return 1
    fi
}

# Function to show logs
show_logs() {
    print_info "Showing service logs (press Ctrl+C to exit)..."
    docker-compose logs -f --tail=50
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up development environment..."
    docker-compose down --remove-orphans
    docker system prune -f
    print_success "Cleanup complete!"
}

# Function to show status
show_status() {
    print_info "Current service status:"
    echo "=================================================="
    docker-compose ps --format table
    echo ""
    
    print_info "Resource usage:"
    echo "=================================================="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Function to open browser tabs
open_browser_tabs() {
    if command -v xdg-open > /dev/null 2>&1; then
        # Linux
        print_status "Opening browser tabs..."
        xdg-open "http://localhost:3004" &  # Command Center
        xdg-open "http://localhost:8088" &  # Temporal UI
    elif command -v open > /dev/null 2>&1; then
        # macOS
        print_status "Opening browser tabs..."
        open "http://localhost:3004"  # Command Center
        open "http://localhost:8088"  # Temporal UI
    elif command -v start > /dev/null 2>&1; then
        # Windows
        print_status "Opening browser tabs..."
        start "http://localhost:3004"  # Command Center
        start "http://localhost:8088"  # Temporal UI
    else
        print_info "Please manually open the service URLs shown above."
    fi
}

# Main execution function
main() {
    local command=${1:-"start"}
    
    case $command in
        "start")
            show_banner
            check_prerequisites
            set_git_provenance  # EMBED-FIX-031: Set git provenance before starting Docker
            setup_workspace
            create_monitoring_config

            print_status "Starting Unit Talk development environment..."

            start_infrastructure
            start_applications
            start_dev_tools
            
            print_status "Waiting for all services to stabilize..."
            sleep 15
            
            if perform_health_checks; then
                show_service_urls
                print_success "🚀 Unit Talk development environment is ready!"
                print_info "Run './dev.sh logs' to view service logs"
                print_info "Run './dev.sh status' to check service status"
                print_info "Run './dev.sh stop' to stop all services"
                
                # Optionally open browser tabs
                read -p "Open browser tabs for key services? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    open_browser_tabs
                fi
            else
                print_warning "Some services may not be fully ready. Check logs with './dev.sh logs'"
            fi
            ;;
            
        "stop")
            print_status "Stopping Unit Talk development environment..."
            docker-compose down
            print_success "Environment stopped!"
            ;;
            
        "restart")
            print_status "Restarting Unit Talk development environment..."
            docker-compose restart
            print_success "Environment restarted!"
            ;;
            
        "logs")
            show_logs
            ;;
            
        "status")
            show_status
            ;;
            
        "clean")
            cleanup
            ;;
            
        "reset")
            print_status "Resetting development environment..."
            docker-compose down --volumes --remove-orphans
            docker system prune -f
            print_success "Environment reset complete! Run './dev.sh start' to rebuild."
            ;;
            
        "help"|"-h"|"--help")
            echo "Unit Talk Development Environment Control Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start     Start the development environment (default)"
            echo "  stop      Stop all services"
            echo "  restart   Restart all services"
            echo "  logs      Show service logs"
            echo "  status    Show service status and resource usage"
            echo "  clean     Stop services and clean up containers"
            echo "  reset     Full reset - removes volumes and containers"
            echo "  help      Show this help message"
            ;;
            
        *)
            print_error "Unknown command: $command"
            echo "Run '$0 help' for usage information."
            exit 1
            ;;
    esac
}

# Trap Ctrl+C to allow graceful exit during log viewing
trap 'echo -e "\n${YELLOW}Exiting...${NC}"; exit 0' INT

# Run main function with all arguments
main "$@"