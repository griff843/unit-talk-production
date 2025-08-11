# Unit Talk Command Center - Final Launch Script
# Launches Command Center from the production directory

param(
    [switch]$SkipDependencyCheck,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$commandCenterPath = "..\unit-talk-command-center"
$targetPort = 3002

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Unit Talk Command Center - Final Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Get current location for reference
    $currentPath = Get-Location
    Write-Host "Starting from: $currentPath" -ForegroundColor Gray
    
    # Step 1: Navigate to Command Center directory
    Write-Host "Step 1: Navigating to Command Center directory..." -ForegroundColor Blue
    if (-not (Test-Path $commandCenterPath)) {
        throw "Command Center directory not found: $commandCenterPath"
    }
    
    Push-Location $commandCenterPath
    $absolutePath = Get-Location
    Write-Host "✓ Current directory: $absolutePath" -ForegroundColor Green
    Write-Host ""
    
    # Step 2: Check Node.js and npm
    Write-Host "Step 2: Verifying Node.js and npm..." -ForegroundColor Blue
    $nodeVersion = node --version 2>$null
    $npmVersion = npm --version 2>$null
    if (-not $nodeVersion -or -not $npmVersion) {
        throw "Node.js or npm not found. Please ensure they are installed and in PATH."
    }
    Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
    Write-Host "✓ npm version: $npmVersion" -ForegroundColor Green
    Write-Host ""
    
    # Step 3: Check dependencies
    if (-not $SkipDependencyCheck) {
        Write-Host "Step 3: Checking dependencies..." -ForegroundColor Blue
        if (-not (Test-Path "node_modules") -or -not (Test-Path "package.json")) {
            Write-Host "Installing dependencies..." -ForegroundColor Yellow
            $null = npm install 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed"
            }
            Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
        } else {
            Write-Host "✓ Dependencies already installed" -ForegroundColor Green
        }
    } else {
        Write-Host "Step 3: Skipping dependency check" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Step 4: Verify environment file
    Write-Host "Step 4: Verifying configuration..." -ForegroundColor Blue
    if (Test-Path ".env.local") {
        $envContent = Get-Content ".env.local" -Raw
        if ($envContent -match "NEXT_PUBLIC_SUPABASE_URL=https://sqdxvtztjczklmqckmwl.supabase.co") {
            Write-Host "✓ Correct Supabase configuration found" -ForegroundColor Green
        } else {
            Write-Host "⚠ Supabase configuration may need verification" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠ .env.local file not found" -ForegroundColor Yellow
    }
    
    # Check package.json script
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($packageJson.scripts.dev -match "-p 3002") {
            Write-Host "✓ Development script configured for port 3002" -ForegroundColor Green
        } else {
            Write-Host "⚠ Development script port configuration unclear" -ForegroundColor Yellow
        }
    }
    Write-Host ""
    
    # Step 5: Check port availability
    Write-Host "Step 5: Checking port $targetPort..." -ForegroundColor Blue
    try {
        $portCheck = Test-NetConnection -ComputerName localhost -Port $targetPort -WarningAction SilentlyContinue
        if ($portCheck.TcpTestSucceeded) {
            Write-Host "Port $targetPort is in use, but continuing anyway..." -ForegroundColor Yellow
        } else {
            Write-Host "✓ Port $targetPort appears to be available" -ForegroundColor Green
        }
    } catch {
        Write-Host "✓ Port check completed (assumed available)" -ForegroundColor Green
    }
    Write-Host ""
    
    # Step 6: Start the server
    Write-Host "Step 6: Starting Command Center..." -ForegroundColor Blue
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "🚀 Unit Talk Command Center Starting..." -ForegroundColor Green
    Write-Host "🌐 URL: http://localhost:$targetPort" -ForegroundColor Green
    Write-Host "📂 Path: $absolutePath" -ForegroundColor Green
    Write-Host "⏹️  Press Ctrl+C to stop the server" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    
    # Set environment for the process
    $env:NODE_ENV = "development"
    $env:PORT = $targetPort.ToString()
    
    # Start the development server
    npm run dev
    
} catch {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "❌ ERROR: Failed to start Command Center" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    # Provide troubleshooting information
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "Command Center path: $commandCenterPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Verify Command Center directory exists" -ForegroundColor Yellow
    Write-Host "2. Run: npm install in the Command Center directory" -ForegroundColor Yellow
    Write-Host "3. Check .env.local configuration" -ForegroundColor Yellow
    Write-Host "4. Ensure port $targetPort is available" -ForegroundColor Yellow
    
    exit 1
} finally {
    # Return to original directory
    Pop-Location -ErrorAction SilentlyContinue
}