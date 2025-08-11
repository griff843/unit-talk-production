@echo off
title Unit Talk Command Center - Final Launcher
color 0A

echo ============================================
echo Unit Talk Command Center - Final Launcher
echo ============================================
echo.

REM Store current directory
set "ORIGINAL_DIR=%CD%"
set "COMMAND_CENTER_PATH=..\unit-talk-command-center"

echo Starting from: %ORIGINAL_DIR%
echo.

REM Step 1: Navigate to Command Center
echo Step 1: Navigating to Command Center directory...
if not exist "%COMMAND_CENTER_PATH%" (
    echo ERROR: Command Center directory not found: %COMMAND_CENTER_PATH%
    pause
    exit /b 1
)

cd /d "%COMMAND_CENTER_PATH%"
echo Current directory: %CD%
echo.

REM Step 2: Check Node.js and npm
echo Step 2: Verifying Node.js and npm...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

for /f "delims=" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found
    pause
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

for /f "delims=" %%i in ('npm --version 2^>nul') do set NPM_VERSION=%%i
echo npm version: %NPM_VERSION%
echo.

REM Step 3: Check dependencies
echo Step 3: Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        cd /d "%ORIGINAL_DIR%"
        exit /b 1
    )
    echo Dependencies installed successfully
) else (
    echo Dependencies already installed
)
echo.

REM Step 4: Verify configuration
echo Step 4: Verifying configuration...
if exist ".env.local" (
    echo Found: .env.local
    findstr "NEXT_PUBLIC_SUPABASE_URL=https://sqdxvtztjczklmqckmwl.supabase.co" .env.local >nul 2>&1
    if %errorlevel% equ 0 (
        echo Correct Supabase configuration found
    ) else (
        echo WARNING: Supabase configuration may need verification
    )
) else (
    echo WARNING: .env.local not found
)

if exist "package.json" (
    echo Found: package.json
) else (
    echo ERROR: package.json not found
    pause
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)
echo.

REM Step 5: Check port (simplified)
echo Step 5: Checking port 3002...
netstat -ano | findstr :3002 >nul 2>&1
if %errorlevel% equ 0 (
    echo Port 3002 is in use, but continuing anyway...
) else (
    echo Port 3002 appears to be available
)
echo.

REM Step 6: Start the server
echo Step 6: Starting Command Center...
echo ============================================
echo 🚀 Unit Talk Command Center Starting...
echo 🌐 URL: http://localhost:3002
echo 📂 Path: %CD%
echo ⏹️  Press Ctrl+C to stop the server
echo ============================================
echo.

REM Set environment variables
set NODE_ENV=development
set PORT=3002

REM Start the development server
npm run dev

REM If we get here, something went wrong or server stopped
echo.
echo Server stopped
echo Returning to original directory: %ORIGINAL_DIR%
cd /d "%ORIGINAL_DIR%"
pause