# Unit Talk Command Center - Clean Launch
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Starting Unit Talk Command Center" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$commandCenterPath = "..\unit-talk-command-center"

try {
    Write-Host "Navigating to Command Center directory..." -ForegroundColor Blue
    Push-Location $commandCenterPath
    
    $currentPath = Get-Location
    Write-Host "Current directory: $currentPath" -ForegroundColor Green
    Write-Host ""
    
    # Check for local Next.js
    if (Test-Path "node_modules\.bin\next.cmd") {
        Write-Host "Found local Next.js binary" -ForegroundColor Green
        $nextCmd = "node_modules\.bin\next.cmd"
    } else {
        Write-Host "Using npx next" -ForegroundColor Yellow
        $nextCmd = "npx"
        $nextArgs = @("next")
    }
    
    Write-Host ""
    Write-Host "Starting development server on port 3002..." -ForegroundColor Blue
    Write-Host "URL: http://localhost:3002" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Green
    Write-Host ""
    
    # Set environment
    $env:NODE_ENV = "development"
    $env:PORT = "3002"
    
    # Start the server
    if ($nextCmd -eq "npx") {
        & npx next dev -p 3002
    } else {
        & $nextCmd dev -p 3002
    }
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Pop-Location -ErrorAction SilentlyContinue
}