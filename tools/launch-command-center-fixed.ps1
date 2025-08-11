# Fixed Command Center Launcher with full paths
Write-Host "Unit Talk Command Center - Fixed Launcher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Get parent directory path
$parentDir = Split-Path $PSScriptRoot -Parent
$commandCenterDir = Join-Path $parentDir "unit-talk-command-center"

Write-Host "Launching from: $commandCenterDir" -ForegroundColor Yellow

if (Test-Path $commandCenterDir) {
    # Navigate to the directory
    Set-Location $commandCenterDir
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies with full npm path..." -ForegroundColor Yellow
        & cmd /c "npm install"
    }
    
    # Create .env.local if it doesn't exist
    if (-not (Test-Path ".env.local")) {
        Write-Host "Creating .env.local..." -ForegroundColor Yellow
        @"
NEXT_PUBLIC_SUPABASE_URL=https://sqdxvtztjczklmqckmwl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZHh2dHp0amN6a2xtcWNrbXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjEyNzQzMjEsImV4cCI6MjAzNjg1MDMyMX0.BYRwJKNdI5JGN5gfzH4dNvzgPZNLlGwEhsN6RnPaMI8
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:3004
NEXT_PUBLIC_PHASE_D_URL=http://localhost:3005
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
    }
    
    Write-Host ""
    Write-Host "Starting Command Center..." -ForegroundColor Green
    Write-Host "URL: http://localhost:3002" -ForegroundColor Cyan
    Write-Host ""
    
    # Try using cmd to run npm
    & cmd /c "npm run dev"
    
} else {
    Write-Host "ERROR: Command Center directory not found!" -ForegroundColor Red
}