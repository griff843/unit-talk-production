# Final Command Center Setup and Launch Script
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Unit Talk Command Center - Final Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Kill any existing processes on port 3002
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3002 -EA SilentlyContinue | ForEach-Object { 
    Write-Host "  Stopping process $($_.OwningProcess)" -ForegroundColor Gray
    Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue 
}

# Navigate to Command Center directory
$commandCenterPath = "C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"
Write-Host "Navigating to: $commandCenterPath" -ForegroundColor Yellow
Set-Location $commandCenterPath

# Install all dependencies
Write-Host "Installing/updating dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Starting Command Center on port 3002" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access URL: http://localhost:3002" -ForegroundColor White
Write-Host ""

# Start the development server
npm run dev