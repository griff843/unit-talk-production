# Unit Talk Command Center - Direct Launch Script
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Starting Unit Talk Command Center" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$commandCenterPath = "..\unit-talk-command-center"

try {
    # Navigate to Command Center
    Write-Host "Navigating to Command Center directory..." -ForegroundColor Blue
    Push-Location $commandCenterPath
    
    $currentPath = Get-Location
    Write-Host "Current directory: $currentPath" -ForegroundColor Green
    Write-Host ""
    
    # Check if Next.js is available locally
    $nextBin = "node_modules\.bin\next.cmd"
    if (Test-Path $nextBin) {
        Write-Host "Found local Next.js binary: $nextBin" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Local Next.js binary not found at $nextBin" -ForegroundColor Yellow
        $nextBin = "npx next"
    }
    
    Write-Host ""
    Write-Host "Starting Next.js development server on port 3002..." -ForegroundColor Blue
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "🚀 Unit Talk Command Center" -ForegroundColor Green
    Write-Host "🌐 URL: http://localhost:3002" -ForegroundColor Green
    Write-Host "📂 Path: $currentPath" -ForegroundColor Green
    Write-Host "⏹️  Press Ctrl+C to stop the server" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    
    # Set environment variables
    $env:NODE_ENV = "development"
    $env:PORT = "3002"
    
    # Start the server using local Next.js
    if (Test-Path "node_modules\.bin\next.cmd") {
        & "node_modules\.bin\next.cmd" dev -p 3002
    } else {
        npx next dev -p 3002
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
} finally {
    Pop-Location -ErrorAction SilentlyContinue
}