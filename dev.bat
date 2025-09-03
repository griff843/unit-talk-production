@echo off
REM ==============================================
REM Unit Talk Development Environment Startup (Windows)
REM Fortune 100-grade local development orchestration
REM ==============================================

setlocal enabledelayedexpansion

REM Configuration
set COMPOSE_FILE=docker-compose.yml
set HEALTH_CHECK_TIMEOUT=300
set HEALTH_CHECK_INTERVAL=5

REM Function to print status with timestamp
:print_status
echo [%time%] %~1
goto :eof

:print_success
echo [%time%] ✅ %~1
goto :eof

:print_warning
echo [%time%] ⚠️  %~1
goto :eof

:print_error
echo [%time%] ❌ %~1
goto :eof

:print_info
echo [%time%] ℹ️  %~1
goto :eof

REM Function to show banner
:show_banner
echo.
echo ==================================================
echo     UNIT TALK DEVELOPMENT ENVIRONMENT
echo     Fortune 100-Grade Local Development
echo ==================================================
echo.
goto :eof

REM Function to show service URLs
:show_service_urls
echo.
echo 🌐 Service URLs:
echo ==================================================
echo 📊 Command Center:    http://localhost:3004
echo 📱 Smart Form:        http://localhost:3002
echo 📈 Dashboard:         http://localhost:3003
echo 🔧 API:               http://localhost:3001
echo.
echo 🛠️  Development Tools:
echo ==================================================
echo ⏱️  Temporal UI:       http://localhost:8088
echo 📊 Prometheus:        http://localhost:9090
echo 📈 Grafana:           http://localhost:3000 (admin/admin)
echo 🗄️  pgAdmin:           http://localhost:5050 (admin@unittalk.com/admin)
echo 📮 Redis Commander:   http://localhost:8081
echo 📧 Mailhog:           http://localhost:8025
echo.
goto :eof

REM Function to check prerequisites
:check_prerequisites
call :print_status "Checking prerequisites..."

REM Check if Docker is running
docker info >nul 2>&1
if !errorlevel! neq 0 (
    call :print_error "Docker is not running. Please start Docker Desktop."
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if !errorlevel! neq 0 (
    call :print_error "docker-compose is not installed or not in PATH."
    exit /b 1
)

REM Check if required files exist
if not exist "%COMPOSE_FILE%" (
    call :print_error "Docker Compose file not found: %COMPOSE_FILE%"
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    call :print_warning ".env file not found. Creating from .env.example..."
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        call :print_info "Please update .env with your actual values before continuing."
        exit /b 1
    ) else (
        call :print_error "No .env.example file found. Please create .env manually."
        exit /b 1
    )
)

call :print_success "Prerequisites check passed!"
goto :eof

REM Function to setup workspace
:setup_workspace
call :print_status "Setting up workspace..."

REM Create required directories
if not exist "logs" mkdir logs
if not exist "monitoring" mkdir monitoring
if not exist "monitoring\grafana" mkdir monitoring\grafana
if not exist "monitoring\grafana\dashboards" mkdir monitoring\grafana\dashboards
if not exist "monitoring\grafana\provisioning" mkdir monitoring\grafana\provisioning

REM Install dependencies if needed
if not exist "node_modules" (
    call :print_status "Installing workspace dependencies..."
    npm install
)

call :print_success "Workspace setup complete!"
goto :eof

REM Function to create monitoring configuration
:create_monitoring_config
call :print_status "Creating monitoring configuration..."

if not exist "monitoring" mkdir monitoring

REM Create Prometheus configuration
(
echo global:
echo   scrape_interval: 15s
echo   evaluation_interval: 15s
echo.
echo scrape_configs:
echo   - job_name: 'unit-talk-api'
echo     static_configs:
echo       - targets: ['api:9464']
echo     scrape_interval: 5s
echo     metrics_path: /metrics
echo.
echo   - job_name: 'unit-talk-workers'
echo     static_configs:
echo       - targets: ['workers:9464']
echo     scrape_interval: 5s
echo     metrics_path: /metrics
echo.
echo   - job_name: 'redis'
echo     static_configs:
echo       - targets: ['redis:6379']
echo.
echo   - job_name: 'postgres'
echo     static_configs:
echo       - targets: ['postgres:5432']
echo.
echo   - job_name: 'temporal'
echo     static_configs:
echo       - targets: ['temporal:7233']
echo     scrape_interval: 10s
) > monitoring\prometheus.yml

