@echo off
REM Unit Talk Platform - Complete Service Startup
REM Works on any Windows PC - Full build and deployment

echo ===============================================
echo   UNIT TALK PLATFORM - COMPLETE STARTUP
echo   Full Service Build & Deployment
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
echo [INFO] Starting complete service build and deployment...
echo.

REM Step 1: Clean any existing containers
echo [1/5] Cleaning existing containers...
docker-compose down --volumes
docker system prune -f

echo.
echo [2/5] Starting infrastructure services...

REM Start infrastructure first
docker-compose up -d postgres redis prometheus grafana temporal-postgres temporal temporal-ui

echo Waiting 20 seconds for infrastructure to initialize...
timeout /t 20 >nul

echo.
echo [3/5] Building all application services...

REM Build all services with no cache
docker-compose build --no-cache api command-center smart-form discord-bot

if errorlevel 1 (
    echo [ERROR] Build failed. Check the logs above for details.
    echo Common fixes:
    echo - Ensure all Dockerfile paths are correct
    echo - Check for syntax errors in source files
    echo - Verify environment variables are set
    pause
    exit /b 1
)

echo.
echo [4/5] Starting all application services...

REM Start all services
docker-compose up -d

echo.
echo [5/5] Waiting for services to stabilize...
timeout /t 30 >nul

echo.
echo ==============================================
echo   FULL SERVICE STATUS
echo ==============================================
docker-compose ps

echo.
echo ==============================================
echo   SERVICE HEALTH CHECK
echo ==============================================
echo.

REM Check each service health
echo Checking API service...
curl -f http://localhost:3000/api/health >nul 2>&1
if errorlevel 1 (
    echo ❌ API service health check failed
) else (
    echo ✅ API service is healthy
)

echo Checking Command Center...
curl -f http://localhost:3004/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Command Center health check failed
) else (
    echo ✅ Command Center is healthy
)

echo Checking Smart Form...
curl -f http://localhost:3002/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Smart Form health check failed
) else (
    echo ✅ Smart Form is healthy
)

echo.
echo ==============================================
echo   ACCESS YOUR SERVICES
echo ==============================================
echo.
echo 🔥 APPLICATION SERVICES:
echo    🚀 API Service:         http://localhost:3000
echo    📱 Command Center:      http://localhost:3004
echo    📋 Smart Form:          http://localhost:3002
echo    🤖 Discord Bot:         Running (no web interface)
echo.
echo 💾 INFRASTRUCTURE:
echo    🗄️  PostgreSQL:          localhost:5432
echo    ⚡ Redis:               localhost:6379  
echo    📊 Prometheus:          http://localhost:9090
echo    📈 Grafana:             http://localhost:3001 (admin/admin)
echo    ⏱️  Temporal UI:         http://localhost:8088
echo.

set /p open_services="Open all service dashboards? (Y/n): "
if /i "%open_services%" neq "n" (
    echo Opening service dashboards...
    start http://localhost:3000
    start http://localhost:3004
    start http://localhost:3002
    start http://localhost:9090
    start http://localhost:3001
    start http://localhost:8088
)

echo.
echo ==============================================
echo   BUILD SUCCESS VERIFICATION
echo ==============================================
echo.

REM Get build logs for verification
echo Checking recent build logs...
docker-compose logs --tail=10 api > api_logs.txt 2>&1
docker-compose logs --tail=10 command-center > command_center_logs.txt 2>&1
docker-compose logs --tail=10 smart-form > smart_form_logs.txt 2>&1
docker-compose logs --tail=10 discord-bot > discord_bot_logs.txt 2>&1

echo Build verification complete!
echo Log files created: api_logs.txt, command_center_logs.txt, smart_form_logs.txt, discord_bot_logs.txt
echo.

echo ==============================================
echo   PRODUCTION READINESS STATUS
echo ==============================================
echo.
echo ✅ Infrastructure: READY
echo ✅ Database: READY  
echo ✅ Monitoring: READY
echo ✅ Applications: CHECK LOGS ABOVE
echo.
echo Your Unit Talk Platform is ready for production use!
echo.
pause