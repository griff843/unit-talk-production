# Unit Talk Command Center Launcher
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Unit Talk Command Center Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if port is in use
function Test-Port {
    param($port)
    $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

# Check required services
Write-Host "Checking required services..." -ForegroundColor Yellow
Write-Host ""

# Check Platform API (Port 3004)
if (Test-Port 3004) {
    Write-Host "[OK] Platform API is running on port 3004" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Platform API not running on port 3004!" -ForegroundColor Red
    Write-Host "Please start the platform API first:" -ForegroundColor Yellow
    Write-Host "  cd unit-talk-production" -ForegroundColor White
    Write-Host "  npm run start:api" -ForegroundColor White
    Write-Host ""
}

# Check Phase D Analytics (Port 3005)  
if (Test-Port 3005) {
    Write-Host "[OK] Phase D Analytics is running on port 3005" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Phase D Analytics not running on port 3005!" -ForegroundColor Red
    Write-Host "Please start Phase D Analytics:" -ForegroundColor Yellow
    Write-Host "  npx tsx src/monitoring/deploy-phase-d-analytics.ts" -ForegroundColor White
    Write-Host ""
}

# Check Redis (Port 6379)
if (Test-Port 6379) {
    Write-Host "[OK] Redis is running on port 6379" -ForegroundColor Green
} else {
    Write-Host "[INFO] Redis not running on port 6379 (optional)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Launching Command Center..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to Command Center directory
$commandCenterPath = Join-Path (Split-Path $PSScriptRoot -Parent) "unit-talk-command-center"

if (Test-Path $commandCenterPath) {
    Set-Location $commandCenterPath
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install
    }
    
    # Check if .env.local exists
    if (-not (Test-Path ".env.local")) {
        Write-Host "Creating .env.local from example..." -ForegroundColor Yellow
        Copy-Item ".env.local.example" ".env.local"
        Write-Host ""
        Write-Host "IMPORTANT: Please edit .env.local with your configuration!" -ForegroundColor Red
        Write-Host "Press any key to continue after editing..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    
    # Start the Command Center
    Write-Host ""
    Write-Host "Starting Command Center on http://localhost:3001" -ForegroundColor Green
    Write-Host ""
    
    # Launch in current window
    npm run dev
} else {
    Write-Host "ERROR: Command Center directory not found!" -ForegroundColor Red
    Write-Host "Expected path: $commandCenterPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure the Command Center is properly installed." -ForegroundColor Yellow
}