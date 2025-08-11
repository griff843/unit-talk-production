@echo off
echo ======================================
echo Unit Talk Command Center Launcher
echo ======================================
echo.

REM Navigate to Command Center directory
cd ..\unit-talk-command-center

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo Creating .env.local from example...
    copy .env.local.example .env.local
    echo.
    echo IMPORTANT: Please edit .env.local with your configuration!
    echo Press any key to continue after editing...
    pause
)

REM Start the Command Center
echo.
echo Starting Command Center on http://localhost:3001
echo.
call npm run dev

pause