call :print_success "Monitoring configuration created!"
goto :eof

REM Function to start infrastructure services
:start_infrastructure
call :print_status "Starting infrastructure services..."

REM Start database services first
docker-compose up -d postgres redis temporal-postgres

call :print_status "Waiting for databases to initialize..."
timeout /t 10 /nobreak >nul

REM Start Temporal services
docker-compose up -d temporal-admin-tools
timeout /t 5 /nobreak >nul

docker-compose up -d temporal temporal-ui

REM Start monitoring services
docker-compose up -d prometheus grafana

call :print_success "Infrastructure services started!"
goto :eof

REM Function to start application services
:start_applications
call :print_status "Starting application services..."

REM Start main API first
docker-compose up -d api

call :print_status "Waiting for API to become healthy..."
timeout /t 60 /nobreak >nul

REM Start worker processes
docker-compose up -d workers

REM Start Discord bot
docker-compose up -d discord-bot

REM Start frontend applications
docker-compose up -d smart-form dashboard command-center

call :print_success "Application services started!"
goto :eof

REM Function to start development tools
:start_dev_tools
call :print_status "Starting development tools..."

REM Start optional development tools
docker-compose --profile tools up -d pgadmin redis-commander mailhog

call :print_success "Development tools started!"
goto :eof

REM Function to open browser tabs
:open_browser_tabs
call :print_status "Opening browser tabs..."
start "" "http://localhost:3004"
start "" "http://localhost:8088"
goto :eof

REM Main execution
set command=%1
if "%command%"=="" set command=start

if "%command%"=="start" (
    call :show_banner
    call :check_prerequisites
    if !errorlevel! neq 0 exit /b 1
    
    call :setup_workspace
    if !errorlevel! neq 0 exit /b 1
    
    call :create_monitoring_config
    
    call :print_status "Starting Unit Talk development environment..."
    
    call :start_infrastructure
    call :start_applications  
    call :start_dev_tools
    
    call :print_status "Waiting for all services to stabilize..."
    timeout /t 15 /nobreak >nul
    
    call :show_service_urls
    call :print_success "🚀 Unit Talk development environment is ready!"
    call :print_info "Run 'dev.bat logs' to view service logs"
    call :print_info "Run 'dev.bat status' to check service status"
    call :print_info "Run 'dev.bat stop' to stop all services"
    
    set /p answer="Open browser tabs for key services? (y/N): "
    if /i "!answer!"=="y" call :open_browser_tabs
    
) else if "%command%"=="stop" (
    call :print_status "Stopping Unit Talk development environment..."
    docker-compose down
    call :print_success "Environment stopped!"
    
) else if "%command%"=="restart" (
    call :print_status "Restarting Unit Talk development environment..."
    docker-compose restart
    call :print_success "Environment restarted!"
    
) else if "%command%"=="logs" (
    call :print_info "Showing service logs (press Ctrl+C to exit)..."
    docker-compose logs -f --tail=50
    
) else if "%command%"=="status" (
    call :print_info "Current service status:"
    echo ==================================================
    docker-compose ps --format table
    echo.
    call :print_info "Resource usage:"
    echo ==================================================
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    
) else if "%command%"=="clean" (
    call :print_status "Cleaning up development environment..."
    docker-compose down --remove-orphans
    docker system prune -f
    call :print_success "Cleanup complete!"
    
) else if "%command%"=="reset" (
    call :print_status "Resetting development environment..."
    docker-compose down --volumes --remove-orphans
    docker system prune -f
    call :print_success "Environment reset complete! Run 'dev.bat start' to rebuild."
    
) else if "%command%"=="help" (
    echo Unit Talk Development Environment Control Script
    echo.
    echo Usage: %0 [command]
    echo.
    echo Commands:
    echo   start     Start the development environment (default)
    echo   stop      Stop all services
    echo   restart   Restart all services
    echo   logs      Show service logs
    echo   status    Show service status and resource usage
    echo   clean     Stop services and clean up containers
    echo   reset     Full reset - removes volumes and containers
    echo   help      Show this help message
    
) else (
    call :print_error "Unknown command: %command%"
    echo Run '%0 help' for usage information.
    exit /b 1
)

endlocal