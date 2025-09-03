@echo off
echo Restarting Command Center with v3.0.0 unified database integration...
echo.

REM Kill any existing Node processes on port 3015
echo Stopping existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3015') do (
    taskkill /F /PID %%a 2>nul
)

REM Give it a moment to clean up
timeout /t 2 /nobreak >nul

echo.
echo Starting Command Center with fresh build...
cd /d "%~dp0"

REM Clear Next.js cache
echo Clearing Next.js cache...
rmdir /s /q .next 2>nul

REM Install dependencies if needed
echo Checking dependencies...
call npm install

REM Build the application
echo Building Command Center...
call npm run build

REM Start the development server
echo Starting Command Center on port 3015...
start cmd /k "npm run dev"

echo.
echo Command Center is starting up...
echo.
echo Once started, it should show:
echo - Real capper names (Griff843, Vicgo, Sauced, etc.)
echo - "Production" mode instead of "Demo"  
echo - Live data from unified_picks table
echo.
echo Open http://localhost:3015 in your browser
pause