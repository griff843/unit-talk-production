# Complete Command Center Fix Script
Write-Host "🚨 CRITICAL FIX: Rebuilding Command Center from scratch..." -ForegroundColor Red

# Navigate to Command Center directory
$commandCenterPath = "C:\Users\griff\Desktop\Unit Talk Production v3\unit-talk-command-center"
Set-Location $commandCenterPath

Write-Host "Step 1: Killing all Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Step 2: Removing corrupted node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✅ node_modules removed" -ForegroundColor Green
}

Write-Host "Step 3: Removing package locks..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "✅ package-lock.json removed" -ForegroundColor Green
}

Write-Host "Step 4: Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force

Write-Host "Step 5: Fresh installation..." -ForegroundColor Yellow
npm install --no-package-lock --legacy-peer-deps

Write-Host "Step 6: Installing specific Radix UI components..." -ForegroundColor Yellow
npm install @radix-ui/react-dialog@latest @radix-ui/react-label@latest --legacy-peer-deps

Write-Host "Step 7: Verifying installation..." -ForegroundColor Yellow
if (Test-Path "node_modules/@radix-ui/react-dialog") {
    Write-Host "✅ Dialog component installed" -ForegroundColor Green
} else {
    Write-Host "❌ Dialog component missing" -ForegroundColor Red
}

if (Test-Path "node_modules/@radix-ui/react-label") {
    Write-Host "✅ Label component installed" -ForegroundColor Green
} else {
    Write-Host "❌ Label component missing" -ForegroundColor Red
}

Write-Host "Step 8: Starting development server..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
npm run dev

Write-Host "🎉 Command Center rebuild complete!" -ForegroundColor Green