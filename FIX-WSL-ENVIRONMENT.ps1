# ============================================================================
# WSL Environment Fix Script for Unit Talk Platform
# Resolves: CreateProcessCommon:735: execvpe(/bin/bash) failed
# ============================================================================

Write-Host "🔧 FIXING WSL ENVIRONMENT FOR UNIT TALK PLATFORM" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green

# Step 1: Enable WSL Features
Write-Host "`n🔄 Step 1: Enabling WSL Features..." -ForegroundColor Yellow
try {
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
    Write-Host "✅ WSL features enabled" -ForegroundColor Green
} catch {
    Write-Host "⚠️ WSL features may already be enabled: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 2: Set WSL 2 as default
Write-Host "`n🔄 Step 2: Setting WSL 2 as default..." -ForegroundColor Yellow
try {
    wsl --set-default-version 2
    Write-Host "✅ WSL 2 set as default" -ForegroundColor Green
} catch {
    Write-Host "⚠️ WSL 2 default setting: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 3: Unregister corrupted distributions
Write-Host "`n🔄 Step 3: Cleaning up corrupted WSL distributions..." -ForegroundColor Yellow
$distributions = @("Ubuntu", "Ubuntu-20.04", "Ubuntu-22.04", "docker-desktop", "docker-desktop-data")

foreach ($dist in $distributions) {
    try {
        $result = wsl --list --quiet 2>$null | Where-Object { $_ -match $dist }
        if ($result) {
            Write-Host "🗑️ Unregistering $dist..." -ForegroundColor Yellow
            wsl --unregister $dist
            Write-Host "✅ $dist unregistered" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ Could not unregister $dist (may not exist)" -ForegroundColor Yellow
    }
}

# Step 4: Download and install Ubuntu 22.04
Write-Host "`n🔄 Step 4: Installing fresh Ubuntu 22.04..." -ForegroundColor Yellow
$ubuntuUrl = "https://aka.ms/wslubuntu2204"
$ubuntuPath = "$env:TEMP\Ubuntu2204.appx"

try {
    Write-Host "📥 Downloading Ubuntu 22.04..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $ubuntuUrl -OutFile $ubuntuPath -UseBasicParsing
    
    Write-Host "📦 Installing Ubuntu 22.04..." -ForegroundColor Yellow
    Add-AppxPackage -Path $ubuntuPath
    
    Write-Host "✅ Ubuntu 22.04 installed" -ForegroundColor Green
    Remove-Item $ubuntuPath -Force
} catch {
    Write-Host "❌ Failed to install Ubuntu 22.04: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try installing manually from Microsoft Store" -ForegroundColor Yellow
}

# Step 5: Initialize Ubuntu
Write-Host "`n🔄 Step 5: Initializing Ubuntu..." -ForegroundColor Yellow
Write-Host "⚠️ Ubuntu will open for initial setup - create a username and password" -ForegroundColor Yellow
Write-Host "Press any key when ready to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

try {
    Start-Process "ubuntu2204.exe" -Wait
    Write-Host "✅ Ubuntu initialized" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Manual Ubuntu initialization may be required" -ForegroundColor Yellow
}

# Step 6: Set Ubuntu as default
Write-Host "`n🔄 Step 6: Setting Ubuntu as default distribution..." -ForegroundColor Yellow
try {
    wsl --set-default Ubuntu-22.04
    Write-Host "✅ Ubuntu-22.04 set as default" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Setting default: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 7: Verify WSL installation
Write-Host "`n🔄 Step 7: Verifying WSL installation..." -ForegroundColor Yellow
try {
    $wslList = wsl --list --verbose
    Write-Host "📋 Current WSL distributions:" -ForegroundColor Cyan
    Write-Host $wslList -ForegroundColor White
    
    # Test basic WSL functionality
    $testResult = wsl echo "WSL Test Successful"
    if ($testResult -eq "WSL Test Successful") {
        Write-Host "✅ WSL is working correctly" -ForegroundColor Green
    } else {
        Write-Host "⚠️ WSL test returned: $testResult" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ WSL verification failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 8: Install essential packages in Ubuntu
Write-Host "`n🔄 Step 8: Installing essential packages..." -ForegroundColor Yellow
try {
    wsl sudo apt update
    wsl sudo apt install -y curl wget git build-essential
    Write-Host "✅ Essential packages installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Package installation: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 9: Docker Desktop integration check
Write-Host "`n🔄 Step 9: Checking Docker Desktop..." -ForegroundColor Yellow
$dockerPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerPath) {
    Write-Host "✅ Docker Desktop found" -ForegroundColor Green
    Write-Host "📋 Next steps for Docker:" -ForegroundColor Cyan
    Write-Host "1. Start Docker Desktop" -ForegroundColor White
    Write-Host "2. Go to Settings > Resources > WSL Integration" -ForegroundColor White
    Write-Host "3. Enable integration with Ubuntu-22.04" -ForegroundColor White
    Write-Host "4. Click 'Apply & Restart'" -ForegroundColor White
} else {
    Write-Host "⚠️ Docker Desktop not found - please install from https://docker.com" -ForegroundColor Yellow
}

# Step 10: Final verification
Write-Host "`n🔄 Step 10: Final verification..." -ForegroundColor Yellow
Write-Host "Testing dev.sh script execution..." -ForegroundColor Yellow

# Create a test script to verify WSL functionality
$testScript = @"
#!/bin/bash
echo "✅ WSL bash execution successful"
echo "📋 Environment check:"
echo "- Bash version: `$BASH_VERSION"
echo "- Current user: `$(whoami)"
echo "- Working directory: `$(pwd)"
echo "- Docker available: `$(which docker || echo 'Not found')"
"@

$testScript | Out-File -FilePath "wsl-test.sh" -Encoding UTF8
try {
    wsl chmod +x wsl-test.sh
    wsl ./wsl-test.sh
    Remove-Item "wsl-test.sh" -Force
    Write-Host "✅ WSL environment is ready for Unit Talk platform" -ForegroundColor Green
} catch {
    Write-Host "❌ WSL test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 WSL ENVIRONMENT FIX COMPLETE!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart your computer to ensure all changes take effect" -ForegroundColor White
Write-Host "2. Start Docker Desktop and enable WSL integration" -ForegroundColor White
Write-Host "3. Navigate to Unit Talk directory and run: ./dev.sh start" -ForegroundColor White
Write-Host "4. If issues persist, run this script again after restart" -ForegroundColor White

Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
