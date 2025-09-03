# ==============================================
# Unit Talk Platform - Development Makefile
# Fortune 100-grade local development commands
# ==============================================

.DEFAULT_GOAL := help
.PHONY: help dev stop restart logs status clean reset build test lint health-check alerts-test db-reset

# Colors for output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
BLUE=\033[0;34m
PURPLE=\033[0;35m
CYAN=\033[0;36m
NC=\033[0m # No Color

# Configuration
COMPOSE_FILE := docker-compose.yml
COMPOSE_PROJECT := unit-talk

# ==============================================
# DEVELOPMENT COMMANDS
# ==============================================

## Start the complete development environment
dev:
	@echo -e "$(BLUE)🚀 Starting Unit Talk development environment...$(NC)"
	@bash dev.sh start

## Stop all services
stop:
	@echo -e "$(YELLOW)⏹️  Stopping Unit Talk development environment...$(NC)"
	@bash dev.sh stop

## Restart all services
restart:
	@echo -e "$(BLUE)🔄 Restarting Unit Talk development environment...$(NC)"
	@bash dev.sh restart

## Show service logs
logs:
	@echo -e "$(CYAN)📋 Showing service logs...$(NC)"
	@bash dev.sh logs

## Show service status and resource usage
status:
	@echo -e "$(CYAN)📊 Checking service status...$(NC)"
	@bash dev.sh status

## Clean up containers and networks
clean:
	@echo -e "$(YELLOW)🧹 Cleaning up development environment...$(NC)"
	@bash dev.sh clean

## Full reset - removes volumes and containers
reset:
	@echo -e "$(RED)💥 Resetting development environment...$(NC)"
	@bash dev.sh reset

# ==============================================
# BUILD COMMANDS
# ==============================================

## Build all Docker images
build:
	@echo -e "$(BLUE)🔨 Building Docker images...$(NC)"
	@docker-compose build

## Build specific service (usage: make build-service SERVICE=api)
build-service:
	@if [ -z "$(SERVICE)" ]; then \
		echo -e "$(RED)❌ Error: SERVICE parameter required. Usage: make build-service SERVICE=api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(BLUE)🔨 Building $(SERVICE) service...$(NC)"
	@docker-compose build $(SERVICE)

## Build and restart specific service
rebuild:
	@if [ -z "$(SERVICE)" ]; then \
		echo -e "$(RED)❌ Error: SERVICE parameter required. Usage: make rebuild SERVICE=api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(BLUE)🔨 Rebuilding and restarting $(SERVICE) service...$(NC)"
	@docker-compose build $(SERVICE)
	@docker-compose up -d $(SERVICE)

# ==============================================
# TESTING COMMANDS
# ==============================================

## Run all tests across workspace
test:
	@echo -e "$(PURPLE)🧪 Running all tests...$(NC)"
	@npm test

## Run tests for specific workspace (usage: make test-workspace WORKSPACE=apps/api)
test-workspace:
	@if [ -z "$(WORKSPACE)" ]; then \
		echo -e "$(RED)❌ Error: WORKSPACE parameter required. Usage: make test-workspace WORKSPACE=apps/api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(PURPLE)🧪 Running tests for $(WORKSPACE)...$(NC)"
	@npm test --workspace=$(WORKSPACE)

## Run E2E tests
test-e2e:
	@echo -e "$(PURPLE)🎭 Running E2E tests...$(NC)"
	@npm run test:e2e --workspace=apps/command-center

## Run security tests
test-security:
	@echo -e "$(PURPLE)🔒 Running security tests...$(NC)"
	@npm run test:security --workspace=apps/api

## Run performance tests
test-performance:
	@echo -e "$(PURPLE)⚡ Running performance tests...$(NC)"
	@npm run test:performance --workspace=apps/api

# ==============================================
# QUALITY COMMANDS
# ==============================================

## Lint all code
lint:
	@echo -e "$(PURPLE)📝 Linting all code...$(NC)"
	@npm run lint

## Fix linting issues
lint-fix:
	@echo -e "$(PURPLE)🔧 Fixing linting issues...$(NC)"
	@npm run lint:fix

## Type check all TypeScript
type-check:
	@echo -e "$(PURPLE)📊 Type checking TypeScript...$(NC)"
	@npm run type-check

## Format all code
format:
	@echo -e "$(PURPLE)✨ Formatting all code...$(NC)"
	@npm run format

## Run complete quality check
quality: lint type-check test
	@echo -e "$(GREEN)✅ Quality check complete!$(NC)"

# ==============================================
# UTILITY COMMANDS
# ==============================================

## Check health of all services
health-check:
	@echo -e "$(CYAN)🏥 Checking service health...$(NC)"
	@bash scripts/health-check.sh || echo -e "$(YELLOW)⚠️  Health check script not found. Run 'make dev' first.$(NC)"

## Test alert system
alerts-test:
	@echo -e "$(CYAN)🚨 Testing alert system...$(NC)"
	@bash scripts/test-alerts.sh || echo -e "$(YELLOW)⚠️  Alert test script not found. Check apps/api/scripts/ directory.$(NC)"

## Reset database
db-reset:
	@echo -e "$(YELLOW)🗄️  Resetting database...$(NC)"
	@bash scripts/reset-database.sh || echo -e "$(YELLOW)⚠️  Database reset script not found. Check apps/api/scripts/ directory.$(NC)"

## Install all dependencies
install:
	@echo -e "$(BLUE)📦 Installing all dependencies...$(NC)"
	@npm install

## Update all dependencies
update:
	@echo -e "$(BLUE)🔄 Updating all dependencies...$(NC)"
	@npm update

## Setup development environment
setup: install build
	@echo -e "$(GREEN)✅ Development environment setup complete!$(NC)"

# ==============================================
# DOCKER COMMANDS
# ==============================================

## Pull latest base images
docker-pull:
	@echo -e "$(BLUE)📥 Pulling latest Docker images...$(NC)"
	@docker-compose pull

## Show Docker system info
docker-info:
	@echo -e "$(CYAN)📊 Docker system information:$(NC)"
	@docker system df
	@echo ""
	@docker system info --format "table {{.Name}}\t{{.Value}}"

## Clean Docker system
docker-clean:
	@echo -e "$(YELLOW)🧹 Cleaning Docker system...$(NC)"
	@docker system prune -f
	@docker volume prune -f

## Deep clean Docker (removes all unused containers, networks, images)
docker-deep-clean:
	@echo -e "$(RED)💥 Deep cleaning Docker system...$(NC)"
	@docker system prune -a -f
	@docker volume prune -f

# ==============================================
# MONITORING COMMANDS
# ==============================================

## Open monitoring dashboards
monitoring:
	@echo -e "$(CYAN)📊 Opening monitoring dashboards...$(NC)"
	@echo -e "$(BLUE)Command Center:$(NC) http://localhost:3004"
	@echo -e "$(BLUE)Temporal UI:$(NC) http://localhost:8088"
	@echo -e "$(BLUE)Grafana:$(NC) http://localhost:3000 (admin/admin)"
	@echo -e "$(BLUE)Prometheus:$(NC) http://localhost:9090"
	@if command -v open >/dev/null 2>&1; then \
		open "http://localhost:3004" "http://localhost:8088"; \
	elif command -v xdg-open >/dev/null 2>&1; then \
		xdg-open "http://localhost:3004" && xdg-open "http://localhost:8088"; \
	elif command -v start >/dev/null 2>&1; then \
		start "http://localhost:3004" && start "http://localhost:8088"; \
	fi

## Show real-time service metrics
metrics:
	@echo -e "$(CYAN)📊 Real-time service metrics:$(NC)"
	@docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}"

## Show container resource usage
resources:
	@echo -e "$(CYAN)💾 Container resource usage:$(NC)"
	@docker system df
	@echo ""
	@docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# ==============================================
# APPLICATION COMMANDS
# ==============================================

## Start specific application (usage: make app-start APP=api)
app-start:
	@if [ -z "$(APP)" ]; then \
		echo -e "$(RED)❌ Error: APP parameter required. Usage: make app-start APP=api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(BLUE)🚀 Starting $(APP) application...$(NC)"
	@docker-compose up -d $(APP)

## Stop specific application
app-stop:
	@if [ -z "$(APP)" ]; then \
		echo -e "$(RED)❌ Error: APP parameter required. Usage: make app-stop APP=api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(YELLOW)⏹️  Stopping $(APP) application...$(NC)"
	@docker-compose stop $(APP)

## Restart specific application
app-restart:
	@if [ -z "$(APP)" ]; then \
		echo -e "$(RED)❌ Error: APP parameter required. Usage: make app-restart APP=api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(BLUE)🔄 Restarting $(APP) application...$(NC)"
	@docker-compose restart $(APP)

## Show logs for specific application
app-logs:
	@if [ -z "$(APP)" ]; then \
		echo -e "$(RED)❌ Error: APP parameter required. Usage: make app-logs APP=api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(CYAN)📋 Showing logs for $(APP)...$(NC)"
	@docker-compose logs -f $(APP)

# ==============================================
# DEVELOPMENT UTILITIES
# ==============================================

## Connect to container shell (usage: make shell CONTAINER=unit-talk-api)
shell:
	@if [ -z "$(CONTAINER)" ]; then \
		echo -e "$(RED)❌ Error: CONTAINER parameter required. Usage: make shell CONTAINER=unit-talk-api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(BLUE)🐚 Connecting to $(CONTAINER) shell...$(NC)"
	@docker exec -it $(CONTAINER) /bin/bash || docker exec -it $(CONTAINER) /bin/sh

## View environment variables for service
env:
	@if [ -z "$(SERVICE)" ]; then \
		echo -e "$(RED)❌ Error: SERVICE parameter required. Usage: make env SERVICE=api$(NC)"; \
		exit 1; \
	fi
	@echo -e "$(CYAN)🔍 Environment variables for $(SERVICE):$(NC)"
	@docker-compose config | grep -A 20 "$(SERVICE):" | grep -E "(environment|env_file)" || echo "No environment variables found"

## Show service ports
ports:
	@echo -e "$(CYAN)🔌 Service ports:$(NC)"
	@docker-compose ps --format "table {{.Name}}\t{{.Ports}}"

# ==============================================
# HELP
# ==============================================

## Show this help message
help:
	@echo -e "$(PURPLE)"
	@echo "=================================================="
	@echo "    UNIT TALK PLATFORM - MAKEFILE COMMANDS"
	@echo "    Fortune 100-Grade Development Environment"
	@echo "=================================================="
	@echo -e "$(NC)"
	@echo -e "$(BLUE)Development Commands:$(NC)"
	@echo "  make dev                 🚀 Start the complete development environment"
	@echo "  make stop                ⏹️  Stop all services"
	@echo "  make restart             🔄 Restart all services"
	@echo "  make logs                📋 Show service logs"
	@echo "  make status              📊 Show service status and resource usage"
	@echo "  make clean               🧹 Clean up containers and networks"
	@echo "  make reset               💥 Full reset - removes volumes and containers"
	@echo ""
	@echo -e "$(BLUE)Build Commands:$(NC)"
	@echo "  make build               🔨 Build all Docker images"
	@echo "  make build-service       🔨 Build specific service (SERVICE=name)"
	@echo "  make rebuild             🔨 Build and restart specific service (SERVICE=name)"
	@echo ""
	@echo -e "$(BLUE)Testing Commands:$(NC)"
	@echo "  make test                🧪 Run all tests across workspace"
	@echo "  make test-workspace      🧪 Run tests for specific workspace (WORKSPACE=path)"
	@echo "  make test-e2e            🎭 Run E2E tests"
	@echo "  make test-security       🔒 Run security tests"
	@echo "  make test-performance    ⚡ Run performance tests"
	@echo ""
	@echo -e "$(BLUE)Quality Commands:$(NC)"
	@echo "  make lint                📝 Lint all code"
	@echo "  make lint-fix            🔧 Fix linting issues"
	@echo "  make type-check          📊 Type check all TypeScript"
	@echo "  make format              ✨ Format all code"
	@echo "  make quality             ✅ Run complete quality check"
	@echo ""
	@echo -e "$(BLUE)Utility Commands:$(NC)"
	@echo "  make health-check        🏥 Check health of all services"
	@echo "  make alerts-test         🚨 Test alert system"
	@echo "  make db-reset            🗄️  Reset database"
	@echo "  make install             📦 Install all dependencies"
	@echo "  make setup               🏗️  Setup development environment"
	@echo ""
	@echo -e "$(BLUE)Monitoring Commands:$(NC)"
	@echo "  make monitoring          📊 Open monitoring dashboards"
	@echo "  make metrics             📊 Show real-time service metrics"
	@echo "  make resources           💾 Show container resource usage"
	@echo ""
	@echo -e "$(BLUE)Application Commands:$(NC)"
	@echo "  make app-start           🚀 Start specific application (APP=name)"
	@echo "  make app-stop            ⏹️  Stop specific application (APP=name)"
	@echo "  make app-restart         🔄 Restart specific application (APP=name)"
	@echo "  make app-logs            📋 Show logs for specific application (APP=name)"
	@echo ""
	@echo -e "$(BLUE)Development Utilities:$(NC)"
	@echo "  make shell               🐚 Connect to container shell (CONTAINER=name)"
	@echo "  make env                 🔍 View environment variables (SERVICE=name)"
	@echo "  make ports               🔌 Show service ports"
	@echo ""
	@echo -e "$(BLUE)Docker Commands:$(NC)"
	@echo "  make docker-pull         📥 Pull latest Docker images"
	@echo "  make docker-info         📊 Show Docker system info"
	@echo "  make docker-clean        🧹 Clean Docker system"
	@echo "  make docker-deep-clean   💥 Deep clean Docker (removes all unused)"
	@echo ""
	@echo -e "$(CYAN)Examples:$(NC)"
	@echo "  make dev                 # Start development environment"
	@echo "  make app-restart APP=api # Restart API service"
	@echo "  make shell CONTAINER=unit-talk-api  # Connect to API container"
	@echo "  make test-workspace WORKSPACE=apps/api  # Test API workspace"
	@echo ""
	@echo -e "$(GREEN)Quick Start:$(NC)"
	@echo "  1. make setup            # First time setup"
	@echo "  2. make dev              # Start development environment"
	@echo "  3. make monitoring       # Open monitoring dashboards"
	@echo ""
	@echo -e "$(YELLOW)Service URLs (after 'make dev'):$(NC)"
	@echo "  📊 Command Center:    http://localhost:3004"
	@echo "  📱 Smart Form:        http://localhost:3002"
	@echo "  📈 Dashboard:         http://localhost:3003"
	@echo "  🔧 API:               http://localhost:3001"
	@echo "  ⏱️  Temporal UI:       http://localhost:8088"
	@echo "  📊 Grafana:           http://localhost:3000"
	@echo "  📈 Prometheus:        http://localhost:9090"