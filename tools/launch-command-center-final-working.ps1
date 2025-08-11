# Unit Talk Command Center - Final Working Launch
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Unit Talk Command Center - Launch" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$commandCenterPath = "..\unit-talk-command-center"

try {
    Write-Host "Navigating to Command Center directory..." -ForegroundColor Blue
    Push-Location $commandCenterPath
    
    $currentPath = Get-Location
    Write-Host "Current directory: $currentPath" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Starting development server on port 3002..." -ForegroundColor Blue
    Write-Host "URL: http://localhost:3002" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Green
    Write-Host ""
    
    # Set environment
    $env:NODE_ENV = "development"
    $env:PORT = "3002"
    
    # Start using npx directly
    & npx next dev -p 3002
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Pop-Location -ErrorAction SilentlyContinue
}