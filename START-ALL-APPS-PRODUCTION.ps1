# Unit Talk Production v3.0 - Robust Application Startup Script
# Handles port conflicts, process cleanup, and health checks

Write-Host "🚀 Unit Talk Production v3.0 - Application Launcher" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Function to kill processes on a specific port
function Clear-Port {
    param($port)
    Write-Host "🧹 Clearing port $port..." -ForegroundColor Yellow
    
    # Find and kill process using the port
    $processId = netstat -ano | findstr ":$port" | Select-String "LISTENING" | ForEach-Object {
        $_.ToString().Trim() -split '\s+' | Select-Object -Last 1
    } | Select-Object -Unique
    
    if ($processId) {
        foreach ($pid in $processId) {
            if ($pid -ne "0") {
                try {
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    Write-Host "  ✅ Killed process $pid on port $port" -ForegroundColor Green
                } catch {
                    Write-Host "  ⚠️ Could not kill process $pid" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "  ✅ Port $port is already free" -ForegroundColor Green
    }
}

# Function to clean build directories
function Clear-BuildCache {
    param($appPath)
    $nextPath = Join-Path $appPath ".next"
    
    if (Test-Path $nextPath) {
        Write-Host "🧹 Cleaning build cache for $appPath..." -ForegroundColor Yellow
        try {
            # Force remove with retries
            $retries = 3
            while ($retries -gt 0 -and (Test-Path $nextPath)) {
                Remove-Item -Path $nextPath -Recurse -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
                $retries--
            }
            
            if (-not (Test-Path $nextPath)) {
                Write-Host "  ✅ Build cache cleaned" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️ Could not fully clean build cache" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ⚠️ Error cleaning build cache: $_" -ForegroundColor Yellow
        }
    }
}

# Function to wait for app to be ready
function Wait-ForApp {
    param($port, $appName, $maxAttempts = 30)
    
    Write-Host "⏳ Waiting for $appName to start on port $port..." -ForegroundColor Yellow
    
    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "  ✅ $appName is ready!" -ForegroundColor Green
                return $true
            }
        } catch {
            Write-Host "  ⏳ Attempt $i/$maxAttempts..." -NoNewline
            Start-Sleep -Seconds 2
        }
    }
    
    Write-Host "  ❌ $appName failed to start!" -ForegroundColor Red
    return $false
}

# Kill all Node processes first
Write-Host "`n🛑 Stopping all Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Clear all required ports
$ports = @{
    "Command Center" = 3020
    "Smart Form" = 3021
    "Dashboard" = 3022
    "API Server" = 3001
}

foreach ($app in $ports.Keys) {
    Clear-Port -port $ports[$app]
}

# Clean build caches if requested
$cleanCache = Read-Host "`nClean build caches? (y/n)"
if ($cleanCache -eq 'y') {
    Clear-BuildCache -appPath ".\apps\command-center"
    Clear-BuildCache -appPath ".\apps\smart-form"
    Clear-BuildCache -appPath ".\apps\dashboard"
}

Write-Host "`n🚀 Starting all applications..." -ForegroundColor Cyan

# Start Command Center
Write-Host "`n📊 Starting Command Center on port 3020..." -ForegroundColor Blue
$env:PORT = 3020
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '.\apps\command-center'; npm run dev" -WorkingDirectory $PWD

# Start Smart Form
Write-Host "📝 Starting Smart Form on port 3021..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '.\apps\smart-form'; $env:PORT=3021; npm run dev" -WorkingDirectory $PWD

# Start Dashboard
Write-Host "🎯 Starting Dashboard on port 3022..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '.\apps\dashboard'; $env:PORT=3022; npm run dev" -WorkingDirectory $PWD

# Start API Server
Write-Host "🔧 Starting API Server on port 3001..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '.\apps\api'; npm run dev" -WorkingDirectory $PWD

# Wait for all apps to be ready
Write-Host "`n⏳ Waiting for all applications to start..." -ForegroundColor Yellow

$allReady = $true
foreach ($app in $ports.Keys) {
    $ready = Wait-ForApp -port $ports[$app] -appName $app
    if (-not $ready) {
        $allReady = $false
    }
}

if ($allReady) {
    Write-Host "`n✅ All applications started successfully!" -ForegroundColor Green
    Write-Host "`n🌐 Application URLs:" -ForegroundColor Cyan
    Write-Host "  📊 Command Center: http://localhost:3020" -ForegroundColor White
    Write-Host "  📝 Smart Form:     http://localhost:3021/submit-ticket" -ForegroundColor White
    Write-Host "  🎯 Dashboard:      http://localhost:3022" -ForegroundColor White
    Write-Host "  🔧 API Server:     http://localhost:3001" -ForegroundColor White
    
    Write-Host "`n📱 To test Smart Form pick submission:" -ForegroundColor Yellow
    Write-Host "  1. Visit http://localhost:3021/submit-ticket" -ForegroundColor White
    Write-Host "  2. Select a capper and sport" -ForegroundColor White
    Write-Host "  3. Choose bet type and details" -ForegroundColor White
    Write-Host "  4. Submit your pick!" -ForegroundColor White
} else {
    Write-Host "`n⚠️ Some applications failed to start. Check the individual windows for errors." -ForegroundColor Red
}

Write-Host "`n💡 Press Enter to open all applications in browser..." -ForegroundColor Yellow
Read-Host

# Open all apps in browser
Start-Process "http://localhost:3020"
Start-Process "http://localhost:3021/submit-ticket"
Start-Process "http://localhost:3022"

Write-Host "`n✅ Script complete. Applications are running in separate windows." -ForegroundColor Green
Write-Host "🛑 To stop all apps, close this window or press Ctrl+C" -ForegroundColor Yellow

# Keep script running
Read-Host "Press Enter to exit"