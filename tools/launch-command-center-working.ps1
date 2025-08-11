# Unit Talk Command Center - Working Launch Script
param(
    [switch]$SkipDependencyCheck,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$commandCenterPath = "..\unit-talk-command-center"
$targetPort = 3002

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Unit Talk Command Center - Working Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Store original location
$originalLocation = Get-Location

try {
    # Step 1: Navigate to Command Center directory
    Write-Host "Step 1: Navigating to Command Center directory..." -ForegroundColor Blue
    Write-Host "Starting from: $originalLocation" -ForegroundColor Gray
    
    if (-not (Test-Path $commandCenterPath)) {
        throw "Command Center directory not found: $commandCenterPath"
    }
    
    Push-Location $commandCenterPath
    $absolutePath = Get-Location
    Write-Host "Current directory: $absolutePath" -ForegroundColor Green
    Write-Host ""
    
    # Step 2: Check Node.js and npm
    Write-Host "Step 2: Verifying Node.js and npm..." -ForegroundColor Blue
    
    $nodeVersion = ""
    $npmVersion = ""
    
    try {
        $nodeVersion = node --version 2>$null
        $npmVersion = npm --version 2>$null
    } catch {
        throw "Node.js or npm not found. Please ensure they are installed and in PATH."
    }
    
    if (-not $nodeVersion -or -not $npmVersion) {
        throw "Node.js or npm commands failed. Please check installation."
    }
    
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
    Write-Host ""
    
    # Step 3: Check dependencies
    Write-Host "Step 3: Checking dependencies..." -ForegroundColor Blue
    
    if (-not $SkipDependencyCheck) {
        if (-not (Test-Path "node_modules") -or -not (Test-Path "package.json")) {
            Write-Host "Installing dependencies..." -ForegroundColor Yellow
            $installOutput = npm install 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "npm install output: $installOutput" -ForegroundColor Red
                throw "npm install failed with exit code $LASTEXITCODE"
            }
            Write-Host "Dependencies installed successfully" -ForegroundColor Green
        } else {
            Write-Host "Dependencies already installed" -ForegroundColor Green
        }
    } else {
        Write-Host "Skipping dependency check (flag provided)" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Step 4: Verify configuration
    Write-Host "Step 4: Verifying configuration..." -ForegroundColor Blue
    
    if (Test-Path ".env.local") {
        Write-Host "Found: .env.local" -ForegroundColor Green
        $envContent = Get-Content ".env.local" -Raw
        if ($envContent -match "NEXT_PUBLIC_SUPABASE_URL=https://sqdxvtztjczklmqckmwl.supabase.co") {
            Write-Host "Correct Supabase configuration found" -ForegroundColor Green
        } else {
            Write-Host "WARNING: Supabase configuration may need verification" -ForegroundColor Yellow
        }
    } else {
        Write-Host "WARNING: .env.local file not found" -ForegroundColor Yellow
    }
    
    if (Test-Path "package.json") {
        Write-Host "Found: package.json" -ForegroundColor Green
        try {
            $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
            if ($packageJson.scripts.dev -match "-p 3002") {
                Write-Host "Development script configured for port 3002" -ForegroundColor Green
            } else {
                Write-Host "WARNING: Development script port configuration unclear" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "WARNING: Could not parse package.json" -ForegroundColor Yellow
        }
    } else {
        throw "package.json not found in the Command Center directory"
    }
    Write-Host ""
    
    # Step 5: Check port availability (simplified)
    Write-Host "Step 5: Checking port $targetPort..." -ForegroundColor Blue
    try {
        $portCheck = Test-NetConnection -ComputerName localhost -Port $targetPort -WarningAction SilentlyContinue
        if ($portCheck.TcpTestSucceeded) {
            Write-Host "Port $targetPort is in use, but continuing anyway..." -ForegroundColor Yellow
        } else {
            Write-Host "Port $targetPort appears to be available" -ForegroundColor Green
        }
    } catch {
        Write-Host "Port check completed (assumed available)" -ForegroundColor Green
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
    
    # Set environment variables
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
    
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "Target path: $commandCenterPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Verify Command Center directory exists" -ForegroundColor Yellow
    Write-Host "2. Run: npm install in the Command Center directory" -ForegroundColor Yellow
    Write-Host "3. Check .env.local configuration" -ForegroundColor Yellow
    Write-Host "4. Ensure port $targetPort is available" -ForegroundColor Yellow
    
    exit 1
} finally {
    # Return to original directory
    if (Get-Location -ne $originalLocation) {
        Pop-Location -ErrorAction SilentlyContinue
    }
}