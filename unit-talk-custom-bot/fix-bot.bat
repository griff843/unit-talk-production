@echo off
echo 🚀 Unit Talk Discord Bot - Complete Setup ^& Fix Script
echo ======================================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the unit-talk-custom-bot directory
    echo Usage: cd unit-talk-custom-bot ^&^& fix-bot.bat
    pause
    exit /b 1
)

echo 📋 Step 1: Checking environment configuration...

REM Check if .env file exists
if not exist ".env" (
    echo ❌ .env file not found!
    echo Please copy .env.example to .env and configure it:
    echo copy .env.example .env
    pause
    exit /b 1
)

echo ✅ .env file found

echo 🔍 Checking critical environment variables...
findstr /C:"DISCORD_TOKEN=" .env >nul
if errorlevel 1 (
    echo ❌ DISCORD_TOKEN is not set in .env
    echo Please set your Discord bot token in the .env file
    pause
    exit /b 1
)

findstr /C:"SUPABASE_URL=" .env >nul
if errorlevel 1 (
    echo ❌ SUPABASE_URL is not set in .env
    echo Please set your Supabase URL in the .env file
    pause
    exit /b 1
)

findstr /C:"SUPABASE_SERVICE_ROLE_KEY=" .env >nul
if errorlevel 1 (
    echo ❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env
    echo Please set your Supabase service role key in the .env file
    pause
    exit /b 1
)

echo ✅ Critical environment variables appear to be set
echo.

echo 📦 Step 2: Installing/updating dependencies...
call npm install
if errorlevel 1 (
    echo ❌ npm install failed
    pause
    exit /b 1
)
echo ✅ Dependencies installed successfully
echo.

echo 🔍 Step 3: Testing database connection...
call node test-database.js
echo.

echo 🏗️ Step 4: Building the project...
call npm run build
if errorlevel 1 (
    echo ❌ Build failed
    echo Please check the TypeScript errors above
    pause
    exit /b 1
)
echo ✅ Build successful
echo.

echo 🎯 Setup Complete!
echo ==================
echo.
echo ⚠️  IMPORTANT: Before starting the bot, make sure you have:
echo.
echo 1. 📊 Run the database setup SQL script in your Supabase project:
echo    - Go to your Supabase dashboard
echo    - Navigate to SQL Editor
echo    - Copy and run the contents of 'complete-database-setup.sql'
echo.
echo 2. 🤖 Verify your Discord bot has proper permissions:
echo    - Read Messages
echo    - Send Messages
echo    - Manage Messages
echo    - Manage Threads
echo    - Use Slash Commands
echo    - Manage Roles (if using role management features)
echo.
echo 3. 🔧 Double-check your channel and role IDs in the .env file
echo.
echo 🚀 To start the bot, run:
echo    npm run dev
echo.
echo 📖 For detailed troubleshooting, see SETUP_GUIDE.md
echo.

set /p response="Would you like to test the database connection again? (y/n): "
if /i "%response%"=="y" (
    echo 🔍 Running database connection test...
    call node test-database.js
)

echo.
echo 🎉 Setup script completed!
echo If you see any errors above, please address them before starting the bot.
pause