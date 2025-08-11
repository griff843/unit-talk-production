@echo off
echo.
echo ===== Unit Talk Smart Form Quick Test =====
echo.

REM Kill any existing Node processes
echo Cleaning up existing processes...
taskkill /F /IM node.exe 2>nul

REM Clear specific port for Smart Form
echo Clearing port 3021...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3021') do taskkill /F /PID %%a 2>nul

REM Start Smart Form on specific port
echo.
echo Starting Smart Form on port 3021...
cd apps\smart-form
set PORT=3021
start /B cmd /c "npm run dev"

REM Wait a moment for server to start
echo.
echo Waiting for server to start...
timeout /t 10 /nobreak >nul

REM Open in browser
echo.
echo Opening Smart Form in browser...
start http://localhost:3021/submit-ticket

echo.
echo ========================================
echo Smart Form is starting on port 3021
echo URL: http://localhost:3021/submit-ticket
echo.
echo If the page doesn't load, wait a moment and refresh.
echo Press Ctrl+C to stop the server.
echo ========================================
echo.

REM Keep window open
pause