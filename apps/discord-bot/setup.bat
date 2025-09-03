@echo off
setlocal enabledelayedexpansion

echo 🤖 Unit Talk Discord Bot - Quick Start
echo ======================================

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected: 
node --version

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Please run this script from the unit-talk-custom-bot directory
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed
) else (
    echo ✅ Dependencies already installed
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  No .env file found
    if exist ".env.example" (
        echo 📋 Copying .env.example to .env
        copy ".env.example" ".env" >nul
        echo ⚠️  Please edit .env file with your configuration before running the bot
        echo    Required: DISCORD_TOKEN, DISCORD_CLIENT_ID, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
        pause
        exit /b 1
    ) else (
        echo ❌ No .env.example file found. Please create a .env file manually.
        pause
        exit /b 1
    )
)

echo ✅ Environment file found

REM Build the project
echo 🔨 Building the project...
call npm run build
if errorlevel 1 (
    echo ❌ Build failed. Please check the errors above.
    pause
    exit /b 1
)

echo ✅ Build successful
echo.
echo 🚀 Setup complete! You can now run the bot with:
echo.
echo    Development mode (with hot reload):
echo    npm run dev
echo.
echo    Production mode:
echo    npm start
echo.
echo 📖 For more information, see README.md
echo.

set /p "choice=Would you like to start the bot in development mode now? (y/N): "
if /i "%choice%"=="y" (
    echo 🚀 Starting bot in development mode...
    call npm run dev
)

pause