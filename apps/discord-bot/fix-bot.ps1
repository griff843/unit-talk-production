# Unit Talk Discord Bot - Complete Setup & Fix Script (Windows PowerShell)
# Run this script from the unit-talk-custom-bot directory

Write-Host "🚀 Unit Talk Discord Bot - Complete Setup & Fix Script" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the unit-talk-custom-bot directory" -ForegroundColor Red
    Write-Host "Usage: cd unit-talk-custom-bot && .\fix-bot.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Step 1: Checking environment configuration..." -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure it:" -ForegroundColor Yellow
    Write-Host "Copy-Item .env.example .env" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ .env file found" -ForegroundColor Green

# Check critical environment variables
Write-Host "🔍 Checking critical environment variables..." -ForegroundColor Cyan

$envContent = Get-Content ".env" -Raw

if (-not ($envContent -match "DISCORD_TOKEN=.+") -or ($envContent -match "DISCORD_TOKEN=your_")) {
    Write-Host "❌ DISCORD_TOKEN is not set properly in .env" -ForegroundColor Red
    Write-Host "Please set your Discord bot token in the .env file" -ForegroundColor Yellow
    exit 1
}

if (-not ($envContent -match "SUPABASE_URL=.+") -or ($envContent -match "SUPABASE_URL=your_")) {
    Write-Host "❌ SUPABASE_URL is not set properly in .env" -ForegroundColor Red
    Write-Host "Please set your Supabase URL in the .env file" -ForegroundColor Yellow
    exit 1
}

if (-not ($envContent -match "SUPABASE_SERVICE_ROLE_KEY=.+") -or ($envContent -match "SUPABASE_SERVICE_ROLE_KEY=your_")) {
    Write-Host "❌ SUPABASE_SERVICE_ROLE_KEY is not set properly in .env" -ForegroundColor Red
    Write-Host "Please set your Supabase service role key in the .env file" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Critical environment variables appear to be set" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Step 2: Installing/updating dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

Write-Host "🔍 Step 3: Testing database connection..." -ForegroundColor Cyan
node test-database.js
Write-Host ""

Write-Host "🏗️ Step 4: Building the project..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    Write-Host "Please check the TypeScript errors above" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

Write-Host "🎯 Setup Complete!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Before starting the bot, make sure you have:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 📊 Run the database setup SQL script in your Supabase project:" -ForegroundColor White
Write-Host "   - Go to your Supabase dashboard" -ForegroundColor Gray
Write-Host "   - Navigate to SQL Editor" -ForegroundColor Gray
Write-Host "   - Copy and run the contents of 'complete-database-setup.sql'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 🤖 Verify your Discord bot has proper permissions:" -ForegroundColor White
Write-Host "   - Read Messages" -ForegroundColor Gray
Write-Host "   - Send Messages" -ForegroundColor Gray
Write-Host "   - Manage Messages" -ForegroundColor Gray
Write-Host "   - Manage Threads" -ForegroundColor Gray
Write-Host "   - Use Slash Commands" -ForegroundColor Gray
Write-Host "   - Manage Roles (if using role management features)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 🔧 Double-check your channel and role IDs in the .env file" -ForegroundColor White
Write-Host ""
Write-Host "🚀 To start the bot, run:" -ForegroundColor Green
Write-Host "   npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "📖 For detailed troubleshooting, see SETUP_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

# Offer to run the database test again
$response = Read-Host "Would you like to test the database connection again? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "🔍 Running database connection test..." -ForegroundColor Cyan
    node test-database.js
}

Write-Host ""
Write-Host "🎉 Setup script completed!" -ForegroundColor Green
Write-Host "If you see any errors above, please address them before starting the bot." -ForegroundColor Yellow