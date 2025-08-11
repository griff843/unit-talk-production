# Unit Talk Command Center - Robust Launch Script
# Handles Node.js PATH issues and provides comprehensive setup

param(
    [switch]$SkipDependencyCheck,
    [switch]$Verbose
)

# Script configuration
$ErrorActionPreference = "Stop"
$commandCenterPath = "C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"
$targetPort = 3002

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Unit Talk Command Center - Robust Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Function to find Node.js installation
function Find-NodeJS {
    Write-Host "Searching for Node.js installation..." -ForegroundColor Yellow
    
    # Common Node.js installation paths
    $possiblePaths = @(
        "${env:ProgramFiles}\nodejs",
        "${env:ProgramFiles(x86)}\nodejs",
        "${env:LOCALAPPDATA}\Programs\nodejs",
        "${env:APPDATA}\npm",
        "C:\Program Files\nodejs",
        "C:\Program Files (x86)\nodejs"
    )
    
    # Check current PATH first
    $nodeFromPath = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeFromPath) {
        Write-Host "✓ Node.js found in PATH: $($nodeFromPath.Source)" -ForegroundColor Green
        return $nodeFromPath.Source
    }
    
    # Check common installation paths
    foreach ($path in $possiblePaths) {
        $nodeExe = Join-Path $path "node.exe"
        if (Test-Path $nodeExe) {
            Write-Host "✓ Node.js found at: $nodeExe" -ForegroundColor Green
            return $nodeExe
        }
    }
    
    # Search in registry
    try {
        $uninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        $nodeInstall = Get-ItemProperty $uninstallKey | Where-Object { $_.DisplayName -like "*Node.js*" } | Select-Object -First 1
        if ($nodeInstall -and $nodeInstall.InstallLocation) {
            $nodeExe = Join-Path $nodeInstall.InstallLocation "node.exe"
            if (Test-Path $nodeExe) {
                Write-Host "✓ Node.js found via registry: $nodeExe" -ForegroundColor Green
                return $nodeExe
            }
        }
    } catch {
        if ($Verbose) { Write-Host "Registry search failed: $($_.Exception.Message)" -ForegroundColor DarkYellow }
    }
    
    return $null
}

# Function to find npm
function Find-NPM {
    param($nodeDir)
    
    # Check if npm is in PATH
    $npmFromPath = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmFromPath) {
        Write-Host "✓ npm found in PATH: $($npmFromPath.Source)" -ForegroundColor Green
        return $npmFromPath.Source
    }
    
    # Check in same directory as node
    if ($nodeDir) {
        $nodeParentDir = Split-Path $nodeDir -Parent
        $npmCmd = Join-Path $nodeParentDir "npm.cmd"
        if (Test-Path $npmCmd) {
            Write-Host "✓ npm found at: $npmCmd" -ForegroundColor Green
            return $npmCmd
        }
    }
    
    return $null
}

# Function to check if port is available
function Test-Port {
    param($Port)
    
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
        return -not $connection.TcpTestSucceeded
    } catch {
        return $true  # Assume available if test fails
    }
}

# Function to kill process on port
function Stop-ProcessOnPort {
    param($Port)
    
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | ForEach-Object {
            Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        }
        
        foreach ($process in $processes) {
            Write-Host "Stopping process $($process.Name) (PID: $($process.Id)) on port $Port" -ForegroundColor Yellow
            Stop-Process -Id $process.Id -Force
            Start-Sleep -Seconds 2
        }
    } catch {
        if ($Verbose) { Write-Host "Error stopping processes on port $Port`: $($_.Exception.Message)" -ForegroundColor DarkYellow }
    }
}

