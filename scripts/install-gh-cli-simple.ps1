# Install GitHub CLI (gh) on Windows - Simplified Version
# Foundation tooling setup for Unit Talk Platform

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " GitHub CLI (gh) Installation for Unit Talk Platform" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if already installed
Write-Host "[1/3] Checking for existing installation..." -ForegroundColor Yellow
$existing = Get-Command gh -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host "SUCCESS: GitHub CLI is already installed!" -ForegroundColor Green
    $versionOutput = & gh --version 2>&1
    Write-Host $versionOutput -ForegroundColor Gray
    Write-Host ""
    Write-Host "You can proceed to authentication step." -ForegroundColor White
    exit 0
}

Write-Host "GitHub CLI not found. Proceeding with installation..." -ForegroundColor Yellow
Write-Host ""

# Step 2: Try winget
Write-Host "[2/3] Attempting installation via winget..." -ForegroundColor Yellow
$wingetExists = Get-Command winget -ErrorAction SilentlyContinue

if ($wingetExists) {
    Write-Host "winget found. Installing GitHub.cli..." -ForegroundColor Gray

    try {
        & winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements

        Write-Host ""
        Write-Host "Installation via winget completed!" -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANT: Please close this terminal and open a new one" -ForegroundColor Yellow
        Write-Host "Then run: gh --version" -ForegroundColor White
        Write-Host ""
        exit 0

    } catch {
        Write-Host "WARNING: winget installation encountered an error:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host "Trying alternative methods..." -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "winget not available on this system" -ForegroundColor Gray
    Write-Host ""
}

# Step 3: Try chocolatey
Write-Host "[3/3] Attempting installation via Chocolatey..." -ForegroundColor Yellow
$chocoExists = Get-Command choco -ErrorAction SilentlyContinue

if ($chocoExists) {
    Write-Host "Chocolatey found. Installing gh..." -ForegroundColor Gray

    try {
        & choco install gh -y

        Write-Host ""
        Write-Host "Installation via Chocolatey completed!" -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANT: Please close this terminal and open a new one" -ForegroundColor Yellow
        Write-Host "Then run: gh --version" -ForegroundColor White
        Write-Host ""
        exit 0

    } catch {
        Write-Host "WARNING: Chocolatey installation encountered an error:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "Chocolatey not available on this system" -ForegroundColor Gray
    Write-Host ""
}

# No package manager available - manual installation required
Write-Host "================================================================" -ForegroundColor Red
Write-Host " MANUAL INSTALLATION REQUIRED" -ForegroundColor Red
Write-Host "================================================================" -ForegroundColor Red
Write-Host ""
Write-Host "Neither winget nor Chocolatey is available." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please install GitHub CLI manually:" -ForegroundColor White
Write-Host ""
Write-Host "1. Download the MSI installer from:" -ForegroundColor White
Write-Host "   https://github.com/cli/cli/releases/latest" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Look for: gh_X.X.X_windows_amd64.msi" -ForegroundColor White
Write-Host ""
Write-Host "3. Run the installer" -ForegroundColor White
Write-Host ""
Write-Host "4. After installation, close and reopen your terminal" -ForegroundColor White
Write-Host ""
Write-Host "5. Verify with: gh --version" -ForegroundColor White
Write-Host ""

exit 1
