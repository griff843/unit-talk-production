@echo off
title Unit Talk Command Center Launcher
color 0A

echo ============================================
echo Unit Talk Command Center - Simple Launcher
echo ============================================
echo.

REM Set the Command Center path
set "COMMAND_CENTER_PATH=C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"

REM Navigate to Command Center directory
echo Step 1: Navigating to Command Center directory...
cd /d "%COMMAND_CENTER_PATH%"
if %errorlevel% neq 0 (
    echo ERROR: Could not navigate to Command Center directory
    echo Path: %COMMAND_CENTER_PATH%
    pause
    exit /b 1
)
echo Current directory: %CD%
echo.

REM Check if Node.js is available
echo Step 2: Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found in PATH
    echo Please install Node.js from https://nodejs.org/
    echo Or ensure Node.js is added to your PATH
    pause
    exit /b 1
)

for /f "delims=" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found
    pause
    exit /b 1
)

for /f "delims=" %%i in ('npm --version') do set NPM_VERSION=%%i
echo npm version: %NPM_VERSION%
echo.

REM Check and install dependencies
echo Step 3: Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo Dependencies installed successfully
) else (
    echo Dependencies already installed
)
echo.

REM Check required files
echo Step 4: Verifying configuration files...
if exist ".env.local" (
    echo Found: .env.local
) else (
    echo WARNING: .env.local not found
)

if exist "package.json" (
    echo Found: package.json
) else (
    echo ERROR: package.json not found
    pause
    exit /b 1
)

if exist "next.config.js" (
    echo Found: next.config.js
) else (
    echo WARNING: next.config.js not found
)
echo.

REM Kill any existing processes on port 3002
echo Step 5: Checking port 3002...
netstat -ano | findstr :3002 >nul 2>&1
if %errorlevel% equ 0 (
    echo Port 3002 is in use, attempting to free it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 3 /nobreak >nul
    echo Port 3002 should now be available
) else (
    echo Port 3002 is available
)
echo.

REM Start the development server
echo Step 6: Starting Command Center...
echo ============================================
echo 🚀 Starting Unit Talk Command Center
echo 🌐 URL: http://localhost:3002
echo ⏹️  Press Ctrl+C to stop the server
echo ============================================
echo.

REM Set environment variables
set NODE_ENV=development
set PORT=3002

REM Start the server
npm run dev

REM If we get here, something went wrong
echo.
echo Server stopped unexpectedly
pause