try {
    # Step 1: Navigate to Command Center directory
    Write-Host "Step 1: Navigating to Command Center directory..." -ForegroundColor Blue
    if (-not (Test-Path $commandCenterPath)) {
        throw "Command Center directory not found: $commandCenterPath"
    }
    Set-Location $commandCenterPath
    Write-Host "✓ Current directory: $(Get-Location)" -ForegroundColor Green
    Write-Host ""
    
    # Step 2: Find Node.js and npm
    Write-Host "Step 2: Locating Node.js and npm..." -ForegroundColor Blue
    $nodeExe = Find-NodeJS
    if (-not $nodeExe) {
        throw "Node.js not found. Please install Node.js from https://nodejs.org/"
    }
    
    $npmExe = Find-NPM (Split-Path $nodeExe -Parent)
    if (-not $npmExe) {
        throw "npm not found. Please ensure npm is installed with Node.js"
    }
    
    # Get versions
    $nodeVersion = & $nodeExe --version 2>$null
    $npmVersion = & $npmExe --version 2>$null
    Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
    Write-Host "✓ npm version: $npmVersion" -ForegroundColor Green
    Write-Host ""
    
    # Step 3: Check and install dependencies
    if (-not $SkipDependencyCheck) {
        Write-Host "Step 3: Checking dependencies..." -ForegroundColor Blue
        if (-not (Test-Path "node_modules") -or -not (Test-Path "node_modules\.bin")) {
            Write-Host "Installing dependencies..." -ForegroundColor Yellow
            $installResult = & $npmExe install 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "npm install output:" -ForegroundColor Red
                Write-Host $installResult -ForegroundColor Red
                throw "npm install failed with exit code $LASTEXITCODE"
            }
            Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
        } else {
            Write-Host "✓ Dependencies already installed" -ForegroundColor Green
        }
    } else {
        Write-Host "Step 3: Skipping dependency check (--SkipDependencyCheck)" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Step 4: Check port availability
    Write-Host "Step 4: Checking port availability..." -ForegroundColor Blue
    if (-not (Test-Port $targetPort)) {
        Write-Host "Port $targetPort is in use. Attempting to free it..." -ForegroundColor Yellow
        Stop-ProcessOnPort $targetPort
        Start-Sleep -Seconds 3
        
        if (-not (Test-Port $targetPort)) {
            Write-Host "Warning: Port $targetPort may still be in use" -ForegroundColor Yellow
        } else {
            Write-Host "✓ Port $targetPort is now available" -ForegroundColor Green
        }
    } else {
        Write-Host "✓ Port $targetPort is available" -ForegroundColor Green
    }
    Write-Host ""
    
    # Step 5: Verify configuration files
    Write-Host "Step 5: Verifying configuration..." -ForegroundColor Blue
    $configFiles = @(".env.local", "package.json", "next.config.js")
    foreach ($file in $configFiles) {
        if (Test-Path $file) {
            Write-Host "✓ Found: $file" -ForegroundColor Green
        } else {
            Write-Host "⚠ Missing: $file" -ForegroundColor Yellow
        }
    }
    
    # Check .env.local for Supabase config
    if (Test-Path ".env.local") {
        $envContent = Get-Content ".env.local" -Raw
        if ($envContent -match "NEXT_PUBLIC_SUPABASE_URL=https://sqdxvtztjczklmqckmwl.supabase.co") {
            Write-Host "✓ Correct Supabase URL configured" -ForegroundColor Green
        } else {
            Write-Host "⚠ Supabase URL may need verification" -ForegroundColor Yellow
        }
    }
    Write-Host ""
    
    # Step 6: Start the development server
    Write-Host "Step 6: Starting Command Center..." -ForegroundColor Blue
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "🚀 Starting Unit Talk Command Center" -ForegroundColor Green
    Write-Host "🌐 URL: http://localhost:$targetPort" -ForegroundColor Green
    Write-Host "⏹️  Press Ctrl+C to stop the server" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    
    # Set environment variables for the npm process
    $env:NODE_ENV = "development"
    $env:PORT = $targetPort.ToString()
    
    # Start the server with explicit path resolution
    $npmRunDev = & $npmExe run dev 2>&1
    
} catch {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "❌ ERROR: Failed to start Command Center" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Ensure Node.js is installed: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "2. Try running: npm install" -ForegroundColor Yellow
    Write-Host "3. Check if port $targetPort is available" -ForegroundColor Yellow
    Write-Host "4. Run with -Verbose for more details" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}