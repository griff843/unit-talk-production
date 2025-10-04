# Unit Talk Schedulers - PM2 Start Script (Windows-Safe)
# Idempotent: Safe to run multiple times

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Unit Talk Schedulers with PM2" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Check if PM2 is installed
try {
    $pm2Version = pm2 --version 2>$null
    Write-Host "✅ PM2 installed: $pm2Version" -ForegroundColor Green
} catch {
    Write-Host "❌ PM2 not found. Installing globally..." -ForegroundColor Red
    npm install -g pm2
    Write-Host "✅ PM2 installed successfully" -ForegroundColor Green
}

# Get repo root (assume script is in scripts/ops/)
$repoRoot = Resolve-Path "$PSScriptRoot\..\.."
Write-Host "📁 Repo root: $repoRoot" -ForegroundColor Gray

# Check if schedulers are already running
$existingProcess = pm2 list | Select-String "unit-talk-schedulers"
if ($existingProcess) {
    Write-Host "⚠️  Schedulers already running. Restarting..." -ForegroundColor Yellow
    pm2 restart unit-talk-schedulers
    Write-Host "✅ Schedulers restarted" -ForegroundColor Green
} else {
    Write-Host "🔄 Starting schedulers for the first time..." -ForegroundColor Cyan

    # Start with PM2
    pm2 start "$repoRoot\apps\api\src\scripts\schedulers\liveLoops.ts" `
        --name unit-talk-schedulers `
        --interpreter npx `
        --interpreter-args tsx `
        --cwd "$repoRoot" `
        --time `
        --watch false

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Schedulers started successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to start schedulers (exit code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
}

# Save PM2 configuration (for auto-restart after reboot)
Write-Host "💾 Saving PM2 configuration..." -ForegroundColor Cyan
pm2 save

# Show status
Write-Host "`n📊 Current PM2 status:" -ForegroundColor Cyan
pm2 list

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Schedulers running. Use 'pm2 logs unit-talk-schedulers' to view logs." -ForegroundColor Green
Write-Host "🛑 To stop: pm2 stop unit-talk-schedulers" -ForegroundColor Gray
Write-Host "🔄 To restart: pm2 restart unit-talk-schedulers" -ForegroundColor Gray
Write-Host "📊 To monitor: pm2 monit" -ForegroundColor Gray
