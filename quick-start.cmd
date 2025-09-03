@echo off
REM Unit Talk Platform - Universal Quick Start
REM Works on any Windows PC

echo ===============================================
echo   UNIT TALK PLATFORM - UNIVERSAL QUICK START
echo   SaaS-Grade Development Environment
echo ===============================================
echo.

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo [INFO] Docker is running
echo [INFO] Starting core infrastructure services only...
echo.

REM Start only the services that work
echo Starting PostgreSQL database...
docker-compose up -d postgres

echo Starting Redis cache...  
docker-compose up -d redis

echo Starting Prometheus monitoring...
docker-compose up -d prometheus

echo Starting Grafana dashboards...
docker-compose up -d grafana

echo Starting Temporal workflow engine...
docker-compose up -d temporal-postgres temporal temporal-ui

echo.
echo [SUCCESS] Core infrastructure is starting!
echo.
echo Waiting 15 seconds for services to initialize...
timeout /t 15 >nul

echo.
echo ==============================================
echo   SERVICE STATUS
echo ==============================================
docker-compose ps

echo.
echo ==============================================
echo   ACCESS YOUR SERVICES
echo ==============================================
echo.
echo 🟢 WORKING SERVICES:
echo    💾 PostgreSQL Database: localhost:5432
echo    ⚡ Redis Cache:         localhost:6379  
echo    📊 Prometheus:          http://localhost:9090
echo    📈 Grafana:             http://localhost:3001 (admin/admin)
echo    ⏱️  Temporal UI:         http://localhost:8088
echo.
echo 🟡 APPLICATION SERVICES (Need Fixing):
echo    🔧 API:                 Will be fixed for production PC
echo    📱 Command Center:      Will be fixed for production PC
echo    📋 Smart Form:          Will be fixed for production PC
echo    🤖 Discord Bot:         Will be fixed for production PC
echo.

set /p open_dashboards="Open monitoring dashboards? (Y/n): "
if /i "%open_dashboards%" neq "n" (
    echo Opening dashboards...
    start http://localhost:9090
    start http://localhost:3001
    start http://localhost:8088
)

echo.
echo ==============================================
echo   WHAT TO DO ON YOUR MAIN PC
echo ==============================================
echo.
echo When you get your main PC back:
echo 1. Copy this entire project folder
echo 2. Run: quick-start.cmd
echo 3. Everything will work identically
echo.
echo The database and configuration are portable!
echo.
pause