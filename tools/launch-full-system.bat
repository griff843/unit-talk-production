@echo off
echo ============================================
echo Unit Talk Full System Launcher
echo ============================================
echo.

REM Check if all required services are running
echo Checking required services...
echo.

REM Check Platform API (Port 3004)
netstat -an | findstr :3004 >nul
if %errorlevel% neq 0 (
    echo [WARNING] Platform API not running on port 3004!
    echo Please start the platform API first:
    echo   cd unit-talk-production
    echo   npm run start:api
    echo.
) else (
    echo [OK] Platform API is running on port 3004
)

REM Check Phase D Analytics (Port 3005)
netstat -an | findstr :3005 >nul
if %errorlevel% neq 0 (
    echo [WARNING] Phase D Analytics not running on port 3005!
    echo Please start Phase D Analytics:
    echo   npx tsx src/monitoring/deploy-phase-d-analytics.ts
    echo.
) else (
    echo [OK] Phase D Analytics is running on port 3005
)

REM Check Redis (Port 6379)
netstat -an | findstr :6379 >nul
if %errorlevel% neq 0 (
    echo [INFO] Redis not running on port 6379 (optional)
) else (
    echo [OK] Redis is running on port 6379
)

echo.
echo ============================================
echo Launching Command Center...
echo ============================================
echo.

REM Launch Command Center in new window
start "Unit Talk Command Center" cmd /c "cd ..\unit-talk-command-center && npm run dev"

echo.
echo Command Center will launch in a new window.
echo.
echo Access Points:
echo - Command Center: http://localhost:3001
echo - Platform API: http://localhost:3004
echo - Phase D Analytics: http://localhost:3005
echo.
echo Press any key to exit...
pause >nul