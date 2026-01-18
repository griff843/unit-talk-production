# Install GitHub CLI (gh) on Windows
# Foundation tooling setup for Unit Talk Platform

$ErrorActionPreference = "Stop"

Write-Host "🔧 Installing GitHub CLI (gh)" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
Write-Host "1️⃣ Checking for existing installation..." -ForegroundColor Cyan
$ghPath = Get-Command gh -ErrorAction SilentlyContinue
if ($ghPath) {
    $version = gh --version 2>&1 | Select-String "gh version" | Out-String
    Write-Host "   ✅ GitHub CLI already installed: $version" -ForegroundColor Green
    Write-Host ""
    Write-Host "Skipping installation." -ForegroundColor Yellow
    exit 0
}

Write-Host "   ❌ GitHub CLI not found" -ForegroundColor Yellow
Write-Host ""

# Try winget first
Write-Host "2️⃣ Attempting installation via winget..." -ForegroundColor Cyan
$wingetPath = Get-Command winget -ErrorAction SilentlyContinue
if ($wingetPath) {
    Write-Host "   ✅ winget found" -ForegroundColor Green
    try {
        Write-Host "   Installing GitHub.cli..." -ForegroundColor Gray
        winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

        # Verify installation
        $ghPath = Get-Command gh -ErrorAction SilentlyContinue
        if ($ghPath) {
            $version = gh --version 2>&1 | Select-String "gh version" | Out-String
            Write-Host ""
            Write-Host "   ✅ GitHub CLI installed successfully!" -ForegroundColor Green
            Write-Host "   Version: $version" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "📋 Next Steps:" -ForegroundColor Cyan
            Write-Host "1. Close and reopen your terminal" -ForegroundColor White
            Write-Host "2. Run: gh auth login" -ForegroundColor White
            Write-Host "3. Verify: gh auth status" -ForegroundColor White
            exit 0
        } else {
            Write-Host "   ⚠️  Installation completed but gh not found in PATH" -ForegroundColor Yellow
            Write-Host "   Please restart your terminal and try again" -ForegroundColor Yellow
            exit 0
        }
    } catch {
        Write-Host "   ❌ winget installation failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ winget not available" -ForegroundColor Yellow
}

# Try chocolatey
Write-Host ""
Write-Host "3️⃣ Attempting installation via Chocolatey..." -ForegroundColor Cyan
$chocoPath = Get-Command choco -ErrorAction SilentlyContinue
if ($chocoPath) {
    Write-Host "   ✅ Chocolatey found" -ForegroundColor Green
    try {
        Write-Host "   Installing gh..." -ForegroundColor Gray
        choco install gh -y

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

        # Verify installation
        $ghPath = Get-Command gh -ErrorAction SilentlyContinue
        if ($ghPath) {
            $version = gh --version 2>&1 | Select-String "gh version" | Out-String
            Write-Host ""
            Write-Host "   ✅ GitHub CLI installed successfully!" -ForegroundColor Green
            Write-Host "   Version: $version" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "📋 Next Steps:" -ForegroundColor Cyan
            Write-Host "1. Run: gh auth login" -ForegroundColor White
            Write-Host "2. Verify: gh auth status" -ForegroundColor White
            exit 0
        } else {
            Write-Host "   ⚠️  Installation completed but gh not found in PATH" -ForegroundColor Yellow
            Write-Host "   Please restart your terminal and try again" -ForegroundColor Yellow
            exit 0
        }
    } catch {
        Write-Host "   ❌ Chocolatey installation failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Chocolatey not available" -ForegroundColor Yellow
}

# Manual installation instructions
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
Write-Host "❌ AUTOMATED INSTALLATION FAILED" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
Write-Host ""
Write-Host "Neither winget nor Chocolatey is available on this system." -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 MANUAL INSTALLATION REQUIRED:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Install via MSI (Recommended)" -ForegroundColor White
Write-Host "1. Download from: https://github.com/cli/cli/releases/latest" -ForegroundColor Gray
Write-Host "2. Look for: gh_X.X.X_windows_amd64.msi" -ForegroundColor Gray
Write-Host "3. Run the installer" -ForegroundColor Gray
Write-Host "4. Restart your terminal" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Install Winget first" -ForegroundColor White
Write-Host "1. Install from Microsoft Store: 'App Installer'" -ForegroundColor Gray
Write-Host "2. Then run this script again" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 3: Install Chocolatey first" -ForegroundColor White
Write-Host "1. Open PowerShell as Administrator" -ForegroundColor Gray
Write-Host "2. Run: Set-ExecutionPolicy Bypass -Scope Process -Force" -ForegroundColor Gray
Write-Host "3. Run: iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" -ForegroundColor Gray
Write-Host "4. Then run this script again" -ForegroundColor Gray
Write-Host ""

exit 1
