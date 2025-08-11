# Fix common NPM and shell issues on Windows

Write-Host "Fixing common NPM issues on Windows..." -ForegroundColor Green

# 1. Clear npm cache
Write-Host "`n1. Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force

# 2. Set npm to use cmd.exe instead of Git Bash
Write-Host "`n2. Configuring npm to use cmd.exe..." -ForegroundColor Yellow
npm config set script-shell "cmd.exe"

# 3. Remove and reinstall problematic packages
Write-Host "`n3. Fixing cross-env and other Windows-problematic packages..." -ForegroundColor Yellow

$apps = @(
    ".\apps\api",
    ".\apps\command-center", 
    ".\apps\dashboard",
    ".\apps\discord-bot",
    ".\apps\smart-form"
)

foreach ($app in $apps) {
    if (Test-Path $app) {
        Write-Host "`nFixing $app..." -ForegroundColor Cyan
        Set-Location $app
        
        # Remove cross-env if it exists and reinstall
        if (Test-Path ".\node_modules\cross-env") {
            npm uninstall cross-env
            npm install --save-dev cross-env
        }
        
        # Ensure Windows-compatible scripts
        if (Test-Path ".\node_modules\.bin") {
            # This ensures Windows .cmd files are properly generated
            npm rebuild
        }
        
        Set-Location ..\..\
    }
}

# 4. Set global npm configuration
Write-Host "`n4. Setting global npm configuration..." -ForegroundColor Yellow
npm config set msvs_version 2022
npm config set python python3

# 5. Fix Git Bash integration
Write-Host "`n5. Checking Git Bash integration..." -ForegroundColor Yellow
$gitPath = (Get-Command git -ErrorAction SilentlyContinue).Path
if ($gitPath) {
    Write-Host "Git found at: $gitPath" -ForegroundColor Green
} else {
    Write-Host "Git not found in PATH!" -ForegroundColor Red
}

Write-Host "`n✅ NPM issues fixed!" -ForegroundColor Green
Write-Host "`nYou can now use the START-*.bat files to launch apps reliably." -ForegroundColor Cyan

pause