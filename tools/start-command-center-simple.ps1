# Simple Command Center Starter
Write-Host "Unit Talk Command Center - Simple Launcher" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# Get parent directory path
$parentDir = Split-Path $PSScriptRoot -Parent
$commandCenterDir = Join-Path $parentDir "unit-talk-command-center"

Write-Host "Parent Directory: $parentDir" -ForegroundColor Yellow
Write-Host "Command Center Directory: $commandCenterDir" -ForegroundColor Yellow

if (Test-Path $commandCenterDir) {
    Write-Host "Command Center directory found!" -ForegroundColor Green
    
    # Check if package.json exists
    $packagePath = Join-Path $commandCenterDir "package.json"
    if (Test-Path $packagePath) {
        Write-Host "package.json found!" -ForegroundColor Green
        
        # Navigate to the directory
        Set-Location $commandCenterDir
        Write-Host "Changed directory to: $(Get-Location)" -ForegroundColor Green
        
        # Check if node_modules exists
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing dependencies..." -ForegroundColor Yellow
            & npm install
        } else {
            Write-Host "Dependencies already installed!" -ForegroundColor Green
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
            Write-Host ".env.local created successfully!" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "Starting Command Center on http://localhost:3002..." -ForegroundColor Green
        Write-Host ""
        
        # Start the development server
        & npm run dev
        
    } else {
        Write-Host "ERROR: package.json not found in Command Center directory!" -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: Command Center directory not found!" -ForegroundColor Red
    Write-Host "Expected path: $commandCenterDir" -ForegroundColor Red
}